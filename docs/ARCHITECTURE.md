# Architecture

## Design goals

Chronicles of Eldoria is designed around four separations:

1. **Content is data.** Items, actions, enemies, regions, quests, NPCs, investigations, dungeons, rituals, and world changes are registries rather than hard-coded screens.
2. **Simulation is deterministic.** Game outcomes use elapsed timestamps and seedable random streams rather than trusting animation timing.
3. **Presentation is independent.** Visual interpolation and combat effects never determine damage, rewards, quest completion, or offline progress.
4. **Persistence is replaceable.** The engine depends on account state, not IndexedDB or Supabase APIs.

The executable release is a dependency-free static PWA. A future backend can replace the repository or validate selected events without rewriting the core engine.

## Boot flow

`src/main.js` performs the production boot sequence:

1. Create the local IndexedDB repository.
2. Load and normalize the account.
3. Run large elapsed-time catch-up through `simulation-worker.js` when appropriate.
4. Create `GameEngine` with the loaded account.
5. Create `PersistenceCoordinator` with a repository and account accessor.
6. Create `AppUI` and `AudioManager`.
7. Initialize the interface and autosave coordinator.
8. Process any remaining resume/offline work.
9. Start the four-Hz logical simulation timer.
10. Register the scoped service worker.
11. Expose a small frozen `window.eldoria` development surface.

The boot screen remains visible until the engine and UI are ready. Fatal boot errors render a retry action rather than leaving an indefinite loading message.

## Module map

### Content

`src/data.js`

- Core world registries.
- Application and character schema versions.
- Equipment slots.
- XP and automation constants.
- Content-pack application hooks.

`src/memory-content.js`

- The Memory Beneath staged quests.
- NPCs and investigation scenes.
- Regional variants and world changes.
- Additional skills, items, actions, enemies, research, projects, animals, rituals, diplomacy, dungeons, specializations, and milestones.

### Simulation

`src/engine.js`

- Inventory and bank transactions.
- Equipment.
- skill actions and mastery.
- travel.
- combat.
- farming, estate, projects, research, companions, economy, sailing, ordinary quests, collections, and prestige.
- elapsed-time simulation and offline reports.

`src/memory-systems.js`

- Staged narrative runtime.
- evidence, puzzles, alternate approaches, commands, decision gates, endings, and world changes.
- branching dungeons.
- Animal Husbandry, Ritualism, and Diplomacy.
- specializations and milestones.
- advanced activity planning and post-plan logistics.
- item preferences and inspection metadata.
- combat presentation-event emission.

`simulation-worker.js`

- Imports the same engine and data modules.
- advances a serialized account to a target time.
- returns the updated account and one aggregated report.
- keeps large resume calculations off the main UI thread.

### State and persistence

`src/state.js`

- Default account and character creation.
- normalization.
- account migrations.
- character migrations.
- legacy SimpleScape V15 import.
- recovery-compatible defaults.

`src/storage.js`

- `AccountRepository` abstract contract.
- `IndexedDbAccountRepository`.
- local-storage fallback.
- account export/import.
- recovery snapshot creation/list/restore/delete.
- `PersistenceCoordinator` autosave and status events.

`src/supabase-adapter.js`

- `SupabaseAccountRepository`.
- `LocalFirstCloudAccountRepository`.
- optimistic cloud revisions.
- conflict state.
- local-first save ordering.

### Presentation

`src/ui.js`

- App shell views.
- character gate.
- base dashboard, map, skills, combat, quests, town, bank, character, collections, and settings.
- common dialogs and actions.

`src/memory-ui.js`

- structural rendering signatures.
- smooth visual loop.
- transform-based bars.
- combat effect layers.
- advanced map controls.
- staged quest journal and objective interfaces.
- planner interface.
- item detail and global search.
- new town systems.
- update/recovery UI.
- local semantic icon enhancement.

`src/audio.js`

- user-gesture-safe local audio playback.
- settings-aware channel levels.
- no network audio requests.

## Simulation clock

The logical foreground clock calls:

```js
engine.advanceTo(Date.now(), { offline: false })
```

approximately every 250 milliseconds. The engine calculates elapsed time since `lastProcessedAt`; it does not assume that an interval fired on time.

When the page becomes visible after suspension, the same engine is called with offline aggregation enabled. Large boot-time gaps can run through the worker.

This means:

- Browser throttling does not permanently lose progress.
- Animation frame rate cannot increase production.
- Combat outcomes do not change because a phone renders at 30 Hz instead of 60 Hz.
- Tests can advance exact timestamps and reproduce outcomes.

## Rendering model

The game deliberately separates logical and visual updates.

### Structural renders

A structural signature contains the current major view plus state that genuinely changes the page’s shape, such as:

- Activity kind or target.
- quest stage/status.
- active dungeon node.
- town and bank tab.

Navigation, activity starts/stops, quest-stage changes, dungeon transitions, and world changes can rebuild the relevant view.

### Routine updates

Routine simulation updates do not replace the main root. They update:

- Progress transforms.
- HP transforms and labels.
- countdown labels.
- visible stack quantities.
- current activity text.

The QA suite pins the dashboard root node across a simulation window and verifies that it remains the same node.

### Visual loop

`requestAnimationFrame` reads stable logical state and interpolates the visible fraction between action boundaries. It does not mutate the game economy or quest state.

Progress bars use:

```css
transform: scaleX(...)
```

instead of layout-triggering width animation.

## Combat presentation events

The engine emits serializable events such as:

```js
{
  id,
  type: 'combat:round',
  sourceId,
  targetId,
  enemyDamage,
  playerDamage,
  result,
  playerResult,
  appliedPlayerStatuses,
  appliedEnemyStatuses,
  telegraphStarted,
  specialResolved,
  enemyDefeated,
  playerDefeated
}
```

Support abilities emit events such as:

```text
combat:healing
combat:cleanse
combat:interrupt
combat:shield
combat:ability
combat:rare-loot
```

The UI converts these into animations. If an action schedules a structural render in the same frame, the event is queued and replayed after the replacement combat DOM is enhanced. Therefore, an effect is not created and immediately erased.

Each combatant uses:

```text
combatant-card              overflow visible
  combatant-surface         clipped to rounded card
  combat-effect-layer       overflow visible, pointer-events none
```

This prevents hit splats, cue labels, recoil, and glows from clipping.

## Map architecture

The map uses a fixed artwork coordinate system with HTML/SVG overlays. A transformable layer is kept inside an `overflow: hidden` viewport.

Map state contains:

- Zoom.
- pan X/Y.
- initialization flag.

Controls include pointer drag, two-pointer pinch, wheel zoom, fit, center player, center selected region, and keyboard operation. The layer transform changes without increasing document width.

Region variants are saved world state. The selected variant changes text, services, activities, NPCs, faction ownership, modifiers, and markers; it is not only decorative.

## Narrative quest architecture

A staged quest contains:

```text
QuestDefinition
  prerequisites
  stages[]
    objectives[]
    entry/completion dialogue
    next stage
  endings[]
```

Objective handlers support:

- Talk.
- inspect.
- investigate.
- evidence.
- puzzle.
- approach.
- command assignment.
- combat.
- skill interaction.
- choice.

Per-character quest state stores:

- Status.
- stage index and ID.
- completed objectives.
- objective-specific data.
- evidence.
- conversations.
- journal entries.
- campaign variables.
- ending.
- decision tags.
- pending decision state.

`applyWorldChanges()` records source IDs so the same ending cannot apply a permanent mutation twice.

When an irreversible ending is available, offline simulation sets a decision gate and stops rather than selecting a branch.

## Activity planner architecture

A plan stores:

- Action ID.
- conditions.
- start timestamp and starting counters.
- per-input reserves.
- optional logistics.
- optional linked next plan.

The engine evaluates plan stop conditions after progress. Produced-output IDs are tracked so a completed plan can deposit only its intended output before travel or handoff.

Pending return/deposit operations are explicit normalized state, allowing the browser to save safely between completion and arrival.

## Transactions

Inventory operations validate the final state before committing. Equipment swaps, crafting inputs/outputs, deposits, withdrawals, salvage, and planner logistics avoid destroying items when a destination is full.

Protected reserves are checked when an activity consumes resources. They can be account-level item preferences or plan-specific input floors.

## Save schemas and migrations

Current versions:

```text
Account schema 3
Character schema 7
IndexedDB version 2
```

Load behavior:

1. Parse the document.
2. Detect account, character, or legacy format.
3. Create a recovery snapshot when migration is needed.
4. Apply each migration in sequence.
5. Normalize all required fields.
6. Validate slot boundaries and content state.
7. Return a current account.

Unknown or malformed saves are rejected rather than silently reset.

## PWA update model

`sw.js` owns a versioned app-shell cache and runtime cache. Registration uses:

```js
navigator.serviceWorker.register('./sw.js', {
  scope: './',
  updateViaCache: 'none'
})
```

When a worker reaches `waiting`, the UI offers an update. Before activation, the app:

- Flushes the current save.
- creates a recovery snapshot.
- sends `SKIP_WAITING` only after confirmation.

`controllerchange` reloads once, preventing a mixed-version session.

All app-shell paths are relative, so the same build works at a root domain or below `/Chronicles-of-Eldoria/`.

## Supabase boundary

The engine receives an account object and emits changes. It does not know how the account is stored.

A later authenticated build can replace:

```text
IndexedDbAccountRepository
```

with:

```text
LocalFirstCloudAccountRepository(
  local = IndexedDbAccountRepository,
  cloud = SupabaseAccountRepository
)
```

Local writes happen first. Cloud failures preserve the playable local save and expose `offline`, `pending`, or `conflict` sync state.

Arbitrary character JSON is not automatically field-merged. Inventory spending, quests, and world decisions cannot be safely reconciled without a defined policy.

## Trust boundary

The static client is authoritative only for the owner’s local single-player experience. Imported or modified JSON can change client state. Therefore:

- Cloud backup can store it.
- A private personal leaderboard can display it.
- Competitive rankings, trading, guild assets, and shared bosses must not trust it directly.

Those systems require signed-in users and server-owned validation or simulation.
