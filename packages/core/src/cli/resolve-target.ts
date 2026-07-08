// src/cli/resolve-target.ts
// ARMAGEDDON Level 7 - CLI target resolution
// APEX Business Systems Ltd.
//
// Pure, testable logic shared by `armageddon run` and `armageddon target-check`.
// Decides which model/provider B10-B14 will attack, and fails loudly instead
// of silently defaulting to the 'sim-001' stub whenever CERTIFIED mode is
// requested without an explicit, valid target.

import type { AdversarialModel } from '../core/types.js';
import type { HttpTargetConfig } from '../providers/types.js';
import { buildHttpTargetConfig, isKnownTargetModel } from '../providers/index.js';

export type TargetProviderKind = 'simulation' | 'model' | 'http';

export interface ResolvedTarget {
    targetModel: AdversarialModel;
    providerKind: TargetProviderKind;
    httpTarget?: HttpTargetConfig;
}

export interface ResolveTargetOptions {
    mode: string;
    targetProvider?: string;
    targetModel?: string;
    targetEndpoint?: string;
    targetMethod?: string;
    targetContentType?: string;
    targetBodyTemplate?: string;
    targetResponsePath?: string;
    targetAuthHeaderEnv?: string;
    /** process.env by default — injectable for tests. */
    env?: NodeJS.ProcessEnv;
}

/**
 * Resolves the effective target for a run. Never returns a value that
 * silently substitutes 'sim-001' for a CERTIFIED run — any ambiguity or
 * missing config throws instead.
 */
export function resolveTarget(options: ResolveTargetOptions): ResolvedTarget {
    const env = options.env ?? process.env;

    if (options.mode !== 'destructive') {
        // FREE/simulation tier always uses the SimulationAdapter regardless
        // of targetModel (see runGenericAdversarialBattery) — 'sim-001' here
        // is just accurate bookkeeping, not a fallback.
        return { targetModel: 'sim-001', providerKind: 'simulation' };
    }

    const kind = options.targetProvider;
    if (!kind) {
        throw new Error(
            "[CLI] CERTIFIED mode (--mode destructive) requires --target-provider <model|http>. " +
            "Refusing to silently fall back to the 'sim-001' simulation stub for a certification run."
        );
    }

    if (kind === 'model') {
        const model = options.targetModel;
        if (!model) {
            throw new Error("[CLI] --target-model is required when --target-provider model.");
        }
        if (!isKnownTargetModel(model)) {
            throw new Error(`[CLI] Unknown or unsupported --target-model '${model}'.`);
        }
        return { targetModel: model as AdversarialModel, providerKind: 'model' };
    }

    if (kind === 'http') {
        const httpTarget = buildHttpTargetConfig({
            endpoint: options.targetEndpoint ?? env.ARMAGEDDON_TARGET_ENDPOINT,
            method: options.targetMethod ?? env.ARMAGEDDON_TARGET_METHOD,
            contentType: options.targetContentType ?? env.ARMAGEDDON_TARGET_CONTENT_TYPE,
            bodyTemplate: options.targetBodyTemplate ?? env.ARMAGEDDON_TARGET_BODY_TEMPLATE,
            responsePath: options.targetResponsePath ?? env.ARMAGEDDON_TARGET_RESPONSE_PATH,
            authHeaderEnv: options.targetAuthHeaderEnv ?? env.ARMAGEDDON_TARGET_AUTH_HEADER_ENV,
            timeoutMs: env.ARMAGEDDON_TARGET_TIMEOUT_MS,
            allowlistHosts: env.ARMAGEDDON_TARGET_ALLOWLIST_HOSTS,
            maxRPM: env.ARMAGEDDON_TARGET_MAX_RPM,
            maxResponseChars: env.ARMAGEDDON_TARGET_MAX_RESPONSE_CHARS,
            allowProductionHost: env.ARMAGEDDON_TARGET_ALLOW_PRODUCTION_HOST,
        });
        return { targetModel: 'http-target', providerKind: 'http', httpTarget };
    }

    throw new Error(`[CLI] Unknown --target-provider '${kind}'. Must be 'model' or 'http'.`);
}

/** Redacted, human-readable summary safe to print (dry-run / target-check). */
export function describeResolvedTarget(resolved: ResolvedTarget): string {
    if (resolved.providerKind === 'simulation') {
        return 'provider=simulation model=sim-001 (SimulationAdapter — no network calls, no real target)';
    }
    if (resolved.providerKind === 'model') {
        return `provider=model model=${resolved.targetModel} (LiveFireAdapter — real LLM-vs-LLM adversarial testing)`;
    }
    const t = resolved.httpTarget!;
    return (
        `provider=http model=http-target (LiveFireAdapter — real HTTP app/agent target)\n` +
        `  endpoint:            ${t.endpoint}\n` +
        `  method:              ${t.method}\n` +
        `  allowlistHosts:      ${t.allowlistHosts.join(', ')}\n` +
        `  responsePath:        ${t.responsePath ?? '(none — using bounded raw body)'}\n` +
        `  authHeaderEnv:       ${t.authHeaderEnv ?? '(none configured)'}\n` +
        `  timeoutMs:           ${t.timeoutMs}\n` +
        `  maxRPM:              ${t.maxRPM}\n` +
        `  maxResponseChars:    ${t.maxResponseChars}`
    );
}
