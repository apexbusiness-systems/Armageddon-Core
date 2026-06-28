import { test, expect } from '@playwright/test';

test.describe('Battery 7: local onboarding readiness smoke', () => {
  test('target endpoint onboarding saves local state and console blocks unsafe initiation', async ({ page }) => {
    await page.goto('/onboarding#target-config');

    await expect(page.getByRole('heading', { name: /onboarding/i })).toBeVisible();
    await page.getByLabel(/organization name/i).fill('APEX Local Smoke');
    await page.getByLabel(/e-mail|email/i).fill('security@example.com');
    await page.getByLabel(/target system name/i).fill('Checkout API');
    await page.getByLabel(/target endpoint or app url/i).fill('https://example.com');
    await page.getByLabel(/environment/i).selectOption('staging');
    await page.getByLabel(/authorized/i).check();
    await page.getByLabel(/acceptable use/i).check();

    await expect.poll(async () => page.evaluate(() => {
      const raw = window.localStorage.getItem('armageddon:onboarding-draft');
      return raw ? JSON.parse(raw).codebaseTarget?.endpointUrl : null;
    })).toBe('https://example.com');

    await page.getByRole('button', { name: /continue/i }).click();
    await expect(page.getByText(/Your selected target is saved locally/i)).toBeVisible();

    await page.goto('/console');

    await expect(page.getByRole('region', { name: /target configuration/i })).toContainText('Checkout API');
    await expect(page.getByRole('region', { name: /target configuration/i })).toContainText('https://example.com');
    await expect(page.getByRole('region', { name: /target configuration/i })).toContainText('Authorized use confirmed');

    const readiness = page.getByRole('region', { name: /run readiness checklist/i });
    await expect(readiness).toContainText('Target configured');
    await expect(readiness).toContainText('Authorized use confirmed');
    await expect(readiness).toContainText('Organization membership active');
    await expect(readiness).toContainText('Backend connected');
    await expect(readiness).toContainText('Battery access verified');
    await expect(readiness).toContainText(/Blocked: .*Organization membership active.*Backend connected.*Battery access verified/);

    await page.getByRole('button', { name: /initiate sequence/i }).focus();
    await page.keyboard.press('Enter');

    await expect(page.getByText(/RUN BLOCKED: Complete readiness items first: Organization membership active, Backend connected, Battery access verified\./)).toBeVisible();
    await expect(page.getByText('No run, analysis, verdict, or certificate has been started.')).toBeVisible();
  });
});
