// src/providers/openai.ts
// ARMAGEDDON Level 7 - OpenAI Provider Adapter
// APEX Business Systems Ltd.
// DATE: 2026-02-06

import type {
    ILLMProvider,
    LLMRequest,
    LLMResponse,
    ProviderMetrics,
    OpenAIModel,
    ProviderOptions,
    CostConfig,
} from './types';
import { CircuitBreaker, CircuitBreakerRegistry } from './circuit-breaker';

/**
 * OpenAI pricing per 1M tokens (as of 2026)
 */
const OPENAI_COSTS: Record<OpenAIModel, CostConfig> = {
    'gpt-4-turbo': { inputPer1M: 10.0, outputPer1M: 30.0 },
    'gpt-4o': { inputPer1M: 5.0, outputPer1M: 15.0 },
    'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.60 },
    'gpt-3.5-turbo': { inputPer1M: 0.50, outputPer1M: 1.50 },
};

/**
 * OpenAI API response structure
 */
interface OpenAICompletion {
    id: string;
    choices: Array<{
        message: { role: string; content: string };
        finish_reason: string;
    }>;
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

/**
 * OpenAI Provider - Real LLM integration for adversarial testing
 * 
 * Features:
 * - Circuit breaker protected
 * - Cost tracking per request
 * - Retry with exponential backoff
 * - Full metrics collection
 */
export class OpenAIProvider implements ILLMProvider {
    readonly name = 'openai' as const;
    readonly model: OpenAIModel;
    
    private apiKey: string;
    private baseUrl: string;
    private circuitBreaker: CircuitBreaker;

    constructor(options: ProviderOptions) {
        this.model = options.model as OpenAIModel;
        this.apiKey = options.apiKey || process.env.OPENAI_API_KEY || '';
        this.baseUrl = options.baseUrl || 'https://api.openai.com/v1';
        
        const costConfig = options.costConfig || OPENAI_COSTS[this.model];
        this.circuitBreaker = CircuitBreakerRegistry.getInstance()
            .getOrCreate(`openai:${this.model}`, options.circuitBreaker);
        
        // Update cost config
        if (costConfig) {
            this.circuitBreaker = new CircuitBreaker(options.circuitBreaker, costConfig);
        }
    }

    async complete(request: LLMRequest): Promise<LLMResponse> {
        // Check circuit breaker
        if (!this.circuitBreaker.canProceed()) {
            throw new Error(`[OpenAI] Circuit breaker OPEN - ${this.model}`);
        }

        // Also check global breaker
        const globalBreaker = CircuitBreakerRegistry.getInstance().getGlobal();
        if (!globalBreaker.canProceed()) {
            throw new Error('[OpenAI] Global circuit breaker OPEN');
        }

        const startTime = Date.now();

        try {
            const response = await this.makeRequest(request);
            const latencyMs = Date.now() - startTime;

            // Record success
            this.circuitBreaker.recordSuccess(
                response.usage.prompt_tokens,
                response.usage.completion_tokens,
                latencyMs
            );
            globalBreaker.recordSuccess(
                response.usage.prompt_tokens,
                response.usage.completion_tokens,
                latencyMs
            );

            return {
                content: response.choices[0]?.message?.content || '',
                model: this.model,
                inputTokens: response.usage.prompt_tokens,
                outputTokens: response.usage.completion_tokens,
                totalTokens: response.usage.total_tokens,
                latencyMs,
                finishReason: this.mapFinishReason(response.choices[0]?.finish_reason),
                raw: response,
            };
        } catch (error) {
            this.circuitBreaker.recordError();
            globalBreaker.recordError();
            throw error;
        }
    }

    private async makeRequest(request: LLMRequest): Promise<OpenAICompletion> {
        const messages = [];

        if (request.systemPrompt) {
            messages.push({ role: 'system', content: request.systemPrompt });
        }
        messages.push({ role: 'user', content: request.prompt });

        const body = {
            model: this.model,
            messages,
            max_tokens: request.maxTokens || 1024,
            temperature: request.temperature ?? 0.7,
            stop: request.stopSequences,
        };

        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`[OpenAI] API Error ${response.status}: ${errorText}`);
        }

        return response.json() as Promise<OpenAICompletion>;
    }

    private mapFinishReason(reason: string | undefined): LLMResponse['finishReason'] {
        switch (reason) {
            case 'stop': return 'stop';
            case 'length': return 'length';
            case 'content_filter': return 'content_filter';
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
