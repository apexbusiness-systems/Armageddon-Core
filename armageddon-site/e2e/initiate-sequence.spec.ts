/**
 * Phase 2a — Free-tier "Initiate Sequence" full run
 * Contract: APEX-CCASP-v1 / armageddon-site/e2e/initiate-sequence.spec.ts
 *
 * Entry: homepage → login (self-serve user) → /console → click INITIATE SEQUENCE
 * Expected outcomes (either is a PASS):
 *   A) Run starts and progresses (Supabase realtime fires, sector counter changes, or
 *      terminal prints a run-started message beyond the boot line).
 *   B) Run is blocked with a named, specific reason (backend not connected; readiness
 *      blocker enumerated; access denied with error text) — NOT a generic "Failed to
 *      fetch", stack trace, or silent no-op.
 *
 * Screenshots captured: before-click, after-click (both in test-results/).
 */

import { test, expect } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3100';
// Credentials come from the environment only — never commit them.
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? '';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? '';

test.describe('Initiate Sequence — free-tier console flow', () => {
    test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'E2E admin credentials not configured');

    test.beforeEach(async ({ page }) => {
        await page.goto(`${BASE}/`);

        // Seed a valid self-serve onboarding draft so target + auth readiness checks pass.
        await page.evaluate(() => {
            localStorage.setItem('armageddon:onboarding-draft', JSON.stringify({
                orgName: 'E2E Test Org',
                contactEmail: 'e2e@armageddontest.icu',
                tier: 'self-serve',
                targetSystemName: 'E2E Test Target',
                targetUrl: 'https://example.com/api',
                environment: 'staging',
                authorizationConfirmed: true,
                acceptableUseAck: true,
                codebaseTarget: null,
            }));
            // Also store the codebase target so readSavedCodebaseTarget() returns non-null.
            localStorage.setItem('armageddon:codebase-target', JSON.stringify({
                id: 'e2e-target-001',
                type: 'endpoint',
                label: 'E2E Test Target',
                endpointUrl: 'https://example.com/api',
                status: 'ready',
                updatedAt: new Date().toISOString(),
            }));
        });

        await page.reload();
    });

    test('logs in, lands on console, clicks INITIATE SEQUENCE, captures result', async ({ page }) => {
        // ── Step 1: Login ──────────────────────────────────────────────────────
        const logoutBtn = page.getByRole('button', { name: /LOGOUT/i }).first();
        if (await logoutBtn.isVisible()) {
            await logoutBtn.click();
            await expect(page.getByRole('button', { name: /LOGIN/i }).first()).toBeVisible({ timeout: 5000 });
        }

        const loginBtn = page.getByRole('button', { name: /LOGIN/i }).first();
        if (await loginBtn.isVisible()) {
            await loginBtn.click();
            await page.locator('input#auth-email').fill(ADMIN_EMAIL);
            await page.locator('input#auth-password').fill(ADMIN_PASSWORD);
            await page.locator('button[type="submit"]').first().click();
            // Wait for auth: either LOGOUT appears or we get auto-redirected to /console
            await Promise.race([
                page.getByRole('button', { name: /LOGOUT/i }).first().waitFor({ state: 'visible', timeout: 10000 }),
                page.waitForURL('**/console', { timeout: 10000 }),
            ]).catch(() => { /* auth may redirect before LOGOUT button renders */ });
        }

        // ── Step 2: Navigate to console ────────────────────────────────────────
        await page.goto(`${BASE}/console`);
        await page.waitForLoadState('networkidle');

        // ── Step 3: Capture screenshot BEFORE clicking ─────────────────────────
        await page.screenshot({ path: 'test-results/initiate-sequence-before.png', fullPage: false });

        // ── Step 4: Intercept the /api/run request if it fires ─────────────────
        let runRequestIntercepted = false;
        let runResponseStatus = 0;
        let runRequestPayload = '';
        page.on('request', (req) => {
            if (req.url().includes('/api/run') && req.method() === 'POST') {
                runRequestIntercepted = true;
                runRequestPayload = req.postData() ?? '';
            }
        });
        page.on('response', (res) => {
            if (res.url().includes('/api/run') && res.request().method() === 'POST') {
                runResponseStatus = res.status();
            }
        });

        // ── Step 5: Find and click INITIATE SEQUENCE ───────────────────────────
        // The button text varies by i18n; try the most common form first.
        const initiateBtn = page.getByRole('button', { name: /INITIATE SEQUENCE/i });
        await expect(initiateBtn).toBeVisible({ timeout: 8000 });
        await expect(initiateBtn).not.toBeDisabled();

        await initiateBtn.click();

        // ── Step 6: Wait for a terminal response (honest outcome) ──────────────
        // Allow up to 15s for any of: run starts, specific error, or honest block message.
        // "AWAITING SEQUENCE INITIATION" is the idle state — we expect something DIFFERENT.
        const terminalContainer = page.locator('text=/ARMAGEDDON|SEQUENCE INITIATED|BACKEND NOT CONNECTED|RUN BLOCKED|SIGN IN|TARGET/i').first();
        // Also acceptable: a named blocker message with specific reason text (not generic "Failed to fetch").
        // Wait for the UI to transition from the default idle state
        await expect.poll(async () => {
            const text = await page.locator('body').innerText();
            return /ARMAGEDDON LEVEL.*SEQUENCE INITIATED/i.test(text)
                || /Connecting to Temporal workflow/i.test(text)
                || /LIVE-FIRE BACKEND NOT CONNECTED/i.test(text)
                || /backend is not connected/i.test(text)
                || /complete.*readiness/i.test(text)
                || /Sign in/i.test(text)
                || /Set the target/i.test(text)
                || /Access denied/i.test(text)
                || /run blocked/i.test(text)
                || /Failed to fetch/i.test(text)
                || runRequestIntercepted;
        }, { timeout: 15000 }).toBeTruthy().catch(() => null);

        // ── Step 7: Capture screenshot AFTER clicking ──────────────────────────
        await page.screenshot({ path: 'test-results/initiate-sequence-after.png', fullPage: false });

        // ── Step 8: Assert honest outcome ─────────────────────────────────────
        // Get all terminal text for inspection.
        const pageText = await page.locator('body').innerText();

        // PASS condition A: run started — terminal shows sequence-initiated line.
        const runStarted = /ARMAGEDDON LEVEL.*SEQUENCE INITIATED/i.test(pageText)
            || /Connecting to Temporal workflow/i.test(pageText)
            || runRequestIntercepted;

        // PASS condition B: honest, specific block — backend message, readiness list, or gated 403.
        const honestBlock = /LIVE-FIRE BACKEND NOT CONNECTED/i.test(pageText)
            || /backend is not connected/i.test(pageText)
            || /complete.*readiness/i.test(pageText)
            || /Sign in/i.test(pageText)
            || /Set the target/i.test(pageText)
            || /Access denied/i.test(pageText)
            || /run blocked/i.test(pageText);

        // FAIL condition: generic network failure reaching the UI.
        const genericFailure = /Failed to fetch/i.test(pageText) && !runStarted && !honestBlock;
        const stackTrace = /at .*\.(tsx?|js):\d+:\d+/.test(pageText);

        expect(genericFailure, 'UI must not expose a generic "Failed to fetch" error').toBe(false);
        expect(stackTrace, 'UI must not expose a raw stack trace').toBe(false);
        expect(runStarted || honestBlock, 'Run must either start or produce a named, specific block reason').toBe(true);

        // Log captured evidence for the report.
        console.log('--- INITIATE SEQUENCE EVIDENCE ---');
        console.log('Run request fired:', runRequestIntercepted);
        console.log('Run request payload:', runRequestPayload);
        console.log('Run response status:', runResponseStatus);
        console.log('Run started:', runStarted);
        console.log('Honest block:', honestBlock);
        console.log('--- END EVIDENCE ---');
    });
});
