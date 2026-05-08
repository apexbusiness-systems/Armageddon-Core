import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as supabaseJs from '@supabase/supabase-js';

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => ({
        rpc: vi.fn()
    }))
}));

// Mock process.env directly inside vitest before dynamic import
describe('dbRateLimit', () => {
    let mockRpc: any;
    let dbRateLimit: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        vi.stubEnv('SUPABASE_URL', 'https://test.supabase.co');
        vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-key');
        vi.stubEnv('RATE_LIMIT_FAIL_OPEN', 'false');
        
        mockRpc = vi.fn();
        (supabaseJs.createClient as any).mockReturnValue({ rpc: mockRpc });

        // Dynamic import to ensure env is set
        vi.resetModules();
        dbRateLimit = (await import('../src/lib/db-rate-limit')).dbRateLimit;
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('should allow request when within limit', async () => {
        mockRpc.mockResolvedValue({
            data: [{ allowed: true, remaining: 9, reset_at: new Date().toISOString() }],
            error: null
        });

        const result = await dbRateLimit({ scope: 'ip', key: '127.0.0.1', limit: 10, windowMs: 60000 });
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(9);
    });

    it('should deny request when limit exceeded', async () => {
        mockRpc.mockResolvedValue({
            data: [{ allowed: false, remaining: 0, reset_at: new Date().toISOString() }],
            error: null
        });

        const result = await dbRateLimit({ scope: 'org', key: 'org1', limit: 5, windowMs: 60000 });
        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
    });

    it('should fail closed on DB error by default', async () => {
        mockRpc.mockResolvedValue({
            data: null,
            error: new Error('DB timeout')
        });

        const result = await dbRateLimit({ scope: 'ip', key: '127.0.0.1', limit: 10, windowMs: 60000 });
        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
    });

    it('should fail OPEN for IP if RATE_LIMIT_FAIL_OPEN=true', async () => {
        vi.stubEnv('RATE_LIMIT_FAIL_OPEN', 'true');
        mockRpc.mockResolvedValue({
            data: null,
            error: new Error('DB timeout')
        });

        const result = await dbRateLimit({ scope: 'ip', key: '127.0.0.1', limit: 10, windowMs: 60000 });
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(1);
    });

    it('should still fail CLOSED for Org even if RATE_LIMIT_FAIL_OPEN=true', async () => {
        vi.stubEnv('RATE_LIMIT_FAIL_OPEN', 'true');
        mockRpc.mockResolvedValue({
            data: null,
            error: new Error('DB timeout')
        });

        const result = await dbRateLimit({ scope: 'org', key: 'org1', limit: 5, windowMs: 60000 });
        expect(result.allowed).toBe(false);
    });
});
