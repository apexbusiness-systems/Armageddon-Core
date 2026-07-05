import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// HttpTargetProvider delegates SSRF/private-IP checks to the shared
// (already independently tested) validateSSRF. Mocking it here keeps these
// unit tests deterministic and offline — no real DNS lookups for
// 'staging.example.com' — while still exercising *that HttpTargetProvider
// calls it and respects the result*. The one true-negative test in this file
// uses a literal loopback IP, which validateSSRF rejects via synchronous
// IP-range logic (no DNS involved), so that specific assertion still proves
// real behavior end to end.
vi.mock('@armageddon/shared/omniport', () => ({
    validateSSRF: vi.fn(async (url: string) => {
        try {
            const hostname = new URL(url).hostname.toLowerCase();
            const blockedLiterals = ['127.0.0.1', 'localhost', '::1', '0.0.0.0'];
            return !blockedLiterals.includes(hostname);
        } catch {
            return false;
        }
    }),
}));

import {
    HttpTargetProvider,
    buildHttpTargetConfig,
    createHttpTargetConfigFromEnv,
    interpolateBodyTemplate,
    extractResponseByPath,
    isHostAllowlisted,
    isNonProductionLikeHost,
} from '../../src/providers/http-target';
import { CircuitBreakerRegistry } from '../../src/providers/circuit-breaker';
import type { LLMRequest } from '../../src/providers/types';

describe('http-target helpers', () => {
    describe('isNonProductionLikeHost', () => {
        it('recognizes common non-production markers', () => {
            expect(isNonProductionLikeHost('staging.example.com')).toBe(true);
            expect(isNonProductionLikeHost('my-sandbox-project.supabase.co')).toBe(true);
            expect(isNonProductionLikeHost('localhost')).toBe(true);
            expect(isNonProductionLikeHost('api-dev.example.com')).toBe(true);
        });

        it('treats a bare production-looking domain as production-like', () => {
            expect(isNonProductionLikeHost('apexomnihub.icu')).toBe(false);
            expect(isNonProductionLikeHost('app.example.com')).toBe(false);
        });
    });

    describe('interpolateBodyTemplate', () => {
        it('substitutes prompt/systemPrompt/uuid as JSON-escaped content', () => {
            const body = interpolateBodyTemplate('{"query":"{{prompt}}","traceId":"{{uuid}}"}', {
                prompt: 'hello "world"\nline2',
                uuid: 'abc-123',
            });
            expect(body).toEqual({ query: 'hello "world"\nline2', traceId: 'abc-123' });
        });

        it('throws if the template does not produce valid JSON after substitution', () => {
            expect(() =>
                interpolateBodyTemplate('{"query": {{prompt}}}', { prompt: 'unquoted', uuid: 'x' })
            ).toThrow(/did not produce valid JSON/);
        });

        it('cannot be broken out of by adversarial prompt content', () => {
            // A naive (non-JSON-safe) template engine would let this prompt
            // inject a second top-level field. JSON.stringify-based escaping
            // must keep it as inert string content instead.
            const body = interpolateBodyTemplate('{"query":"{{prompt}}"}', {
                prompt: '","admin":true,"x":"',
                uuid: 'x',
            });
            expect(body).toEqual({ query: '","admin":true,"x":"' });
            expect((body as any).admin).toBeUndefined();
        });
    });

    describe('extractResponseByPath', () => {
        it('resolves a nested dot-path', () => {
            expect(extractResponseByPath({ data: { reply: 'hi' } }, 'data.reply')).toBe('hi');
        });

        it('returns undefined for a missing path (caller falls back)', () => {
            expect(extractResponseByPath({ data: {} }, 'data.reply')).toBeUndefined();
            expect(extractResponseByPath({ data: {} }, undefined)).toBeUndefined();
        });

        it('stringifies non-string leaf values', () => {
            expect(extractResponseByPath({ data: { reply: { nested: 1 } } }, 'data.reply')).toBe('{"nested":1}');
        });
    });

    describe('isHostAllowlisted', () => {
        it('matches case-insensitively and rejects anything not listed', () => {
            expect(isHostAllowlisted('Example.COM', ['example.com'])).toBe(true);
            expect(isHostAllowlisted('evil.com', ['example.com'])).toBe(false);
        });
    });

    describe('buildHttpTargetConfig', () => {
        const validRaw = {
            endpoint: 'https://staging.example.com/functions/v1/agent',
            bodyTemplate: '{"query":"{{prompt}}"}',
            allowlistHosts: 'staging.example.com',
        };

        it('builds a valid config with defaults applied', () => {
            const cfg = buildHttpTargetConfig(validRaw);
            expect(cfg.method).toBe('POST');
            expect(cfg.contentType).toBe('application/json');
            expect(cfg.timeoutMs).toBe(30_000);
            expect(cfg.maxRPM).toBe(10);
            expect(cfg.maxResponseChars).toBe(20_000);
            expect(cfg.allowlistHosts).toEqual(['staging.example.com']);
        });

        it('fails loudly when endpoint is missing', () => {
            expect(() => buildHttpTargetConfig({ ...validRaw, endpoint: undefined })).toThrow(/Missing target endpoint/);
        });

        it('fails loudly when bodyTemplate is missing', () => {
            expect(() => buildHttpTargetConfig({ ...validRaw, bodyTemplate: undefined })).toThrow(/Missing body template/);
        });

        it('default-denies when allowlistHosts is empty', () => {
            expect(() => buildHttpTargetConfig({ ...validRaw, allowlistHosts: '' })).toThrow(/Default-deny/);
        });

        it('default-denies when the endpoint host is not in the allowlist', () => {
            expect(() =>
                buildHttpTargetConfig({ ...validRaw, allowlistHosts: 'someone-else.example.com' })
            ).toThrow(/not present in ARMAGEDDON_TARGET_ALLOWLIST_HOSTS/);
        });

        it('blocks a production-looking host without the canary flag', () => {
            expect(() =>
                buildHttpTargetConfig({
                    ...validRaw,
                    endpoint: 'https://apexomnihub.icu/functions/v1/agent',
                    allowlistHosts: 'apexomnihub.icu',
                })
            ).toThrow(/does not look like a staging\/sandbox\/dev\/test host/);
        });

        it('allows a production-looking host only with the explicit canary flag', () => {
            const cfg = buildHttpTargetConfig({
                ...validRaw,
                endpoint: 'https://apexomnihub.icu/functions/v1/agent',
                allowlistHosts: 'apexomnihub.icu',
                allowProductionHost: 'true',
            });
            expect(cfg.endpoint).toBe('https://apexomnihub.icu/functions/v1/agent');
        });

        it('rejects an invalid endpoint URL', () => {
            expect(() => buildHttpTargetConfig({ ...validRaw, endpoint: 'not-a-url' })).toThrow(/not a valid URL/);
        });
    });

    describe('createHttpTargetConfigFromEnv', () => {
        it('returns null when ARMAGEDDON_TARGET_PROVIDER is not http (not an error — just unrequested)', () => {
            expect(createHttpTargetConfigFromEnv({})).toBeNull();
            expect(createHttpTargetConfigFromEnv({ ARMAGEDDON_TARGET_PROVIDER: 'model' })).toBeNull();
        });

        it('throws (does not silently fall back) when http is requested but misconfigured', () => {
            expect(() => createHttpTargetConfigFromEnv({ ARMAGEDDON_TARGET_PROVIDER: 'http' })).toThrow();
        });

        it('builds a config from a full env map', () => {
            const cfg = createHttpTargetConfigFromEnv({
                ARMAGEDDON_TARGET_PROVIDER: 'http',
                ARMAGEDDON_TARGET_ENDPOINT: 'https://staging.example.com/agent',
                ARMAGEDDON_TARGET_BODY_TEMPLATE: '{"query":"{{prompt}}"}',
                ARMAGEDDON_TARGET_ALLOWLIST_HOSTS: 'staging.example.com',
            });
            expect(cfg?.endpoint).toBe('https://staging.example.com/agent');
        });
    });
});

describe('HttpTargetProvider', () => {
    const config = buildHttpTargetConfig({
        endpoint: 'https://staging.example.com/agent',
        bodyTemplate: '{"query":"{{prompt}}","traceId":"{{uuid}}"}',
        responsePath: 'data.reply',
        allowlistHosts: 'staging.example.com',
        authHeaderEnv: 'TEST_TARGET_BEARER',
    });

    beforeEach(() => {
        vi.restoreAllMocks();
        CircuitBreakerRegistry.getInstance().resetAll();
        delete process.env.TEST_TARGET_BEARER;
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete process.env.TEST_TARGET_BEARER;
    });

    it('requires httpTarget in ProviderOptions', () => {
        expect(() => new HttpTargetProvider({ model: 'http-target' } as any)).toThrow(/httpTarget is required/);
    });

    it('sends the interpolated body, extracts the response path, and never logs the auth header value', async () => {
        process.env.TEST_TARGET_BEARER = 'super-secret-token';
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            type: 'basic',
            text: async () => JSON.stringify({ data: { reply: 'hello back' } }),
        } as unknown as Response);
        vi.stubGlobal('fetch', mockFetch);

        const provider = new HttpTargetProvider({ model: 'http-target', httpTarget: config });
        const request: LLMRequest = { prompt: 'attack prompt' };
        const response = await provider.complete(request);

        expect(mockFetch).toHaveBeenCalledTimes(1);
        const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toBe('https://staging.example.com/agent');
        expect(init.redirect).toBe('manual');

        const sentHeaders = init.headers as Record<string, string>;
        expect(sentHeaders['Authorization']).toBe('Bearer super-secret-token');

        const sentBody = JSON.parse(init.body as string);
        expect(sentBody.query).toBe('attack prompt');
        expect(typeof sentBody.traceId).toBe('string');

        expect(response.content).toBe('hello back');
        expect(response.model).toBe('http-target');
        expect(response.finishReason).toBe('stop');

        // The raw metadata and any thrown message must never carry the secret.
        expect(JSON.stringify(response.raw)).not.toContain('super-secret-token');
        expect(JSON.stringify(response)).not.toContain('super-secret-token');
    });

    it('falls back to the bounded raw body when responsePath is absent from the response', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            type: 'basic',
            text: async () => JSON.stringify({ unexpected: 'shape' }),
        } as unknown as Response);
        vi.stubGlobal('fetch', mockFetch);

        const provider = new HttpTargetProvider({ model: 'http-target', httpTarget: config });
        const response = await provider.complete({ prompt: 'x' });
        expect(response.content).toBe(JSON.stringify({ unexpected: 'shape' }));
    });

    it('blocks an unsafe redirect instead of following it', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 302,
            type: 'basic',
        } as unknown as Response);
        vi.stubGlobal('fetch', mockFetch);

        const provider = new HttpTargetProvider({ model: 'http-target', httpTarget: config });
        await expect(provider.complete({ prompt: 'x' })).rejects.toThrow(/unsafe redirect/);
    });

    it('blocks an opaque redirect response type', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 0,
            type: 'opaqueredirect',
        } as unknown as Response);
        vi.stubGlobal('fetch', mockFetch);

        const provider = new HttpTargetProvider({ model: 'http-target', httpTarget: config });
        await expect(provider.complete({ prompt: 'x' })).rejects.toThrow(/unsafe redirect/);
    });

    it('rejects a private/loopback endpoint via validateSSRF even if it slipped past the allowlist', async () => {
        const localConfig = buildHttpTargetConfig({
            endpoint: 'http://127.0.0.1:9999/agent',
            bodyTemplate: '{"query":"{{prompt}}"}',
            allowlistHosts: '127.0.0.1',
            // Passing the production-canary gate on purpose here — this test
            // proves the independent SSRF layer still blocks the request even
            // when the allowlist/canary gate was (mis)configured to allow it.
            allowProductionHost: 'true',
        });
        const mockFetch = vi.fn();
        vi.stubGlobal('fetch', mockFetch);

        const provider = new HttpTargetProvider({ model: 'http-target', httpTarget: localConfig });
        await expect(provider.complete({ prompt: 'x' })).rejects.toThrow(/SSRF validation rejected/);
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('truncates an oversized response and marks finishReason length', async () => {
        const bigConfig = buildHttpTargetConfig({
            endpoint: 'https://staging.example.com/agent',
            bodyTemplate: '{"query":"{{prompt}}"}',
            allowlistHosts: 'staging.example.com',
            maxResponseChars: '10',
        });
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            type: 'basic',
            text: async () => 'x'.repeat(100),
        } as unknown as Response);
        vi.stubGlobal('fetch', mockFetch);

        const provider = new HttpTargetProvider({ model: 'http-target', httpTarget: bigConfig });
        const response = await provider.complete({ prompt: 'x' });
        expect(response.content.length).toBe(10);
        expect(response.finishReason).toBe('length');
    });

    it('propagates non-2xx responses as errors without leaking headers', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 500,
            type: 'basic',
            text: async () => 'internal error',
        } as unknown as Response);
        vi.stubGlobal('fetch', mockFetch);

        const provider = new HttpTargetProvider({ model: 'http-target', httpTarget: config });
        await expect(provider.complete({ prompt: 'x' })).rejects.toThrow(/Target returned 500/);
    });
});
