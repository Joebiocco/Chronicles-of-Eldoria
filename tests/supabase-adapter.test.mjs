import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CloudSaveConflictError,
  LocalFirstCloudAccountRepository,
  SupabaseAccountRepository,
} from '../src/supabase-adapter.js';
import { AccountRepository } from '../src/storage.js';
import { createEmptyAccount, createNewCharacter } from '../src/state.js';

class MemoryRepository extends AccountRepository {
  constructor() {
    super();
    this.saved = [];
  }

  async loadAccount() {
    return this.saved.at(-1)?.account || createEmptyAccount();
  }

  async saveAccount(account, options = {}) {
    const savedAt = Date.now();
    this.saved.push({ account: structuredClone(account), options, savedAt });
    return { savedAt, provider: 'memory', reason: options.reason || 'manual' };
  }

  async clearAccount() {
    this.saved = [];
  }
}

function createRpcClient() {
  const calls = [];
  return {
    calls,
    async rpc(name, args) {
      calls.push({ name, args: structuredClone(args) });
      return { data: Number(args.p_expected_revision || 0) + 1, error: null };
    },
  };
}

test('Supabase repository uses the atomic account RPC and advances the live revision', async () => {
  const client = createRpcClient();
  const repository = new SupabaseAccountRepository({ client, userId: '00000000-0000-0000-0000-000000000001' });
  const account = createEmptyAccount();
  account.slots[0] = createNewCharacter({ name: 'Cloud Tester' });
  account.activeSlot = 0;

  const first = await repository.saveAccount(account, { reason: 'test' });
  assert.equal(first.revision, 1);
  assert.equal(account.sync.revision, 1);
  assert.equal(account.sync.status, 'synced');
  assert.equal(client.calls[0].name, 'save_eldoria_account');
  assert.equal(client.calls[0].args.p_expected_revision, 0);
  assert.equal(client.calls[0].args.p_characters.length, 1);
  assert.equal(client.calls[0].args.p_characters[0].name, 'Cloud Tester');

  const second = await repository.saveAccount(account, { reason: 'test-again' });
  assert.equal(second.revision, 2);
  assert.equal(account.sync.revision, 2);
  assert.equal(client.calls[1].args.p_expected_revision, 1);
});

test('local-first cloud saves preserve the local account and expose pending sync state', async () => {
  const local = new MemoryRepository();
  const cloud = {
    async loadAccount() { throw new Error('offline'); },
    async saveAccount() { throw new Error('network unavailable'); },
    async clearAccount() {},
  };
  const repository = new LocalFirstCloudAccountRepository({ localRepository: local, cloudRepository: cloud });
  const account = createEmptyAccount();
  account.slots[0] = createNewCharacter({ name: 'Offline Tester' });

  const result = await repository.saveAccount(account, { reason: 'autosave' });
  assert.equal(account.sync.status, 'pending');
  assert.match(account.sync.lastError, /network unavailable/);
  assert.equal(result.provider, 'local (cloud pending)');
  assert.ok(local.saved.length >= 2, 'local state and pending sync metadata should both be committed');
});

test('local-first cloud conflicts are preserved for explicit conflict UX', async () => {
  const local = new MemoryRepository();
  const cloud = {
    async loadAccount() { return createEmptyAccount(); },
    async saveAccount() { throw new CloudSaveConflictError('remote revision changed'); },
    async clearAccount() {},
  };
  const repository = new LocalFirstCloudAccountRepository({ localRepository: local, cloudRepository: cloud });
  const account = createEmptyAccount();

  await repository.saveAccount(account);
  assert.equal(account.sync.status, 'conflict');
  assert.match(account.sync.lastError, /remote revision changed/);
});
