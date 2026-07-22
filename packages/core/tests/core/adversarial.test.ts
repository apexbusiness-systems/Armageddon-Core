import { describe, it, expect } from 'vitest';
import { createAdversarialEngine } from '../../src/core/adversarial';

// Regression shield for the silent CERTIFIED→simulation downgrade: a run
// labelled tier: 'CERTIFIED' (and therefore telemetry-tagged engine:
// 'LIVE_FIRE' by callers) must never quietly execute the fake
// SimulationProvider just because targetModel was omitted. Every OmniPort
// dispatch path lacked targetModel until this fix — this file's job is to
// make sure that specific class of bug fails loudly instead of certifying
// a simulated run as real.
describe('createAdversarialEngine — tier/targetModel gating', () => {
    it('throws when tier is CERTIFIED but no targetModel is provided', () => {
        expect(() => createAdversarialEngine({ tier: 'CERTIFIED', runId: 'run-1' }))
            .toThrow(/tier is 'CERTIFIED' but no targetModel was provided/);
    });

    it('does not throw when tier is CERTIFIED with a real targetModel', () => {
        expect(() => createAdversarialEngine({ tier: 'CERTIFIED', runId: 'run-2', targetModel: 'claude-sonnet-4-6' }))
            .not.toThrow();
    });

    it('does not throw for FREE tier regardless of targetModel', () => {
        expect(() => createAdversarialEngine({ tier: 'FREE', runId: 'run-3' })).not.toThrow();
        expect(() => createAdversarialEngine({ tier: 'FREE', runId: 'run-4', targetModel: 'claude-sonnet-4-6' })).not.toThrow();
    });

    it('still refuses to silently fall back to sim-001 for http-target with no HTTP target configured', () => {
        const originalEndpoint = process.env.ARMAGEDDON_TARGET_ENDPOINT;
        const originalProvider = process.env.ARMAGEDDON_TARGET_PROVIDER;
        delete process.env.ARMAGEDDON_TARGET_ENDPOINT;
        delete process.env.ARMAGEDDON_TARGET_PROVIDER;
        try {
            expect(() => createAdversarialEngine({ tier: 'CERTIFIED', runId: 'run-5', targetModel: 'http-target' }))
                .toThrow(/no HTTP target is configured/);
        } finally {
            if (originalEndpoint === undefined) delete process.env.ARMAGEDDON_TARGET_ENDPOINT;
            else process.env.ARMAGEDDON_TARGET_ENDPOINT = originalEndpoint;
            if (originalProvider === undefined) delete process.env.ARMAGEDDON_TARGET_PROVIDER;
            else process.env.ARMAGEDDON_TARGET_PROVIDER = originalProvider;
        }
    });

    it('a FREE-tier engine is backed by simulation providers, never real ones', () => {
        const engine = createAdversarialEngine({ tier: 'FREE', runId: 'run-6' });
        // SimulationProvider.isAvailable() is always true and requires no
        // network/API key — a real provider without an API key configured
        // in this test environment would report unavailable instead.
        expect(engine.isAvailable()).toBe(true);
    });
});
