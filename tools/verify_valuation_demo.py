#!/usr/bin/env python3
from __future__ import annotations

from datetime import datetime
import json
from pathlib import Path
import re

from playwright.sync_api import sync_playwright


URL = "https://mobleysoft.com/valuation/"
SCREENSHOT = Path("/tmp/mobley-valuation-certified.png")


def main() -> int:
    checks: dict[str, bool] = {}
    observations: dict[str, str] = {}
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 1000})
        page = context.new_page()
        cdp = context.new_cdp_session(page)
        cdp.send("WebAuthn.enable")
        cdp.send(
            "WebAuthn.addVirtualAuthenticator",
            {
                "options": {
                    "protocol": "ctap2",
                    "transport": "internal",
                    "hasResidentKey": True,
                    "hasUserVerification": True,
                    "isUserVerified": True,
                    "automaticPresenceSimulation": True,
                }
            },
        )

        response = page.goto(URL, wait_until="networkidle")
        checks["public_html_200"] = response is not None and response.status == 200
        checks["virtual_twin_explained"] = "Meet the twin" in page.locator(".demo-intro h1").inner_text()
        page.wait_for_function("document.querySelector('#sessionStatus').textContent.includes('EPHEMERAL')")
        checks["ephemeral_session_started"] = "EPHEMERAL" in page.locator("#sessionStatus").inner_text()

        page.locator("#passkeyButton").click()
        page.wait_for_function("document.querySelector('#passkeyButton').textContent.includes('PASSKEY ACTIVE')")
        checks["passkey_registered"] = page.locator("#passkeyButton").inner_text() == "PASSKEY ACTIVE"

        prompt = "Design a launch surface for Unlost, a context concierge that searches everything I own."
        page.locator("#prompt").fill(prompt)
        page.locator("#submitPrompt").click()
        page.wait_for_selector("#workspaceFrame:not([hidden])", timeout=30_000)
        page.wait_for_function("document.querySelector('#ticket').textContent.includes('VD-')")
        frame = page.locator("#workspaceFrame").content_frame
        frame.locator("h1").wait_for()
        workspace_title = frame.locator("h1").inner_text()
        checks["bounded_html_generated"] = workspace_title == "Search everything you own."
        checks["sandbox_has_no_script_permission"] = page.locator("#workspaceFrame").get_attribute("sandbox") == ""
        ticket_text = page.locator("#ticket").inner_text()
        checks["source_attributed_ticket"] = bool(re.search(r"MOBLEYSOFT VALUATION DEMO.*VD-", ticket_text))

        timestamps = page.evaluate(
            """async () => {
              const one = await fetch('./live.json?t=' + Date.now(), {cache: 'no-store'}).then(r => r.json());
              await new Promise(resolve => setTimeout(resolve, 1100));
              const two = await fetch('./live.json?t=' + Date.now(), {cache: 'no-store'}).then(r => r.json());
              return [one.generated_at, two.generated_at];
            }"""
        )
        checks["evidence_updates_live"] = timestamps[0] != timestamps[1]
        observations["first_generated_at"] = timestamps[0]
        observations["second_generated_at"] = timestamps[1]

        context.clear_cookies()
        page.reload(wait_until="networkidle")
        page.wait_for_function("document.querySelector('#passkeyButton').textContent.includes('RESUME WITH PASSKEY')")
        page.locator("#passkeyButton").click()
        page.wait_for_function("document.querySelector('#passkeyButton').textContent.includes('PASSKEY ACTIVE')")
        checks["passkey_reauthenticated"] = page.locator("#sessionStatus").inner_text() == "PASSKEY CONTINUITY / ACTIVE"
        checks["conversation_restored"] = "Unlost" in page.locator("#messages").inner_text()

        page.screenshot(path=str(SCREENSHOT), full_page=True)
        browser.close()

    passed = all(checks.values())
    payload = {
        "status": "passed" if passed else "failed",
        "observed_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "url": URL,
        "checks": checks,
        "observations": observations,
        "screenshot": str(SCREENSHOT),
    }
    print(json.dumps(payload, indent=2, sort_keys=True))
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
