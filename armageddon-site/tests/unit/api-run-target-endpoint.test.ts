/**
 * REGRESSION GUARD — configured target endpoint must reach the runtime path.
 *
 * Proves the full contract the onboarding/console flow depends on:
 *   POST /api/run { targetEndpoint } ->
 *     (a) persisted into the `armageddon_runs` row `config.targetEndpoint`, and
 *     (b) forwarded into the `ArmageddonLevel7Workflow` start args.
 *
 * Without both, a configured target would silently never reach the engine.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@armageddon/shared', () => ({
    DEFAULT_BATTERIES: ['B10', 'B11'],
    checkRunEligibility: vi.fn(async () => ({ eligible: true, tier: 'certified' })),
    normalizeIterations: vi.fn((value: number) => value),
}));
vi.mock('@/lib/db-rate-limit', () => ({ dbRateLimit: vi.fn(async () => ({ allowed: true })) }));
vi.mock('@/lib/auth', () => ({
    checkMembershipResponse: vi.fn(),
    getRunAndVerifyAccess: vi.fn(),
}));
vi.mock('@/lib/temporal', () => ({ getTemporalClient: vi.fn() }));

import { checkMembershipResponse } from '@/lib/auth';
import { getTemporalClient } from '@/lib/temporal';
import { POST } from '@/app/api/run/route';

const TARGET = 'https://staging.example.com/api';

const inserts: any[] = [];
const insert = vi.fn(async (payload: unknown) => { inserts.push(payload); return { error: null }; });
const update = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }));
const supabase = { from: vi.fn(() => ({ insert, update })) };
const start = vi.fn(async () => ({ firstExecutionRunId: 'wf-run-1' }));

const req = () => new NextRequest('http://localhost:3000/api/run', {
    method: 'POST',
    body: JSON.stringify({ organizationId: 'org-1', level: 7, batteries: ['B10'], targetEndpoint: TARGET }),
});

beforeEach(() => {
    vi.clearAllMocks();
    inserts.length = 0;
    (checkMembershipResponse as any).mockResolvedValue({ supabase });
    (getTemporalClient as any).mockResolvedValue({ workflow: { start } });
});

describe('POST /api/run target endpoint propagation', () => {
    it('persists targetEndpoint in the run config and forwards it to the workflow input', async () => {
        const res = await POST(req());
        expect(res.status).toBe(200);

        // (a) persisted into the run row config
        expect(inserts).toHaveLength(1);
        expect(inserts[0].config).toMatchObject({ targetEndpoint: TARGET });

        // (b) forwarded into the workflow start args
        expect(start).toHaveBeenCalledTimes(1);
        // start('ArmageddonLevel7Workflow', { workflowId, args: [...] }) -> options is arg[1]
        const call = start.mock.calls[0] as unknown as [string, { args: Array<{ targetEndpoint?: string }> }];
        expect(call[1].args[0]).toMatchObject({ targetEndpoint: TARGET });
    });
});
