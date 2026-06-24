// armageddon-core/tests/integration/circuit-breaker-parallel.test.ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CircuitBreakerRegistry } from '../../src/providers/circuit-breaker';

describe('Circuit Breaker - Parallel Execution', () => {
    let registry: CircuitBreakerRegistry;

    beforeEach(() => {
        registry = CircuitBreakerRegistry.getInstance();
        registry.resetAll();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should respect rate limits with concurrency=2', async () => {
        // Set a small limit to force blocking behavior
        const LIMIT = 5;
        const breaker = registry.getOrCreate('test-provider', {
            maxRequestsPerMinute: LIMIT,
        });

        const requests = Array.from({ length: 10 }, (_, i) => i);
        const CONCURRENCY = 2;

        const start = Date.now();

        for (let i = 0; i < requests.length; i += CONCURRENCY) {
            const chunk = requests.slice(i, i + CONCURRENCY);

            // Poll until allowed
            while (!breaker.canProceed()) {
                await vi.advanceTimersByTimeAsync(100);
            }

            // Execute chunk
            await Promise.all(
                chunk.map(async () => {
                    breaker.recordSuccess(100, 50, 10);
                })
            );
        }

        const duration = Date.now() - start;

        // First 3 chunks (6 reqs) should pass (overshoot 1 because check-then-act race in parallel).
        // 4th chunk should block for ~60s (sliding window).
        expect(duration).toBeGreaterThan(50000);
    });
});
