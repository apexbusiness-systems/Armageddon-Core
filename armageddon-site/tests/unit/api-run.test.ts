/**
 * ═══════════════════════════════════════════════════════════════════════════
 * API ROUTE UNIT TESTS
 * Verifying security vulnerability and fix
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

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
import { POST } from '../../src/app/api/run/route';

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

    it('should return 401 if no Authorization header is provided', async () => {
        const req = new NextRequest('http://localhost:3000/api/run', {
            method: 'POST',
            body: JSON.stringify({ organizationId: 'test-org' }),
        });

        const res = await POST(req);
        expect(res.status).toBe(401);
        const data = await res.json();
        expect(data.error).toContain('Unauthorized');
    });

    it('should return 401 if Authorization header is invalid', async () => {
        mockSupabase.auth.getUser.mockResolvedValueOnce({
            data: { user: null },
            error: { message: 'Invalid token' } as any,
        });

        const req = new NextRequest('http://localhost:3000/api/run', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer invalid-token',
            },
            body: JSON.stringify({ organizationId: 'test-org' }),
        });

        const res = await POST(req);
        expect(res.status).toBe(401);
    });

    it('should return 403 if user is not a member of the organization', async () => {
        mockSupabase.auth.getUser.mockResolvedValueOnce({
            data: { user: { id: 'user-123' } },
            error: null,
        });

        // Mock membership check returning no rows
        const mockSingle = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
        const mockEq2 = vi.fn(() => ({ single: mockSingle }));
        const mockEq1 = vi.fn(() => ({ eq: mockEq2 }));
        const mockSelect = vi.fn(() => ({ eq: mockEq1 }));

        mockSupabase.from.mockReturnValueOnce({ select: mockSelect } as any);

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
        mockSupabase.auth.getUser.mockResolvedValueOnce({
            data: { user: { id: 'user-123' } },
            error: null,
        });

        // Mock membership check returning a row
        const mockSingle = vi.fn().mockResolvedValue({ data: { role: 'member' }, error: null });
        const mockEq2 = vi.fn(() => ({ single: mockSingle }));
        const mockEq1 = vi.fn(() => ({ eq: mockEq2 }));
        const mockSelect = vi.fn(() => ({ eq: mockEq1 }));

        // Mock chain for membership check AND subsequent inserts
        const mockUpdate = vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ error: null })
        }));

        mockSupabase.from
            .mockReturnValueOnce({ select: mockSelect } as any) // verification
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
