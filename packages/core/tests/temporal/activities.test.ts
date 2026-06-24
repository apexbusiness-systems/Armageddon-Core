import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the safety singleton so finalize doesn't depend on live env gating.
vi.mock('../../src/core/safety', () => ({
    safetyGuard: { enforce: vi.fn() },
    SafetyGuard: { resetForTesting: vi.fn(), getInstance: vi.fn() },
    SystemLockdownError: class SystemLockdownError extends Error {},
}));

const eqMock = vi.fn();
const updateMock = vi.fn(() => ({ eq: eqMock }));
const fromMock = vi.fn(() => ({ update: updateMock }));

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => ({ from: fromMock })),
}));

import { finalizeRunActivity, ArmageddonReport } from '../../src/temporal/activities';

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
        eqMock.mockResolvedValue({ error: null });
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
    });

    it('throws when the terminal persistence write fails', async () => {
        eqMock.mockResolvedValue({ error: { message: 'update failed' } });
        await expect(
            finalizeRunActivity({ runId: 'r', status: 'failed', startedAt: Date.now(), report: makeReport() })
        ).rejects.toThrow(/update failed/);
    });
});
