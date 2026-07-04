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

    it('imports without throwing and fails closed when credentials are missing', async () => {
        vi.stubEnv('SUPABASE_URL', '');
        vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
        vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
        vi.resetModules();
        // Module evaluation must not construct a client (previously crashed `next build`)
        const fresh = (await import('../src/lib/db-rate-limit')).dbRateLimit;
        expect(supabaseJs.createClient).not.toHaveBeenCalled();

        const result = await fresh({ scope: 'ip', key: '127.0.0.1', limit: 10, windowMs: 60000 });
        expect(result.allowed).toBe(false);
    });

    it('strips surrounding quotes from dashboard-pasted env values', async () => {
        vi.stubEnv('SUPABASE_URL', '"https://test.supabase.co"');
        vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', "'test-key'");
        vi.resetModules();
        const fresh = (await import('../src/lib/db-rate-limit')).dbRateLimit;
        mockRpc.mockResolvedValue({
            data: [{ allowed: true, remaining: 9, reset_at: new Date().toISOString() }],
            error: null
        });

        const result = await fresh({ scope: 'ip', key: '127.0.0.1', limit: 10, windowMs: 60000 });
        expect(result.allowed).toBe(true);
        expect(supabaseJs.createClient).toHaveBeenCalledWith(
            'https://test.supabase.co',
            'test-key',
            expect.anything()
        );
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
