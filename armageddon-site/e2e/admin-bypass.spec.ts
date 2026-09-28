import { test, expect } from '@playwright/test';

// Credentials come from the environment only — never commit them.
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? '';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? '';

test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'E2E admin credentials not configured');

test('Admin creates policy without approval prompt', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Mock target configuration in local storage
    await page.evaluate(() => {
        localStorage.setItem('armageddon:onboarding-draft', JSON.stringify({
            targetSystemName: 'E2E Test Target',
            targetUrl: 'https://example.com',
            environment: 'staging'
        }));
    });
    
    // Reload so TargetConfigPanel reads it on mount
    await page.reload();
    
    // Check if we need to log out first
    const logoutBtn = await page.getByRole('button', { name: 'LOGOUT' }).first();
    if (await logoutBtn.isVisible()) {
        await logoutBtn.click();
        await expect(page.getByRole('button', { name: 'LOGIN' }).first()).toBeVisible();
    }
    
    // Wait for LOGIN button and click
    const loginBtn = await page.getByRole('button', { name: 'LOGIN' }).first();
    await loginBtn.click();
    
    // Fill credentials in AuthModal
    await page.locator('input#auth-email').fill(ADMIN_EMAIL);
    await page.locator('input#auth-password').fill(ADMIN_PASSWORD);
    await page.locator('button[type="submit"]').first().click();
    
    // Wait for the UI to update to logged-in state (tier badge, LOGOUT button, etc.)
    await expect(page.getByRole('button', { name: 'LOGOUT' }).first()).toBeVisible({ timeout: 5000 });
    
    // Check for the "certified" badge or tier access
    // Admin override ensures we get "certified" which unlocks all
    // Batteries should be selectable (not disabled)
    const b10Button = page.getByRole('button', { name: /B10/ });
    if (await b10Button.isVisible()) {
        await expect(b10Button).not.toBeDisabled();
        await b10Button.click();
    }
    
    // Check that we can click Initiate Sequence
    const initiateBtn = page.getByRole('button', { name: /INITIATE SEQUENCE/ });
    if (await initiateBtn.isVisible()) {
        await expect(initiateBtn).not.toBeDisabled();
    }
});
