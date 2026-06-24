import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/auth', () => ({
    authenticateRequest: vi.fn(),
}));

import { authenticateRequest } from '@/lib/auth';
import { GET } from '@/app/api/me/organizations/route';

function mockSupabaseReturning(result: { data: unknown; error: unknown }) {
    return {
        from: vi.fn(() => ({
            select: vi.fn(() => ({
                eq: vi.fn(() => Promise.resolve(result)),
            })),
        })),
    };
}

function req() {
    return new NextRequest('http://localhost:3000/api/me/organizations', {
        headers: { Authorization: 'Bearer token' },
    });
}

describe('GET /api/me/organizations', () => {
    beforeEach(() => vi.clearAllMocks());

    // T6
    it('returns the authenticated user\'s real organization membership', async () => {
        (authenticateRequest as any).mockResolvedValueOnce({
            user: { id: 'user-1' },
            supabase: mockSupabaseReturning({
                data: [
                    { organization_id: 'org-member', role: 'member' },
                    { organization_id: 'org-owner', role: 'owner' },
                ],
                error: null,
            }),
        });

        const res = await GET(req());
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.active.organization_id).toBe('org-owner'); // owner preferred
        expect(data.organizations).toHaveLength(2);
    });

    it('returns 404 when the user has no organization membership', async () => {
        (authenticateRequest as any).mockResolvedValueOnce({
            user: { id: 'user-1' },
            supabase: mockSupabaseReturning({ data: [], error: null }),
        });

        const res = await GET(req());
        expect(res.status).toBe(404);
        expect((await res.json()).organizations).toEqual([]);
    });

    it('propagates a 401 from authenticateRequest', async () => {
        (authenticateRequest as any).mockResolvedValueOnce(
            NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        );
        const res = await GET(req());
        expect(res.status).toBe(401);
    });
});
