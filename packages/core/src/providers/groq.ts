// src/providers/groq.ts
// ARMAGEDDON Level 7 - Groq Provider Adapter
// APEX Business Systems Ltd.
// DATE: 2026-06-26

import type { CostConfig, LLMRequest, GroqModel, ProviderOptions } from './types';
import { BaseProvider, type ProviderExecutionResult } from './base-provider';
import { assertJsonResponse, mapStopFinishReason } from './provider-utils';

/**
 * Groq pricing per 1M tokens (as of 2026)
 */
const GROQ_COSTS: Record<GroqModel, CostConfig> = {
    'llama-3.3-70b-versatile': { inputPer1M: 0.59, outputPer1M: 0.79 },
    'llama-3.1-8b-instant': { inputPer1M: 0.05, outputPer1M: 0.08 },
    'openai/gpt-oss-120b': { inputPer1M: 0.15, outputPer1M: 0.60 },
    'openai/gpt-oss-20b': { inputPer1M: 0.075, outputPer1M: 0.30 },
    // Legacy models (deprecated)
    'llama3-70b-8192': { inputPer1M: 0.70, outputPer1M: 0.90 },
    'mixtral-8x7b-32768': { inputPer1M: 0.10, outputPer1M: 0.10 },
};

/**
 * Groq API response structure
 */
interface GroqCompletion {
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
 * Groq Provider - Real LLM integration for adversarial testing
 *
 * Features:
 * - Circuit breaker protected (via BaseProvider)
 * - Cost tracking per request
 * - Retry with exponential backoff
 * - Full metrics collection
 */
export class GroqProvider extends BaseProvider {
    readonly name = 'groq' as const;
    readonly model: GroqModel;

    constructor(options: ProviderOptions) {
        const model = options.model as GroqModel;
        const costConfig = options.costConfig || GROQ_COSTS[model];

        super(options, 'https://api.groq.com/openai/v1', 'GROQ_API_KEY', costConfig);
        this.model = model;
    }

    protected async executeRequest(request: LLMRequest): Promise<ProviderExecutionResult> {
        const response = await this.makeAPIRequest(request);

        return {
            usage: {
                inputTokens: response.usage.prompt_tokens,
                outputTokens: response.usage.completion_tokens,
                totalTokens: response.usage.total_tokens,
            },
            content: response.choices[0]?.message?.content || '',
            finishReason: mapStopFinishReason(response.choices[0]?.finish_reason),
            raw: response,
        };
    }

    private async makeAPIRequest(request: LLMRequest): Promise<GroqCompletion> {
        const messages = [];

        if (request.systemPrompt) {
            messages.push({ role: 'system', content: request.systemPrompt });
        }
        messages.push({ role: 'user', content: request.prompt });

        const body = {
            model: this.model,
            messages,
            max_completion_tokens: request.maxTokens || 1024,
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

        return assertJsonResponse<GroqCompletion>(response, 'Groq');
    }
}
