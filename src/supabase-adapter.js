import { AccountRepository } from './storage.js';
import { createEmptyAccount, normalizeAccount } from './state.js';

/**
 * Optional remote adapter. The PWA intentionally does not bundle the Supabase
 * SDK, so local-only builds remain dependency-free. Pass an initialized client
 * after authentication:
 *
 *   const cloud = new SupabaseAccountRepository({ client, userId });
 *
 * The SQL contract is in supabase/migrations/001_initial_schema.sql.
 */
export class SupabaseAccountRepository extends AccountRepository {
  constructor({ client, userId, useAtomicRpc = true, useConflictRpc = true }) {
    super();
    if (!client) throw new Error('A Supabase client is required.');
    if (!userId) throw new Error('An authenticated Supabase user id is required.');
    this.client = client;
    this.userId = userId;
    this.useAtomicRpc = useAtomicRpc;
    this.useConflictRpc = useConflictRpc;
  }

  async loadAccount() {
    const [{ data: profile, error: profileError }, { data: rows, error: characterError }] = await Promise.all([
      this.client
        .from('eldoria_profiles')
        .select('account_id,settings,mods,active_slot,sync_revision,updated_at')
        .eq('user_id', this.userId)
        .maybeSingle(),
      this.client
        .from('eldoria_characters')
        .select('slot,state,revision,updated_at')
        .eq('user_id', this.userId)
        .order('slot'),
    ]);
    if (profileError) throw profileError;
    if (characterError) throw characterError;
    if (!profile && !rows?.length) return createEmptyAccount();

    const account = createEmptyAccount();
    account.id = profile?.account_id || account.id;
    account.activeSlot = Number.isInteger(profile?.active_slot) ? profile.active_slot : null;
    account.settings = { ...account.settings, ...(profile?.settings || {}) };
    account.mods = Array.isArray(profile?.mods) ? profile.mods : [];
    account.updatedAt = profile?.updated_at ? Date.parse(profile.updated_at) : Date.now();
    account.sync = {
      provider: 'supabase',
      userId: this.userId,
      status: 'synced',
      lastSyncedAt: Date.now(),
      revision: Number(profile?.sync_revision) || 0,
    };
    for (const row of rows || []) {
      if (row.slot >= 0 && row.slot < 3) account.slots[row.slot] = row.state;
    }
    return normalizeAccount(account);
  }

  async saveAccount(account, options = {}) {
    const normalized = normalizeAccount(account);
    const expectedRevision = Math.max(0, Number(normalized.sync?.revision) || 0);
    let nextRevision = expectedRevision + 1;
    const nowIso = new Date().toISOString();
    const rows = normalized.slots.flatMap((character, slot) => character ? [{
      user_id: this.userId,
      character_id: character.id,
      slot,
      name: character.name,
      revision: character.revision,
      state: character,
      updated_at: nowIso,
    }] : []);

    if (this.useAtomicRpc) {
      const characters = rows.map(({ character_id, slot, name, revision, state }) => ({
        character_id,
        slot,
        name,
        revision,
        state,
      }));
      const { data, error } = await this.client.rpc('save_eldoria_account', {
        p_account_id: normalized.id,
        p_settings: normalized.settings,
        p_mods: normalized.mods,
        p_active_slot: normalized.activeSlot,
        p_expected_revision: expectedRevision,
        p_characters: characters,
      });
      if (error) {
        if (error.code === '40001' || /conflict/i.test(error.message || '')) throw new CloudSaveConflictError(error.message);
        throw error;
      }
      nextRevision = Number(data) || nextRevision;
    } else {
      if (this.useConflictRpc) {
        const { data, error } = await this.client.rpc('save_eldoria_profile', {
          p_account_id: normalized.id,
          p_settings: normalized.settings,
          p_mods: normalized.mods,
          p_active_slot: normalized.activeSlot,
          p_expected_revision: expectedRevision,
        });
        if (error) {
          if (error.code === '40001' || /conflict/i.test(error.message || '')) throw new CloudSaveConflictError(error.message);
          throw error;
        }
        nextRevision = Number(data) || nextRevision;
      } else {
        const profilePayload = {
          user_id: this.userId,
          account_id: normalized.id,
          settings: normalized.settings,
          mods: normalized.mods,
          active_slot: normalized.activeSlot,
          sync_revision: nextRevision,
          updated_at: nowIso,
        };
        const { error } = await this.client.from('eldoria_profiles').upsert(profilePayload, { onConflict: 'user_id' });
        if (error) throw error;
      }

      if (rows.length) {
        const { error } = await this.client.from('eldoria_characters').upsert(rows, { onConflict: 'user_id,slot' });
        if (error) throw error;
      }

      const occupied = rows.map((row) => row.slot);
      let deleteQuery = this.client.from('eldoria_characters').delete().eq('user_id', this.userId);
      if (occupied.length) deleteQuery = deleteQuery.not('slot', 'in', `(${occupied.join(',')})`);
      const { error: deleteError } = await deleteQuery;
      if (deleteError) throw deleteError;
    }

    const savedAt = Date.now();
    const sync = {
      ...normalized.sync,
      provider: 'supabase',
      userId: this.userId,
      status: 'synced',
      revision: nextRevision,
      lastSyncedAt: savedAt,
      lastError: null,
    };
    // Persist the optimistic cloud revision on the live account as well as the
    // serialized copy. Without this, the next autosave from the same tab would
    // submit the previous expected revision and create a false conflict.
    if (account && typeof account === 'object') {
      account.sync = { ...sync };
      account.updatedAt = savedAt;
    }

    return {
      savedAt,
      provider: 'supabase',
      reason: options.reason || 'manual',
      revision: nextRevision,
      sync,
    };
  }

  async clearAccount() {
    const [characters, profile] = await Promise.all([
      this.client.from('eldoria_characters').delete().eq('user_id', this.userId),
      this.client.from('eldoria_profiles').delete().eq('user_id', this.userId),
    ]);
    if (characters.error) throw characters.error;
    if (profile.error) throw profile.error;
  }
}

/**
 * Local-first composite for the future authenticated build. Local persistence
 * is always committed first. A failed cloud write leaves the playable local
 * save intact and marks cloud sync as pending instead of losing progress.
 */
export class LocalFirstCloudAccountRepository extends AccountRepository {
  constructor({ localRepository, cloudRepository, conflictResolver = newestUpdatedAt }) {
    super();
    if (!localRepository || !cloudRepository) throw new Error('Both local and cloud repositories are required.');
    this.local = localRepository;
    this.cloud = cloudRepository;
    this.conflictResolver = conflictResolver;
  }

  async loadAccount() {
    const local = await this.local.loadAccount();
    try {
      const remote = await this.cloud.loadAccount();
      const chosen = normalizeAccount(await this.conflictResolver(local, remote));
      chosen.sync = {
        ...chosen.sync,
        provider: 'local+supabase',
        status: 'synced',
        lastSyncedAt: Date.now(),
      };
      await this.local.saveAccount(chosen, { reason: 'cloud-hydration' });
      return chosen;
    } catch (error) {
      local.sync = {
        ...local.sync,
        provider: 'local+supabase',
        status: error instanceof CloudSaveConflictError ? 'conflict' : 'offline',
        lastError: error?.message || String(error),
      };
      return local;
    }
  }

  async saveAccount(account, options = {}) {
    const normalized = normalizeAccount(account);
    const localResult = await this.local.saveAccount(normalized, options);
    try {
      const cloudResult = await this.cloud.saveAccount(normalized, options);
      normalized.sync = {
        ...normalized.sync,
        provider: 'local+supabase',
        status: 'synced',
        revision: cloudResult.revision,
        lastSyncedAt: cloudResult.savedAt,
        lastError: null,
      };
      normalized.updatedAt = cloudResult.savedAt || localResult.savedAt;
      if (account && typeof account === 'object') {
        account.sync = { ...normalized.sync };
        account.updatedAt = normalized.updatedAt;
      }
      await this.local.saveAccount(normalized, { reason: 'cloud-sync-metadata' });
      return { ...cloudResult, provider: 'local+supabase', localSavedAt: localResult.savedAt, sync: normalized.sync };
    } catch (error) {
      normalized.sync = {
        ...normalized.sync,
        provider: 'local+supabase',
        status: error instanceof CloudSaveConflictError ? 'conflict' : 'pending',
        lastError: error?.message || String(error),
      };
      normalized.updatedAt = localResult.savedAt;
      if (account && typeof account === 'object') {
        account.sync = { ...normalized.sync };
        account.updatedAt = normalized.updatedAt;
      }
      await this.local.saveAccount(normalized, { reason: 'cloud-sync-pending' });
      return {
        ...localResult,
        provider: 'local (cloud pending)',
        cloudError: normalized.sync.lastError,
        sync: normalized.sync,
      };
    }
  }

  async clearAccount() {
    await this.local.clearAccount();
    await this.cloud.clearAccount();
  }
}

export class CloudSaveConflictError extends Error {
  constructor(message = 'The cloud save changed on another device.') {
    super(message);
    this.name = 'CloudSaveConflictError';
  }
}

export function newestUpdatedAt(local, remote) {
  const localTime = Number(local?.updatedAt) || 0;
  const remoteTime = Number(remote?.updatedAt) || 0;
  return remoteTime > localTime ? remote : local;
}
