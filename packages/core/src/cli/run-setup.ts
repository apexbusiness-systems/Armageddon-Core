// src/cli/run-setup.ts
// ARMAGEDDON Level 7 - CLI `run` command setup helpers
// APEX Business Systems Ltd.
//
// Extracted from bin/armageddon.ts's `run` action to keep that function's
// cognitive complexity down — each helper here owns one self-contained
// concern (mode env setup, HTTP target env propagation).

import type { ResolvedTarget } from './resolve-target.js';

/**
 * Sets the SIM_MODE/SANDBOX_TENANT/CHAOS_SEED/ARMAGEDDON_DESTRUCTIVE
 * environment for the requested run mode. Destructive mode without the
 * required SANDBOX_TENANT + ARMAGEDDON_DESTRUCTIVE env vars exits the
 * process immediately (matches the CLI's existing fail-closed behavior).
 */
export function configureRunModeEnv(mode: string, seed: number): void {
    if (mode === 'simulation') {
        process.env.SIM_MODE = 'true';
        process.env.SANDBOX_TENANT = process.env.SANDBOX_TENANT || 'cli-sim-tenant';
        process.env.CHAOS_SEED = seed.toString();
        delete process.env.ARMAGEDDON_DESTRUCTIVE;
        return;
    }

    if (mode !== 'destructive') return;

    // Required even for destructive (SIM_MODE=true + SANDBOX_TENANT + ARMAGEDDON_DESTRUCTIVE).
    process.env.SIM_MODE = 'true';

    if (!process.env.SANDBOX_TENANT || !process.env.ARMAGEDDON_DESTRUCTIVE) {
        console.error('[CLI] DESTRUCTIVE MODE BLOCKED: Missing required env vars (SANDBOX_TENANT, ARMAGEDDON_DESTRUCTIVE)');
        console.error('Use: SANDBOX_TENANT=x ARMAGEDDON_DESTRUCTIVE=true armageddon run --mode=destructive ...');
        process.exit(1);
    }
}

/**
 * Propagates a resolved HTTP target to the environment so the worker
 * process (in-process or external, via its own env) picks it up through
 * createHttpTargetConfigFromEnv(). No-op for non-http target kinds.
 */
export function applyHttpTargetEnv(resolvedTarget: ResolvedTarget): void {
    if (resolvedTarget.providerKind !== 'http' || !resolvedTarget.httpTarget) return;

    const t = resolvedTarget.httpTarget;
    process.env.ARMAGEDDON_TARGET_PROVIDER = 'http';
    process.env.ARMAGEDDON_TARGET_ENDPOINT = t.endpoint;
    process.env.ARMAGEDDON_TARGET_METHOD = t.method;
    process.env.ARMAGEDDON_TARGET_CONTENT_TYPE = t.contentType;
    process.env.ARMAGEDDON_TARGET_BODY_TEMPLATE = t.bodyTemplate;
    if (t.responsePath) process.env.ARMAGEDDON_TARGET_RESPONSE_PATH = t.responsePath;
    if (t.authHeaderEnv) process.env.ARMAGEDDON_TARGET_AUTH_HEADER_ENV = t.authHeaderEnv;
    process.env.ARMAGEDDON_TARGET_ALLOWLIST_HOSTS = t.allowlistHosts.join(',');
    process.env.ARMAGEDDON_TARGET_TIMEOUT_MS = String(t.timeoutMs);
    process.env.ARMAGEDDON_TARGET_MAX_RPM = String(t.maxRPM);
    process.env.ARMAGEDDON_TARGET_MAX_RESPONSE_CHARS = String(t.maxResponseChars);
}
