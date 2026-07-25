# Chronicles of Eldoria 1.1.1 build report

**Release title:** The Memory Beneath  
**Build date:** 2026-07-25  
**Application version:** 1.1.1  
**Account schema:** 3  
**Character schema:** 7  
**Deployment target:** Static GitHub Pages-compatible installable PWA  
**Suggested commit:** `Overhaul rendering and add Memory Beneath quest arc`

## Result

The executable project implements the requested local-first overhaul rather than only documenting it. It contains the revised rendering pipeline, clipping and mobile repairs, interactive map, advanced planner, combat presentation layer, narrative quest runtime, three flagship quest chains and all endings, new skills, dungeons, expanded content, save migrations, recovery snapshots, PWA update flow, and future Supabase repository boundary.

## Delivered content

| Registry | Count |
|---|---:|
| Skills | 35 |
| Skill activities | 152 |
| Items | 171 |
| Regions | 17 |
| Travel routes | 24 |
| Factions | 10 |
| Enemies | 40 |
| Combat abilities | 8 |
| Structured encounters | 4 |
| Quests | 15 |
| Staged flagship quests | 3 |
| Flagship endings | 11 |
| Investigation scenes | 5 |
| Branching dungeons | 8 |
| Named NPCs | 15 |
| Animal species | 4 |
| Specialization tracks | 9 |
| Specialization choices | 27 |
| Skill milestone tracks | 9 |
| Skill milestones | 45 |
| Buildings | 11 |
| Settlement projects | 9 |
| Crops | 6 |
| Companions | 5 |
| Expeditions | 5 |
| Research projects | 11 |
| Voyages | 3 |
| World events | 10 |
| Achievements | 10 |
| Backgrounds | 5 |
| Difficulties | 5 |
| Rituals | 5 |
| Diplomacy actions | 4 |

## Rendering and clipping work

Implemented:

- Four-Hz deterministic simulation separated from visual animation.
- Independent `requestAnimationFrame` interpolation for activities, travel, health, combat, and timers.
- Stable main-view DOM during routine simulation.
- Structural signatures to reserve full renders for genuine structure changes.
- Transform-based progress and health bars.
- Combat event-presentation records separate from outcome calculation.
- Overflow-visible combat effect layers surrounding clipped card surfaces.
- Deferred combat-effect replay when a structural render occurs in the same frame.
- Full/reduced/minimal animation modes and reduced-motion support.
- Mobile-safe dialogs, item sheets, adaptive grids, safe-area spacing, and simplified navigation.
- Removal of forced browser zoom restrictions.
- Map fit, zoom, pan, pinch, keyboard control, route highlighting, marker states, and overlays without increasing document width.
- Local semantic SVG icons for primary skills, items, combatants, regions, quests, dungeons, and status types.

## Narrative runtime

Implemented reusable objective handlers for:

- Dialogue and remembered conversations.
- Inspection and environmental evidence.
- Skill interpretations.
- Sequence puzzles and hints.
- Alternate approaches and access routes.
- Command/personnel assignments.
- Combat objectives and ending encounters.
- Irreversible choices.
- Persistent decision tags.
- World-change application with source idempotency.
- Journal entries, evidence, recaps, consequences, and completed-ending records.
- Offline pause at decision gates.

### Flagship quest endings

**The Bell Beneath Crystal Lake**

1. Final Repose.
2. The Living Archive.
3. The Emerged Ruins.

**Seven Nights at the Wall**

1. The Memorial Stronghold.
2. The Open Eastern Road.
3. The Frontier Town.
4. The Scorched Frontier.

**The Names in the Ash**

1. Keeper of Names.
2. The Choir Embassy.
3. The Quiet Metal.
4. The Worker Council.

Each ending is tested for reachability, one-time rewards, world-state changes, and idempotency.

## New and expanded systems

- Animal Husbandry with stocking, feeding, health, happiness, product accumulation, collection, breeding, and offline completion.
- Ritualism with costs, regional restrictions, expiring modifiers, and purification/world effects.
- Diplomacy with reputation, leverage, treaties, persistent modifiers, and noncombat progression.
- Eight branching dungeons with route choices, hazards, lore, combat, bosses, supplies, checkpoints, completion history, and abandon controls.
- Nine specialization tracks and 45 milestone rewards.
- Advanced activity plans with estimates, per-input reserves, rare-drop stops, output deposits, return travel, and linked next actions.
- Item favorites, locks, protected reserves, notes, detailed sources/uses, comparisons, markets, salvage, and quest relevance.
- Global cross-content search.
- Local optional audio with independent master/effect/interface/notification controls.

## Save and migration work

- Account schema advanced to 3.
- Character schema advanced to 7.
- IndexedDB database version advanced to 2.
- Deterministic normalization and migration of older account and character structures.
- Legacy SimpleScape V15 character import.
- Recovery snapshots before migration and update activation.
- Manual snapshot creation and restoration UI.
- Local-storage fallback snapshots.
- Account and character import/export.
- Pending planner post-actions normalized and preserved.
- Three-slot account model retained.

No old save is intentionally reset or discarded. Invalid imported data is rejected with an error rather than silently accepted.

## Automated verification

`npm run check` completed successfully:

```text
61 tests passed
0 failed
14 JavaScript files passed syntax validation
Manifest, icons, screenshots, service worker, app shell, SQL references,
and relative asset paths passed static validation
```

Test coverage includes content references, all 152 skill actions, every enemy, combat, item transactions, travel, passive systems, every flagship ending, decision gates, dungeons, new skills, specializations, planner behavior, recovery snapshots, legacy migration, Supabase optimistic revisions, and PWA contracts.

## Browser and PWA verification

The browser suite ran against a GitHub Pages-style subdirectory:

```text
http://127.0.0.1:4174/Chronicles-of-Eldoria/
```

Result:

```text
25 checks passed
0 failed
120 route/viewport combinations passed
0 console or page errors
Offline controlled reload passed
```

Tested viewports:

```text
320×568
360×740
390×844
412×915
568×320
740×360
768×1024
1024×768
1366×768
1920×1080
2560×1440
7680×2160
```

Every viewport was exercised across Dashboard, Map, Skills, Combat, Quests, Town, Bank, Character, Collections, and Settings. No tested view produced page-level or main-view horizontal overflow.

The browser suite also verified:

- Map containment, transforms, overlays, markers, route highlighting, and keyboard controls.
- Planner estimates and conditions.
- Smooth visual interpolation.
- Stable dashboard DOM during routine ticks.
- Attack and support combat events.
- Non-clipping effect layers.
- Flagship quest journal and interactive staged objective rendering.
- Global narrative search.
- Local semantic icons.
- New town systems.
- Small-phone item modal containment.
- 150% text, reduced motion, high contrast, and browser zoom.
- Service-worker scope, control, caches, and offline reload.
- Manifest screenshot dimensions.

See `QA_REPORT.md` and `BROWSER_QA_REPORT.json`.

## PWA delivery

Included:

- Relative `start_url` and `scope`.
- Repository-subdirectory-safe imports, assets, worker, and service-worker registration.
- Versioned app-shell and runtime caches.
- Controlled update prompt.
- Recovery snapshot and save flush before update activation.
- Standard, maskable, and Apple touch icons.
- Verified desktop, map, and phone manifest screenshots.
- Offline app launch after initial successful load.
- GitHub Pages `.nojekyll` marker.

## Supabase readiness

Included but inactive:

- `AccountRepository` persistence contract.
- IndexedDB and fallback local repositories.
- `SupabaseAccountRepository`.
- `LocalFirstCloudAccountRepository`.
- Optimistic revision handling.
- Conflict error states.
- Row-level-security schema.
- Atomic account/profile/slot RPCs.
- Recovery snapshot table and policies.
- Rollout documentation.

No project URL, public key, service-role key, password, access token, refresh token, or other credential is included.

## Honest boundaries

The following require external infrastructure or a later production phase:

- A real Supabase project, Auth screens, and cloud activation.
- Server-authoritative trading, guild economies, global leaderboards, community seasons, or shared boss health.
- Native store packaging.
- Full commissioned illustration for every individual item and enemy definition.
- Localization at scale.
- Long-horizon economy tuning based on player telemetry.

These are not represented as secure completed client-only features.
