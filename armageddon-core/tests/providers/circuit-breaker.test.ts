/**
 * CircuitBreaker Unit Tests
 *
 * COVERAGE:
 * - Cost limit enforcement (APEX-POWER Zero Tolerance)
 * - Token limit enforcement
 * - Rate limiting (non-tripping)
 * - Consecutive error handling
 * - State transitions (CLOSED → OPEN → HALF_OPEN → CLOSED)
 * - Cooldown period enforcement
 * - Cost calculation accuracy
 * - CircuitBreakerRegistry global limits
 *
 * NOTE: Tests validated locally via logical trace-through
 *       CI execution will confirm runtime behavior
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CircuitBreaker, CircuitBreakerRegistry } from '../../src/providers/circuit-breaker';

describe('CircuitBreaker', () => {
    let breaker: CircuitBreaker;

    beforeEach(() => {
        // Use small limits for testing
        breaker = new CircuitBreaker({
            maxCostUSD: 1.0,
            maxTokensPerRun: 1000,
            maxRequestsPerMinute: 2,
            maxConsecutiveErrors: 2,
            cooldownMs: 100,
        });
    });

    it('should start in CLOSED state', () => {
        expect(breaker.getState()).toBe('CLOSED');
        expect(breaker.canProceed()).toBe(true);
    });

    it('should trip when cost limit is reached (APEX-POWER Zero Tolerance)', () => {
        // Default cost config: $10/1M input, $30/1M output
        // 100k input tokens = $1.0
        breaker.recordSuccess(100000, 0, 100);
        expect(breaker.canProceed()).toBe(false);
        expect(breaker.getState()).toBe('OPEN');
    });

    it('should trip when token limit is reached', () => {
        // maxTokensPerRun = 1000
        breaker.recordSuccess(500, 501, 100);
        expect(breaker.canProceed()).toBe(false);
        expect(breaker.getState()).toBe('OPEN');
    });

    it('should return false but not trip when rate limit is reached', () => {
        // maxRequestsPerMinute = 2
        breaker.recordSuccess(1, 1, 10);
        breaker.recordSuccess(1, 1, 10);

        // Third request within a minute should fail canProceed but state remains CLOSED
        expect(breaker.canProceed()).toBe(false);
        expect(breaker.getState()).toBe('CLOSED');
    });

    it('should trip after max consecutive errors', () => {
        // maxConsecutiveErrors = 2
        breaker.recordError();
        expect(breaker.canProceed()).toBe(true);
        breaker.recordError();
        expect(breaker.canProceed()).toBe(false);
        expect(breaker.getState()).toBe('OPEN');
    });

    it('should transition to HALF_OPEN after cooldown and CLOSED after success', () => {
        vi.useFakeTimers();

        // Trip the breaker
        breaker.recordError();
        breaker.recordError();
        expect(breaker.getState()).toBe('OPEN');
        expect(breaker.canProceed()).toBe(false);

        // Advance time by cooldownMs
        vi.advanceTimersByTime(101);

        // canProceed should transition state to HALF_OPEN
        expect(breaker.canProceed()).toBe(true);
        expect(breaker.getState()).toBe('HALF_OPEN');

        // Success in HALF_OPEN should transition to CLOSED
        breaker.recordSuccess(1, 1, 10);
        expect(breaker.getState()).toBe('CLOSED');

        vi.useRealTimers();
    });

    it('should enforcement cooldown period', () => {
        vi.useFakeTimers();

        // Trip the breaker
        breaker.recordError();
        breaker.recordError();
        expect(breaker.getState()).toBe('OPEN');

        // Before cooldown
        vi.advanceTimersByTime(50);
        expect(breaker.canProceed()).toBe(false);
        expect(breaker.getState()).toBe('OPEN');

        // After cooldown
        vi.advanceTimersByTime(51);
        expect(breaker.canProceed()).toBe(true);
        expect(breaker.getState()).toBe('HALF_OPEN');

        vi.useRealTimers();
    });

    it('should calculate cost and remaining budget accurately', () => {
        // maxTokensPerRun = 1000, maxCostUSD = 1.0
        // Input: 100 tokens -> 100 / 1,000,000 * $10 = $0.001
        // Output: 100 tokens -> 100 / 1,000,000 * $30 = $0.003
        // Total: $0.004
        breaker.recordSuccess(100, 100, 100);

        const metrics = breaker.getMetrics();
        expect(metrics.totalCostUSD).toBeCloseTo(0.004);

        const budget = breaker.getRemainingBudget();
        expect(budget.costUSD).toBeCloseTo(0.996);
        expect(budget.tokens).toBe(800);
    });

    it('should reset metrics and state', () => {
        breaker.recordSuccess(100, 100, 50);
        breaker.recordError();
        breaker.reset();

        expect(breaker.getState()).toBe('CLOSED');
        const metrics = breaker.getMetrics();
        expect(metrics.totalCalls).toBe(0);
        expect(metrics.totalTokens).toBe(0);
        expect(metrics.totalCostUSD).toBe(0);
        expect(metrics.errorCount).toBe(0);
    });
});

describe('CircuitBreakerRegistry', () => {
    let registry: CircuitBreakerRegistry;

    beforeEach(() => {
        registry = CircuitBreakerRegistry.getInstance();
        registry.resetAll();
    });

    it('should be a singleton', () => {
        const instance2 = CircuitBreakerRegistry.getInstance();
        expect(registry).toBe(instance2);
    });

    it('should provide a global breaker with specific limits', () => {
        const globalBreaker = registry.getGlobal();
        expect(globalBreaker).toBeInstanceOf(CircuitBreaker);

        const budget = globalBreaker.getRemainingBudget();
        expect(budget.costUSD).toBe(50);
        expect(budget.tokens).toBe(500000);
    });

    it('should get or create provider-specific breakers', () => {
        const providerId = 'test-provider-unique';
        const b1 = registry.getOrCreate(providerId);
        const b2 = registry.getOrCreate(providerId);
        const b3 = registry.getOrCreate('different-provider');

        expect(b1).toBe(b2);
        expect(b1).not.toBe(b3);
    });

    it('should calculate total cost across all provider breakers', () => {
        const p1 = 'p1-cost';
        const p2 = 'p2-cost';
        const b1 = registry.getOrCreate(p1);
        const b2 = registry.getOrCreate(p2);

        // 100k input = $1.0
        b1.recordSuccess(100000, 0, 100);
        // 100k output = $3.0
        b2.recordSuccess(0, 100000, 100);

        expect(registry.getTotalCost()).toBeCloseTo(4.0);
    });

    it('should reset all breakers including global one', () => {
        const p1 = 'p-reset-all';
        const b1 = registry.getOrCreate(p1, { maxConsecutiveErrors: 1 });
        const global = registry.getGlobal();

        b1.recordError();
        global.recordError();
        global.recordError();
        global.recordError();
        global.recordError();
        global.recordError(); // Trip global (default max 5)

        expect(b1.getState()).toBe('OPEN');
        expect(global.getState()).toBe('OPEN');

        registry.resetAll();

        expect(b1.getState()).toBe('CLOSED');
        expect(global.getState()).toBe('CLOSED');
        expect(registry.getTotalCost()).toBe(0);
    });
});
