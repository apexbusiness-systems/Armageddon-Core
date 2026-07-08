import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { configureRunModeEnv, applyHttpTargetEnv } from '../../src/cli/run-setup';
import { buildHttpTargetConfig } from '../../src/providers/http-target';

describe('configureRunModeEnv', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        delete process.env.SIM_MODE;
        delete process.env.SANDBOX_TENANT;
        delete process.env.CHAOS_SEED;
        delete process.env.ARMAGEDDON_DESTRUCTIVE;
    });

    afterEach(() => {
        process.env = { ...originalEnv };
        vi.restoreAllMocks();
    });

    it('sets simulation defaults and clears ARMAGEDDON_DESTRUCTIVE', () => {
        process.env.ARMAGEDDON_DESTRUCTIVE = 'true';
        configureRunModeEnv('simulation', 42);
        expect(process.env.SIM_MODE).toBe('true');
        expect(process.env.SANDBOX_TENANT).toBe('cli-sim-tenant');
        expect(process.env.CHAOS_SEED).toBe('42');
        expect(process.env.ARMAGEDDON_DESTRUCTIVE).toBeUndefined();
    });

    it('preserves an existing SANDBOX_TENANT in simulation mode', () => {
        process.env.SANDBOX_TENANT = 'my-tenant';
        configureRunModeEnv('simulation', 1);
        expect(process.env.SANDBOX_TENANT).toBe('my-tenant');
    });

    it('exits the process when destructive mode is missing required env vars', () => {
        const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

        configureRunModeEnv('destructive', 1);

        expect(errorSpy).toHaveBeenCalled();
        expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('allows destructive mode when SANDBOX_TENANT and ARMAGEDDON_DESTRUCTIVE are set', () => {
        process.env.SANDBOX_TENANT = 'sandbox-org';
        process.env.ARMAGEDDON_DESTRUCTIVE = 'true';
        const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

        configureRunModeEnv('destructive', 1);

        expect(exitSpy).not.toHaveBeenCalled();
        expect(process.env.SIM_MODE).toBe('true');
    });
});

describe('applyHttpTargetEnv', () => {
    afterEach(() => {
        for (const key of Object.keys(process.env)) {
            if (key.startsWith('ARMAGEDDON_TARGET_')) delete process.env[key];
        }
    });

    it('is a no-op for non-http target kinds', () => {
        applyHttpTargetEnv({ targetModel: 'sim-001', providerKind: 'simulation' });
        expect(process.env.ARMAGEDDON_TARGET_PROVIDER).toBeUndefined();
    });

    it('propagates an http target config into the environment', () => {
        const httpTarget = buildHttpTargetConfig({
            endpoint: 'https://staging.example.com/agent',
            bodyTemplate: '{"query":"{{prompt}}"}',
            responsePath: 'data.reply',
            allowlistHosts: 'staging.example.com',
            authHeaderEnv: 'MY_BEARER',
        });

        applyHttpTargetEnv({ targetModel: 'http-target', providerKind: 'http', httpTarget });

        expect(process.env.ARMAGEDDON_TARGET_PROVIDER).toBe('http');
        expect(process.env.ARMAGEDDON_TARGET_ENDPOINT).toBe('https://staging.example.com/agent');
        expect(process.env.ARMAGEDDON_TARGET_RESPONSE_PATH).toBe('data.reply');
        expect(process.env.ARMAGEDDON_TARGET_AUTH_HEADER_ENV).toBe('MY_BEARER');
        expect(process.env.ARMAGEDDON_TARGET_ALLOWLIST_HOSTS).toBe('staging.example.com');
    });
});
