// src/providers/base-provider.ts
// ARMAGEDDON Level 7 - Base Provider Class (Deduplication)
// APEX Business Systems Ltd.
// DATE: 2026-02-06
//
// Extracted common logic from OpenAI/Anthropic providers to eliminate
// SonarQube code duplication (S1192, S4144).

import type {
    ILLMProvider,
    LLMRequest,
    LLMResponse,
    ProviderMetrics,
    ProviderOptions,
    ProviderName,
    ModelIdentifier,
    CostConfig,
} from './types';
import { CircuitBreaker, CircuitBreakerRegistry } from './circuit-breaker';

/**
 * API response with token usage - common interface for normalization
 */
export interface TokenUsage {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
}

/**
 * BaseProvider - Abstract base class for LLM providers
 *
 * Provides common functionality:
 * - Circuit breaker management
 * - Metrics collection
 * - Error handling pattern
 * - Availability checks
 */
export abstract class BaseProvider implements ILLMProvider {
    abstract readonly name: ProviderName;
    abstract readonly model: ModelIdentifier;

    protected apiKey: string;
    protected baseUrl: string;
    protected circuitBreaker: CircuitBreaker;

    constructor(
        options: ProviderOptions,
        defaultBaseUrl: string,
        envKeyName: string,
        costConfig?: CostConfig
    ) {
        this.apiKey = options.apiKey || process.env[envKeyName] || '';
        this.baseUrl = options.baseUrl || defaultBaseUrl;

        const providerName = this.constructor.name.toLowerCase().replace('provider', '');
        this.circuitBreaker = CircuitBreakerRegistry.getInstance()
            .getOrCreate(`${providerName}:${options.model}`, options.circuitBreaker);

        if (costConfig) {
            this.circuitBreaker = new CircuitBreaker(options.circuitBreaker, costConfig);
        }
    }

    /**
     * Execute a completion request with circuit breaker protection
     */
    async complete(request: LLMRequest): Promise<LLMResponse> {
        this.checkCircuitBreakers();

        const startTime = Date.now();

        try {
            const response = await this.executeRequest(request);
            const latencyMs = Date.now() - startTime;

            this.recordSuccess(response.usage, latencyMs);

            return this.normalizeResponse(response, latencyMs);
        } catch (error) {
            this.recordError();
            throw error;
        }
    }

    /**
     * Check both local and global circuit breakers
     * @throws Error if any breaker is open
     */
    protected checkCircuitBreakers(): void {
        if (!this.circuitBreaker.canProceed()) {
            throw new Error(`[${this.name}] Circuit breaker OPEN - ${this.model}`);
        }

        const globalBreaker = CircuitBreakerRegistry.getInstance().getGlobal();
        if (!globalBreaker.canProceed()) {
            throw new Error(`[${this.name}] Global circuit breaker OPEN`);
        }
    }

    /**
     * Record successful request to circuit breakers
     */
    protected recordSuccess(usage: TokenUsage, latencyMs: number): void {
        this.circuitBreaker.recordSuccess(usage.inputTokens, usage.outputTokens, latencyMs);
        CircuitBreakerRegistry.getInstance()
            .getGlobal()
            .recordSuccess(usage.inputTokens, usage.outputTokens, latencyMs);
    }

    /**
     * Record error to circuit breakers
     */
    protected recordError(): void {
        this.circuitBreaker.recordError();
        CircuitBreakerRegistry.getInstance().getGlobal().recordError();
    }

    /**
     * Execute the provider-specific API request
     * Must be implemented by subclasses
     */
    protected abstract executeRequest(request: LLMRequest): Promise<{
        usage: TokenUsage;
        content: string;
        finishReason: LLMResponse['finishReason'];
        raw: unknown;
    }>;

    /**
     * Normalize response to common LLMResponse format
     */
    protected normalizeResponse(
        response: {
            usage: TokenUsage;
            content: string;
            finishReason: LLMResponse['finishReason'];
            raw: unknown;
        },
        latencyMs: number
    ): LLMResponse {
        return {
            content: response.content,
            model: String(this.model),
            inputTokens: response.usage.inputTokens,
            outputTokens: response.usage.outputTokens,
            totalTokens: response.usage.totalTokens,
            latencyMs,
            finishReason: response.finishReason,
            raw: response.raw,
        };
    }

    /**
     * Get current usage metrics
     */
    getMetrics(): ProviderMetrics {
        return this.circuitBreaker.getMetrics();
    }

    /**
     * Check if provider is available
     */
    isAvailable(): boolean {
        return this.circuitBreaker.canProceed() && !!this.apiKey;
    }

    /**
     * Reset provider state
     */
    reset(): void {
        this.circuitBreaker.reset();
    }
}
