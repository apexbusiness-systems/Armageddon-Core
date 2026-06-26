// src/providers/openai-compatible-provider.ts
// ARMAGEDDON Level 7 - OpenAI Compatible Provider Base
// APEX Business Systems Ltd.
// DATE: 2026-06-26

import type { LLMRequest } from './types';
import { BaseProvider, type ProviderExecutionResult } from './base-provider';
import { assertJsonResponse, mapStopFinishReason } from './provider-utils';

export interface OpenAICompatibleResponse {
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

export abstract class OpenAICompatibleProvider extends BaseProvider {
    abstract readonly label: string;

    /**
     * Build the messages array from the LLM request.
     * Shared by all OpenAI-compatible providers.
     */
    protected buildMessages(request: LLMRequest): Array<{ role: string; content: string }> {
        const messages: Array<{ role: string; content: string }> = [];
        if (request.systemPrompt) {
            messages.push({ role: 'system', content: request.systemPrompt });
        }
        messages.push({ role: 'user', content: request.prompt });
        return messages;
    }

    protected abstract getRequestBody(request: LLMRequest): Record<string, unknown>;

    protected async executeRequest(request: LLMRequest): Promise<ProviderExecutionResult> {
        const body = this.getRequestBody(request);

        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify(body),
        });

        const data = await assertJsonResponse<OpenAICompatibleResponse>(response, this.label);

        return {
            usage: {
                inputTokens: data.usage.prompt_tokens,
                outputTokens: data.usage.completion_tokens,
                totalTokens: data.usage.total_tokens,
            },
            content: data.choices[0]?.message?.content || '',
            finishReason: mapStopFinishReason(data.choices[0]?.finish_reason),
            raw: data,
        };
    }
}
