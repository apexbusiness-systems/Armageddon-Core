import { describe, it, expect } from 'vitest';
import { resolveTarget, describeResolvedTarget } from '../../src/cli/resolve-target';

const httpEnv = {
    ARMAGEDDON_TARGET_ENDPOINT: 'https://staging.example.com/agent',
    ARMAGEDDON_TARGET_BODY_TEMPLATE: '{"query":"{{prompt}}"}',
    ARMAGEDDON_TARGET_ALLOWLIST_HOSTS: 'staging.example.com',
};

describe('resolveTarget', () => {
    it('always resolves to the sim-001 stub in simulation mode, regardless of target flags', () => {
        const resolved = resolveTarget({
            mode: 'simulation',
            targetProvider: 'http',
            targetEndpoint: 'https://staging.example.com/agent',
        });
        expect(resolved).toEqual({ targetModel: 'sim-001', providerKind: 'simulation' });
    });

    it('fails loudly when destructive mode is requested without --target-provider', () => {
        expect(() => resolveTarget({ mode: 'destructive' })).toThrow(
            /requires --target-provider <model\|http>/
        );
    });

    it('fails loudly for an unknown --target-provider value', () => {
        expect(() => resolveTarget({ mode: 'destructive', targetProvider: 'bogus' })).toThrow(
            /Unknown --target-provider/
        );
    });

    describe('--target-provider model', () => {
        it('requires --target-model', () => {
            expect(() => resolveTarget({ mode: 'destructive', targetProvider: 'model' })).toThrow(
                /--target-model is required/
            );
        });

        it('rejects an unknown model identifier', () => {
            expect(() =>
                resolveTarget({ mode: 'destructive', targetProvider: 'model', targetModel: 'not-a-real-model' })
            ).toThrow(/Unknown or unsupported --target-model/);
        });

        it('rejects sim-001 and http-target as explicit --target-model values (must use their own provider kind)', () => {
            expect(() =>
                resolveTarget({ mode: 'destructive', targetProvider: 'model', targetModel: 'sim-001' })
            ).toThrow(/Unknown or unsupported --target-model/);
        });

        it('resolves a known real model', () => {
            const resolved = resolveTarget({ mode: 'destructive', targetProvider: 'model', targetModel: 'gpt-4o' });
            expect(resolved).toEqual({ targetModel: 'gpt-4o', providerKind: 'model' });
        });
    });

    describe('--target-provider http', () => {
        it('never silently substitutes sim-001 — resolves to the http-target sentinel with real config attached', () => {
            const resolved = resolveTarget({ mode: 'destructive', targetProvider: 'http', env: httpEnv });
            expect(resolved.targetModel).toBe('http-target');
            expect(resolved.targetModel).not.toBe('sim-001');
            expect(resolved.providerKind).toBe('http');
            expect(resolved.httpTarget?.endpoint).toBe('https://staging.example.com/agent');
        });

        it('fails loudly instead of falling back when required config is missing', () => {
            expect(() => resolveTarget({ mode: 'destructive', targetProvider: 'http', env: {} })).toThrow();
        });

        it('CLI flags take precedence over env vars', () => {
            const resolved = resolveTarget({
                mode: 'destructive',
                targetProvider: 'http',
                targetEndpoint: 'https://staging.example.com/agent',
                targetBodyTemplate: '{"query":"{{prompt}}"}',
                env: { ARMAGEDDON_TARGET_ALLOWLIST_HOSTS: 'staging.example.com' },
            });
            expect(resolved.httpTarget?.endpoint).toBe('https://staging.example.com/agent');
        });
    });

    describe('describeResolvedTarget', () => {
        it('never prints the auth header env value, only its name', () => {
            const resolved = resolveTarget({
                mode: 'destructive',
                targetProvider: 'http',
                env: { ...httpEnv, ARMAGEDDON_TARGET_AUTH_HEADER_ENV: 'MY_SECRET_ENV_VAR' },
            });
            const description = describeResolvedTarget(resolved);
            expect(description).toContain('MY_SECRET_ENV_VAR');
            expect(description).not.toContain(process.env.MY_SECRET_ENV_VAR ?? '__unset__');
        });

        it('describes a simulation target plainly', () => {
            const resolved = resolveTarget({ mode: 'simulation' });
            expect(describeResolvedTarget(resolved)).toMatch(/provider=simulation/);
        });
    });
});
