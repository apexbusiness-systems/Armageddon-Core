// src/providers/types.ts
// ARMAGEDDON Level 7 - LLM Provider Abstraction Layer
// APEX Business Systems Ltd.
// DATE: 2026-02-06

/**
 * Supported LLM providers for adversarial testing
 */
export type ProviderName = 'openai' | 'anthropic' | 'together' | 'groq' | 'simulation' | 'http';

/**
 * Model identifiers grouped by provider
 */
export type OpenAIModel = 'gpt-4-turbo' | 'gpt-4o' | 'gpt-4o-mini' | 'gpt-3.5-turbo';
export type AnthropicModel =
    | 'claude-opus-4-6'
    | 'claude-sonnet-4-6'
    | 'claude-haiku-4-5'
    | 'claude-3-opus-20240229'     // backward compat — do not remove
    | 'claude-3-sonnet-20240229'   // backward compat — do not remove
    | 'claude-3-haiku-20240307';   // backward compat — do not remove
export type TogetherModel = 'meta-llama/Llama-3-70b-chat-hf' | 'mistralai/Mixtral-8x7B-Instruct-v0.1';
export type GroqModel = 
    | 'llama-3.1-8b-instant' 
    | 'llama-3.3-70b-versatile' 
    | 'openai/gpt-oss-120b' 
    | 'openai/gpt-oss-20b'
    // Legacy models (deprecated)
    | 'llama3-70b-8192' 
    | 'mixtral-8x7b-32768';

export type ModelIdentifier = OpenAIModel | AnthropicModel | TogetherModel | GroqModel | 'sim-001' | 'http-target';

/**
 * Standard LLM request configuration
 */
export interface LLMRequest {
    prompt: string;
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
    stopSequences?: string[];
}

/**
 * Standard LLM response
 */
export interface LLMResponse {
    content: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    latencyMs: number;
    finishReason: 'stop' | 'length' | 'content_filter' | 'error';
    raw?: unknown;
}

/**
 * Provider health and usage metrics
 */
export interface ProviderMetrics {
    totalCalls: number;
    totalTokens: number;
    totalCostUSD: number;
    avgLatencyMs: number;
    errorCount: number;
    lastCallAt: Date | null;
}

/**
 * Cost configuration per 1M tokens
 */
export interface CostConfig {
    inputPer1M: number;
    outputPer1M: number;
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
    maxCostUSD: number;           // Hard stop at this cost
    maxTokensPerRun: number;      // Token limit per run
    maxRequestsPerMinute: number; // Rate limit
    maxConsecutiveErrors: number; // Trip breaker after N errors
    cooldownMs: number;           // Wait time after trip
}

/**
 * Circuit breaker state
 */
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * Core LLM provider interface
 */
export interface ILLMProvider {
    readonly name: ProviderName;
    readonly model: ModelIdentifier;
    
    /**
     * Execute a completion request
     */
    complete(request: LLMRequest): Promise<LLMResponse>;
    
    /**
     * Get current usage metrics
     */
    getMetrics(): ProviderMetrics;
    
    /**
     * Check if provider is available (circuit breaker)
     */
    isAvailable(): boolean;
    
    /**
     * Reset metrics and state
     */
    reset(): void;
}

/**
 * Configuration for the generic HTTP target provider (`http-target` model).
 *
 * Lets B10-B14 attack a real app/agent HTTP endpoint instead of the
 * `sim-001` stub. Fully generic — no APEX-OmniHub-specific behavior lives
 * here; a specific target's shape is described entirely by
 * `bodyTemplate`/`responsePath`, supplied by the operator via env/CLI.
 */
export interface HttpTargetConfig {
    /** Full URL of the target endpoint. Must appear in allowlistHosts. */
    endpoint: string;
    /** HTTP method. Default: POST. */
    method?: string;
    /** Request Content-Type header. Default: application/json. */
    contentType?: string;
    /**
     * JSON body template. Supports `{{prompt}}`, `{{systemPrompt}}`, and
     * `{{uuid}}` placeholders, substituted as JSON-escaped string content.
     */
    bodyTemplate: string;
    /**
     * Dot-path into the parsed JSON response used as the target's reply
     * (e.g. `data.reply`). Falls back to the raw (bounded) response body
     * when the path is absent or not found.
     */
    responsePath?: string;
    /** Name of the env var holding the bearer token to send as `Authorization: Bearer <value>`. */
    authHeaderEnv?: string;
    /** Request timeout in milliseconds. Default: 30000. */
    timeoutMs?: number;
    /**
     * Explicit hostname allowlist. Required and non-empty — this is the
     * default-deny gate: no host is reachable unless listed here verbatim.
     */
    allowlistHosts: string[];
    /** Max requests per minute against this target. Default: 10. */
    maxRPM?: number;
    /** Max characters kept from the target's response body. Default: 20000. */
    maxResponseChars?: number;
}

/**
 * Provider factory options
 */
export interface ProviderOptions {
    apiKey?: string;
    model: ModelIdentifier;
    costConfig?: CostConfig;
    circuitBreaker?: Partial<CircuitBreakerConfig>;
    baseUrl?: string;
    /** Only read when model === 'http-target' (provider 'http'). */
    httpTarget?: HttpTargetConfig;
}

/**
 * 3-LLM adversarial architecture roles
 */
export type AdversarialRole = 'attacker' | 'target' | 'judge';

/**
 * Adversarial test configuration
 */
export interface AdversarialConfig {
    attacker: ILLMProvider;  // Red team - generates attacks
    target: ILLMProvider;    // System under test
    judge: ILLMProvider;     // Blue team - evaluates success
}
