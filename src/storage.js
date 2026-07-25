import { ACCOUNT_SCHEMA_VERSION, createEmptyAccount, normalizeAccount } from './state.js';
import { SAVE_SCHEMA_VERSION } from './data.js';

const DB_NAME = 'eldoria-chronicles';
const DB_VERSION = 2;
const STORE_NAME = 'documents';
const ACCOUNT_KEY = 'account';
const FALLBACK_KEY = 'eldoria.account.v2';
const RECOVERY_PREFIX = 'recovery:';
const FALLBACK_RECOVERY_KEY = 'eldoria.recovery.v1';
const MAX_RECOVERY_SNAPSHOTS = 12;

export class AccountRepository {
  async loadAccount() {
    throw new Error('loadAccount() is not implemented.');
  }

  async saveAccount(_account, _options = {}) {
    throw new Error('saveAccount() is not implemented.');
  }

  async clearAccount() {
    throw new Error('clearAccount() is not implemented.');
  }

  async createRecoverySnapshot(_account, _reason = 'manual') {
    throw new Error('createRecoverySnapshot() is not implemented.');
  }

  async listRecoverySnapshots() { return []; }

  async restoreRecoverySnapshot(_id) {
    throw new Error('restoreRecoverySnapshot() is not implemented.');
  }
}

export class IndexedDbAccountRepository extends AccountRepository {
  constructor() {
    super();
    this.dbPromise = null;
    this.fallback = false;
  }

  async open() {
    if (this.fallback || !('indexedDB' in globalThis)) {
      this.fallback = true;
      return null;
    }
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Could not open IndexedDB.'));
      request.onblocked = () => reject(new Error('IndexedDB upgrade was blocked by another Eldoria tab.'));
    }).catch((error) => {
      console.warn('IndexedDB unavailable; using localStorage fallback.', error);
      this.fallback = true;
      return null;
    });
    return this.dbPromise;
  }

  async loadAccount() {
    const db = await this.open();
    if (!db) {
      try {
        const raw = localStorage.getItem(FALLBACK_KEY);
        if (!raw) return createEmptyAccount();
        const parsed = JSON.parse(raw);
        if (needsMigration(parsed)) await this.createRecoverySnapshot(parsed, 'pre-migration');
        return normalizeAccount(parsed);
      } catch (error) {
        console.warn('Could not read localStorage fallback.', error);
        return createEmptyAccount();
      }
    }
    const result = await transactionRequest(db, 'readonly', (store) => store.get(ACCOUNT_KEY));
    if (!result) return createEmptyAccount();
    if (needsMigration(result)) await this.createRecoverySnapshot(result, 'pre-migration');
    return normalizeAccount(result);
  }

  async saveAccount(account, options = {}) {
    const normalized = normalizeAccount(account);
    normalized.updatedAt = Date.now();
    const db = await this.open();
    if (!db) {
      localStorage.setItem(FALLBACK_KEY, JSON.stringify(normalized));
      return { savedAt: normalized.updatedAt, provider: 'localStorage', reason: options.reason || 'manual' };
    }
    await transactionRequest(db, 'readwrite', (store) => store.put(normalized, ACCOUNT_KEY));
    return { savedAt: normalized.updatedAt, provider: 'indexedDB', reason: options.reason || 'manual' };
  }

  async clearAccount() {
    const db = await this.open();
    localStorage.removeItem(FALLBACK_KEY);
    if (!db) return;
    await transactionRequest(db, 'readwrite', (store) => store.delete(ACCOUNT_KEY));
  }


  async createRecoverySnapshot(account, reason = 'manual') {
    const snapshot = {
      id: `${RECOVERY_PREFIX}${Date.now()}:${Math.random().toString(36).slice(2, 10)}`,
      kind: 'recovery-snapshot',
      reason,
      createdAt: Date.now(),
      account: structuredCloneSafe(account),
      accountSchemaVersion: Number(account?.schemaVersion) || 1,
      characterSchemaVersions: (account?.slots || []).filter(Boolean).map((slot) => Number(slot.schemaVersion) || 1),
    };
    const db = await this.open();
    if (!db) {
      const existing = readFallbackSnapshots();
      existing.unshift(snapshot);
      localStorage.setItem(FALLBACK_RECOVERY_KEY, JSON.stringify(existing.slice(0, MAX_RECOVERY_SNAPSHOTS)));
      return snapshot;
    }
    await transactionRequest(db, 'readwrite', (store) => store.put(snapshot, snapshot.id));
    await this.pruneRecoverySnapshots();
    return snapshot;
  }

  async listRecoverySnapshots() {
    const db = await this.open();
    if (!db) return readFallbackSnapshots();
    const entries = await transactionRequest(db, 'readonly', (store) => store.getAll());
    return (entries || [])
      .filter((entry) => entry?.kind === 'recovery-snapshot')
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  async restoreRecoverySnapshot(id) {
    const db = await this.open();
    let snapshot;
    if (!db) snapshot = readFallbackSnapshots().find((entry) => entry.id === id);
    else snapshot = await transactionRequest(db, 'readonly', (store) => store.get(id));
    if (!snapshot?.account) throw new Error('Recovery snapshot not found.');
    const restored = normalizeAccount(snapshot.account);
    await this.saveAccount(restored, { reason: `restore:${snapshot.reason || 'snapshot'}` });
    return restored;
  }

  async deleteRecoverySnapshot(id) {
    const db = await this.open();
    if (!db) {
      localStorage.setItem(FALLBACK_RECOVERY_KEY, JSON.stringify(readFallbackSnapshots().filter((entry) => entry.id !== id)));
      return;
    }
    await transactionRequest(db, 'readwrite', (store) => store.delete(id));
  }

  async pruneRecoverySnapshots() {
    const snapshots = await this.listRecoverySnapshots();
    for (const entry of snapshots.slice(MAX_RECOVERY_SNAPSHOTS)) await this.deleteRecoverySnapshot(entry.id);
  }
}

function transactionRequest(db, mode, operation) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    let request;
    try {
      request = operation(store);
    } catch (error) {
      reject(error);
      return;
    }
    transaction.oncomplete = () => resolve(request?.result);
    transaction.onerror = () => reject(transaction.error || request?.error || new Error('IndexedDB transaction failed.'));
    transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction was aborted.'));
  });
}

export class PersistenceCoordinator extends EventTarget {
  constructor({ repository, getAccount, autosaveSeconds = 20 }) {
    super();
    this.repository = repository;
    this.getAccount = getAccount;
    this.autosaveSeconds = Math.max(5, Number(autosaveSeconds) || 20);
    this.dirty = false;
    this.saving = false;
    this.pendingReason = 'autosave';
    this.lastSavedAt = null;
    this.timer = null;
    this.debounceTimer = null;
    this.channel = 'BroadcastChannel' in globalThis ? new BroadcastChannel('eldoria-save-channel') : null;
    this.handlePageHide = () => this.flush('pagehide').catch(() => {});
    this.handleVisibility = () => {
      if (document.visibilityState === 'hidden') this.flush('visibility').catch(() => {});
    };
  }

  start() {
    this.stop();
    this.timer = setInterval(() => {
      if (this.dirty) this.flush('autosave').catch((error) => this.emitStatus('error', error.message));
    }, this.autosaveSeconds * 1000);
    addEventListener('pagehide', this.handlePageHide);
    document.addEventListener('visibilitychange', this.handleVisibility);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.timer = null;
    this.debounceTimer = null;
    removeEventListener('pagehide', this.handlePageHide);
    document.removeEventListener('visibilitychange', this.handleVisibility);
  }

  setAutosaveSeconds(seconds) {
    this.autosaveSeconds = Math.max(5, Number(seconds) || 20);
    this.start();
  }

  markDirty(reason = 'change', { urgent = false } = {}) {
    this.dirty = true;
    this.pendingReason = reason;
    this.emitStatus('dirty', reason);
    if (urgent) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => this.flush(reason).catch((error) => this.emitStatus('error', error.message)), 120);
    }
  }

  async flush(reason = this.pendingReason || 'manual') {
    if (this.saving || !this.dirty) return null;
    this.saving = true;
    this.emitStatus('saving', reason);
    try {
      const account = this.getAccount();
      const result = await this.repository.saveAccount(account, { reason });
      this.lastSavedAt = result.savedAt || Date.now();
      if (account && typeof account === 'object') account.updatedAt = this.lastSavedAt;
      this.dirty = false;
      this.pendingReason = 'autosave';
      this.emitStatus('saved', result.provider || 'local');
      this.channel?.postMessage({ type: 'saved', accountId: account.id, at: this.lastSavedAt });
      return result;
    } catch (error) {
      this.emitStatus('error', error.message || 'Save failed.');
      throw error;
    } finally {
      this.saving = false;
      if (this.dirty && reason !== 'follow-up') setTimeout(() => this.flush('follow-up').catch(() => {}), 250);
    }
  }

  emitStatus(status, detail) {
    this.dispatchEvent(new CustomEvent('status', { detail: { status, detail, at: Date.now() } }));
  }
}


function needsMigration(account) {
  if (!account || typeof account !== 'object') return false;
  if ((Number(account.schemaVersion) || 1) < ACCOUNT_SCHEMA_VERSION) return true;
  return (account.slots || []).some((slot) => slot && (Number(slot.schemaVersion) || 1) < SAVE_SCHEMA_VERSION);
}

function structuredCloneSafe(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function readFallbackSnapshots() {
  try {
    const parsed = JSON.parse(localStorage.getItem(FALLBACK_RECOVERY_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
