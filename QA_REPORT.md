# Quality-assurance report

**Project:** Chronicles of Eldoria — The Memory Beneath  
**Version:** 1.1.1  
**Completed:** 2026-07-25  
**Overall result:** PASS


## Mobile 1.1.1 regression campaign

The mobile repair added a dedicated phone-first browser suite:

```bash
npm run mobile:qa
```

Result:

```text
14 common phone resolutions
10 major views per resolution
140 viewport/view checks passed
0 failures
0 runtime errors
```

The suite checks portrait and landscape phones from 320×568 through 915×412. It verifies page/body/main horizontal containment, compact header and navigation heights, two-line description limits, scroll-safe action and tab rows, unclipped controls, modal containment, one-toast mobile notification behavior, and a desktop-layout guard.

The full list of tested devices and exact findings is in [`MOBILE_FIX_REPORT.md`](MOBILE_FIX_REPORT.md); raw results are in [`MOBILE_QA_REPORT.json`](MOBILE_QA_REPORT.json).

## Automated engine and content tests

Command:

```bash
npm run check
```

Result:

```text
61 tests passed
0 failed
Static validation passed
```

The test suite covers:

- Registry breadth and cross-reference integrity.
- All 152 skill activities completing through the shared engine.
- All 40 enemies resolving through combat.
- Atomic inventory and equipment behavior.
- Travel and discovery.
- Farming, buildings, projects, companions, expeditions, research, trade, ships, voyages, markets, quests, loadouts, and prestige.
- All three flagship story quests reaching real decision gates.
- All eleven endings completing once and applying their world changes.
- Offline decision pausing.
- World-change idempotency.
- All eight branching dungeons.
- Animal Husbandry, Ritualism, and Diplomacy.
- Specializations and milestone rewards.
- Activity estimates, reserves, rare-drop stops, return-to-town logistics, output deposits, and linked plans.
- Item favorites, notes, reserves, locks, and normalization.
- Explicit combat presentation events.
- Recovery snapshots and restoration.
- SimpleScape V15 migration.
- Supabase optimistic revisions and local-first conflict behavior.

## Static validation

The validator confirmed:

- Syntax for 14 JavaScript files.
- Internal imports.
- HTML/CSS/script and asset references.
- Four manifest icons and four shortcuts.
- Manifest screenshot declarations.
- Service-worker app-shell entries.
- Relative GitHub Pages-safe paths.
- Supabase SQL/RPC references and row-level-security declarations.

## Browser and responsive QA

Browser suite target:

```text
http://127.0.0.1:4174/Chronicles-of-Eldoria/
```

This deliberately reproduced a GitHub Pages repository-subdirectory deployment.

Summary:

```text
25 checks passed
0 failed
120 viewport/view combinations passed
0 runtime errors
```

### Viewports

- 320×568.
- 360×740.
- 390×844.
- 412×915.
- 568×320 landscape.
- 740×360 landscape.
- 768×1024.
- 1024×768.
- 1366×768.
- 1920×1080.
- 2560×1440.
- 7680×2160.

Each viewport exercised:

- Dashboard.
- Map.
- Skills.
- Combat.
- Quests.
- Town.
- Bank.
- Character.
- Collections.
- Settings.

No tested combination produced page-level, body-level, or main-view horizontal overflow.

### Functional checks

Passed:

1. Application boot without the fatal fallback.
2. Account schema 3 and character schema 7.
3. All responsive combinations.
4. Transform-only map zoom without document expansion.
5. Map routes and seventeen region markers.
6. Keyboard map zoom/pan and selected route highlighting.
7. Advanced planner estimates, stop rules, reserves, logistics, and linked controls.
8. `requestAnimationFrame` activity interpolation.
9. Stable dashboard root DOM during routine simulation.
10. Attack and support combat presentation events.
11. Effect layers outside the clipping surface.
12. All three flagship quests in the journal.
13. Authored staged quest content and interactive objective controls.
14. Dashboard/context stability while a staged quest is active.
15. Global search finding the Bellkeeper.
16. Primary content icons using the local SVG sprite.
17. Animal Husbandry, Ritualism, and Diplomacy rendering as playable systems.
18. Item-detail containment at 320×568.
19. 150% text, reduced motion, high contrast, and no horizontal overflow.
20. Browser zoom permitted.
21. Service-worker installation and controlled reload.
22. Versioned app-shell/runtime caches.
23. Offline reload from cache.
24. Manifest screenshots at 1440×1000, 1440×1000, and 390×844.
25. No page or console runtime errors.

## PWA verification

Confirmed:

- Service worker registered with the application’s relative scope.
- Reload became service-worker controlled.
- Versioned caches were present.
- The app reopened while the browser context was offline.
- Manifest screenshots were regenerated from the real executable build.
- Relative paths worked below `/Chronicles-of-Eldoria/`.

## Artifacts

- `BROWSER_QA_REPORT.json`: complete machine-readable browser result.
- `assets/screenshot-wide.png`: 1440×1000.
- `assets/screenshot-map.png`: 1440×1000.
- `assets/screenshot-mobile.png`: 390×844.

## Remaining validation boundary

Automated browser QA used Chromium in a controlled test environment. Manual checks on the owner’s actual Android and iOS devices remain useful because browser chrome, virtual keyboards, font rendering, and PWA installation prompts can vary by operating-system version. No known blocking issue remained after the completed suite.
