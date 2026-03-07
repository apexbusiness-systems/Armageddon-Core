import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Hoist mocks to ensure they are available in vi.mock factory
const { mockSupabase } = vi.hoisted(() => {
    const mockSupabase = {
        auth: {
            getUser: vi.fn(),
        },
    };
    return { mockSupabase };
});

vi.mock('@/lib/supabase', () => ({
    getSupabaseAnon: vi.fn(() => mockSupabase),
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
            tier: 'verified',
            reason: 'ADMIN_OVERRIDE'
        });
    });

    it('should return eligible: false if no auth header', async () => {
        const req = new NextRequest('http://localhost:3000/api/gatekeeper', {
            method: 'POST',
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data).toEqual({
            eligible: false,
            tier: 'free',
            reason: 'LEVEL_7_ACCESS_REQUIRED'
        });
    });

    it('should return eligible: false for non-admin user', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: { email: 'user@example.com' } },
            error: null,
        });

        const req = new NextRequest('http://localhost:3000/api/gatekeeper', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer user-token',
            },
        });

        const res = await POST(req);
        const data = await res.json();

        expect(data.eligible).toBe(false);
        expect(data.tier).toBe('free');
    });

    it('should return eligible: false if ADMIN_EMAIL env is not set', async () => {
        delete process.env.ADMIN_EMAIL;

        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: { email: 'admin@example.com' } },
            error: null,
        });

        const req = new NextRequest('http://localhost:3000/api/gatekeeper', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer admin-token',
            },
        });

        const res = await POST(req);
        const data = await res.json();

        expect(data.eligible).toBe(false);
    });

    it('should return eligible: false if user has no email', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: { id: 'some-id' } },
            error: null,
        });

        const req = new NextRequest('http://localhost:3000/api/gatekeeper', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer token',
            },
        });

        const res = await POST(req);
        const data = await res.json();

        expect(data.eligible).toBe(false);
    });

    it('should return eligible: false if Supabase returns no user', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: null },
            error: null,
        });

        const req = new NextRequest('http://localhost:3000/api/gatekeeper', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer invalid-token',
            },
        });

        const res = await POST(req);
        const data = await res.json();

        expect(data.eligible).toBe(false);
    });
});
