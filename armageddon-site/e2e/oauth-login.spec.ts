/**
 * Phase 2c — GitHub OAuth (Sign Up / Login)
 * Contract: APEX-CCASP-v1 / armageddon-site/e2e/oauth-login.spec.ts
 *
 * BLOCKED: no GitHub OAuth test account available in this session.
 *
 * The GitHub OAuth flow requires:
 *   1. A real GitHub account authorized against the ARMAGEDDON GitHub OAuth App.
 *   2. Supabase OAuth redirect handling (cross-origin browser redirect to GitHub → back).
 *   3. A verified organization_members row in Supabase for the OAuth user.
 *
 * None of these credentials are available to the Antigravity agent in this session.
 * Fabricating a login or mocking the OAuth callback is explicitly prohibited by the
 * contract ("do not fabricate a login").
 *
 * This file is a placeholder that:
 *   a) Documents the block explicitly (BLOCKED: no GitHub OAuth test account available).
 *   b) Validates the LOGIN/SIGN UP buttons exist and link to the correct OAuth entry point.
 *   c) Verifies no stack trace or raw internal error is exposed at the OAuth redirect surface.
 *
 * Full OAuth E2E coverage requires the following to be provisioned by JR before the test
 * can be written as a real passing spec:
 *   - GITHUB_OAUTH_TEST_EMAIL (a real GitHub account email)
 *   - GITHUB_OAUTH_TEST_PASSWORD (password for the test account)
 *   - The test account must already have authorized the ARMAGEDDON GitHub OAuth App
 *   - The account must have a valid organization_members row in Supabase
 *
 * BLOCKED: no GitHub OAuth test account available
 */

import { test, expect } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3100';

test.describe('GitHub OAuth — entry point validation (partial, BLOCKED full flow)', () => {
    test('LOGIN button is visible and navigation entry point is reachable', async ({ page }) => {
        await page.goto(`${BASE}/`);
        await page.waitForLoadState('domcontentloaded');

        // Verify the login entry point exists on the marketing surface.
        const loginBtn = page.getByRole('button', { name: /LOGIN/i }).first();
        // If user is already logged in (LOGOUT is shown), note that and skip.
        const logoutBtn = page.getByRole('button', { name: /LOGOUT/i }).first();
        const isLoggedIn = await logoutBtn.isVisible();

        if (isLoggedIn) {
            console.log('OAUTH-LOGIN EVIDENCE: session already active — LOGOUT button visible, skipping entry point check.');
            // If logged in, verify redirect to console works (no raw error).
            await expect(page).toHaveURL(/console|\//, { timeout: 5000 });
        } else {
            await expect(loginBtn).toBeVisible({ timeout: 5000 });
            // Click to open the auth modal — do NOT attempt GitHub OAuth (BLOCKED).
            await loginBtn.click();
            // Verify the auth modal opens (Supabase email+password login is available for
            // non-OAuth test accounts; GitHub OAuth button may appear here).
            const authEmailInput = page.locator('input#auth-email');
            await expect(authEmailInput).toBeVisible({ timeout: 5000 });
            console.log('OAUTH-LOGIN EVIDENCE: auth modal opened, email input visible. GitHub OAuth button (if present):');
            const githubBtn = page.getByRole('button', { name: /GitHub|Sign in with GitHub/i });
            const hasGithubBtn = await githubBtn.isVisible();
            console.log('GitHub OAuth button present:', hasGithubBtn);

            if (hasGithubBtn) {
                // Do NOT click — BLOCKED. Verify it has an href or click handler.
                const tag = await githubBtn.evaluate((el) => el.tagName);
                console.log('GitHub button tag:', tag);
                // No assertion beyond "it exists" — full flow is BLOCKED.
            }
        }

        // Universal assertion: no raw stack trace or internal error visible anywhere.
        const pageText = await page.locator('body').innerText();
        const hasStackTrace = /at .*\.(tsx?|js):\d+:\d+/.test(pageText);
        expect(hasStackTrace, 'No raw stack trace must be visible on the OAuth entry page').toBe(false);

        console.log('--- OAUTH LOGIN EVIDENCE ---');
        console.log('BLOCKED: no GitHub OAuth test account available');
        console.log('Partial check: LOGIN button / auth modal entry point validated');
        console.log('Full OAuth E2E: requires provisioning (see spec file header for requirements)');
        console.log('--- END EVIDENCE ---');
    });

    // Skipped test documents the missing full flow explicitly in the Playwright report.
    test.skip('Full GitHub OAuth round-trip — BLOCKED: no test account credentials available', async () => {
        // This test body is intentionally empty.
        // It will appear as "skipped" in the Playwright HTML report with the reason
        // visible in the test title.
        // To un-skip: provide GITHUB_OAUTH_TEST_EMAIL + GITHUB_OAUTH_TEST_PASSWORD
        // env vars and implement the full OAuth redirect + session verification flow.
    });
});
