/**
 * ═══════════════════════════════════════════════════════════════════════════
 * RATE LIMITER UNIT TESTS
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RateLimiter } from '../../src/lib/rate-limit';

describe('RateLimiter', () => {
    let limiter: RateLimiter;

    beforeEach(() => {
        // 2 requests per 100ms for testing
        limiter = new RateLimiter({
            intervalMs: 100,
            limit: 2,
        });
    });

    it('should allow requests within limit', () => {
        expect(limiter.check('user1')).toBe(true);
        expect(limiter.check('user1')).toBe(true);
    });

    it('should block requests exceeding limit', () => {
        expect(limiter.check('user1')).toBe(true);
        expect(limiter.check('user1')).toBe(true);
        expect(limiter.check('user1')).toBe(false);
    });

    it('should allow requests after interval has passed', () => {
        vi.useFakeTimers();

        expect(limiter.check('user1')).toBe(true);
        expect(limiter.check('user1')).toBe(true);
        expect(limiter.check('user1')).toBe(false);

        // Advance time by more than intervalMs
        vi.advanceTimersByTime(101);

        expect(limiter.check('user1')).toBe(true);

        vi.useRealTimers();
    });

    it('should track different tokens independently', () => {
        expect(limiter.check('user1')).toBe(true);
        expect(limiter.check('user1')).toBe(true);
        expect(limiter.check('user1')).toBe(false);

        expect(limiter.check('user2')).toBe(true);
        expect(limiter.check('user2')).toBe(true);
    });

    it('should prune old entries', () => {
        vi.useFakeTimers();

        limiter.check('user1');

        // Advance time
        vi.advanceTimersByTime(101);

        // At this point 'user1' is still in cache but timestamps are old
        limiter.prune();

        // Now 'user1' should be removed from cache (internally)
        // We can check if it still works
        expect(limiter.check('user1')).toBe(true);

        vi.useRealTimers();
    });
});
