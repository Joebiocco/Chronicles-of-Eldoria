# Memory Beneath implementation notes

## Release philosophy

This release prioritizes a complete executable local game over pretending that external multiplayer or cloud infrastructure exists. Every listed local system runs inside the delivered project. Features whose defining behavior requires a trusted server remain clearly separated.

## Content integration

The previous modular Eldoria build remains in `data.js`, `engine.js`, and `ui.js`. The expansion installs through three additive modules:

- `memory-content.js` extends data registries.
- `memory-systems.js` augments the engine prototype.
- `memory-ui.js` augments the interface prototype.

This allowed older content and save migration behavior to remain available while the overhaul added new systems.

## Smooth rendering

A simulation tick is not an animation frame. The engine advances at a bounded logical rate; the visual loop calculates the current visible fraction from the action’s elapsed timestamps.

This approach prevents:

- Faster devices earning more resources.
- Browser timer throttling changing combat.
- Progress bars stepping at four frames per second.
- Full-view HTML replacement on every routine tick.

Combat support effects required one additional safeguard. Ability execution can emit an effect and schedule a structural render in the same JavaScript turn. The UI queues these events and replays them after the replacement combat DOM exists, preventing a shield or interrupt label from disappearing immediately.

## Map behavior

The map artwork retains its original aspect ratio and coordinate system. Region positions remain normalized percentages. The transformed layer is clamped within a viewport, so zooming and panning do not increase the page’s scroll width.

At low zoom, secondary labels simplify to reduce marker overlap. Quest, dungeon, selected, route, active-travel, and discovery states use separate classes and overlays.

## Quest-state decisions

Story endings are explicit decision objects. A quest does not infer a choice from reputation or skill. Requirements can unlock or disable options, but the player still chooses.

Ending world changes use a source ID such as the quest-ending pair. Applying the same ending again is a no-op. This protects imports, reloads, repeated event delivery, and future cloud retries.

The three quest families intentionally share the larger Heartglass-memory theme without collapsing decisions into “good” and “evil.” The save records contextual tags such as preserving memory, institutional loyalty, refugee trust, frontier autonomy, labor restitution, or destructive containment. Later content can react to the specific history.

## Activity planner balance

Planner forecasts use current action duration, expected outputs, XP, and known modifiers. They are estimates, not guaranteed loot forecasts.

Rare tables, active interactions, mastery changes during the plan, dynamic events, hazards, resource preservation, quality, and interruption can change the final result. The UI explains this directly.

Per-plan reserves override or supplement account-level protected quantities. The activity stops before violating the reserve floor.

Post-plan behavior is stored explicitly so an autosave can occur after production but before deposit, return travel, or next-plan handoff.

## Active versus idle play

Active interactions are intended to provide modest efficiency, safety, or choice rather than exclusive progression. No core story decision requires reflex clicking. Combat cues and puzzles have text equivalents, and reduced-motion/minimal modes retain the necessary information.

## Combat presentation

The engine remains the only authority for damage and status resolution. Presentation events are descriptive records. The UI may skip or reduce them without changing state.

Effects favor transform and opacity. Large layout properties are not continuously animated. Damage splats and cue nodes remove themselves after their animation ends.

## Audio

The included WAV files were synthesized locally for this release. Audio is initialized only after user interaction and is disabled through settings when requested. There is no remote music or sound dependency.

## Save migration assumptions

- Unknown content IDs are preserved where safe or normalized away when they cannot be rendered.
- New fields receive deterministic defaults.
- Existing quantities, XP, mastery, equipment, quests, and world state are retained where structurally compatible.
- Legacy SimpleScape equipment maps into the closest Eldoria slots.
- A pre-migration snapshot is created before replacing the live normalized account when storage permits.

## Balance assumptions

The release provides coherent progression and system integration, but exact economy tuning remains provisional. Current assumptions include:

- Active play should normally improve value by approximately 10–25%, not multiply it several times.
- Specializations create direction without permanently making other activities unusable.
- World-changing quest outcomes exchange benefits rather than having one universally optimal reward.
- Dungeons are meaningful risk/reward expeditions, not the only source of viable equipment.
- Offline safety settings can stop combat before consuming protected reserves.
- High-tier passive systems require prior investment and should not replace focused character activity.

Long-run balance should be adjusted from actual player save telemetry and feedback rather than only short simulation runs.

## Browser QA notes

The automated browser suite used a GitHub Pages-like path, not only domain-root localhost. It validated the relative service-worker scope, app-shell cache, offline reload, and all major views at twelve dimensions.

The test suite regenerated the screenshots declared in the manifest from the actual executable project.

## Security notes

- User-entered and imported labels are escaped before HTML insertion.
- Imported saves are normalized and validated.
- No service-role credential belongs in this project.
- The browser’s public Supabase key is only acceptable with Auth and RLS.
- Local or cloud-stored client state is not sufficient evidence for competitive rewards.
- Data-only content packs do not execute imported JavaScript.
