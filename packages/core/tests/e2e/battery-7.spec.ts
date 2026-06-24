import { test, expect } from '@playwright/test';

test.describe('Battery 7: E2E Certification Campaign Workflow', () => {

  test('Full Journey: Onboarding through Artifact Export', async ({ page }) => {
    // Phase 1: Onboarding
    await page.goto('/onboarding');
    await expect(page.locator('h1')).toContainText(/Onboarding|Setup/i);
    await page.getByLabel(/Organization Name/i).fill('Test Org');
    await page.getByLabel(/Compliance Mode/i).selectOption('STRICT');
    await page.getByRole('button', { name: /Complete Setup/i }).click();

    await expect(page).toHaveURL(/\/console/);

    // Phase 2 & 3: Initialization and Live Operation
    await page.getByRole('button', { name: /INITIATE SEQUENCE/i }).click();
    await expect(page.locator('.terminal-content')).toBeVisible();
    
    // Phase 4 & 5: Certification Resolution and Artifact Export
    await expect(page.getByRole('button', { name: /EXPORT JSON EVIDENCE/i })).toBeVisible({ timeout: 45000 });

    const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
    await page.getByRole('button', { name: /EXPORT JSON EVIDENCE/i }).click();
    const download = await downloadPromise;
    
    // Assert download is successful
    expect(download.suggestedFilename()).toContain('.json');
  });
});

