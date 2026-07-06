/**
 * Pricing display consistency shield (2026-07-06).
 *
 * Root cause guarded: SettingsModal hard-coded stale prices ($49/$199) that
 * contradicted the canonical catalog in src/lib/pricing.ts (CAD $29/$79).
 * Every UI surface must render prices FROM the catalog, never inline.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PLANS, PLAN_ORDER } from '../../src/lib/pricing';

const modalSrc = readFileSync(join(__dirname, '..', '..', 'src', 'components', 'SettingsModal.tsx'), 'utf8');

describe('pricing display consistency', () => {
    it('SettingsModal contains no hard-coded dollar prices', () => {
        expect(modalSrc).not.toMatch(/\$\s?\d/);
    });

    it('SettingsModal renders tiers from the canonical pricing catalog', () => {
        expect(modalSrc).toContain("from '@/lib/pricing'");
        expect(modalSrc).toContain('PLAN_ORDER');
        expect(modalSrc).toContain('visiblePlans');
    });

    it('canonical catalog holds the approved prices', () => {
        expect(PLANS.pro.price).toBe('CAD $29');
        expect(PLANS.team.price).toBe('CAD $79');
        expect(PLANS.verified.price).toBe('CAD $499');
        expect(PLANS.certified.price).toBe('CAD $1,499');
        expect(PLAN_ORDER).toHaveLength(6);
    });
});
