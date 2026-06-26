import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockGetTemporalClient, mockParseOmniPortBody } = vi.hoisted(() => ({
    mockGetTemporalClient: vi.fn(),
    mockParseOmniPortBody: vi.fn(),
}));

vi.mock('@/lib/omniport', () => ({
    guardOmniPort: vi.fn(() => null),
    isOmniPortEnabled: vi.fn(() => true),
    parseOmniPortBody: mockParseOmniPortBody,
    deriveRunSeed: vi.fn(() => 123),
    persistTelemetryEvent: vi.fn(),
    OmniPortExecuteRequestSchema: {},
}));
vi.mock('@/lib/temporal', () => ({
    getTemporalClient: mockGetTemporalClient,
}));
vi.mock('@/lib/supabase', () => ({ getSupabaseServiceRole: vi.fn() }));

import { getSupabaseServiceRole } from '@/lib/supabase';
import { POST } from '@/app/api/omniport/execute/route';

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

const req = () => new NextRequest('http://localhost:3000/api/omniport/execute', { method: 'POST' });

describe('POST /api/omniport/execute — Temporal Error Scenarios', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockParseOmniPortBody.mockResolvedValue({
            organizationId: 'org-1',
            level: 7,
            iterations: 100,
            batteries: ['B10'],
            targetUrl: 'https://valid-target.com',
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
        (getSupabaseServiceRole as any).mockReturnValue(supabaseMock);

        const res = await POST(req());
        const data = await res.json();

        expect(res.status).toBe(503);
        expect(data.success).toBe(false);
        expect(data.code).toBe('TEMPORAL_UNAVAILABLE');
        expect(updateMock).toHaveBeenCalledWith({ status: 'failed' });
    });
});
