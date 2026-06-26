import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockGetTemporalClient, mockCheckMembershipResponse, mockCheckRunEligibility } = vi.hoisted(() => ({
    mockGetTemporalClient: vi.fn(),
    mockCheckMembershipResponse: vi.fn(),
    mockCheckRunEligibility: vi.fn(),
}));

vi.mock('@/lib/temporal', () => ({
    getTemporalClient: mockGetTemporalClient,
}));
vi.mock('@/lib/auth', () => ({
    checkMembershipResponse: mockCheckMembershipResponse,
}));
vi.mock('@armageddon/shared', () => ({
    DEFAULT_BATTERIES: ['B10', 'B11', 'B12', 'B13', 'B14'],
    checkRunEligibility: mockCheckRunEligibility,
    normalizeIterations: vi.fn((x) => x),
}));
vi.mock('@/lib/db-rate-limit', () => ({
    dbRateLimit: vi.fn(() => ({ allowed: true })),
}));

import { POST } from '@/app/api/run/route';

function makeChain(resolved: { single?: unknown; default?: unknown }) {
    const chain: any = {
        from: () => chain,
        insert: () => chain,
        update: () => chain,
        eq: () => chain,
        single: () => Promise.resolve(resolved.single ?? { data: null, error: null }),
        then: (onF: any, onR: any) => Promise.resolve(resolved.default ?? { error: null }).then(onF, onR),
    };
    return chain;
}

const req = (body: Record<string, any>) => {
    const r = new NextRequest('http://localhost:3000/api/run', {
        method: 'POST',
        body: JSON.stringify(body),
    });
    r.json = async () => body;
    return r;
};

describe('POST /api/run — Temporal Error Scenarios', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCheckMembershipResponse.mockResolvedValue({
            supabase: makeChain({ default: { error: null } }),
        });
        mockCheckRunEligibility.mockResolvedValue({
            eligible: true,
            tier: 'certified',
        });
    });

    it('marks run as failed when Temporal cluster is unavailable', async () => {
        mockGetTemporalClient.mockRejectedValueOnce(new Error('Temporal unavailable'));

        const updateMock = vi.fn().mockReturnValue(makeChain({ default: { error: null } }));
        const supabaseMock = {
            from: (table: string) => ({
                insert: () => makeChain({ default: { error: null } }),
                update: updateMock,
            }),
        };
        mockCheckMembershipResponse.mockResolvedValue({ supabase: supabaseMock });

        const res = await POST(req({ organizationId: 'org-1' }));
        const data = await res.json();

        expect(res.status).toBe(503);
        expect(data.success).toBe(false);
        expect(data.code).toBe('TEMPORAL_UNAVAILABLE');
        expect(updateMock).toHaveBeenCalledWith({ status: 'failed' });
    });

    it('marks run as failed when workflow start fails', async () => {
        mockGetTemporalClient.mockResolvedValueOnce({
            workflow: {
                start: vi.fn().mockRejectedValueOnce(new Error('Workflow start failed')),
            },
        });

        const updateMock = vi.fn().mockReturnValue(makeChain({ default: { error: null } }));
        const supabaseMock = {
            from: (table: string) => ({
                insert: () => makeChain({ default: { error: null } }),
                update: updateMock,
            }),
        };
        mockCheckMembershipResponse.mockResolvedValue({ supabase: supabaseMock });

        const res = await POST(req({ organizationId: 'org-1' }));
        const data = await res.json();

        expect(res.status).toBe(500);
        expect(data.success).toBe(false);
        expect(data.code).toBe('WORKFLOW_START_FAILED');
        expect(updateMock).toHaveBeenCalledWith({ status: 'failed' });
    });
});
