# Chronicles of Eldoria — The Memory Beneath

**Release:** 1.1.1  
**Account save schema:** 3  
**Character save schema:** 7

Chronicles of Eldoria is a local-first fantasy idle RPG and installable progressive web app. It can be left running in the background, closed and resumed later through timestamp-based offline simulation, or played actively through combat abilities, map exploration, investigations, quest decisions, activity planning, dungeons, settlement management, and skill interactions.

Version 1.1.1 preserves the complete **Memory Beneath** overhaul and adds a phone-first layout repair: smoother rendering, clipping repairs, a zoomable map, an advanced activity planner, explicit combat presentation events, three substantial branching story quests, new skills and long-running systems, eight dungeons, save migrations, recovery snapshots, and a repository boundary prepared for optional Supabase cloud saves later.

The production game has no runtime package dependencies and can be hosted as static files.


## 1.1.1 mobile repair

The mobile interface was re-audited after reports that it felt compressed. This release changes only phone/tablet media rules and mobile-only notification behavior. Desktop retains its three-column shell and full activity header.

Phone improvements include:

- A 52px portrait header and 46px short-landscape header.
- More usable main-content height.
- A single newest notification instead of stacked toasts covering controls.
- Two-line page summaries and horizontally scrollable action rows.
- Compact map controls and overlay chips.
- Readable character resources, settings, tabs, item cards, and modal sheets.
- Correct mobile landscape behavior through 950px wide.

## Start locally

A service worker and JavaScript modules require HTTP. Do not open `index.html` directly through `file://`.

```bash
npm run serve
```

Open:

```text
http://localhost:8080/
```

Run all automated checks:

```bash
npm run check
```

The verified release result is:

```text
61 automated tests passed
Static PWA validation passed
14 common phone viewports tested
140 phone viewport/view combinations passed
0 mobile clipping or overflow failures
0 browser runtime errors
```

Run the phone-specific suite while the local server is running:

```bash
npm run mobile:qa
```

See [`MOBILE_FIX_REPORT.md`](MOBILE_FIX_REPORT.md), [`QA_REPORT.md`](QA_REPORT.md), and the machine-readable [`MOBILE_QA_REPORT.json`](MOBILE_QA_REPORT.json). The prior full desktop/tablet/PWA campaign remains archived in [`BROWSER_QA_REPORT.json`](BROWSER_QA_REPORT.json).

## Publish through GitHub’s website

This project is already configured for a repository subdirectory such as:

```text
https://joebiocco.github.io/Chronicles-of-Eldoria/
```

1. Extract the release ZIP.
2. Create a public GitHub repository named `Chronicles-of-Eldoria`.
3. On the empty repository page, choose **uploading an existing file** or **Add file → Upload files**.
4. Open the extracted folder that directly contains `index.html`.
5. Select and drag **everything inside that folder** into GitHub.
6. Confirm that `index.html`, `src`, and `assets` appear beside one another at the repository root.
7. Commit directly to `main`.
8. Open **Settings → Pages**.
9. Choose **Deploy from a branch → main → / (root)**.
10. Wait for the Pages deployment in the **Actions** tab to finish.

Do not upload only the ZIP, and do not nest the project inside another `eldoria-pwa` folder.

After replacing an older PWA at the same URL, clear the old service worker once:

1. Open the live game.
2. Press `F12` in Chrome or Edge.
3. Open **Application → Storage → Clear site data**.
4. Open **Application → Service Workers** and unregister the old worker if shown.
5. Reload with `Ctrl+Shift+R`.

Future releases use an in-game update prompt and create a recovery snapshot before activating a waiting service worker.

## Install the PWA

### Windows or macOS

Open the HTTPS site in Edge or Chrome and use **Install Chronicles of Eldoria** or **Install page as app**. The game opens in a standalone window and can be pinned to the desktop, taskbar, Dock, or Start menu.

### Android

Open the HTTPS site in Chrome and choose **Install app**. The in-game install button also appears when the browser exposes the installation prompt.

### iPhone or iPad

Open the site in Safari, choose **Share → Add to Home Screen**, and launch it from the new icon.

Once the app shell has loaded successfully, the installed game can reopen without a connection. Saves remain local to that browser profile unless exported or later synchronized through a configured cloud repository.

## Major content in 1.1.0

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
| Flagship staged quests | 3 |
| Flagship endings | 11 |
| Investigation scenes | 5 |
| Branching dungeons | 8 |
| Named NPCs | 15 |
| Animal species | 4 |
| Specialization tracks | 9, with 27 choices |
| Skill milestone tracks | 9, with 45 milestones |
| Buildings | 11 |
| Settlement projects | 9 |
| Crops | 6 |
| Companions | 5 |
| Expeditions | 5 |
| Research projects | 11 |
| Voyages | 3 |
| World events | 10 |
| Rituals | 5 |
| Diplomacy actions | 4 |

## The Memory Beneath story arc

The three flagship quests use staged objectives, dialogue, investigations, evidence, puzzles, alternate skill solutions, command assignments, combat encounters, irreversible decision gates, persistent journal recaps, and world-state changes.

### The Bell Beneath Crystal Lake

Investigate impossible currents, reconstruct a funeral song, enter Willowbrook’s altered archive, select a diving approach, explore the drowned settlement of Veyra’s Rest, find Lysa Vale, and decide whether to release, preserve, or sever the Heartglass memory nexus. The ending can purify Crystal Lake, establish a living archive, or expose the Emerged Ruins.

### Seven Nights at the Wall

Command Watchpost through seven nights of siege and political collapse. Personnel, supplies, wall strength, morale, refugees, Nera’s signals, Commander Thorne’s corruption, and the Crown’s abandonment order all influence the final defense. Watchpost can become a memorial stronghold, an open eastern route, a shared frontier town, or a scorched military frontier.

### The Names in the Ash

Investigate names vanishing from Stonehaven’s memorial, lead a specialist expedition through the sealed Deepforge levels, uncover the legal erasure of the Lost Shift, meet Keeper Rhun and the Forged Choir, and decide whether to separate the dead, give the Choir a body, destroy it, or let it collect its debt. Stonehaven’s government and production systems change accordingly.

Offline simulation never chooses an irreversible ending. It pauses and records that the player’s decision is required.

## Rendering and interface overhaul

The deterministic simulation still advances at four logical ticks per second, but visual presentation uses an independent `requestAnimationFrame` loop. This provides smooth action, travel, health, and combat interpolation without changing outcomes.

Routine simulation updates preserve stable page DOM instead of rebuilding the complete view. Structural renders are reserved for navigation, activity changes, quest-stage changes, and other genuine layout changes.

Additional interface systems include:

- Transform-based progress and health bars.
- Dedicated combat effect layers outside clipped card surfaces.
- Hit, miss, dodge, critical, heal, shield, cleanse, interrupt, status, telegraph, defeat, and rare-loot cues.
- Full, reduced, and minimal animation modes.
- Optional damage splats, screen shake, background motion, and local sound effects.
- Fit, zoom, pan, pinch, keyboard controls, route highlighting, and overlays on the world map.
- Adaptive inventory layout and mobile item-detail sheets.
- A five-destination mobile navigation bar.
- Scroll-safe, focus-trapped dialogs.
- High contrast, reduced motion, text scaling, visible focus, user zoom, and safe-area support.
- Global search across items, skills, activities, regions, quests, enemies, NPCs, factions, and lore.

## Activity planner

The planner can start an activity with conditions such as:

- Action count.
- Duration.
- Target skill level.
- Target action mastery.
- Minimum free inventory slots.
- Food and consumable reserves.
- Per-input material reserves.
- Stop after obtaining a selected item.
- Stop after a rare drop.
- Deposit produced outputs.
- Return to a preferred bank settlement.
- Start a linked next activity.

Before starting, it estimates duration, XP, XP per hour, output, inputs, and the likely stop condition. Estimates are explicitly approximate because rare drops, events, mastery, quality, hazards, and active interactions can alter results.

## Skills and long-running systems

The game includes gathering, production, combat, utility, and advanced skills, including the added:

- **Animal Husbandry:** pens, feed, health, happiness, products, treatment, breeding, inherited traits, and mount progression.
- **Ritualism:** bounded regional rites, offerings, purification, Heartglass effects, weather and danger modifiers, and expiring regional bonuses.
- **Diplomacy:** leverage, mediation, favors, treaties, faction relationships, and noncombat political progression.

Existing systems include Farming, Construction, Engineering, Leadership, companions, expeditions, research, projects, markets, contracts, trade routes, ships, voyages, world events, Slayer, four combat styles, equipment quality, affixes, salvage, loadouts, achievements, collections, bestiary records, and optional Chronicle prestige.

Dungeoneering is implemented as a branching activity system rather than a passive XP-only skill. The eight initial dungeons are:

1. Lower Deepforge Galleries.
2. Rootbound Sanctum.
3. Drowned Archive.
4. Hollow Warrens.
5. Obsidian Crucible.
6. Ashen Citadel.
7. Smuggler’s Undertide.
8. Tempest Graveyard.

## Save and offline model

The active persistence stack is:

```text
GameEngine
  → PersistenceCoordinator
    → IndexedDbAccountRepository
      → LocalStorage fallback when IndexedDB is unavailable
```

The account contains three character slots, settings, content-pack metadata, recovery snapshots, and cloud-sync metadata. Important behavior includes:

- IndexedDB autosave.
- Debounced and urgent transaction saves.
- `pagehide` and background saves.
- Account and character JSON export/import.
- Recovery snapshots before migrations and updates.
- Explicit account and character schema migrations.
- Import of the supplied SimpleScape V15 save shape.
- Deterministic, seedable simulation.
- Aggregated offline reports instead of one loop/notification per completed action.
- A Web Worker for large boot-time offline calculations.
- Offline pause at narrative decision gates.

Export account backups periodically. Clearing browser site data, removing the browser profile, or reinstalling the operating system can remove local saves.

## Project structure

```text
index.html                       Accessible app shell
styles.css                      Responsive presentation and animations
manifest.webmanifest            PWA metadata, icons, screenshots, shortcuts
sw.js                           Scoped app-shell/runtime service worker
simulation-worker.js            Large offline-simulation worker
src/
  main.js                       Boot, simulation clock, PWA registration
  data.js                       Core content registry and constants
  memory-content.js             Memory Beneath quests/content expansion
  engine.js                     Deterministic base simulation
  memory-systems.js             Narrative, planner, dungeon, new-skill systems
  state.js                      Schemas, migrations, normalization, legacy import
  storage.js                    Repository interface, IndexedDB, snapshots, autosave
  supabase-adapter.js           Optional cloud/local-first repositories
  ui.js                         Base views and interactions
  memory-ui.js                  Smooth rendering, map, story, planner, added UI
  audio.js                      Local generated audio manager
  utils.js                      XP, formatting, seeded RNG, identifiers, cloning
assets/
  eldoria-map.png               Supplied world artwork
  icons/ui/sprite.svg           Local semantic UI/content icon sprite
  audio/                        Locally generated WAV cues
  screenshot-*.png              Verified manifest screenshots
docs/
  ARCHITECTURE.md               System boundaries and data flow
  FEATURE_MATRIX.md             Implementation-status audit
  IMPLEMENTATION_NOTES.md       Release-specific implementation details
  ASSET_ATTRIBUTION.md          Asset provenance and licensing notes
  SUPABASE.md                   Optional cloud-save rollout
supabase/migrations/            Future Auth/RLS/cloud-save SQL
 tests/                          Engine, content, migration, system tests
 tools/                          Static server, validator, browser QA
```

## Supabase later

No gameplay code calls Supabase directly. Persistence is behind `AccountRepository`, with these implementations or contracts:

```text
IndexedDbAccountRepository (with an internal local-storage fallback)
SupabaseAccountRepository
LocalFirstCloudAccountRepository
```

The optional SQL migration creates profiles, three character slots, recovery snapshots, row-level security policies, and conflict-aware account-saving RPCs. Cloud activation requires a real Supabase project, Auth UI, a public browser key, and an explicit repository swap. No credentials are included in this release.

Cloud storage does not make client-computed game state trustworthy. Secure player trading, competitive leaderboards, guild economies, and shared world-boss health require authenticated, server-authoritative validation and are intentionally not presented as completed client-only features.

See [`docs/SUPABASE.md`](docs/SUPABASE.md).

## Documentation

- [`GITHUB_DEPLOY.md`](GITHUB_DEPLOY.md): browser-only repository replacement and Pages deployment.
- [`BUILD_REPORT.md`](BUILD_REPORT.md): exact delivered counts, verification, migrations, and boundaries.
- [`QA_REPORT.md`](QA_REPORT.md): automated and browser verification.
- [`docs/FEATURE_MATRIX.md`](docs/FEATURE_MATRIX.md): implementation audit against the overhaul specification.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): engine, rendering, save, quest, PWA, and cloud boundaries.
- [`docs/IMPLEMENTATION_NOTES.md`](docs/IMPLEMENTATION_NOTES.md): technical details and balance assumptions.
- [`docs/ASSET_ATTRIBUTION.md`](docs/ASSET_ATTRIBUTION.md): asset provenance and external-dependency statement.
- [`CHANGELOG.md`](CHANGELOG.md): release history.

## Current boundaries

The executable local/PWA overhaul is complete. The following are intentionally outside this static client release:

- Activation of a real Supabase project and login flow.
- Server-authoritative player trading, guild economies, global leaderboards, shared bosses, or seasons.
- Native App Store or Play Store packaging.
- Full commissioned illustration for every content definition; primary interface/content surfaces use a local semantic SVG system, while some authored data retains glyph fallbacks.
- Large-scale localization.
- Final economy tuning based on months of real player telemetry.

No Supabase credentials, API secrets, service-role keys, remote fonts, hotlinked art, or remote runtime scripts are included.
