// src/providers/anthropic.ts
// ARMAGEDDON Level 7 - Anthropic Provider Adapter
// APEX Business Systems Ltd.
// DATE: 2026-02-06

import type {
    ILLMProvider,
    LLMRequest,
    LLMResponse,
    ProviderMetrics,
    AnthropicModel,
    ProviderOptions,
    CostConfig,
} from './types';
import { CircuitBreaker, CircuitBreakerRegistry } from './circuit-breaker';

/**
 * Anthropic pricing per 1M tokens (as of 2026)
 */
const ANTHROPIC_COSTS: Record<AnthropicModel, CostConfig> = {
    'claude-3-opus-20240229': { inputPer1M: 15.0, outputPer1M: 75.0 },
    'claude-3-sonnet-20240229': { inputPer1M: 3.0, outputPer1M: 15.0 },
    'claude-3-haiku-20240307': { inputPer1M: 0.25, outputPer1M: 1.25 },
};

/**
 * Anthropic API response structure
 */
interface AnthropicMessage {
    id: string;
    type: 'message';
    role: 'assistant';
    content: Array<{ type: 'text'; text: string }>;
    stop_reason: string | null;
    usage: {
        input_tokens: number;
        output_tokens: number;
    };
}

/**
 * Anthropic Provider - Real LLM integration for adversarial testing
 * 
 * Features:
 * - Circuit breaker protected
 * - Cost tracking per request
 * - Messages API v1 support
 * - Full metrics collection
 */
export class AnthropicProvider implements ILLMProvider {
    readonly name = 'anthropic' as const;
    readonly model: AnthropicModel;
    
    private apiKey: string;
    private baseUrl: string;
    private circuitBreaker: CircuitBreaker;

    constructor(options: ProviderOptions) {
        this.model = options.model as AnthropicModel;
        this.apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY || '';
        this.baseUrl = options.baseUrl || 'https://api.anthropic.com/v1';
        
        const costConfig = options.costConfig || ANTHROPIC_COSTS[this.model];
        this.circuitBreaker = CircuitBreakerRegistry.getInstance()
            .getOrCreate(`anthropic:${this.model}`, options.circuitBreaker);
        
        if (costConfig) {
            this.circuitBreaker = new CircuitBreaker(options.circuitBreaker, costConfig);
        }
    }

    async complete(request: LLMRequest): Promise<LLMResponse> {
        // Check circuit breaker
        if (!this.circuitBreaker.canProceed()) {
            throw new Error(`[Anthropic] Circuit breaker OPEN - ${this.model}`);
        }

        const globalBreaker = CircuitBreakerRegistry.getInstance().getGlobal();
        if (!globalBreaker.canProceed()) {
            throw new Error('[Anthropic] Global circuit breaker OPEN');
        }

        const startTime = Date.now();

        try {
            const response = await this.makeRequest(request);
            const latencyMs = Date.now() - startTime;

            this.circuitBreaker.recordSuccess(
                response.usage.input_tokens,
                response.usage.output_tokens,
                latencyMs
            );
            globalBreaker.recordSuccess(
                response.usage.input_tokens,
                response.usage.output_tokens,
                latencyMs
            );

            const content = response.content
                .filter(c => c.type === 'text')
                .map(c => c.text)
                .join('');

            return {
                content,
                model: this.model,
                inputTokens: response.usage.input_tokens,
                outputTokens: response.usage.output_tokens,
                totalTokens: response.usage.input_tokens + response.usage.output_tokens,
                latencyMs,
                finishReason: this.mapStopReason(response.stop_reason),
                raw: response,
            };
        } catch (error) {
            this.circuitBreaker.recordError();
            globalBreaker.recordError();
            throw error;
        }
    }

    private async makeRequest(request: LLMRequest): Promise<AnthropicMessage> {
        const body = {
            model: this.model,
            max_tokens: request.maxTokens || 1024,
            system: request.systemPrompt,
            messages: [{ role: 'user', content: request.prompt }],
            temperature: request.temperature ?? 0.7,
            stop_sequences: request.stopSequences,
        };

        const response = await fetch(`${this.baseUrl}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`[Anthropic] API Error ${response.status}: ${errorText}`);
        }

        return response.json() as Promise<AnthropicMessage>;
    }

    private mapStopReason(reason: string | null): LLMResponse['finishReason'] {
        switch (reason) {
            case 'end_turn': return 'stop';
            case 'max_tokens': return 'length';
            case 'stop_sequence': return 'stop';
            default: return 'error';
        }
    }

    getMetrics(): ProviderMetrics {
        return this.circuitBreaker.getMetrics();
    }

    isAvailable(): boolean {
        return this.circuitBreaker.canProceed() && !!this.apiKey;
    }

    reset(): void {
        this.circuitBreaker.reset();
    }
}
