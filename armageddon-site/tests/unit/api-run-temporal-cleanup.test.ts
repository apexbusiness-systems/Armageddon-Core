import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@armageddon/shared', () => ({
    DEFAULT_BATTERIES: ['B10', 'B11'],
    checkRunEligibility: vi.fn(async () => ({ eligible: true, tier: 'certified' })),
    normalizeIterations: vi.fn((value: number) => value),
    readAdminEmail: vi.fn(() => undefined),
}));
vi.mock('@/lib/db-rate-limit', () => ({ dbRateLimit: vi.fn(async () => ({ allowed: true })) }));
vi.mock('@/lib/auth', () => ({
    checkMembershipResponse: vi.fn(),
    authenticateRequest: vi.fn(),
    verifyOrganizationMembership: vi.fn(),
    getRunAndVerifyAccess: vi.fn(),
}));
vi.mock('@/lib/temporal', () => ({ getTemporalClient: vi.fn() }));

import { checkMembershipResponse, authenticateRequest, verifyOrganizationMembership } from '@/lib/auth';
import { getTemporalClient } from '@/lib/temporal';
import { POST } from '@/app/api/run/route';

const updates: unknown[] = [];
const update = vi.fn((payload: unknown) => { updates.push(payload); return { eq: vi.fn(async () => ({ error: null })) }; });
const insert = vi.fn(async () => ({ error: null }));
const supabase = { from: vi.fn(() => ({ insert, update })) };
const req = () => new NextRequest('http://localhost:3000/api/run', {
    method: 'POST',
    body: JSON.stringify({ organizationId: 'org-1', level: 7, iterations: 100, batteries: ['B10'] }),
});

beforeEach(() => {
    vi.clearAllMocks();
    updates.length = 0;
    (checkMembershipResponse as any).mockResolvedValue({ supabase });
    (authenticateRequest as any).mockResolvedValue({ supabase, user: { id: 'u1' } });
    (verifyOrganizationMembership as any).mockResolvedValue(true);
});

describe('POST /api/run temporal cleanup', () => {
    it('marks inserted run failed when getTemporalClient throws', async () => {
        (getTemporalClient as any).mockRejectedValueOnce(new Error('down'));

        const res = await POST(req());
        const data = await res.json();

        expect(res.status).toBe(503);
        expect(data.code).toBe('TEMPORAL_UNAVAILABLE');
        expect(updates).toContainEqual({ status: 'failed' });
    });

    it('marks inserted run failed when workflow.start throws', async () => {
        (getTemporalClient as any).mockResolvedValueOnce({ workflow: { start: vi.fn().mockRejectedValueOnce(new Error('start failed')) } });

        const res = await POST(req());
        const data = await res.json();

        expect(res.status).toBe(500);
        expect(data.code).toBe('WORKFLOW_START_FAILED');
        expect(updates).toContainEqual({ status: 'failed' });
    });
});
