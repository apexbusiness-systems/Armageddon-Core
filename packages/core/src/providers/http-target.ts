// src/providers/http-target.ts
// ARMAGEDDON Level 7 - Generic HTTP Target Provider
// APEX Business Systems Ltd.
//
// Lets the CERTIFIED adversarial batteries (B10-B14) attack a real HTTP
// app/agent endpoint instead of the `sim-001` simulation stub. Deliberately
// generic: no product (e.g. APEX-OmniHub) is named or special-cased here —
// the target's request/response shape is entirely described by operator
// config (env vars or CLI flags), documented in HttpTargetConfig.

import { validateSSRF } from '@armageddon/shared/omniport';
import type {
    HttpTargetConfig,
    ILLMProvider,
    LLMRequest,
    LLMResponse,
    ProviderMetrics,
    ProviderName,
    ProviderOptions,
} from './types';
import { CircuitBreaker, CircuitBreakerRegistry } from './circuit-breaker';

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RPM = 10;
const DEFAULT_MAX_RESPONSE_CHARS = 20_000;

/** Hostname substrings that identify a target as explicitly non-production. */
const NON_PRODUCTION_HOST_MARKERS = [
    'staging', 'stage', 'sandbox', 'dev', 'test', 'local', 'localhost', 'qa', 'preview',
];

export function isNonProductionLikeHost(hostname: string): boolean {
    const h = hostname.toLowerCase();
    return NON_PRODUCTION_HOST_MARKERS.some(marker => h.includes(marker));
}

/**
 * Raw, string-typed input for building an HttpTargetConfig — mirrors the
 * ARMAGEDDON_TARGET_* env vars / --target-* CLI flags 1:1 before parsing.
 */
export interface RawHttpTargetInput {
    endpoint?: string;
    method?: string;
    contentType?: string;
    bodyTemplate?: string;
    responsePath?: string;
    authHeaderEnv?: string;
    timeoutMs?: string | number;
    /** Comma-separated hostnames. */
    allowlistHosts?: string;
    maxRPM?: string | number;
    maxResponseChars?: string | number;
    /** Explicit canary: required when the resolved host doesn't self-identify as non-production. */
    allowProductionHost?: string | boolean;
}

function toPositiveInt(value: string | number | undefined, fallback: number): number {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/**
 * Validates and builds an HttpTargetConfig from raw string input.
 * Fails loudly (throws) on any missing/invalid required field — this
 * provider must never silently fall back to a fake target.
 */
export function buildHttpTargetConfig(raw: RawHttpTargetInput): HttpTargetConfig {
    if (!raw.endpoint) {
        throw new Error(
            '[HttpTarget] Missing target endpoint (ARMAGEDDON_TARGET_ENDPOINT / --target-endpoint is required for --target-provider http).'
        );
    }
    if (!raw.bodyTemplate) {
        throw new Error(
            '[HttpTarget] Missing body template (ARMAGEDDON_TARGET_BODY_TEMPLATE / --target-body-template is required for --target-provider http).'
        );
    }

    let hostname: string;
    try {
        hostname = new URL(raw.endpoint).hostname.toLowerCase();
    } catch {
        throw new Error(`[HttpTarget] ARMAGEDDON_TARGET_ENDPOINT is not a valid URL: ${raw.endpoint}`);
    }

    const allowlistHosts = (raw.allowlistHosts ?? '')
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter(Boolean);

    if (allowlistHosts.length === 0) {
        throw new Error(
            '[HttpTarget] ARMAGEDDON_TARGET_ALLOWLIST_HOSTS is required and must be non-empty. ' +
            'Default-deny: no target host is reachable unless explicitly listed.'
        );
    }
    if (!allowlistHosts.includes(hostname)) {
        throw new Error(
            `[HttpTarget] Target endpoint host '${hostname}' is not present in ARMAGEDDON_TARGET_ALLOWLIST_HOSTS. Refusing (default-deny).`
        );
    }

    const allowProductionHost = raw.allowProductionHost === true || raw.allowProductionHost === 'true';
    if (!isNonProductionLikeHost(hostname) && !allowProductionHost) {
        throw new Error(
            `[HttpTarget] Target host '${hostname}' does not look like a staging/sandbox/dev/test host. ` +
            `Refusing to run adversarial traffic against a possibly-production host without an explicit ` +
            `production canary gate. Set ARMAGEDDON_TARGET_ALLOW_PRODUCTION_HOST=true only if you have ` +
            `deliberately decided to run this against a production target.`
        );
    }

    return {
        endpoint: raw.endpoint,
        method: raw.method || 'POST',
        contentType: raw.contentType || 'application/json',
        bodyTemplate: raw.bodyTemplate,
        responsePath: raw.responsePath,
        authHeaderEnv: raw.authHeaderEnv,
        timeoutMs: toPositiveInt(raw.timeoutMs, DEFAULT_TIMEOUT_MS),
        allowlistHosts,
        maxRPM: toPositiveInt(raw.maxRPM, DEFAULT_MAX_RPM),
        maxResponseChars: toPositiveInt(raw.maxResponseChars, DEFAULT_MAX_RESPONSE_CHARS),
    };
}

/**
 * Reads ARMAGEDDON_TARGET_* env vars and builds a validated HttpTargetConfig.
 * Returns null (not an error) when ARMAGEDDON_TARGET_PROVIDER !== 'http' —
 * i.e. HTTP targeting simply isn't requested. Throws if it IS requested but
 * misconfigured, so callers must not swallow the null case into a fallback.
 */
export function createHttpTargetConfigFromEnv(env: NodeJS.ProcessEnv = process.env): HttpTargetConfig | null {
    if (env.ARMAGEDDON_TARGET_PROVIDER !== 'http') return null;

    return buildHttpTargetConfig({
        endpoint: env.ARMAGEDDON_TARGET_ENDPOINT,
        method: env.ARMAGEDDON_TARGET_METHOD,
        contentType: env.ARMAGEDDON_TARGET_CONTENT_TYPE,
        bodyTemplate: env.ARMAGEDDON_TARGET_BODY_TEMPLATE,
        responsePath: env.ARMAGEDDON_TARGET_RESPONSE_PATH,
        authHeaderEnv: env.ARMAGEDDON_TARGET_AUTH_HEADER_ENV,
        timeoutMs: env.ARMAGEDDON_TARGET_TIMEOUT_MS,
        allowlistHosts: env.ARMAGEDDON_TARGET_ALLOWLIST_HOSTS,
        maxRPM: env.ARMAGEDDON_TARGET_MAX_RPM,
        maxResponseChars: env.ARMAGEDDON_TARGET_MAX_RESPONSE_CHARS,
        allowProductionHost: env.ARMAGEDDON_TARGET_ALLOW_PRODUCTION_HOST,
    });
}

/** JSON-safe substitution — never allows prompt content to break out of the template's JSON string context. */
function jsonEscapeForTemplate(value: string): string {
    return JSON.stringify(value).slice(1, -1);
}

export interface BodyTemplateVars {
    prompt: string;
    systemPrompt?: string;
    uuid: string;
}

/** Interpolates {{prompt}}, {{systemPrompt}}, {{uuid}} into a JSON body template and validates the result parses. */
export function interpolateBodyTemplate(template: string, vars: BodyTemplateVars): Record<string, unknown> {
    const substituted = template
        .replaceAll('{{prompt}}', jsonEscapeForTemplate(vars.prompt))
        .replaceAll('{{systemPrompt}}', jsonEscapeForTemplate(vars.systemPrompt ?? ''))
        .replaceAll('{{uuid}}', vars.uuid);

    try {
        return JSON.parse(substituted);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`[HttpTarget] Body template did not produce valid JSON after substitution: ${msg}`);
    }
}

/** Resolves a dot-path (e.g. "data.reply") against a parsed JSON value. Returns undefined if any segment is missing. */
export function extractResponseByPath(value: unknown, path: string | undefined): string | undefined {
    if (!path) return undefined;
    let current: unknown = value;
    for (const segment of path.split('.')) {
        if (current === null || typeof current !== 'object' || !(segment in current)) return undefined;
        current = (current as Record<string, unknown>)[segment];
    }
    if (current === undefined || current === null) return undefined;
    return typeof current === 'string' ? current : JSON.stringify(current);
}

export function isHostAllowlisted(hostname: string, allowlistHosts: string[]): boolean {
    const h = hostname.toLowerCase();
    return allowlistHosts.some(allowed => allowed.toLowerCase() === h);
}

/**
 * HttpTargetProvider - System-Under-Test adapter for a real app/agent HTTP
 * endpoint. Only ever used as the `target` role in the 3-LLM adversarial
 * architecture (never attacker/judge) — see AdversarialConfig.
 *
 * Safety posture (defense in depth, all required, none optional):
 *  - allowlistHosts is mandatory and checked at both config-build time and
 *    per-request time (config could theoretically be reused across a DNS change).
 *  - validateSSRF (@armageddon/shared/omniport) blocks private/loopback/
 *    link-local/metadata IPs and non-http(s) schemes.
 *  - redirects are never followed (`redirect: 'manual'`) — any 3xx or
 *    opaque redirect is treated as a hard failure.
 *  - requests are timeout-bounded and response bodies are size-bounded.
 *  - the resolved auth header value is never included in thrown errors,
 *    logs, or the `raw` metadata returned to callers.
 *  - rate limiting reuses the same CircuitBreaker every other provider uses.
 */
export class HttpTargetProvider implements ILLMProvider {
    readonly name: ProviderName = 'http';
    readonly model = 'http-target' as const;

    private readonly config: HttpTargetConfig;
    private readonly circuitBreaker: CircuitBreaker;

    constructor(options: ProviderOptions) {
        if (!options.httpTarget) {
            throw new Error('[HttpTarget] ProviderOptions.httpTarget is required when model is "http-target".');
        }
        this.config = options.httpTarget;

        this.circuitBreaker = CircuitBreakerRegistry.getInstance().getOrCreate(
            `http-target:${new URL(this.config.endpoint).hostname}`,
            {
                maxRequestsPerMinute: this.config.maxRPM ?? DEFAULT_MAX_RPM,
                // Cost concepts don't apply to a customer's own app — disable the cost trip.
                maxCostUSD: Number.MAX_SAFE_INTEGER,
                maxTokensPerRun: Number.MAX_SAFE_INTEGER,
            }
        );
    }

    async complete(request: LLMRequest): Promise<LLMResponse> {
        if (!this.circuitBreaker.canProceed()) {
            throw new Error(`[HttpTarget] Circuit breaker OPEN for ${new URL(this.config.endpoint).hostname}`);
        }
        const globalBreaker = CircuitBreakerRegistry.getInstance().getGlobal();
        if (!globalBreaker.canProceed()) {
            throw new Error('[HttpTarget] Global circuit breaker OPEN');
        }

        const startTime = Date.now();
        try {
            const result = await this.executeRequest(request);
            const latencyMs = Date.now() - startTime;

            this.circuitBreaker.recordSuccess(result.inputTokens, result.outputTokens, latencyMs);
            globalBreaker.recordSuccess(result.inputTokens, result.outputTokens, latencyMs);

            return { ...result, latencyMs };
        } catch (error) {
            this.circuitBreaker.recordError();
            globalBreaker.recordError();
            throw error;
        }
    }

    private async executeRequest(request: LLMRequest): Promise<Omit<LLMResponse, 'latencyMs'>> {
        const endpointUrl = new URL(this.config.endpoint);

        // Re-validate on every call — config objects can be long-lived (held
        // by a running worker) while DNS/allowlist expectations must not.
        if (!isHostAllowlisted(endpointUrl.hostname, this.config.allowlistHosts)) {
            throw new Error(`[HttpTarget] Host '${endpointUrl.hostname}' left the allowlist. Refusing request.`);
        }
        const ssrfOk = await validateSSRF(this.config.endpoint);
        if (!ssrfOk) {
            throw new Error(`[HttpTarget] SSRF validation rejected endpoint host '${endpointUrl.hostname}'.`);
        }

        const body = interpolateBodyTemplate(this.config.bodyTemplate, {
            prompt: request.prompt,
            systemPrompt: request.systemPrompt,
            uuid: crypto.randomUUID(),
        });

        const authValue = this.config.authHeaderEnv ? process.env[this.config.authHeaderEnv] : undefined;
        const headers: Record<string, string> = {
            'Content-Type': this.config.contentType || 'application/json',
        };
        if (authValue) headers['Authorization'] = `Bearer ${authValue}`;

        const timeoutMs = this.config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        let response: Response;
        try {
            response = await fetch(this.config.endpoint, {
                method: this.config.method || 'POST',
                headers,
                body: JSON.stringify(body),
                redirect: 'manual', // never silently follow a redirect to an unvalidated host
                signal: AbortSignal.timeout(timeoutMs),
            });
        } catch (err) {
            // Never let a fetch error leak header values via err.cause / request echo.
            const msg = err instanceof Error ? err.message : String(err);
            throw new Error(`[HttpTarget] Request to ${endpointUrl.hostname} failed: ${msg}`);
        }

        if (response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) {
            throw new Error(`[HttpTarget] Target responded with an unsafe redirect (status ${response.status}). Blocked.`);
        }
        if (!response.ok) {
            const errorText = (await response.text().catch(() => '')).slice(0, 500);
            throw new Error(`[HttpTarget] Target returned ${response.status}: ${errorText}`);
        }

        const maxChars = this.config.maxResponseChars ?? DEFAULT_MAX_RESPONSE_CHARS;
        const rawText = await response.text();
        const truncated = rawText.length > maxChars;
        const boundedText = truncated ? rawText.slice(0, maxChars) : rawText;

        let parsed: unknown = boundedText;
        try {
            parsed = JSON.parse(boundedText);
        } catch {
            // Non-JSON response body — fall through and use the bounded text directly.
        }

        const extracted = extractResponseByPath(parsed, this.config.responsePath);
        const content = extracted ?? (typeof parsed === 'string' ? parsed : JSON.stringify(parsed));

        const inputTokens = Math.ceil(request.prompt.length / 4);
        const outputTokens = Math.ceil(content.length / 4);

        return {
            content,
            model: 'http-target',
            inputTokens,
            outputTokens,
            totalTokens: inputTokens + outputTokens,
            finishReason: truncated ? 'length' : 'stop',
            // Deliberately omits headers/auth value/full request — only safe,
            // non-secret metadata about the exchange.
            raw: {
                endpointHost: endpointUrl.hostname,
                status: response.status,
                truncated,
                responsePathUsed: this.config.responsePath ?? null,
                responsePathResolved: extracted !== undefined,
            },
        };
    }

    getMetrics(): ProviderMetrics {
        return this.circuitBreaker.getMetrics();
    }

    isAvailable(): boolean {
        try {
            const hostname = new URL(this.config.endpoint).hostname;
            return this.circuitBreaker.canProceed() && isHostAllowlisted(hostname, this.config.allowlistHosts);
        } catch {
            return false;
        }
    }

    reset(): void {
        this.circuitBreaker.reset();
    }
}
