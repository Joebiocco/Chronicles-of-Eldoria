# Mobile layout repair report

**Release:** 1.1.1  
**Scope:** Phone and short-screen landscape layouts only  
**Desktop constraint:** Desktop layout was not redesigned or compressed

## Problems reproduced

The 1.1.0 phone interface was not horizontally overflowing, but it was vertically compressed:

- The phone header occupied **113px** in portrait and about **103–105px** in landscape.
- The bottom navigation occupied **65px** in portrait.
- Page headers consumed **136–202px** before primary content appeared.
- A 320×568 device had only about **390px** of main content height, and stacked notifications covered much of it.
- A 568×320 landscape device had only about **160px** of main content height.
- Map controls wrapped into several rows.
- Bank, map, character, collection, and town action rows wrapped tightly or appeared cut off without a clear scrolling behavior.
- 915×412 phone landscape fell just above the previous 900px mobile breakpoint and incorrectly received the desktop sidebar layout.

## Mobile-only corrections

- Portrait header reduced to **52px** on phones.
- Short-screen landscape header reduced to **46px**.
- Mobile navigation reduced to **55–57px** in portrait and **43px** in landscape.
- Current activity remains accessible from the mobile Activity button; its large header chip is hidden only on narrow phones.
- Page descriptions are limited to two lines on portrait phones and hidden in short landscape mode.
- Page action groups, tabs, map controls, and map overlays now scroll horizontally instead of wrapping into tall stacks.
- Only the newest phone notification is retained, and it clears after 2.6 seconds.
- Character actions use a horizontal row; resource bars stack at readable widths.
- Settings use one column on phones.
- The mobile shell now remains active for short landscape screens up to 950px wide.
- Modal sheets were retested at 320×568 and 568×320.

## Common phone resolutions tested

- 320×568 — legacy small phone.
- 360×640 — small Android.
- 360×740 — Galaxy-class Android.
- 360×780 — modern narrow Android.
- 375×667 — iPhone SE / iPhone 8.
- 390×844 — iPhone 12–14.
- 393×852 — iPhone 14 Pro.
- 412×915 — Pixel 7-class Android.
- 430×932 — iPhone Pro Max.
- 568×320 — small phone landscape.
- 667×375 — iPhone landscape.
- 740×360 — Android landscape.
- 844×390 — modern iPhone landscape.
- 915×412 — Pixel landscape.

Every resolution exercised Dashboard, Map, Skills, Combat, Quests, Town, Bank, Character, Collections, and Settings.

## Results

```text
14 phone viewports
10 major views per viewport
140 viewport/view checks
0 clipping or horizontal-overflow failures
0 browser runtime errors
0 modal-containment failures
61 engine/content tests passed
Static PWA validation passed
```

The machine-readable results are in `MOBILE_QA_REPORT.json`.

## Desktop guard

At 1366×768 the following remain intact:

- Original three-column game shell.
- Desktop sidebar.
- Desktop context drawer.
- Full desktop current-activity chip.
- Hidden mobile navigation.
- Original desktop topbar height and key layout metrics.

All new layout rules are bounded to phone/tablet media queries or short-screen landscape queries. The one JavaScript behavior change is also guarded by `max-width: 900px` and only caps mobile toast stacking.
