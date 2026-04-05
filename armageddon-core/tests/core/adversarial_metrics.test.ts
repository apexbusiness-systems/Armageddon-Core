
import { describe, it, expect, beforeEach } from 'vitest';
import { AdversarialEngine } from '../../src/core/adversarial';

describe('AdversarialEngine Metrics Caching', () => {
    let engine: AdversarialEngine;

    beforeEach(() => {
        engine = new AdversarialEngine({
            tier: 'FREE',
            runId: 'test-run',
        });
    });

    it('should return 0 initially', () => {
        const metrics = engine.getMetrics();
        expect(metrics.totalTokens).toBe(0);
        expect(metrics.totalCost).toBe(0);
    });

    it('should update metrics after an attack iteration', async () => {
        const initial = engine.getMetrics();
        expect(initial.totalTokens).toBe(0);

        // Run one iteration
        await (engine as any).singleAttackIteration('test goal', 0, []);

        const updated = engine.getMetrics();
        expect(updated.totalTokens).toBeGreaterThan(0);

        // Repeated calls should return same (cached) values
        const repeated = engine.getMetrics();
        expect(repeated).toEqual(updated);
        expect(repeated).not.toBe(updated); // Should be a copy
    });

    it('should reset metrics when engine is reset', async () => {
        await (engine as any).singleAttackIteration('test goal', 0, []);
        expect(engine.getMetrics().totalTokens).toBeGreaterThan(0);

        engine.reset();

        const resetMetrics = engine.getMetrics();
        expect(resetMetrics.totalTokens).toBe(0);
    });

    it('should maintain accuracy after multiple iterations', async () => {
        // Run a full attack sequence (default 5 iterations or breach)
        // For FREE tier/simulation, it should run some iterations
        const result = await engine.runPAIRAttack('test goal');

        const metrics = engine.getMetrics();
        expect(metrics.totalTokens).toBe(result.totalTokens);
        expect(metrics.totalCost).toBe(result.totalCostUSD);
    });
});
