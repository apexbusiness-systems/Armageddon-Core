import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { createHash } from 'node:crypto';

const persistTelemetryEvent = vi.hoisted(() => vi.fn());
const mockVerifyWaiverToken = vi.hoisted(() => vi.fn());
const mockParseOmniPortBody = vi.hoisted(() => vi.fn());

vi.mock('@/lib/omniport', () => ({
    guardOmniPort: vi.fn(() => null),
    verifyWaiverToken: mockVerifyWaiverToken,
    parseOmniPortBody: mockParseOmniPortBody,
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
import { getTemporalClient } from '@/lib/temporal';
import { verifyWaiverToken } from '@/lib/omniport';
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

function supabaseOk(waiverTokenHash = createHash('sha256').update('t').digest('hex')) {
    return {
        from: (table: string) =>
            table === 'omniport_waiver_records'
                ? makeChain({ single: { data: { id: 'waiver-1', expires_at: new Date(Date.now() + 600000).toISOString(), waiver_token_hash: waiverTokenHash }, error: null } })
                : makeChain({ default: { error: null } }),
    };
}

const req = () => new NextRequest('http://localhost:3000/api/omniport/live-fire', { method: 'POST' });

describe('POST /api/omniport/live-fire — validation & security', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.OMNIPORT_LIVE_FIRE_SECRET = 'secret';
        
        // Setup default mocks (successful path)
        mockVerifyWaiverToken.mockReturnValue({ runLevel: 7, expiresAt: Date.now() + 600000, orgId: 'org-1' });
        mockParseOmniPortBody.mockResolvedValue({
            organizationId: 'org-1', waiverToken: 't', level: 7, iterations: 100, batteries: ['B10'],
        });
        (getSupabaseServiceRole as any).mockReturnValue(supabaseOk());
    });

    it('rejects when orgId in request does not match orgId in waiver token', async () => {
        mockVerifyWaiverToken.mockReturnValue({ runLevel: 7, expiresAt: Date.now() + 600000, orgId: 'org-2' }); // org-2
        
        const res = await POST(req());
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.authorized).toBe(false);
        expect(data.reason).toBe('WAIVER_ORG_MISMATCH');
    });

    it('rejects when runLevel in token does not match level in request', async () => {
        mockVerifyWaiverToken.mockReturnValue({ runLevel: 6, expiresAt: Date.now() + 600000, orgId: 'org-1' }); // runLevel 6 != level 7
        
        const res = await POST(req());
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.authorized).toBe(false);
        expect(data.reason).toBe('WAIVER_LEVEL_MISMATCH');
    });

    it('rejects when presented token hash does not match stored waiver_token_hash', async () => {
        // Mock DB with hash of token 'different'
        const differentHash = createHash('sha256').update('different').digest('hex');
        (getSupabaseServiceRole as any).mockReturnValue(supabaseOk(differentHash));

        const res = await POST(req());
        const data = await res.json();

        expect(res.status).toBe(403);
        expect(data.authorized).toBe(false);
        expect(data.reason).toBe('WAIVER_TOKEN_HASH_MISMATCH');
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
