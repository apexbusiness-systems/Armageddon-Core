"""Capture screenshots of the Armageddon marketing site."""

from playwright.sync_api import sync_playwright
import os

OUTPUT_DIR = (
    r"C:\Users\sinyo\.gemini\antigravity\brain\74e6738e-8ef3-439e-945a-a1957ee72f66"
)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1920, "height": 1080})

    # Navigate to the site
    page.goto("http://localhost:3001")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)  # Wait for animations

    # Screenshot 1: Hero section
    page.screenshot(
        path=os.path.join(OUTPUT_DIR, "armageddon_hero.png"), full_page=False
    )
    print("✓ Captured hero section")

    # Scroll to battery grid bottom (where Supply Chain is)
    page.evaluate("window.scrollTo(0, 1600)")
    page.wait_for_timeout(500)
    page.screenshot(
        path=os.path.join(OUTPUT_DIR, "armageddon_batteries.png"), full_page=False
    )
    print("✓ Captured battery grid (bottom)")

    # Scroll to seal/footer
    page.evaluate("window.scrollTo(0, 2600)")
    page.wait_for_timeout(500)
    page.screenshot(
        path=os.path.join(OUTPUT_DIR, "armageddon_seal.png"), full_page=False
    )
    print("✓ Captured seal section")

    # Full page screenshot
    page.evaluate("window.scrollTo(0, 0)")
    page.wait_for_timeout(300)
    page.screenshot(
        path=os.path.join(OUTPUT_DIR, "armageddon_full.png"), full_page=True
    )
    print("✓ Captured full page")

    browser.close()
    print("\n✅ All screenshots captured successfully!")
