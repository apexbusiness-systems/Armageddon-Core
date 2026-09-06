import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { loadAtscEnv } from './load_env.mjs';

function getCredentials() {
    const fileEnv = loadAtscEnv();
    const email = process.env.TEST_USER_EMAIL || process.env.USERNAME || fileEnv.USERNAME;
    const password = process.env.TEST_USER_PASSWORD || process.env.PASSWORD || fileEnv.PASSWORD;
    if (!email || !password) {
        throw new Error('Missing credentials: set TEST_USER_EMAIL and TEST_USER_PASSWORD or provide ATSC_ENV_PATH.');
    }
    return { email, password };
}

const artifactsDir = process.env.ARTIFACTS_DIR || path.resolve('test-results');
if (!fs.existsSync(artifactsDir)) fs.mkdirSync(artifactsDir, { recursive: true });

async function runE2E() {
    console.log('[E2E] Starting Playwright Browser Automation for Paid User Onboarding & Sequence...');
    const creds = getCredentials();
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        acceptDownloads: true
    });
    const page = await context.newPage();

    // Detect any stray localhost requests
    page.on('request', req => {
        if (req.url().includes('localhost')) {
            console.error('[E2E ERROR] Stray localhost request detected:', req.url());
        }
    });

    // Step 1: Open Home Page
    console.log('[E2E] Navigating to https://armageddontest.icu...');
    await page.goto('https://armageddontest.icu');

    // Step 2: Open Auth Modal
    console.log('[E2E] Opening Auth Modal...');
    const loginButton = page.locator('button', { hasText: /LOG\s*IN/i }).first();
    await loginButton.waitFor({ state: 'visible', timeout: 10000 });
    await loginButton.click();

    // Step 3: Fill Credentials
    console.log(`[E2E] Entering credentials for ${creds.email}...`);
    await page.fill('#auth-email', creds.email);
    await page.fill('#auth-password', creds.password);

    const submitBtn = page.locator('button[type="submit"]', { hasText: /SIGN IN/i });
    await submitBtn.click();

    // Wait for login to settle
    console.log('[E2E] Waiting for authenticated session...');
    const logoutBtn = page.locator('button', { hasText: /LOGOUT/i }).first();
    await logoutBtn.waitFor({ state: 'visible', timeout: 15000 });
    console.log('[E2E] Logged in successfully!');

    await page.screenshot({ path: path.join(artifactsDir, 'paid_user_authenticated.png'), fullPage: true });

    // Step 4: Navigate to /onboarding
    console.log('[E2E] Navigating to /onboarding...');
    await page.goto('https://armageddontest.icu/onboarding');

    console.log('[E2E] Filling Onboarding Pipeline form...');
    await page.fill('#orgName', 'APEX Business Systems Ltd.');
    await page.fill('#contactEmail', 'jrmendozaceo@apexbusiness-systems.icu');
    await page.selectOption('#tier', 'certified');
    await page.fill('#targetSystemName', 'APEX Core Banking Gateway');
    await page.fill('#targetUrl', 'https://armageddon-exec-api.onrender.com/health');
    await page.selectOption('#environment', 'staging');

    await page.check('#authorizationConfirmed');
    await page.check('#acceptableUseAck');

    await page.screenshot({ path: path.join(artifactsDir, 'onboarding_paid_user_filled.png'), fullPage: true });

    console.log('[E2E] Submitting Onboarding form...');
    const saveBtn = page.locator('button[type="submit"]');
    await saveBtn.click();

    // Step 5: Wait for navigation to /console
    console.log('[E2E] Waiting for navigation to /console...');
    await page.waitForURL('**/console', { timeout: 15000 });
    await page.waitForTimeout(3000);
    console.log('[E2E] Reached /console successfully!');

    // Wait for target locked panel
    await page.waitForSelector('text=TARGET LOCKED', { timeout: 15000 });
    console.log('[E2E] TARGET LOCKED verified on /console!');

    await page.screenshot({ path: path.join(artifactsDir, 'console_ready_to_initiate.png'), fullPage: true });

    // Step 6: Click INITIATE SEQUENCE
    console.log('[E2E] Locating INITIATE SEQUENCE button...');
    const initiateBtn = page.locator('button', { hasText: /INITIATE SEQUENCE/i });
    await initiateBtn.waitFor({ state: 'visible', timeout: 10000 });
    await initiateBtn.click();
    console.log('[E2E] INITIATE SEQUENCE clicked!');

    // Step 7: Monitor Terminal Execution
    console.log('[E2E] Monitoring live terminal execution...');
    const terminal = page.locator('.terminal-content');

    // Wait for sequence completion verdict (either passed or review required)
    console.log('[E2E] Waiting for run completion verdict in terminal...');
    const exportBtn = page.locator('button', { hasText: /EXPORT.*EVIDENCE/i });
    await exportBtn.waitFor({ state: 'visible', timeout: 60000 });
    console.log('[E2E] Run complete! Export button activated!');

    // Print terminal content
    const terminalText = await terminal.innerText();
    console.log('\n--- TERMINAL OUTPUT ---\n' + terminalText + '\n-----------------------\n');

    await page.screenshot({ path: path.join(artifactsDir, 'sequence_completed_verdict.png'), fullPage: true });

    // Step 8: Export Evidence
    console.log('[E2E] Clicking EXPORT EVIDENCE (JSON) button...');
    const [download] = await Promise.all([
        page.waitForEvent('download'),
        exportBtn.click(),
    ]);

    const downloadPath = path.join(artifactsDir, 'armageddon-evidence-latest.json');
    await download.saveAs(downloadPath);
    console.log(`[E2E] Evidence JSON downloaded successfully to: ${downloadPath}`);

    const evidenceContent = fs.readFileSync(downloadPath, 'utf8');
    console.log('\n--- EVIDENCE ARTIFACT PREVIEW ---\n' + evidenceContent.slice(0, 500) + '...\n');

    await page.screenshot({ path: path.join(artifactsDir, 'evidence_exported.png'), fullPage: true });

    await browser.close();
    console.log('[E2E] Validation completed with 100% success!');
}

try {
    await runE2E();
} catch (err) {
    console.error('[E2E] Error:', err);
    process.exit(1);
}
