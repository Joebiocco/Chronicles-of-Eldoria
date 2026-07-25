# Optional Supabase rollout guide

The 1.1.1 game is fully playable without Supabase. Do not connect cloud persistence until the local release is stable on the production domain and a recovery/export process has been tested.

## Current boundary

Gameplay code works with an account object and never directly calls Supabase. Persistence passes through `AccountRepository`.

Current local stack:

```text
IndexedDbAccountRepository
  + LocalStorage fallback
  + PersistenceCoordinator
```

Available future stack:

```text
LocalFirstCloudAccountRepository
  local: IndexedDbAccountRepository
  cloud: SupabaseAccountRepository
```

Local is written first. A failed network write does not prevent play or destroy the local save.

## 1. Create a Supabase project

Create a project and keep these rules:

- Use only the browser-safe publishable/anon key in the PWA.
- Never put the service-role key in this repository, a GitHub Pages build, or browser storage.
- Enable Auth before accepting cloud saves.
- Keep row-level security enabled.

## 2. Apply the database migration

Run:

```text
supabase/migrations/001_initial_schema.sql
```

The migration creates:

- `eldoria_profiles` for account settings, active slot, content-pack metadata, and cloud revision.
- `eldoria_characters` for one JSON character document per user/slot.
- `eldoria_save_snapshots` for optional cloud recovery copies.
- Row-level-security policies bound to `auth.uid()`.
- Conflict-aware profile and atomic account-save RPCs.

Review the SQL against the current Supabase project before applying it. Treat migrations as production database changes.

## 3. Add Auth UI outside the engine

Implement sign-up, sign-in, sign-out, recovery, and session bootstrap in a separate authentication layer. The engine does not need to know the user ID.

After the Auth session is ready:

```js
import { createClient } from '@supabase/supabase-js';
import { IndexedDbAccountRepository } from './src/storage.js';
import {
  SupabaseAccountRepository,
  LocalFirstCloudAccountRepository,
} from './src/supabase-adapter.js';

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const { data: { user } } = await client.auth.getUser();

const repository = new LocalFirstCloudAccountRepository({
  localRepository: new IndexedDbAccountRepository(),
  cloudRepository: new SupabaseAccountRepository({
    client,
    userId: user.id,
  }),
});
```

Then supply that repository to `PersistenceCoordinator` during boot.

Do not modify the simulation engine to call Supabase.

## 4. First-device linking

A safe first-link flow should ask whether to:

- Upload the current local account.
- Download the existing cloud account.
- Export both before choosing.

Never silently overwrite one with the other merely because sign-in succeeded.

Create a local recovery snapshot before the first cloud pull or push.

## 5. Revisions and conflicts

`save_eldoria_account` compares `p_expected_revision` with the live cloud revision. A stale client receives a conflict instead of overwriting another device.

The adapter advances the in-memory account revision after a successful save so the same tab does not immediately create a false conflict.

Conflict UI should offer:

- Export local JSON.
- Export remote JSON.
- inspect character names, revisions, play time, updated timestamps, and ending/world-state summaries.
- keep local and snapshot remote.
- keep remote and snapshot local.

Do not automatically merge arbitrary character JSON. Currency spending, inventory movement, quest decisions, equipment, planner state, and world changes are not safely field-mergeable.

## 6. Offline writes

The local-first adapter preserves local progress and marks sync status as:

```text
synced
pending
offline
conflict
```

A production integration can retry:

- When `online` fires.
- On app foreground.
- After a manual Sync button.
- On a bounded exponential schedule.

Avoid an aggressive loop that keeps a mobile PWA awake.

## 7. Recovery snapshots

The local build already creates snapshots before migrations and PWA updates. A cloud-enabled build can also write selected snapshots to `eldoria_save_snapshots`.

Recommended policy:

- Manual named snapshots.
- Before conflict resolution.
- Before major save-schema migration.
- Bounded retention.
- User-controlled deletion.

Do not upload every autosave as a permanent snapshot.

## 8. Security and server authority

Cloud save storage protects availability, not competitive integrity. A user controls the browser and can edit local state before synchronizing it.

The following require server-owned validation or simulation:

- Player trading.
- Guild banks and shared projects.
- Competitive leaderboards.
- Shared world-boss health and rewards.
- Community seasons.
- Scarce global items or currencies.

Use Edge Functions or another authoritative service with authenticated requests, idempotency keys, server-side eligibility, and audit records. Do not calculate competitive rewards from uploaded character JSON alone.

## 9. Deployment secrets

For GitHub Pages, never commit real keys to source history. A browser publishable key is not a secret, but hard-coding it still couples environments. Prefer a controlled build/config injection process or a small public configuration file per environment.

The service-role key must remain server-side only.

## 10. Rollout checklist

1. Export local accounts from test devices.
2. Apply and review SQL in a nonproduction Supabase project.
3. Test RLS with two users.
4. Test new account, existing cloud account, and existing local account flows.
5. Test offline local saves and later retry.
6. Test simultaneous edits on two devices and explicit conflict handling.
7. Test recovery snapshot creation/restoration.
8. Test sign-out without deleting the local backup unexpectedly.
9. Verify no service-role key appears in source, network responses, or browser storage.
10. Only then enable cloud sync for production users.
