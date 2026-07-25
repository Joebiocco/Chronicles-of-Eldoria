# Changelog

## 1.1.1 — Mobile Layout Stabilization

- Rebuilt the phone header as a compact single-row layout below 680px, while retaining the full current-activity header on tablets and desktop.
- Reduced mobile header height from 113px to 52px in portrait and from roughly 105px to 46px in landscape.
- Reduced bottom-navigation height and removed unnecessary mobile content padding.
- Collapsed repetitive page eyebrows on phones, limited descriptions to two lines, and converted page actions into touch-friendly horizontal control rows.
- Prevented notification stacks from covering the play area: phones now show only the newest toast for a shorter duration.
- Made map controls and overlay chips horizontally scrollable instead of wrapping into tall, compressed toolbars.
- Improved mobile character panels, resource bars, settings grids, item grids, tabs, and bottom-sheet dialogs.
- Added dedicated short-screen landscape handling through 950px wide, covering Pixel- and iPhone-class landscape viewports without switching to the desktop sidebar layout.
- Added `tools/mobile-qa.py` and `npm run mobile:qa`.
- Verified 140 phone-resolution/view combinations across fourteen common portrait and landscape sizes with zero clipping, overflow, runtime, or modal-containment failures.
- Confirmed the desktop three-column shell, desktop activity header, sidebar, context drawer, and navigation behavior remain unchanged.

## 1.1.0 — The Memory Beneath

### Rendering, animation, and interface

- Separated the deterministic four-Hz simulation from a smooth `requestAnimationFrame` presentation loop.
- Added interpolated activity, travel, HP, enemy HP, and timer presentation.
- Preserved stable main-view DOM during routine simulation updates.
- Converted progress and health bars to transform-based animation.
- Added explicit combat presentation events and deferred effect replay across structural renders.
- Added attacks, recoil, hit splats, misses, dodges, criticals, heals, shields, cleanses, interrupts, status cues, telegraphs, defeat effects, and rare-loot cues.
- Moved effects outside clipped combat surfaces.
- Added full, reduced, and minimal animation quality settings.
- Repaired responsive clipping and horizontal-overflow risks across phone, tablet, desktop, and ultrawide layouts.
- Added mobile-safe item detail sheets, focus-trapped dialogs, keyboard focus, text scaling, high contrast, reduced motion, safe-area support, and user zoom.
- Replaced primary gameplay glyphs with a local semantic SVG sprite.
- Added optional locally generated audio cues and volume controls.

### World map

- Added fit, zoom, pan, pinch, center-player, center-selection, and keyboard controls.
- Added resource, quest, danger, faction, weather, event, trade, discovery, route, and dungeon overlays.
- Added selected and active route highlighting.
- Added zoom-aware labels and marker states.
- Added persistent quest-driven region variants for Crystal Lake, Watchpost, and Stonehaven.

### Narrative

- Added a staged quest engine with dialogue, investigations, evidence, skill interpretations, puzzles, alternate approaches, command phases, combat objectives, decision gates, recaps, and persistent world changes.
- Added **The Bell Beneath Crystal Lake**, with three endings.
- Added **Seven Nights at the Wall**, with four endings.
- Added **The Names in the Ash**, with four endings.
- Added fifteen named NPCs and five investigation scenes.
- Offline simulation now pauses at irreversible quest choices.

### Skills and systems

- Added Animal Husbandry.
- Added Ritualism.
- Added Diplomacy.
- Expanded the registry to 35 skills, 152 activities, 171 items, and 40 enemies.
- Added nine specialization tracks, 27 choices, and 45 milestone rewards.
- Added eight branching dungeons.
- Expanded research and settlement projects.
- Added global cross-content search and detailed item inspection.
- Expanded the activity planner with estimates, reserves, rare-drop stops, logistics, and linked plans.

### Saves and PWA

- Advanced the account schema to 3 and character schema to 7.
- Added deterministic migrations and recovery snapshots.
- Added snapshot management and pre-update snapshots.
- Preserved SimpleScape V15 importing.
- Updated IndexedDB to version 2.
- Added a controlled PWA update prompt and subdirectory-safe service worker.
- Verified offline reload and GitHub Pages-style deployment paths.

### Verification

- 61 automated tests passed.
- 25 browser/PWA checks passed.
- 120 viewport/view combinations passed.
- Zero browser runtime errors were observed.

## 0.9.0-alpha.6

- Introduced the modular local-first Eldoria PWA foundation.
- Added IndexedDB autosave, offline simulation, three character slots, data-driven skills/items/regions, combat, estate systems, trade, sailing, quests, collections, service-worker caching, and optional Supabase repository contracts.
