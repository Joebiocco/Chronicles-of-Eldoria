# Feature implementation matrix

This matrix audits the Memory Beneath overhaul against the requested scope.

Status meanings:

- **Implemented:** executable and covered by automated or browser verification.
- **Prepared:** interfaces/schema exist, but activation requires external services or credentials.
- **Future production work:** intentionally outside a static local-first client.

## Foundation, rendering, and responsiveness

| Requirement | Status | Delivery |
|---|---|---|
| Preserve the existing game rather than replace it with a mockup | Implemented | Existing skills, economy, estate, travel, combat, saves, and PWA systems remain and are extended through modular patches. |
| Four-Hz deterministic simulation | Implemented | Foreground and offline progress use elapsed timestamps. |
| Independent smooth visual loop | Implemented | `requestAnimationFrame` interpolates activity, travel, HP, enemy HP, and timers. |
| Avoid whole-screen rendering during routine ticks | Implemented | Structural signatures and targeted dynamic updates preserve the current main root. |
| Transform-based progress bars | Implemented | Converted to `scaleX` updates. |
| Combat visual-event layer | Implemented | Attack and support actions emit explicit presentation events. |
| Non-clipping combat effects | Implemented | Effects live outside the clipped surface and are replayed after same-frame structural renders. |
| Animation settings | Implemented | Full/reduced/minimal, system reduced motion, splats, shake, particles/background motion. |
| Mobile clipping repair | Implemented | Tested through 320×568 and landscape phones. |
| Desktop and ultrawide repair | Implemented | Tested through 7680×2160. |
| No page horizontal overflow | Implemented | Passed 120 route/viewport combinations. |
| Mobile top/navigation redesign | Implemented | Five-destination bottom navigation, simplified chrome, safe-area padding. |
| Adaptive item layout and mobile action sheet | Implemented | Small phones can use a single-column grid and contained item-detail sheet. |
| Modal focus and containment | Implemented | Focus trap, Escape, restoration, scroll-safe body/footer. |
| Browser zoom and accessibility | Implemented | No `maximum-scale` restriction; high contrast, text scaling, reduced motion, focus states. |

## World map and interface

| Requirement | Status | Delivery |
|---|---|---|
| Fit-to-screen map | Implemented | Initial fit and explicit Fit control. |
| Mouse/touch pan | Implemented | Pointer drag and pointer capture. |
| Pinch and wheel zoom | Implemented | Two-pointer distance scaling and cursor-relative wheel zoom. |
| Keyboard map controls | Implemented | `+`, `-`, arrows, `F`/`0`, and `C`. |
| Center selection/player | Implemented | Region and player centering controls. |
| Overlay toggles | Implemented | Resources, quests, danger, factions, weather, events, trade, discovery, routes, dungeons. |
| Route highlighting | Implemented | Selected destination and current/next travel route states. |
| Quest-driven region variants | Implemented | Crystal Lake, Watchpost, and Stonehaven persistent variants. |
| Dashboard expansion | Implemented | Activity, rates, stop estimate, quest, events, passive systems, progress, consequences. |
| Advanced activity planner | Implemented | Counts, durations, levels, mastery, free slots, reserves, item/rare stops, deposit/return/handoff. |
| Planner preview | Implemented | Duration, XP, XP/hour, outputs, inputs, likely stop condition. |
| Global search | Implemented | Items, skills, actions, regions, quests, enemies, NPCs, factions, lore. |
| Detailed item inspection | Implemented | Stats, comparison, sources, recipes/uses, market, salvage, quest relevance, notes, favorite, lock, reserve. |
| Local semantic icon system | Implemented for primary UI/content surfaces | Local SVG sprite. Some data-authored glyphs remain fallbacks until a commissioned art pass. |
| Optional local audio | Implemented | Generated WAV cues, no autoplay, channel settings. |

## Narrative quest engine

| Requirement | Status | Delivery |
|---|---|---|
| Data-driven staged quests | Implemented | Stages, objectives, dialogue, next-stage transitions, endings. |
| Dialogue | Implemented | Named NPC dialogue, follow-up progression, remembered conversations. |
| Investigation scenes | Implemented | Five authored scenes with evidence and skill interpretations. |
| Puzzle objectives | Implemented | Sequence/option solving, hints, non-destructive attempts. |
| Alternate skill solutions | Implemented | Access, preparation, and interpretation routes use different skills/reputation/items. |
| Command assignments | Implemented | Personnel costs and campaign state. |
| Combat quest objectives | Implemented | Story context survives combat and finalizes only after encounter completion. |
| Irreversible decision gates | Implemented | Offline progress pauses and awaits the player. |
| Persistent consequences | Implemented | Region variants, NPCs, services, modifiers, projects, reputations, activities. |
| Contextual decision tags | Implemented | Named tags rather than a one-dimensional morality meter. |
| Quest journal and “Previously…” recap | Implemented | Stage, clues, conversations, decisions, consequences, recap content. |

## Flagship quests

| Quest | Status | Delivery |
|---|---|---|
| The Bell Beneath Crystal Lake | Implemented | Boat/village/archive investigations, song puzzle, descent route, Veyra’s Rest, Lysa and Bellkeeper, 3 endings. |
| Seven Nights at the Wall | Implemented | Seven command/defense stages, personnel and campaign state, Thorne/Nera/refugee/Crown decisions, 4 endings. |
| The Names in the Ash | Implemented | Memorial evidence, specialist mine expedition, multiple descent routes, Keeper Rhun/Forged Choir, 4 endings. |
| Every ending reachable | Implemented | Automated tests cover all eleven. |
| Every ending one-time/idempotent | Implemented | Rewards and world changes are source-protected. |
| Offline choice safety | Implemented | Automated test confirms no ending is selected offline. |

## Skills, content, and long-running systems

| Requirement | Status | Delivery |
|---|---|---|
| Deeper existing skill content | Implemented | Expanded action registry, regional methods, inputs/outputs, rare drops, hazards, mastery, tools, milestones. |
| Specialization paths | Implemented | Nine tracks and 27 permanent choices. |
| Skill milestones | Implemented | Nine tracks and 45 one-time rewards. |
| Animal Husbandry | Implemented | Pens, feed, health, happiness, products, collection, breeding, traits, mount progress. |
| Ritualism | Implemented | Offerings, level/region gates, timed regional modifiers, purification and Heartglass themes. |
| Diplomacy | Implemented | Leverage, reputation, treaties, persistent faction/world modifiers. |
| Dungeons as activities, not an XP-only skill | Implemented | Eight branching runs with choices, hazards, combat, bosses, lore, supplies, completion history. |
| Active interaction remains optional | Implemented | Existing active interactions offer bounded bonuses; idle simulation remains viable. |
| 35 skills / 152 actions / 171 items / 40 enemies | Implemented | Registry validated and tests exercise every action and enemy. |

## Offline, save, PWA, and QA

| Requirement | Status | Delivery |
|---|---|---|
| Aggregated offline simulation | Implemented | Batched mathematical processing and one summary report. |
| Worker-based large catch-up | Implemented | `simulation-worker.js`. |
| Configurable offline combat safety | Implemented | Death and resource reserves, target stops, and automation. |
| Account/character migrations | Implemented | Account 3, character 7. |
| Legacy V15 import | Implemented | Automated migration test. |
| Recovery snapshots | Implemented | Before migration/update plus manual snapshot management. |
| GitHub Pages subdirectory safety | Implemented | Relative imports, manifest, scope, worker, service worker. |
| Controlled update prompt | Implemented | Save/snapshot before `SKIP_WAITING`. |
| Offline PWA reload | Implemented | Browser QA passed. |
| Automated engine/content testing | Implemented | 61 tests. |
| Responsive browser QA | Implemented | 25 checks and 120 combinations. |
| Zero tested runtime errors | Implemented | Browser report recorded none. |

## Supabase and connected systems

| Requirement | Status | Delivery |
|---|---|---|
| Supabase-ready persistence architecture | Prepared | Repository adapters and SQL contract are included. |
| Supabase Auth | Prepared, not activated | Requires a real project and user-facing login flow. |
| Cloud saves | Prepared, not activated | Atomic revision RPC and local-first adapter are present. |
| Conflict UX/data contract | Prepared | Conflict error state and documented resolution approach. |
| Secure player trading | Future production work | Requires server-authoritative validation. |
| Competitive leaderboards | Future production work | Client JSON is not trustworthy for competition. |
| Shared guild economy/world boss health | Future production work | Requires Edge Functions or another authoritative service. |
| Native app-store packages | Future production work | PWA installation is delivered; native wrappers are not. |
| Full commissioned art/localization | Future production work | Architecture supports asset replacement and text localization later. |
