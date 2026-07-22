import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the safety singleton so finalize doesn't depend on live env gating.
vi.mock('../../src/core/safety', () => ({
    safetyGuard: { enforce: vi.fn() },
    SafetyGuard: { resetForTesting: vi.fn(), getInstance: () => ({ enforce: vi.fn(), getStatus: vi.fn() }) },
    SystemLockdownError: class SystemLockdownError extends Error {},
}));

// Chain: from('armageddon_runs').update(...).eq('id', id).select('id').single()
const singleMock = vi.fn();
const selectMock = vi.fn(() => ({ single: singleMock }));
const eqMock = vi.fn(() => ({ select: selectMock }));
const updateMock = vi.fn(() => ({ eq: eqMock }));
const fromMock = vi.fn(() => ({ update: updateMock }));

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => ({ from: fromMock })),
}));

import { finalizeRunActivity, ArmageddonReport, capIterationsForLiveFire, LIVE_FIRE_MAX_VECTORS } from '../../src/temporal/activities';
import type { BatteryConfig } from '../../src/temporal/activities';

function makeReport(): ArmageddonReport {
    return {
        meta: { timestamp: new Date().toISOString(), duration: 1000 },
        status: 'COMPLETED',
        grade: 'A',
        score: 100,
        batteries: [
            { batteryId: 'B10', status: 'PASSED', iterations: 100, blockedCount: 100, breachCount: 0, driftScore: 0, duration: 10, details: {} },
            { batteryId: 'B11', status: 'FAILED', iterations: 100, blockedCount: 90, breachCount: 10, driftScore: 0.1, duration: 10, details: {} },
        ],
    };
}

describe('finalizeRunActivity — durable terminal persistence', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.SUPABASE_URL = 'http://localhost';
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
        delete process.env.ARMAGEDDON_DB_URL;
        delete process.env.ARMAGEDDON_DB_SERVICE_ROLE_KEY;
        singleMock.mockResolvedValue({ data: { id: 'run-xyz' }, error: null });
    });

    // T3
    it('writes the lowercase run_status enum value plus completed_at and aggregates', async () => {
        await finalizeRunActivity({
            runId: 'run-xyz',
            status: 'passed',
            startedAt: Date.now() - 5000,
            report: makeReport(),
        });

        expect(fromMock).toHaveBeenCalledWith('armageddon_runs');
        const update = updateMock.mock.calls[0][0];

        expect(update.status).toBe('passed');         // lowercase, not 'COMPLETED'
        expect(typeof update.completed_at).toBe('string');
        expect(update.duration_ms).toBeGreaterThanOrEqual(0);
        expect(update.total_iterations).toBe(200);
        expect(update.breaches).toBe(10);
        expect(update.batteries_passed).toEqual(['B10']);
        expect(update.batteries_failed).toEqual(['B11']);
        expect(eqMock).toHaveBeenCalledWith('id', 'run-xyz');
        expect(selectMock).toHaveBeenCalledWith('id'); // proves the row was returned
    });



    it('uses ARMAGEDDON_DB_URL and ARMAGEDDON_DB_SERVICE_ROLE_KEY aliases for terminal persistence', async () => {
        delete process.env.SUPABASE_URL;
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;
        process.env.ARMAGEDDON_DB_URL = 'http://alias-localhost';
        process.env.ARMAGEDDON_DB_SERVICE_ROLE_KEY = 'alias-service-key';

        await finalizeRunActivity({
            runId: 'run-alias',
            status: 'passed',
            startedAt: Date.now() - 5000,
            report: makeReport(),
        });

        expect(fromMock).toHaveBeenCalledWith('armageddon_runs');
    });

    it('throws when the terminal persistence write returns an error', async () => {
        singleMock.mockResolvedValue({ data: null, error: { message: 'update failed' } });
        await expect(
            finalizeRunActivity({ runId: 'r', status: 'failed', startedAt: Date.now(), report: makeReport() })
        ).rejects.toThrow(/update failed/);
    });

    // Zero matching rows: Supabase returns error: null AND data: null — must still throw.
    it('throws when no run row matched (no durable proof produced)', async () => {
        singleMock.mockResolvedValue({ data: null, error: null });
        await expect(
            finalizeRunActivity({ runId: 'missing', status: 'passed', startedAt: Date.now(), report: makeReport() })
        ).rejects.toThrow(/no matching run row/);
    });
});

describe('capIterationsForLiveFire — real-money cost cap for CERTIFIED (live-fire) batteries', () => {
    const baseConfig: BatteryConfig = {
        runId: 'r1',
        iterations: 10000,
        tier: 'FREE',
        seed: 1,
        batteries: ['B10', 'B11', 'B12', 'B13'],
    };

    it('caps CERTIFIED-tier iterations at LIVE_FIRE_MAX_VECTORS regardless of what was requested', () => {
        const capped = capIterationsForLiveFire({ ...baseConfig, tier: 'CERTIFIED', iterations: 10000 });
        expect(capped.iterations).toBe(LIVE_FIRE_MAX_VECTORS);
    });

    it('does not raise a CERTIFIED request that already sits below the cap', () => {
        const capped = capIterationsForLiveFire({ ...baseConfig, tier: 'CERTIFIED', iterations: 10 });
        expect(capped.iterations).toBe(10);
    });

    it('leaves FREE/simulation-tier iterations completely unchanged, even above the cap value', () => {
        const uncapped = capIterationsForLiveFire({ ...baseConfig, tier: 'FREE', iterations: 10000 });
        expect(uncapped.iterations).toBe(10000);
    });
});
