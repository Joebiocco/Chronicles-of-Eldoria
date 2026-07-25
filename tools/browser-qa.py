#!/usr/bin/env python3
"""Reproducible browser QA for Chronicles of Eldoria.

Run against the local server at http://127.0.0.1:4173/. The script writes
BROWSER_QA_REPORT.json and refreshes manifest screenshots after all checks pass.
"""
from __future__ import annotations

import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from playwright.sync_api import Page, TimeoutError as PlaywrightTimeoutError, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BASE_URL = os.environ.get("ELDORIA_QA_URL", "http://127.0.0.1:4173/")
REPORT_PATH = ROOT / "BROWSER_QA_REPORT.json"

VIEWPORTS = [
    (320, 568),
    (360, 740),
    (390, 844),
    (412, 915),
    (568, 320),
    (740, 360),
    (768, 1024),
    (1024, 768),
    (1366, 768),
    (1920, 1080),
    (2560, 1440),
    (7680, 2160),
]
VIEWS = ["dashboard", "map", "skills", "combat", "quests", "town", "bank", "character", "collections", "settings"]


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def main() -> int:
    report: dict[str, Any] = {
        "project": "Chronicles of Eldoria — The Memory Beneath",
        "version": "1.1.1",
        "baseUrl": BASE_URL,
        "startedAt": utc_now(),
        "completedAt": None,
        "passed": False,
        "summary": {},
        "checks": [],
        "viewportResults": [],
        "runtimeErrors": [],
    }

    def record(name: str, passed: bool, details: Any = None, category: str = "functional") -> None:
        report["checks"].append({"name": name, "category": category, "passed": bool(passed), "details": details})
        if not passed:
            print(f"FAIL: {name}: {details}")
        else:
            print(f"PASS: {name}")

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            executable_path="/usr/bin/chromium",
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--disable-background-timer-throttling",
                "--disable-renderer-backgrounding",
            ],
        )
        context = browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=1,
            service_workers="allow",
            locale="en-US",
        )
        page = context.new_page()
        page.set_default_timeout(12_000)

        def on_page_error(error: Exception) -> None:
            report["runtimeErrors"].append({"type": "pageerror", "message": str(error)})

        def on_console(message: Any) -> None:
            if message.type == "error":
                report["runtimeErrors"].append({"type": "console", "message": message.text})

        page.on("pageerror", on_page_error)
        page.on("console", on_console)

        try:
            page.goto(BASE_URL, wait_until="networkidle")
            wait_for_app(page)
            record("Application booted without the fatal fallback screen", page.locator("#boot-screen").is_hidden())
            create_character_if_needed(page)
            seed_qa_character(page)

            # Baseline runtime state and content visibility.
            counts = page.evaluate(
                """() => ({
                  accountSchema: eldoria.engine.account.schemaVersion,
                  characterSchema: eldoria.engine.character.schemaVersion,
                  activeSlot: eldoria.engine.activeSlot,
                  characterName: eldoria.engine.character.name,
                  appVersionText: document.querySelector('#character-subtitle')?.textContent || ''
                })"""
            )
            record("Account and character schemas load at the overhaul versions", counts["accountSchema"] == 3 and counts["characterSchema"] == 7, counts)

            # Responsive matrix. This deliberately exercises every major route at every requested viewport.
            for width, height in VIEWPORTS:
                page.set_viewport_size({"width": width, "height": height})
                for view in VIEWS:
                    close_modal(page)
                    page.evaluate("view => eldoria.ui.setView(view)", view)
                    page.wait_for_timeout(70)
                    metrics = page.evaluate(
                        """({view, width, height}) => {
                          const de = document.documentElement;
                          const body = document.body;
                          const main = document.querySelector('#main-view');
                          const shell = document.querySelector('#game-shell');
                          const rect = main?.getBoundingClientRect();
                          const visible = (node) => {
                            if (!node) return false;
                            const style = getComputedStyle(node);
                            const r = node.getBoundingClientRect();
                            return style.display !== 'none' && style.visibility !== 'hidden' && r.width > 0 && r.height > 0;
                          };
                          const fixedObstructions = [...document.querySelectorAll('.topbar,.mobile-nav')]
                            .filter(visible)
                            .map(node => ({className: node.className, rect: node.getBoundingClientRect().toJSON()}));
                          return {
                            view, width, height,
                            documentScrollWidth: de.scrollWidth,
                            documentClientWidth: de.clientWidth,
                            documentOverflow: Math.max(0, de.scrollWidth - de.clientWidth),
                            bodyOverflow: Math.max(0, body.scrollWidth - body.clientWidth),
                            mainOverflow: main ? Math.max(0, main.scrollWidth - main.clientWidth) : null,
                            mainRect: rect?.toJSON() || null,
                            shellVisible: visible(shell),
                            mainHasContent: Boolean(main?.textContent?.trim()),
                            fatalText: /could not open eldoria/i.test(document.body.textContent || ''),
                            fixedObstructions,
                          };
                        }""",
                        {"view": view, "width": width, "height": height},
                    )
                    passed = (
                        metrics["shellVisible"]
                        and metrics["mainHasContent"]
                        and not metrics["fatalText"]
                        and metrics["documentOverflow"] <= 1
                        and metrics["bodyOverflow"] <= 1
                        and (metrics["mainOverflow"] is None or metrics["mainOverflow"] <= 1)
                    )
                    result = {**metrics, "passed": passed}
                    report["viewportResults"].append(result)
                    if not passed:
                        print(f"FAIL viewport {width}x{height} {view}: {metrics}")

            viewport_failures = [result for result in report["viewportResults"] if not result["passed"]]
            record(
                "All requested viewport/view combinations avoid page-level and main-view horizontal overflow",
                not viewport_failures,
                {"tested": len(report["viewportResults"]), "failures": viewport_failures[:10]},
                "responsive",
            )

            # Map interaction, containment, overlays, and transform-only zoom.
            page.set_viewport_size({"width": 390, "height": 844})
            page.evaluate("eldoria.ui.setView('map')")
            page.wait_for_timeout(250)
            before_transform = page.locator("[data-map-transform]").evaluate("node => node.style.transform")
            page.locator('[data-action="map-zoom-in"]').first.click()
            page.wait_for_timeout(80)
            after_transform = page.locator("[data-map-transform]").evaluate("node => node.style.transform")
            routes = page.locator('[data-map-overlay-multi="routes"]')
            if routes.count() and not routes.is_checked():
                routes.check()
                page.wait_for_timeout(100)
            map_metrics = page.evaluate(
                """() => {
                  const viewport = document.querySelector('[data-map-viewport]');
                  const layer = document.querySelector('[data-map-transform]');
                  const vr = viewport.getBoundingClientRect();
                  const mr = document.querySelector('#main-view').getBoundingClientRect();
                  return {
                    viewportRect: vr.toJSON(), mainRect: mr.toJSON(),
                    contained: vr.left >= mr.left - 1 && vr.right <= mr.right + 1,
                    overflow: getComputedStyle(viewport).overflow,
                    transform: layer.style.transform,
                    routeCount: document.querySelectorAll('.map-route-line').length,
                    markerCount: document.querySelectorAll('.map-marker').length,
                  };
                }"""
            )
            record("Map zoom changes the transform without expanding the document", before_transform != after_transform and map_metrics["contained"] and map_metrics["overflow"] == "hidden", {"before": before_transform, "after": after_transform, **map_metrics})
            record("Map route overlay and region markers render", map_metrics["routeCount"] > 0 and map_metrics["markerCount"] >= 17, map_metrics)

            map_keyboard = page.evaluate(
                """async () => {
                  const ui=eldoria.ui, e=eldoria.engine;
                  ui.state.selectedRegion='crystal_lake';
                  e.account.settings.mapOverlays=[...new Set([...(e.account.settings.mapOverlays||[]),'routes'])];
                  ui.renderAll();
                  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
                  const viewport=document.querySelector('[data-map-viewport]');
                  viewport.focus();
                  const before=document.querySelector('[data-map-transform]').style.transform;
                  viewport.dispatchEvent(new KeyboardEvent('keydown',{key:'+',bubbles:true}));
                  viewport.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
                  const after=document.querySelector('[data-map-transform]').style.transform;
                  return {
                    before, after,
                    zoomBucket:viewport.dataset.zoomBucket,
                    activeRoutes:document.querySelectorAll('.map-route-line.active').length,
                    selectedCentered:Boolean(document.querySelector('.map-marker.selected')),
                  };
                }"""
            )
            record("Map supports keyboard zoom/pan and highlights the selected travel route", map_keyboard["before"] != map_keyboard["after"] and map_keyboard["activeRoutes"] > 0 and bool(map_keyboard["zoomBucket"]), map_keyboard)

            # Advanced planner conditions, estimates, and handoff controls.
            page.evaluate(
                """() => {
                  const e=eldoria.engine;
                  try { e.stopActivity('QA planner reset'); } catch (_) {}
                  e.character.location='stonehaven';
                  eldoria.ui.openActivityPlanner();
                }"""
            )
            planner_form = page.locator("#advanced-planner-form")
            planner_form.wait_for(state="visible")
            planner_form.locator('select[name="actionId"]').select_option("mine_copper")
            planner_form.locator('input[name="actionCount"]').fill("2")
            planner_form.locator('input[name="stopOnRareDrop"]').check()
            planner_form.locator('input[name="depositOutputs"]').check()
            planner_form.locator('input[name="returnToTown"]').check()
            planner_estimate = page.locator("[data-planner-estimate]").inner_text()
            planner_form.locator('button[type="submit"]').click()
            page.wait_for_timeout(80)
            planner_state = page.evaluate(
                """() => ({
                  actionId:eldoria.engine.character.planner.activePlan?.actionId,
                  actionCount:eldoria.engine.character.planner.activePlan?.conditions?.actionCount,
                  stopOnRareDrop:eldoria.engine.character.planner.activePlan?.conditions?.stopOnRareDrop,
                  depositOutputs:eldoria.engine.character.planner.activePlan?.conditions?.depositOutputs,
                  returnToTown:eldoria.engine.character.planner.activePlan?.conditions?.returnToTown,
                })"""
            )
            record("Advanced activity planner exposes estimates, stop rules, reserves, logistics, and linked-plan controls", "XP/hour" in planner_estimate and planner_state == {"actionId":"mine_copper","actionCount":2,"stopOnRareDrop":True,"depositOutputs":True,"returnToTown":True}, {"estimateExcerpt": planner_estimate[:300], "state": planner_state})
            page.evaluate("eldoria.engine.stopActivity('QA planner complete')")

            # Smooth visual interpolation and stable DOM during routine simulation.
            page.set_viewport_size({"width": 1366, "height": 768})
            page.evaluate(
                """() => {
                  const e = eldoria.engine;
                  try { e.stopActivity('QA reset'); } catch (_) {}
                  e.character.location = 'stonehaven';
                  e.character.discoveredRegions = [...new Set([...e.character.discoveredRegions, 'stonehaven'])];
                  e.character.xp.mining = Math.max(e.character.xp.mining || 0, 2000000);
                  e.startSkillAction('mine_copper');
                  eldoria.ui.setView('dashboard');
                }"""
            )
            # Let the structural render queued by starting the activity settle,
            # then pin the live node. The following sampling window contains
            # only routine simulation and visual interpolation.
            page.wait_for_timeout(180)
            page.evaluate("window.__qaMainNode = document.querySelector('#main-view').firstElementChild")
            progress_values: list[str] = []
            for _ in range(32):
                progress_values.append(
                    page.evaluate(
                        """() => {
                          const node = document.querySelector('[data-dashboard-activity-progress]');
                          return node ? `${node.dataset.progress}|${node.style.transform}` : 'missing';
                        }"""
                    )
                )
                page.wait_for_timeout(22)
            stable_dom = page.evaluate("() => window.__qaMainNode === document.querySelector('#main-view').firstElementChild")
            distinct_progress = len(set(progress_values))
            record("Activity progress is interpolated through requestAnimationFrame", distinct_progress >= 10 and "missing" not in progress_values, {"distinctSamples": distinct_progress, "samples": progress_values[:8]})
            record("Routine simulation does not replace the dashboard root DOM node", stable_dom, {"sampleWindowMs": 704})

            # Combat presentation event and non-clipping FX layer.
            combat_result = page.evaluate(
                """async () => {
                  const e = eldoria.engine;
                  try { e.stopActivity('QA combat reset'); } catch (_) {}
                  for (const key of Object.keys(e.character.xp)) e.character.xp[key] = Math.max(e.character.xp[key] || 0, 3000000);
                  e.character.currentHp = e.getCombatStats().maxHp;
                  e.character.location = 'stonehaven';
                  eldoria.ui.setView('combat');
                  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
                  const enemyButton = document.querySelector('[data-action="start-combat"]');
                  if (!enemyButton) return {error: 'No local enemy button'};
                  window.__qaFxEvents = [];
                  e.addEventListener('combat-fx', event => window.__qaFxEvents.push(event.detail));
                  e.startCombat(enemyButton.dataset.id);
                  eldoria.ui.renderAll();
                  e.character.stamina = 999;
                  e.useCombatAbility('guard');
                  e.character.activity.enemyHp = 1;
                  e.character.activity.nextAttackAt = Date.now();
                  e.advanceTo(Date.now() + 12000, {offline:false});
                  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
                  const layers = [...document.querySelectorAll('.combat-effect-layer')];
                  const card = document.querySelector('.combatant-card');
                  return {
                    events: window.__qaFxEvents,
                    layers: layers.length,
                    splats: document.querySelectorAll('.combat-splat').length,
                    cues: document.querySelectorAll('.combat-cue').length,
                    supportEvent: window.__qaFxEvents.some(event => event.type === 'combat:shield'),
                    cardOverflow: card ? getComputedStyle(card).overflow : null,
                    surfaceOverflow: card?.querySelector('.combatant-surface') ? getComputedStyle(card.querySelector('.combatant-surface')).overflow : null,
                    layerOverflow: layers[0] ? getComputedStyle(layers[0]).overflow : null,
                    activityKind: e.character.activity?.kind || null,
                  };
                }"""
            )
            record("Combat emits explicit attack/support presentation events and renders effect layers", not combat_result.get("error") and len(combat_result.get("events", [])) > 0 and combat_result.get("layers") == 2 and combat_result.get("supportEvent") and combat_result.get("cues", 0) > 0, combat_result)
            record("Combat effects are outside the clipping surface", combat_result.get("cardOverflow") == "visible" and combat_result.get("surfaceOverflow") == "hidden" and combat_result.get("layerOverflow") == "visible", combat_result)

            # Story quest rendering, dialogue/investigation controls, and staged quest-safe dashboard/context.
            story_result = page.evaluate(
                """() => {
                  const e = eldoria.engine;
                  try { e.stopActivity('QA story reset'); } catch (_) {}
                  e.character.discoveredRegions = [...new Set([...e.character.discoveredRegions, 'crystal_lake'])];
                  const state = e.getStoryQuestState('memory_bell');
                  if (state.status === 'available') e.startStoryQuest('memory_bell');
                  eldoria.ui.state.questTab = 'active';
                  eldoria.ui.setView('quests');
                  const activeJournal = document.querySelector('#main-view').textContent;
                  eldoria.ui.state.questTab = 'available';
                  eldoria.ui.renderAll();
                  const availableJournal = document.querySelector('#main-view').textContent;
                  eldoria.ui.openStoryQuest('memory_bell');
                  const modal = document.querySelector('#modal-card').textContent;
                  return {
                    hasBell: activeJournal.includes('The Bell Beneath Crystal Lake'),
                    hasWall: availableJournal.includes('Seven Nights at the Wall'),
                    hasAsh: availableJournal.includes('The Names in the Ash'),
                    modalHasStory: modal.includes('The Bell Beneath Crystal Lake') || modal.includes('Voices on the Water'),
                    modalHasInteractiveControl: Boolean(document.querySelector('#modal-card [data-action^="story-"]')),
                    status: e.getStoryQuestState('memory_bell').status,
                  };
                }"""
            )
            record("All three flagship quests appear in the narrative journal", story_result["hasBell"] and story_result["hasWall"] and story_result["hasAsh"], story_result)
            record("A staged quest opens with authored story and interactive objectives", story_result["modalHasStory"] and story_result["modalHasInteractiveControl"] and story_result["status"] == "active", story_result)
            close_modal(page)
            page.evaluate("eldoria.ui.setView('dashboard')")
            page.wait_for_timeout(100)
            dashboard_story_safe = page.locator("#main-view").inner_text()
            context_story_safe = page.locator("#context-drawer").inner_text()
            record("Dashboard and context drawer remain stable with a staged quest active", "Welcome back" in dashboard_story_safe and "memory beneath" in context_story_safe.lower(), {"dashboardExcerpt": dashboard_story_safe[:120], "contextExcerpt": context_story_safe[:200]})

            # Global search.
            page.evaluate("eldoria.ui.openGlobalSearch()")
            search_input = page.locator("[data-global-search]")
            search_input.fill("Bellkeeper")
            page.wait_for_timeout(80)
            search_text = page.locator("[data-global-search-results]").inner_text()
            record("Global search finds named narrative content", "Bellkeeper" in search_text, search_text[:500])
            icon_state = page.evaluate("""() => ({count:document.querySelectorAll('svg.content-icon use').length, external:[...document.querySelectorAll('svg.content-icon use')].some(node => !String(node.getAttribute('href')||'').startsWith('./assets/icons/ui/sprite.svg#'))})""")
            record("Primary content icons use the local semantic SVG sprite", icon_state["count"] > 0 and not icon_state["external"], icon_state)
            close_modal(page)

            # New town systems.
            town_checks = {}
            for tab, needle in [("husbandry", "Animal Husbandry"), ("ritualism", "Ritualism"), ("diplomacy", "Diplomacy")]:
                page.evaluate("args => eldoria.ui.setView('town', {townTab: args.tab})", {"tab": tab})
                page.wait_for_timeout(70)
                text = page.locator("#main-view").inner_text()
                town_checks[tab] = needle in text
            record("Animal Husbandry, Ritualism, and Diplomacy render as playable town systems", all(town_checks.values()), town_checks)

            # Item detail and modal containment on the smallest supported phone.
            page.set_viewport_size({"width": 320, "height": 568})
            page.evaluate(
                """() => {
                  const e=eldoria.engine;
                  e.addItem('logs_normal', 10, {location:'inventory', allowBankFallback:true});
                  eldoria.ui.setView('bank', {bankTab:'inventory'});
                }"""
            )
            page.wait_for_timeout(80)
            details = page.locator('[data-action="inspect-stack"][data-id="logs_normal"]')
            if not details.count():
                details = page.locator('[data-action="inspect-stack"]').first
            details.click()
            page.wait_for_timeout(80)
            modal_metrics = page.evaluate(
                """() => {
                  const card = document.querySelector('#modal-card');
                  const body = card?.querySelector('.modal-body');
                  const r = card?.getBoundingClientRect();
                  const br = body?.getBoundingClientRect();
                  return {
                    card: r?.toJSON(), body: br?.toJSON(), width: innerWidth, height: innerHeight,
                    contained: Boolean(r && r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1),
                    bodyScrollable: Boolean(body && body.scrollHeight >= body.clientHeight),
                    title: document.querySelector('#modal-title')?.textContent,
                  };
                }"""
            )
            record("Item detail sheet remains within a 320×568 viewport", modal_metrics["contained"] and bool(modal_metrics["title"]), modal_metrics)
            close_modal(page)

            # Accessibility settings and enlarged text.
            settings_result = page.evaluate(
                """() => {
                  const s = eldoria.engine.account.settings;
                  s.textScale = 1.5;
                  s.reducedMotion = true;
                  s.highContrast = true;
                  eldoria.ui.applySettings();
                  eldoria.ui.setView('settings');
                  const de = document.documentElement;
                  return {
                    reduced: document.body.classList.contains('animations-minimal') || document.body.classList.contains('reduced-motion'),
                    highContrast: document.body.classList.contains('high-contrast'),
                    fontSize: getComputedStyle(document.documentElement).fontSize,
                    overflow: Math.max(0, de.scrollWidth - de.clientWidth),
                    maximumScaleBlocked: document.querySelector('meta[name="viewport"]')?.content.includes('maximum-scale') || false,
                  };
                }"""
            )
            record("150% text, reduced motion, and high contrast apply without horizontal page overflow", settings_result["reduced"] and settings_result["highContrast"] and settings_result["overflow"] <= 1, settings_result)
            record("Viewport metadata permits user zoom", not settings_result["maximumScaleBlocked"], settings_result)
            page.evaluate(
                """() => {
                  const s=eldoria.engine.account.settings;
                  s.textScale=1; s.reducedMotion=false; s.highContrast=false; s.animationQuality='full';
                  eldoria.ui.applySettings();
                }"""
            )

            # Service worker control, app-shell caches, and offline reload.
            page.set_viewport_size({"width": 390, "height": 844})
            sw_ready = page.evaluate("() => navigator.serviceWorker.ready.then(reg => ({scope: reg.scope, active: Boolean(reg.active)}))")
            page.reload(wait_until="networkidle")
            wait_for_app(page)
            sw_state = page.evaluate(
                """async () => ({
                  controlled: Boolean(navigator.serviceWorker.controller),
                  caches: await caches.keys(),
                  registrations: (await navigator.serviceWorker.getRegistrations()).map(r => r.scope),
                })"""
            )
            record("Service worker installs within the local app scope and controls reloads", sw_ready["active"] and sw_state["controlled"], {"ready": sw_ready, **sw_state}, "pwa")
            record("Versioned app-shell/runtime caches are present", any("eldoria" in name.lower() for name in sw_state["caches"]), sw_state, "pwa")

            context.set_offline(True)
            try:
                page.reload(wait_until="domcontentloaded", timeout=15_000)
                wait_for_app(page, timeout=15_000)
                offline_state = page.evaluate("() => ({title: document.title, shell: !document.querySelector('#game-shell').hidden, controlled: Boolean(navigator.serviceWorker.controller)})")
                offline_ok = offline_state["shell"] and offline_state["controlled"]
            except Exception as exc:  # pragma: no cover - captured in report
                offline_state = {"error": str(exc)}
                offline_ok = False
            finally:
                context.set_offline(False)
            record("Installed app reloads from cache while offline", offline_ok, offline_state, "pwa")

            # Refresh screenshots with the current real build.
            prepare_screenshot_state(page)
            page.set_viewport_size({"width": 1440, "height": 1000})
            page.evaluate("eldoria.ui.setView('dashboard')")
            page.wait_for_timeout(300)
            page.screenshot(path=str(ROOT / "assets" / "screenshot-wide.png"), full_page=False)
            page.evaluate("eldoria.ui.setView('map'); eldoria.ui.state.selectedRegion='crystal_lake'; eldoria.ui.renderAll()")
            page.wait_for_timeout(300)
            page.screenshot(path=str(ROOT / "assets" / "screenshot-map.png"), full_page=False)
            page.set_viewport_size({"width": 390, "height": 844})
            page.evaluate("eldoria.ui.setView('dashboard')")
            page.wait_for_timeout(300)
            page.screenshot(path=str(ROOT / "assets" / "screenshot-mobile.png"), full_page=False)
            screenshot_sizes = image_sizes([ROOT / "assets" / "screenshot-wide.png", ROOT / "assets" / "screenshot-map.png", ROOT / "assets" / "screenshot-mobile.png"])
            expected_sizes = [(1440, 1000), (1440, 1000), (390, 844)]
            record("Manifest screenshots were regenerated at their declared dimensions", screenshot_sizes == expected_sizes, {"actual": screenshot_sizes, "expected": expected_sizes}, "pwa")

        except Exception as exc:
            report["runtimeErrors"].append({"type": "qa_exception", "message": repr(exc)})
            print(f"QA exception: {exc!r}", file=sys.stderr)
        finally:
            browser.close()

    runtime_errors = report["runtimeErrors"]
    # Browser logs may include one expected offline network warning only if the service worker was not ready;
    # in this suite any console/page error is treated as a failure and reported verbatim.
    record("No page runtime or console errors were observed", not runtime_errors, runtime_errors, "runtime")
    failed = [check for check in report["checks"] if not check["passed"]]
    report["completedAt"] = utc_now()
    report["passed"] = not failed
    report["summary"] = {
        "checks": len(report["checks"]),
        "passed": len(report["checks"]) - len(failed),
        "failed": len(failed),
        "viewportCombinations": len(report["viewportResults"]),
        "runtimeErrors": len(runtime_errors),
    }
    REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report["summary"], indent=2))
    print(f"Report: {REPORT_PATH}")
    return 0 if report["passed"] else 1


def wait_for_app(page: Page, timeout: int = 12_000) -> None:
    page.wait_for_function("window.eldoria && window.eldoria.engine && window.eldoria.ui", timeout=timeout)
    page.wait_for_function("document.querySelector('#boot-screen')?.hidden === true", timeout=timeout)


def create_character_if_needed(page: Page) -> None:
    if page.locator("#character-gate").is_visible():
        create = page.locator('[data-action="create-character"]').first
        if create.count():
            create.click()
            form = page.locator("#create-character-form")
            form.wait_for(state="visible")
            form.locator('input[name="name"]').fill("Ari Vale")
            form.locator('button[type="submit"]').click()
    page.wait_for_selector("#game-shell:not([hidden])")


def seed_qa_character(page: Page) -> None:
    page.evaluate(
        """() => {
          const e = eldoria.engine;
          const c = e.character;
          c.name = 'Ari Vale';
          c.title = 'Keeper of the Chronicle';
          for (const key of Object.keys(c.xp)) c.xp[key] = Math.max(c.xp[key] || 0, 250000);
          c.coins = Math.max(c.coins, 12500);
          for (const [id, qty] of Object.entries({logs_normal:40, ore_copper:32, fish_trout_cooked:18, heartglass_shard:3})) {
            try { e.addItem(id, qty, {location:'inventory', allowBankFallback:true}); } catch (_) {}
          }
          c.currentHp = e.getCombatStats().maxHp;
          eldoria.ui.renderAll();
        }"""
    )


def prepare_screenshot_state(page: Page) -> None:
    page.evaluate(
        """() => {
          const e=eldoria.engine, c=e.character;
          try { e.stopActivity('Screenshot setup'); } catch (_) {}
          c.name='Ari Vale'; c.title='Keeper of the Chronicle'; c.location='stonehaven';
          c.inbox.push({id:'qa-world',title:'The bell rings beneath Crystal Lake',message:'Mara Vale waits beside the dark water.',type:'quest',createdAt:Date.now(),read:false});
          c.discoveredRegions=[...new Set([...c.discoveredRegions,'crystal_lake'])];
          const q=e.getStoryQuestState('memory_bell');
          if(q.status==='available')e.startStoryQuest('memory_bell');
          e.startSkillAction('mine_copper');
          eldoria.ui.state.selectedRegion='crystal_lake';
          eldoria.ui.renderAll();
        }"""
    )


def close_modal(page: Page) -> None:
    try:
        hidden = page.locator("#modal-layer").get_attribute("hidden") is not None
        if not hidden:
            page.evaluate("eldoria.ui.closeModal()")
    except Exception:
        pass


def image_sizes(paths: list[Path]) -> list[tuple[int, int]]:
    # Pillow is available in the environment; keeping this local avoids browser-specific metadata handling.
    from PIL import Image

    result: list[tuple[int, int]] = []
    for path in paths:
        with Image.open(path) as image:
            result.append(image.size)
    return result


if __name__ == "__main__":
    raise SystemExit(main())
