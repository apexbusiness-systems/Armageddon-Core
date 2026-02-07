// src/providers/openai.ts
// ARMAGEDDON Level 7 - OpenAI Provider Adapter
// APEX Business Systems Ltd.
// DATE: 2026-02-06
// REFACTORED: Extends BaseProvider to eliminate code duplication (SonarQube)

import type {
    LLMRequest,
    LLMResponse,
    OpenAIModel,
    ProviderOptions,
    CostConfig,
} from './types';
import { BaseProvider, type TokenUsage } from './base-provider';

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
 * - Circuit breaker protected (via BaseProvider)
 * - Cost tracking per request
 * - Retry with exponential backoff
 * - Full metrics collection
 */
export class OpenAIProvider extends BaseProvider {
    readonly name = 'openai' as const;
    readonly model: OpenAIModel;

    constructor(options: ProviderOptions) {
        const model = options.model as OpenAIModel;
        const costConfig = options.costConfig || OPENAI_COSTS[model];

        super(options, 'https://api.openai.com/v1', 'OPENAI_API_KEY', costConfig);
        this.model = model;
    }

    protected async executeRequest(request: LLMRequest): Promise<{
        usage: TokenUsage;
        content: string;
        finishReason: LLMResponse['finishReason'];
        raw: unknown;
    }> {
        const response = await this.makeAPIRequest(request);

        return {
            usage: {
                inputTokens: response.usage.prompt_tokens,
                outputTokens: response.usage.completion_tokens,
                totalTokens: response.usage.total_tokens,
            },
            content: response.choices[0]?.message?.content || '',
            finishReason: this.mapFinishReason(response.choices[0]?.finish_reason),
            raw: response,
        };
    }

    private async makeAPIRequest(request: LLMRequest): Promise<OpenAICompletion> {
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
}
