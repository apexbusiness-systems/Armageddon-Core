/**
 * Regression shield for Wake-on-Enqueue (execution-plane cold-start elimination).
 *
 * Root problem: the edge control plane and the Node execution plane are
 * decoupled — creating a run only inserts a `pending` row in Supabase, which
 * generates no inbound HTTP to the free-tier executor, so a run created while
 * the executor is spun down sits unclaimed until an unrelated request wakes it
 * (observed live on production run 6d608387). `wakeExecutor` fires one
 * fire-and-forget nudge at enqueue time to couple "work exists" → "wake worker".
 *
 * These lock the load-bearing contract:
 *   • unset / non-http(s) URL → no fetch, returns false (graceful degradation);
 *   • configured URL → exactly one GET to that URL, returns true;
 *   • a rejecting fetch never throws out of wakeExecutor (run creation is safe);
 *   • when an ExecutionContext is provided the promise is handed to waitUntil.
 */
import { describe, expect, it, vi, afterEach } from 'vitest';
import { wakeExecutor } from '../../src/intake-handler';

type Env = Parameters<typeof wakeExecutor>[0];

function makeEnv(url?: string): Env {
    // Only ARMAGEDDON_EXEC_WAKE_URL is read; ASSETS satisfies the type.
    return { ASSETS: { fetch: async () => new Response('') }, ARMAGEDDON_EXEC_WAKE_URL: url } as Env;
}

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('wakeExecutor — Wake-on-Enqueue contract', () => {
    it('is a no-op and returns false when no wake URL is configured', () => {
        const fetchSpy = vi.fn();
        vi.stubGlobal('fetch', fetchSpy);
        expect(wakeExecutor(makeEnv(undefined))).toBe(false);
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('is a no-op for a non-http(s) URL (never fetch untrusted schemes)', () => {
        const fetchSpy = vi.fn();
        vi.stubGlobal('fetch', fetchSpy);
        expect(wakeExecutor(makeEnv('file:///etc/passwd'))).toBe(false);
        expect(wakeExecutor(makeEnv('ftp://host/x'))).toBe(false);
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('fires exactly one GET to the configured URL and returns true', () => {
        const fetchSpy = vi.fn().mockResolvedValue(new Response(''));
        vi.stubGlobal('fetch', fetchSpy);
        const url = 'https://armageddon-exec-api.onrender.com/health';
        expect(wakeExecutor(makeEnv(url))).toBe(true);
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect(fetchSpy.mock.calls[0][0]).toBe(url);
        expect(fetchSpy.mock.calls[0][1]).toMatchObject({ method: 'GET' });
    });

    it('never throws when the wake fetch rejects (run creation must stay safe)', async () => {
        const fetchSpy = vi.fn().mockRejectedValue(new Error('executor down'));
        vi.stubGlobal('fetch', fetchSpy);
        // Synchronous call must not throw...
        expect(() => wakeExecutor(makeEnv('https://exec.example.com/health'))).not.toThrow();
        // ...and the swallowed rejection must not surface as an unhandled rejection.
        await Promise.resolve();
    });

    it('registers the wake promise with ctx.waitUntil when a context is provided', () => {
        const fetchSpy = vi.fn().mockResolvedValue(new Response(''));
        vi.stubGlobal('fetch', fetchSpy);
        const waitUntil = vi.fn();
        expect(wakeExecutor(makeEnv('https://exec.example.com/health'), { waitUntil })).toBe(true);
        expect(waitUntil).toHaveBeenCalledTimes(1);
        expect(waitUntil.mock.calls[0][0]).toBeInstanceOf(Promise);
    });
});
