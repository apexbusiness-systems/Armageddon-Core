/**
 * Phase 2d — Docs link regression guard
 * Contract: APEX-CCASP-v1 / armageddon-site/e2e/docs-link-regression.spec.ts
 *
 * Permanent regression guard: asserts the "Docs" nav link on both /support and /privacy
 * resolves to the correct Armageddon-Core repository (not the 404'd armageddon-test-suite).
 *
 * This spec is a CI gate — it must pass on every build after the Phase 1 fix.
 */

import { test, expect } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3100';
const CORRECT_DOCS_URL = 'https://github.com/apexbusiness-systems/Armageddon-Core';
const BROKEN_DOCS_URL_FRAGMENT = 'armageddon-test-suite';

test.describe('Docs link regression guard — Phase 1 permanent CI gate', () => {
    test('/support — Docs nav link points to Armageddon-Core, not armageddon-test-suite', async ({ page }) => {
        await page.goto(`${BASE}/support`);
        await page.waitForLoadState('domcontentloaded');

        // Find the Docs link in the nav area.
        const docsLink = page.locator('nav a[href*="github.com"]').first();
        await expect(docsLink).toBeVisible({ timeout: 5000 });

        const href = await docsLink.getAttribute('href');
        console.log('/support Docs link href:', href);

        // Assert correct target.
        expect(href, '/support Docs link must target Armageddon-Core').toBe(CORRECT_DOCS_URL);

        // Assert it does NOT contain the broken fragment.
        expect(href ?? '', '/support Docs link must not reference armageddon-test-suite').not.toContain(BROKEN_DOCS_URL_FRAGMENT);
    });

    test('/privacy — Docs nav link points to Armageddon-Core, not armageddon-test-suite', async ({ page }) => {
        await page.goto(`${BASE}/privacy`);
        await page.waitForLoadState('domcontentloaded');

        const docsLink = page.locator('nav a[href*="github.com"]').first();
        await expect(docsLink).toBeVisible({ timeout: 5000 });

        const href = await docsLink.getAttribute('href');
        console.log('/privacy Docs link href:', href);

        expect(href, '/privacy Docs link must target Armageddon-Core').toBe(CORRECT_DOCS_URL);
        expect(href ?? '', '/privacy Docs link must not reference armageddon-test-suite').not.toContain(BROKEN_DOCS_URL_FRAGMENT);
    });

    test('Armageddon-Core GitHub URL resolves to HTTP 200 (live URL health check)', async ({ request }) => {
        // Use Playwright's request context for a direct HTTP GET to the corrected URL.
        const response = await request.get(CORRECT_DOCS_URL, { maxRedirects: 5 });
        console.log('Armageddon-Core URL status:', response.status());
        expect(response.status(), `${CORRECT_DOCS_URL} must return 200, not 404`).toBe(200);
    });
});
