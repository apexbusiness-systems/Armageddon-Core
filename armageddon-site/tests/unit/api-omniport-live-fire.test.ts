import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const persistTelemetryEvent = vi.hoisted(() => vi.fn());

vi.mock('@/lib/omniport', () => ({
    guardOmniPort: vi.fn(() => null),
    verifyWaiverToken: vi.fn(() => ({ runLevel: 7, expiresAt: Date.now() + 600000, orgId: 'org-1' })),
    parseOmniPortBody: vi.fn(async () => ({
        organizationId: 'org-1', waiverToken: 't', level: 7, iterations: 100, batteries: ['B10'],
    })),
    deriveRunSeed: vi.fn(() => 123),
    persistTelemetryEvent,
    OmniPortLiveFireRequestSchema: {},
}));
vi.mock('@/lib/temporal', () => ({
    getTemporalClient: vi.fn(async () => ({
        workflow: { start: vi.fn().mockResolvedValue({ firstExecutionRunId: 'wf-run-1' }) },
    })),
}));
vi.mock('@/lib/supabase', () => ({ getSupabaseServiceRole: vi.fn() }));

import { getSupabaseServiceRole } from '@/lib/supabase';
import { POST } from '@/app/api/omniport/live-fire/route';

function makeChain(resolved: { single?: unknown; default?: unknown }) {
    const chain: any = {
        select: () => chain,
        eq: () => chain,
        gte: () => chain,
        order: () => chain,
        limit: () => chain,
        insert: () => chain,
        update: () => chain,
        single: () => Promise.resolve(resolved.single ?? { data: null, error: null }),
        then: (onF: any, onR: any) => Promise.resolve(resolved.default ?? { error: null }).then(onF, onR),
    };
    return chain;
}

function supabaseOk() {
    return {
        from: (table: string) =>
            table === 'omniport_waiver_records'
                ? makeChain({ single: { data: { id: 'waiver-1', expires_at: new Date(Date.now() + 600000).toISOString() }, error: null } })
                : makeChain({ default: { error: null } }),
    };
}

const req = () => new NextRequest('http://localhost:3000/api/omniport/live-fire', { method: 'POST' });

describe('POST /api/omniport/live-fire — proof-critical telemetry', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.OMNIPORT_LIVE_FIRE_SECRET = 'secret';
        (getSupabaseServiceRole as any).mockReturnValue(supabaseOk());
    });

    it('does NOT return authorized:true when the proof telemetry fails to persist', async () => {
        persistTelemetryEvent.mockRejectedValueOnce(new Error("Required telemetry 'live_fire.authorized' failed to persist: db down"));

        const res = await POST(req());
        const data = await res.json();

        expect(res.status).toBe(500);
        expect(data.authorized).not.toBe(true);
        expect(data.reason).toBe('PROOF_PERSIST_FAILED');
        // Proof was requested as required.
        expect(persistTelemetryEvent).toHaveBeenCalledWith(
            expect.anything(), expect.any(String), 'org-1', 'live_fire.authorized',
            expect.anything(), { required: true }
        );
    });

    it('returns authorized:true when the proof telemetry persists', async () => {
        persistTelemetryEvent.mockResolvedValueOnce(undefined);

        const res = await POST(req());
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.authorized).toBe(true);
        expect(data.liveFire).toBe(true);
    });
});
