/**
 * ═══════════════════════════════════════════════════════════════════════════
 * API ROUTE UNIT TESTS
 * Verifying security vulnerability and fix
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// Hoist mocks to ensure they are available in vi.mock factory
const { mockSupabase, mockTemporalClient, MockClient } = vi.hoisted(() => {
    const mockSupabase = {
        auth: {
            getUser: vi.fn(),
        },
        from: vi.fn(() => ({
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    eq: vi.fn(() => ({
                        single: vi.fn(),
                    })),
                })),
            })),
            insert: vi.fn(() => Promise.resolve({ error: null })),
            update: vi.fn(() => Promise.resolve({ error: null })),
        })),
    };

    const mockTemporalClient = {
        workflow: {
            start: vi.fn(() => Promise.resolve({ firstExecutionRunId: 'test-run-id' })),
        },
    };

    const MockClient = vi.fn();
    MockClient.prototype.workflow = mockTemporalClient.workflow;
    // @ts-ignore
    MockClient.mockImplementation(function() { return mockTemporalClient; });

    return { mockSupabase, mockTemporalClient, MockClient };
});

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => mockSupabase),
}));

vi.mock('@temporalio/client', () => ({
    Connection: { connect: vi.fn() },
    Client: MockClient,
}));

vi.mock('@armageddon/shared', () => ({
    checkRunEligibility: vi.fn(() => Promise.resolve({ eligible: true })),
}));

// Import the handler
import { POST, GET } from '../../src/app/api/run/route';

// Mock auth module
vi.mock('../../src/lib/auth', () => ({
    authenticateRequest: vi.fn(),
    verifyOrganizationMembership: vi.fn(),
    checkMembershipResponse: vi.fn(),
    getRunAndVerifyAccess: vi.fn(),
    forbiddenResponse: vi.fn((msg) => NextResponse.json({ success: false, error: msg }, { status: 403 })),
}));

import { authenticateRequest, checkMembershipResponse, getRunAndVerifyAccess } from '../../src/lib/auth';

describe('POST /api/run', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.SUPABASE_URL = 'https://example.supabase.co';
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';

        // Default successful auth for happy path or to ensure specific failure
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: { id: 'user-123' } },
            error: null,
        });

        // Restore default mock implementation if it was changed
        // @ts-ignore
        MockClient.mockImplementation(function() { return mockTemporalClient; });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should return 401 if authentication fails', async () => {
        (checkMembershipResponse as any).mockResolvedValueOnce(
            NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        );

        const req = new NextRequest('http://localhost:3000/api/run', {
            method: 'POST',
            body: JSON.stringify({ organizationId: 'test-org' }),
        });

        const res = await POST(req);
        expect(res.status).toBe(401);
    });

    it('should return 403 if user is not a member of the organization', async () => {
        (checkMembershipResponse as any).mockResolvedValueOnce(
            NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
        );

        const req = new NextRequest('http://localhost:3000/api/run', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer valid-token',
            },
            body: JSON.stringify({ organizationId: 'test-org' }),
        });

        const res = await POST(req);
        expect(res.status).toBe(403);
    });

    it('should return 200 if user is a member and eligible', async () => {
        (checkMembershipResponse as any).mockResolvedValueOnce({
            user: { id: 'user-123' },
            supabase: mockSupabase,
        });

        // Mock chain for subsequent inserts
        const mockUpdate = vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ error: null })
        }));

        mockSupabase.from
            .mockReturnValueOnce({ insert: vi.fn().mockResolvedValue({ error: null }) } as any) // insert run
            .mockReturnValueOnce({ update: mockUpdate } as any); // update run

        const req = new NextRequest('http://localhost:3000/api/run', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer valid-token',
            },
            body: JSON.stringify({ organizationId: 'test-org' }),
        });

        const res = await POST(req);
        expect(res.status).toBe(200);

        const data = await res.json();
        expect(data.success).toBe(true);
    });
});

describe('GET /api/run', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.SUPABASE_URL = 'https://example.supabase.co';
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    });

    it('should return 401 if authentication fails', async () => {
        (getRunAndVerifyAccess as any).mockResolvedValueOnce(
            NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        );

        const req = new NextRequest('http://localhost:3000/api/run?runId=run-123', {
            method: 'GET',
        });

        const res = await GET(req);
        expect(res.status).toBe(401);
    });

    it('should return 403 if user is not a member of the organization that owns the run', async () => {
        (getRunAndVerifyAccess as any).mockResolvedValueOnce(
            NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
        );

        const req = new NextRequest('http://localhost:3000/api/run?runId=run-123', {
            method: 'GET',
            headers: {
                Authorization: 'Bearer valid-token',
            },
        });

        const res = await GET(req);
        expect(res.status).toBe(403);
    });

    it('should return 200 if user is a member of the organization that owns the run', async () => {
        const mockRun = { id: 'run-123', organization_id: 'org-123', status: 'completed' };

        (getRunAndVerifyAccess as any).mockResolvedValueOnce({
            run: mockRun,
            auth: {
                user: { id: 'user-123' },
                supabase: mockSupabase,
            }
        });

        const req = new NextRequest('http://localhost:3000/api/run?runId=run-123', {
            method: 'GET',
            headers: {
                Authorization: 'Bearer valid-token',
            },
        });

        const res = await GET(req);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(data.run).toEqual(mockRun);
    });
});
