from playwright.sync_api import sync_playwright
import time

def verify_frontend():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1280, 'height': 800})
        page = context.new_page()

        # Wait for server
        for i in range(30):
            try:
                page.goto("http://localhost:3000")
                break
            except:
                time.sleep(1)

        # 1. Homepage
        print("Verifying Homepage...")
        page.goto("http://localhost:3000")
        page.wait_for_load_state("networkidle")
        page.screenshot(path="verification_home.png", full_page=True)

        # 2. Dry Run
        print("Verifying Dry Run...")
        page.goto("http://localhost:3000/dry-run")
        page.wait_for_load_state("networkidle")
        # Wait for console to appear
        page.wait_for_selector(".terminal-header", timeout=5000)
        page.screenshot(path="verification_dry_run.png", full_page=True)

        # 3. Docs
        print("Verifying Docs...")
        page.goto("http://localhost:3000/docs/batteries")
        page.wait_for_load_state("networkidle")
        page.screenshot(path="verification_docs.png", full_page=True)

        # 4. Doc Detail
        print("Verifying Doc Detail...")
        page.goto("http://localhost:3000/docs/batteries/10")
        page.wait_for_load_state("networkidle")
        page.screenshot(path="verification_doc_detail.png", full_page=True)

        browser.close()
        print("Verification complete.")

if __name__ == "__main__":
    verify_frontend()
