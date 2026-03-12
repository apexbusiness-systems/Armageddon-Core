import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Hoist mocks to ensure they are available in vi.mock factory
const { mockSupabase, mockResolveCallerContext } = vi.hoisted(() => {
    const mockSupabase = {
        auth: {
            getUser: vi.fn(),
        },
    };
    const mockResolveCallerContext = vi.fn();
    return { mockSupabase, mockResolveCallerContext };
});

vi.mock('@/lib/server/apexGate', () => ({
    resolveCallerContext: mockResolveCallerContext,
}));

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => mockSupabase),
}));

// Import the handler
import { POST } from '../../src/app/api/gatekeeper/route';

describe('POST /api/gatekeeper', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        vi.clearAllMocks();
        // Reset process.env to original state before each test
        process.env = { ...originalEnv };
        process.env.ADMIN_EMAIL = 'admin@example.com';
    });

    afterEach(() => {
        process.env = originalEnv;
        vi.restoreAllMocks();
    });

    it('should return eligible: true for valid admin token', async () => {
        mockResolveCallerContext.mockResolvedValue({
            success: true,
            context: { tier: 'certified', orgId: 'org-001' }
        });
        
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: { email: 'admin@example.com' } },
            error: null,
        });

        const req = new NextRequest('http://localhost:3000/api/gatekeeper', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer valid-admin-token',
            },
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data).toEqual({
            eligible: true,
            tier: 'certified',
            reason: 'ADMIN_OVERRIDE'
        });
    });

    it('should return eligible: false if no auth header', async () => {
        mockResolveCallerContext.mockResolvedValue({
            success: false,
            error: 'Missing Authorization header',
            status: 401
        });
        
        const req = new NextRequest('http://localhost:3000/api/gatekeeper', {
            method: 'POST',
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(401);
        expect(data).toEqual({
            eligible: false,
            tier: 'free_dry',
            reason: 'AUTH_REQUIRED',
            upgradeUrl: '/pricing?upgrade=verified',
        });
    });

    it('should return eligible: true for non-admin user (if auth passes apexGate)', async () => {
        mockResolveCallerContext.mockResolvedValue({
            success: true,
            context: { tier: 'verified', orgId: 'org-123' }
        });

        const req = new NextRequest('http://localhost:3000/api/gatekeeper', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer user-token',
            },
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.eligible).toBe(true);
        expect(data.tier).toBe('verified');
        expect(data.orgId).toBe('org-123');
        expect(data.reason).toBe('AUTHENTICATED');
    });

    it('should return default authenticated response if ADMIN_EMAIL env is not set', async () => {
        delete process.env.ADMIN_EMAIL;

        mockResolveCallerContext.mockResolvedValue({
            success: true,
            context: { tier: 'certified', orgId: 'org-001' }
        });

        const req = new NextRequest('http://localhost:3000/api/gatekeeper', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer admin-token',
            },
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.eligible).toBe(true);
        expect(data.reason).toBe('AUTHENTICATED');
    });
});
