import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/omniport', () => ({
    guardOmniPort: vi.fn(() => null),
    verifyWaiverToken: vi.fn(() => ({
        orgId: 'org-1',
        acceptedByUserId: 'user-1',
        runLevel: 7,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 600000,
        waiverVersion: '1.0',
    })),
    parseOmniPortBody: vi.fn(async () => ({ waiverToken: 't', organizationId: 'org-1', acceptedByUserId: 'user-1' })),
    WaiverRecordRequestSchema: {},
}));
vi.mock('@/lib/supabase', () => ({ getSupabaseServiceRole: vi.fn() }));

import { getSupabaseServiceRole } from '@/lib/supabase';
import { parseOmniPortBody, verifyWaiverToken } from '@/lib/omniport';
import { POST } from '@/app/api/omniport/waiver/route';

const req = () => new NextRequest('http://localhost:3000/api/omniport/waiver', { method: 'POST' });
const insert = vi.fn(() => ({ select: () => ({ single: async () => ({ data: { id: 'waiver-1' }, error: null }) }) }));

beforeEach(() => {
    vi.clearAllMocks();
    (getSupabaseServiceRole as any).mockReturnValue({ from: () => ({ insert }) });
});

describe('POST /api/omniport/waiver', () => {
    it('rejects mismatched org without inserting a waiver row', async () => {
        (verifyWaiverToken as any).mockReturnValueOnce({ orgId: 'org-2', acceptedByUserId: 'user-1', runLevel: 7, issuedAt: Date.now(), expiresAt: Date.now() + 600000, waiverVersion: '1.0' });

        const res = await POST(req());
        const data = await res.json();

        expect(res.status).toBe(403);
        expect(data.reason).toBe('WAIVER_ORG_MISMATCH');
        expect(getSupabaseServiceRole).not.toHaveBeenCalled();
        expect(insert).not.toHaveBeenCalled();
    });

    it('rejects mismatched acceptedByUserId without inserting a waiver row', async () => {
        (parseOmniPortBody as any).mockResolvedValueOnce({ waiverToken: 't', organizationId: 'org-1', acceptedByUserId: 'user-2' });

        const res = await POST(req());
        const data = await res.json();

        expect(res.status).toBe(403);
        expect(data.reason).toBe('WAIVER_USER_MISMATCH');
        expect(getSupabaseServiceRole).not.toHaveBeenCalled();
        expect(insert).not.toHaveBeenCalled();
    });
});
