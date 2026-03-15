import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

import { NextResponse } from 'next/server';

// Mock auth module
vi.mock('../../src/lib/auth', () => ({
    authenticateRequest: vi.fn(),
}));

import { authenticateRequest } from '../../src/lib/auth';

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
        (authenticateRequest as any).mockResolvedValueOnce({
            user: { email: 'admin@example.com' },
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
        (authenticateRequest as any).mockResolvedValueOnce(
            NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        );

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
        (authenticateRequest as any).mockResolvedValueOnce({
            user: { email: 'user@example.com' },
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

        (authenticateRequest as any).mockResolvedValueOnce({
            user: { email: 'admin@example.com' },
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
        (authenticateRequest as any).mockResolvedValueOnce({
            user: { id: 'some-id' },
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
        (authenticateRequest as any).mockResolvedValueOnce(
            NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        );

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
