import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockVerifyWaiverToken, mockParseOmniPortBody } = vi.hoisted(() => ({
    mockVerifyWaiverToken: vi.fn(),
    mockParseOmniPortBody: vi.fn(),
}));

vi.mock('@/lib/omniport', () => ({
    guardOmniPort: vi.fn(() => null),
    verifyWaiverToken: mockVerifyWaiverToken,
    parseOmniPortBody: mockParseOmniPortBody,
    WaiverRecordRequestSchema: {},
}));
vi.mock('@/lib/supabase', () => ({ getSupabaseServiceRole: vi.fn() }));

import { getSupabaseServiceRole } from '@/lib/supabase';
import { POST } from '@/app/api/omniport/waiver/route';

function makeInsertChain(resolved: { single?: unknown }) {
    const chain: any = {
        select: () => chain,
        single: () => Promise.resolve(resolved.single ?? { data: null, error: null }),
    };
    return chain;
}

function makeChain(resolved: { single?: unknown; default?: unknown }) {
    const chain: any = {
        select: () => chain,
        single: () => Promise.resolve(resolved.single ?? { data: null, error: null }),
        then: (onF: any, onR: any) => Promise.resolve(resolved.default ?? { error: null }).then(onF, onR),
    };
    return chain;
}

function supabaseOk() {
    return {
        from: () => ({
            insert: () => makeInsertChain({ single: { data: { id: 'waiver-1' }, error: null } }),
            select: () => makeChain({ single: { data: { id: 'waiver-1' }, error: null } }),
        }),
    };
}

const req = () => new NextRequest('http://localhost:3000/api/omniport/waiver', { method: 'POST' });

describe('POST /api/omniport/waiver — validation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (getSupabaseServiceRole as any).mockReturnValue(supabaseOk());
    });

    it('rejects when orgId in request does not match orgId in waiver token payload', async () => {
        mockVerifyWaiverToken.mockReturnValue({
            orgId: 'org-2',
            acceptedByUserId: 'user-1',
            runLevel: 7,
            expiresAt: Date.now() + 600000,
        });
        mockParseOmniPortBody.mockResolvedValue({
            waiverToken: 'token',
            acceptedByUserId: 'user-1',
            organizationId: 'org-1', // MISMATCH
        });

        const res = await POST(req());
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.accepted).toBe(false);
        expect(data.reason).toBe('WAIVER_ORG_MISMATCH');
    });

    it('rejects when acceptedByUserId in request does not match acceptedByUserId in waiver token payload', async () => {
        mockVerifyWaiverToken.mockReturnValue({
            orgId: 'org-1',
            acceptedByUserId: 'user-2',
            runLevel: 7,
            expiresAt: Date.now() + 600000,
        });
        mockParseOmniPortBody.mockResolvedValue({
            waiverToken: 'token',
            acceptedByUserId: 'user-1', // MISMATCH
            organizationId: 'org-1',
        });

        const res = await POST(req());
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.accepted).toBe(false);
        expect(data.reason).toBe('WAIVER_USER_MISMATCH');
    });

    it('accepts and inserts waiver record on valid matching payload', async () => {
        mockVerifyWaiverToken.mockReturnValue({
            orgId: 'org-1',
            acceptedByUserId: 'user-1',
            runLevel: 7,
            expiresAt: Date.now() + 600000,
        });
        mockParseOmniPortBody.mockResolvedValue({
            waiverToken: 'token',
            acceptedByUserId: 'user-1',
            organizationId: 'org-1',
        });

        const res = await POST(req());
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.accepted).toBe(true);
        expect(data.waiverRecordId).toBe('waiver-1');
    });
});
