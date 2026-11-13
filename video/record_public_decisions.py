#!/usr/bin/env python3
"""Capture the two public, read-only Decisions interactions used in the demo.

This opens an isolated Chromium context, never a signed-in user browser. The page
only reads final contract views and configured executed call references.
"""

from __future__ import annotations

import shutil
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parent
URL = "https://www.agenttrust.tech/decisions"
DATE = "2026-11-13"


def capture(browser, row: int, name: str) -> None:
    work = ROOT / "work/recordings"
    work.mkdir(parents=True, exist_ok=True)
    context = browser.new_context(
        viewport={"width": 1920, "height": 1080},
        device_scale_factor=1,
        record_video_dir=str(work),
        record_video_size={"width": 1920, "height": 1080},
    )
    page = context.new_page()
    page.goto(URL, wait_until="domcontentloaded", timeout=30_000)
    page.locator("article").nth(row).wait_for(timeout=20_000)
    page.get_by_role("button", name="REJECT ALL").click()
    page.evaluate("document.body.style.zoom = '2'")
    target = page.locator("article").nth(row)
    target.evaluate("el => window.scrollBy(0, el.getBoundingClientRect().top - 340)")
    page.wait_for_timeout(1000)
    target.locator("summary").first.click()
    page.wait_for_timeout(4500)
    context.close()
    destination = ROOT / f"assets/decisions-{name}-{DATE}.webm"
    shutil.copyfile(page.video.path(), destination)
    print(destination)


def main() -> None:
    if datetime.now(timezone.utc).date().isoformat() != DATE:
        raise ValueError("this archival capture script is pinned to 13 Nov 2026")
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        try:
            capture(browser, 0, "model-b")
            capture(browser, 2, "direct-a")
        finally:
            browser.close()


if __name__ == "__main__":
    main()
