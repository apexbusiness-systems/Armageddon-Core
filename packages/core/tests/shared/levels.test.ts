import { describe, it, expect } from 'vitest';
import {
    MIN_CERTIFICATION_LEVEL,
    MAX_CERTIFICATION_LEVEL,
    CERTIFICATION_LEVELS,
    TIER_LEVEL_ACCESS,
    BILLING_TIERS,
    isCertificationLevel,
    getLevelCapability,
    allowedLevelsForTier,
    tierCanRunLevel,
    requiredTierForLevel,
    levelRequiresMoat,
    levelRequiresLiveFire,
    levelIsAttested,
} from '@armageddon/shared';

describe('certification levels — single source of truth', () => {
    it('bounds are 1..8', () => {
        expect(MIN_CERTIFICATION_LEVEL).toBe(1);
        expect(MAX_CERTIFICATION_LEVEL).toBe(8);
    });

    it('manifest covers exactly every level in [MIN..MAX] with matching keys', () => {
        for (let lvl = MIN_CERTIFICATION_LEVEL; lvl <= MAX_CERTIFICATION_LEVEL; lvl++) {
            const cap = CERTIFICATION_LEVELS[lvl as keyof typeof CERTIFICATION_LEVELS];
            expect(cap, `level ${lvl} present`).toBeDefined();
            expect(cap.level).toBe(lvl);
        }
        expect(Object.keys(CERTIFICATION_LEVELS)).toHaveLength(MAX_CERTIFICATION_LEVEL);
    });

    it('isCertificationLevel accepts integers 1..8 and rejects everything else', () => {
        for (let lvl = 1; lvl <= 8; lvl++) expect(isCertificationLevel(lvl)).toBe(true);
        for (const bad of [0, 9, -1, 7.5, '7', null, undefined, NaN, {}]) {
            expect(isCertificationLevel(bad as unknown)).toBe(false);
        }
    });

    it('tier→level access is derived correctly', () => {
        expect([...TIER_LEVEL_ACCESS.free_dry]).toEqual([1, 2, 3]);
        expect([...TIER_LEVEL_ACCESS.verified]).toEqual([1, 2, 3, 4, 5, 6]);
        expect([...TIER_LEVEL_ACCESS.certified]).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
        expect([...allowedLevelsForTier('certified')]).toContain(8);
        expect(allowedLevelsForTier('nope')).toEqual([]);
    });

    it('tierCanRunLevel enforces boundaries', () => {
        expect(tierCanRunLevel('certified', 8)).toBe(true);
        expect(tierCanRunLevel('certified', 7)).toBe(true);
        expect(tierCanRunLevel('verified', 7)).toBe(false);
        expect(tierCanRunLevel('verified', 8)).toBe(false);
        expect(tierCanRunLevel('free_dry', 4)).toBe(false);
        expect(tierCanRunLevel('certified', 9)).toBe(false);
    });

    it('requiredTierForLevel maps to the minimum tier', () => {
        expect(requiredTierForLevel(3)).toBe('free_dry');
        expect(requiredTierForLevel(6)).toBe('verified');
        expect(requiredTierForLevel(7)).toBe('certified');
        expect(requiredTierForLevel(8)).toBe('certified');
        expect(requiredTierForLevel(99)).toBeUndefined();
    });

    it('Level 8 is the locked apex: air-gapped Moat + live-fire + attested', () => {
        const l8 = getLevelCapability(8)!;
        expect(l8.environment).toBe('MOAT');
        expect(l8.adversary).toBe('LIVE_FIRE');
        expect(l8.attested).toBe(true);
        expect(l8.minTier).toBe('certified');
        expect(levelRequiresMoat(8)).toBe(true);
        expect(levelRequiresLiveFire(8)).toBe(true);
        expect(levelIsAttested(8)).toBe(true);
    });

    it('Level 7 is cloud live-fire (not Moat); 1-6 are simulation', () => {
        expect(levelRequiresMoat(7)).toBe(false);
        expect(levelRequiresLiveFire(7)).toBe(true);
        expect(levelIsAttested(7)).toBe(true);
        for (const lvl of [1, 2, 3, 4, 5, 6]) {
            expect(levelRequiresLiveFire(lvl)).toBe(false);
            expect(levelRequiresMoat(lvl)).toBe(false);
        }
    });

    it('exported structures are frozen (immutable / idempotent)', () => {
        expect(Object.isFrozen(CERTIFICATION_LEVELS)).toBe(true);
        expect(Object.isFrozen(TIER_LEVEL_ACCESS)).toBe(true);
        expect(Object.isFrozen(BILLING_TIERS)).toBe(true);
        expect(Object.isFrozen(CERTIFICATION_LEVELS[8])).toBe(true);
    });
});
