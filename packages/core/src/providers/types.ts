// src/providers/types.ts
// ARMAGEDDON Level 7 - LLM Provider Abstraction Layer
// APEX Business Systems Ltd.
// DATE: 2026-02-06

/**
 * Supported LLM providers for adversarial testing
 */
export type ProviderName = 'openai' | 'anthropic' | 'together' | 'groq' | 'simulation';

/**
 * Model identifiers grouped by provider
 */
export type OpenAIModel = 'gpt-4-turbo' | 'gpt-4o' | 'gpt-4o-mini' | 'gpt-3.5-turbo';
export type AnthropicModel = 'claude-3-opus-20240229' | 'claude-3-sonnet-20240229' | 'claude-3-haiku-20240307';
export type TogetherModel = 'meta-llama/Llama-3-70b-chat-hf' | 'mistralai/Mixtral-8x7B-Instruct-v0.1';
export type GroqModel = 'llama3-70b-8192' | 'mixtral-8x7b-32768';

export type ModelIdentifier = OpenAIModel | AnthropicModel | TogetherModel | GroqModel | 'sim-001';

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
 * Provider factory options
 */
export interface ProviderOptions {
    apiKey?: string;
    model: ModelIdentifier;
    costConfig?: CostConfig;
    circuitBreaker?: Partial<CircuitBreakerConfig>;
    baseUrl?: string;
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
