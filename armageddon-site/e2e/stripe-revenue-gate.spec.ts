/**
 * Phase 3 — Stripe Revenue Launch Gate
 * Contract: APEX-CCASP-v1 / armageddon-site/e2e/stripe-revenue-gate.spec.ts
 *
 * Assert that for a REVENUE LAUNCH, Stripe payment links are actively configured
 * in the environment. Without these, the site degrades to an honest "payment pending"
 * internal flow, which is unacceptable for a true revenue launch.
 */

import { test, expect } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3100';

test.describe('Stripe Revenue Launch Gate', () => {
    test('Paid tiers must route to external Stripe Payment Links', async ({ page }) => {
        await page.goto(`${BASE}/pricing`);
        await page.waitForLoadState('domcontentloaded');

        // Locate the Pro plan card
        const proCard = page.locator('.pricing-card', { hasText: 'Pro' }).first();
        await expect(proCard).toBeVisible({ timeout: 5000 });

        // Get the CTA button/link
        const proCta = proCard.locator('a').first();
        const href = await proCta.getAttribute('href');
        
        console.log('Pro Tier CTA href:', href);

        // For a revenue launch, this must be a Stripe URL (buy.stripe.com or similar)
        // NOT a relative /onboarding fallback.
        expect(href, 'Pro tier CTA must link to Stripe (buy.stripe.com) for a revenue launch').toMatch(/^https:\/\/(buy\.)?stripe\.com\//);
        
        // Target must be _blank for external Stripe links
        expect(await proCta.getAttribute('target'), 'Pro tier CTA must open in a new tab').toBe('_blank');
    });
});
