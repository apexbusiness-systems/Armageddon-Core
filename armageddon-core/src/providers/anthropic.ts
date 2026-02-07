// src/providers/anthropic.ts
// ARMAGEDDON Level 7 - Anthropic Provider Adapter
// APEX Business Systems Ltd.
// DATE: 2026-02-06
// REFACTORED: Extends BaseProvider to eliminate code duplication (SonarQube)

import type {
    LLMRequest,
    LLMResponse,
    AnthropicModel,
    ProviderOptions,
    CostConfig,
} from './types';
import { BaseProvider, type TokenUsage } from './base-provider';

/**
 * Anthropic pricing per 1M tokens (as of 2026)
 */
const ANTHROPIC_COSTS: Record<AnthropicModel, CostConfig> = {
    'claude-3-opus-20240229': { inputPer1M: 15, outputPer1M: 75 },
    'claude-3-sonnet-20240229': { inputPer1M: 3, outputPer1M: 15 },
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
 * - Circuit breaker protected (via BaseProvider)
 * - Cost tracking per request
 * - Messages API v1 support
 * - Full metrics collection
 */
export class AnthropicProvider extends BaseProvider {
    readonly name = 'anthropic' as const;
    readonly model: AnthropicModel;

    constructor(options: ProviderOptions) {
        const model = options.model as AnthropicModel;
        const costConfig = options.costConfig || ANTHROPIC_COSTS[model];

        super(options, 'https://api.anthropic.com/v1', 'ANTHROPIC_API_KEY', costConfig);
        this.model = model;
    }

    protected async executeRequest(request: LLMRequest): Promise<{
        usage: TokenUsage;
        content: string;
        finishReason: LLMResponse['finishReason'];
        raw: unknown;
    }> {
        const response = await this.makeAPIRequest(request);

        const content = response.content
            .filter(c => c.type === 'text')
            .map(c => c.text)
            .join('');

        return {
            usage: {
                inputTokens: response.usage.input_tokens,
                outputTokens: response.usage.output_tokens,
                totalTokens: response.usage.input_tokens + response.usage.output_tokens,
            },
            content,
            finishReason: this.mapStopReason(response.stop_reason),
            raw: response,
        };
    }

    private async makeAPIRequest(request: LLMRequest): Promise<AnthropicMessage> {
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
}
