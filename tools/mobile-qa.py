#!/usr/bin/env python3
"""Phone-first responsive QA for Chronicles of Eldoria 1.1.1.

Runs against a local server (default http://127.0.0.1:4173/) and writes
MOBILE_QA_REPORT.json. The test focuses on common phone resolutions,
portrait/landscape density, fixed UI overlap, horizontal clipping, modal
containment, and the mobile-only toast policy.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BASE_URL = os.environ.get("ELDORIA_QA_URL", "http://127.0.0.1:4173/")
REPORT_PATH = ROOT / "MOBILE_QA_REPORT.json"

PHONE_VIEWPORTS = [
    (320, 568, "Legacy small phone"),
    (360, 640, "Small Android"),
    (360, 740, "Galaxy-class Android"),
    (360, 780, "Modern narrow Android"),
    (375, 667, "iPhone SE / 8"),
    (390, 844, "iPhone 12–14"),
    (393, 852, "iPhone 14 Pro"),
    (412, 915, "Pixel 7-class Android"),
    (430, 932, "iPhone Pro Max"),
    (568, 320, "Small phone landscape"),
    (667, 375, "iPhone landscape"),
    (740, 360, "Android landscape"),
    (844, 390, "iPhone modern landscape"),
    (915, 412, "Pixel landscape"),
]

VIEWS = ["dashboard", "map", "skills", "combat", "quests", "town", "bank", "character", "collections", "settings"]


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def main() -> int:
    report: dict[str, Any] = {
        "project": "Chronicles of Eldoria — Mobile Layout Stabilization",
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

    def record(name: str, passed: bool, details: Any = None) -> None:
        report["checks"].append({"name": name, "passed": bool(passed), "details": details})
        print(f"{'PASS' if passed else 'FAIL'}: {name}")
        if not passed and details is not None:
            print(json.dumps(details, indent=2)[:4000])

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            executable_path="/usr/bin/chromium",
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
        )
        context = browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=1,
            service_workers="block",
            locale="en-US",
        )
        page = context.new_page()
        page.set_default_timeout(12_000)
        page.on("pageerror", lambda error: report["runtimeErrors"].append({"type": "pageerror", "message": str(error)}))
        page.on("console", lambda message: report["runtimeErrors"].append({"type": "console", "message": message.text}) if message.type == "error" else None)

        page.goto(BASE_URL, wait_until="networkidle")
        page.wait_for_function("window.eldoria && window.eldoria.engine && window.eldoria.ui")
        page.wait_for_function("document.querySelector('#boot-screen')?.hidden === true")
        create_character_if_needed(page)
        seed_character(page)

        for width, height, device in PHONE_VIEWPORTS:
            page.set_viewport_size({"width": width, "height": height})
            landscape = width > height
            for view in VIEWS:
                close_modal(page)
                page.evaluate("view => eldoria.ui.setView(view)", view)
                page.wait_for_timeout(80)
                metrics = page.evaluate(
                    """({view,width,height,landscape,device}) => {
                      const q = selector => document.querySelector(selector);
                      const visible = node => {
                        if (!node) return false;
                        const style = getComputedStyle(node);
                        const rect = node.getBoundingClientRect();
                        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
                      };
                      const rect = node => node?.getBoundingClientRect()?.toJSON() || null;
                      const de = document.documentElement;
                      const body = document.body;
                      const top = q('.topbar');
                      const main = q('#main-view');
                      const nav = q('.mobile-nav');
                      const header = q('.page-header');
                      const description = q('.page-description');
                      const actions = q('.page-actions');
                      const categoryTabs = q('.category-tabs');
                      const toastRegion = q('.toast-region');
                      const topRect = rect(top), mainRect = rect(main), navRect = rect(nav), headerRect = rect(header), toastRect = rect(toastRegion);
                      const visibleToasts = [...document.querySelectorAll('.toast-region .toast')].filter(visible);
                      const pageActionScrollSafe = !actions || actions.scrollWidth <= actions.clientWidth + 1 || ['auto','scroll'].includes(getComputedStyle(actions).overflowX);
                      const categoryScrollSafe = !categoryTabs || categoryTabs.scrollWidth <= categoryTabs.clientWidth + 1 || ['auto','scroll'].includes(getComputedStyle(categoryTabs).overflowX);
                      const descriptionLineHeight = description ? parseFloat(getComputedStyle(description).lineHeight) || 0 : 0;
                      const descriptionLines = description && descriptionLineHeight ? description.getBoundingClientRect().height / descriptionLineHeight : 0;
                      const intendedScroll = node => {
                        for (let current=node?.parentElement; current && current !== main; current=current.parentElement) {
                          const style=getComputedStyle(current);
                          if (['auto','scroll'].includes(style.overflowX)) return true;
                        }
                        return false;
                      };
                      const clippedControls = [...document.querySelectorAll('#main-view button, #main-view input, #main-view select')]
                        .filter(visible)
                        .filter(node => {
                          if (intendedScroll(node)) return false;
                          const r=node.getBoundingClientRect();
                          return r.left < mainRect.left - 1 || r.right > mainRect.right + 1;
                        })
                        .slice(0,8)
                        .map(node => ({text:(node.textContent||node.getAttribute('aria-label')||'').trim().slice(0,50), rect:rect(node)}));
                      return {
                        view,width,height,device,landscape,
                        documentOverflow: Math.max(0,de.scrollWidth-de.clientWidth),
                        bodyOverflow: Math.max(0,body.scrollWidth-body.clientWidth),
                        mainOverflow: main ? Math.max(0,main.scrollWidth-main.clientWidth) : null,
                        topRect,mainRect,navRect,headerRect,toastRect,
                        topbarHeight: topRect?.height || 0,
                        mainHeight: mainRect?.height || 0,
                        navHeight: navRect?.height || 0,
                        headerHeight: headerRect?.height || 0,
                        mainFitsBetweenChrome: Boolean(topRect && mainRect && navRect && mainRect.top >= topRect.bottom - 1 && mainRect.bottom <= navRect.top + 1),
                        descriptionLines,
                        pageActionScrollSafe,
                        categoryScrollSafe,
                        visibleToastCount: visibleToasts.length,
                        toastAvoidsNav: !toastRect || !navRect || toastRect.bottom <= navRect.top - 2 || toastRect.top >= navRect.bottom + 2,
                        clippedControls,
                        appVisible: visible(q('#game-shell')),
                        mainHasContent: Boolean(main?.textContent?.trim()),
                      };
                    }""",
                    {"view": view, "width": width, "height": height, "landscape": landscape, "device": device},
                )

                top_limit = 50 if landscape else 60
                nav_limit = 48 if landscape else 60
                header_limit = 52 if landscape else 130
                passed = (
                    metrics["appVisible"]
                    and metrics["mainHasContent"]
                    and metrics["documentOverflow"] <= 1
                    and metrics["bodyOverflow"] <= 1
                    and (metrics["mainOverflow"] is None or metrics["mainOverflow"] <= 1)
                    and metrics["topbarHeight"] <= top_limit
                    and metrics["navHeight"] <= nav_limit
                    and metrics["headerHeight"] <= header_limit
                    and metrics["mainFitsBetweenChrome"]
                    and metrics["descriptionLines"] <= 2.15
                    and metrics["pageActionScrollSafe"]
                    and metrics["categoryScrollSafe"]
                    and not metrics["clippedControls"]
                )
                report["viewportResults"].append({**metrics, "passed": passed})

        failures = [entry for entry in report["viewportResults"] if not entry["passed"]]
        record(
            "All common phone resolution/view combinations avoid clipping and excessive chrome",
            not failures,
            {"tested": len(report["viewportResults"]), "failures": failures[:12]},
        )

        # Explicitly verify mobile toast behavior. Trigger multiple messages; only newest may remain visible.
        page.set_viewport_size({"width": 320, "height": 568})
        page.evaluate("""() => { eldoria.ui.toast('First notice','Should be replaced on mobile','success'); eldoria.ui.toast('Newest notice','Only this notice should remain','success'); }""")
        page.wait_for_timeout(50)
        toast_policy = page.evaluate(
            """() => ({
              total: document.querySelectorAll('.toast-region .toast').length,
              visible: [...document.querySelectorAll('.toast-region .toast')].filter(node => getComputedStyle(node).display !== 'none').length,
              newest: document.querySelector('.toast-region .toast:last-child strong')?.textContent || ''
            })"""
        )
        record("Mobile notifications are capped to the newest toast", toast_policy["total"] == 1 and toast_policy["visible"] == 1 and toast_policy["newest"] == "Newest notice", toast_policy)

        # Modal containment on the smallest portrait and landscape phones.
        modal_results = []
        for width, height in [(320, 568), (568, 320)]:
            page.set_viewport_size({"width": width, "height": height})
            page.evaluate("eldoria.ui.openMobileMenu()")
            page.wait_for_timeout(50)
            modal_results.append(page.evaluate(
                """({width,height}) => {
                  const card=document.querySelector('#modal-card'); const r=card.getBoundingClientRect();
                  return {width,height,rect:r.toJSON(),contained:r.left>=-1 && r.right<=width+1 && r.top>=-1 && r.bottom<=height+1};
                }""",
                {"width": width, "height": height},
            ))
            close_modal(page)
        record("Mobile menu sheets stay within portrait and landscape viewports", all(item["contained"] for item in modal_results), modal_results)

        # Desktop guard: the desktop shell remains the full three-column layout and mobile navigation stays hidden.
        page.set_viewport_size({"width": 1366, "height": 768})
        page.evaluate("eldoria.ui.setView('dashboard')")
        desktop_guard = page.evaluate(
            """() => {
              const shell=getComputedStyle(document.querySelector('.game-shell'));
              const top=document.querySelector('.topbar').getBoundingClientRect();
              return {
                columns:shell.gridTemplateColumns,
                topbarHeight:top.height,
                sidebarDisplay:getComputedStyle(document.querySelector('.sidebar')).display,
                contextDisplay:getComputedStyle(document.querySelector('.context-drawer')).display,
                mobileNavDisplay:getComputedStyle(document.querySelector('.mobile-nav')).display,
                activityDisplay:getComputedStyle(document.querySelector('.activity-chip')).display,
              };
            }"""
        )
        record(
            "Desktop layout remains the original three-column shell",
            desktop_guard["sidebarDisplay"] != "none"
            and desktop_guard["contextDisplay"] != "none"
            and desktop_guard["mobileNavDisplay"] == "none"
            and desktop_guard["activityDisplay"] != "none"
            and desktop_guard["topbarHeight"] >= 60,
            desktop_guard,
        )

        browser.close()

    report["completedAt"] = utc_now()
    report["summary"] = {
        "phoneViewports": len(PHONE_VIEWPORTS),
        "viewsPerViewport": len(VIEWS),
        "viewportViewChecks": len(report["viewportResults"]),
        "viewportFailures": len([entry for entry in report["viewportResults"] if not entry["passed"]]),
        "runtimeErrors": len(report["runtimeErrors"]),
        "checksPassed": sum(1 for check in report["checks"] if check["passed"]),
        "checksTotal": len(report["checks"]),
    }
    report["passed"] = report["summary"]["viewportFailures"] == 0 and not report["runtimeErrors"] and all(check["passed"] for check in report["checks"])
    REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report["summary"], indent=2))
    return 0 if report["passed"] else 1


def create_character_if_needed(page) -> None:
    if page.locator("#character-gate").is_visible():
        page.locator('[data-action="create-character"]').first.click()
        form = page.locator("#create-character-form")
        form.wait_for(state="visible")
        form.locator('input[name="name"]').fill("Ari Vale")
        form.locator('button[type="submit"]').click()
    page.wait_for_selector("#game-shell:not([hidden])")


def seed_character(page) -> None:
    page.evaluate(
        """() => {
          const e=eldoria.engine,c=e.character;
          c.name='Ari Vale'; c.title='Keeper of the Chronicle';
          for (const key of Object.keys(c.xp)) c.xp[key]=Math.max(c.xp[key]||0,250000);
          c.coins=Math.max(c.coins,12500); c.currentHp=e.getCombatStats().maxHp;
          c.discoveredRegions=[...new Set([...c.discoveredRegions,'crystal_lake','riverside','willowbrook','pineglade','watchpost','waveport'])];
          eldoria.ui.renderAll();
        }"""
    )


def close_modal(page) -> None:
    try:
        if page.locator("#modal-layer").get_attribute("hidden") is None:
            page.evaluate("eldoria.ui.closeModal()")
    except Exception:
        pass


if __name__ == "__main__":
    raise SystemExit(main())
