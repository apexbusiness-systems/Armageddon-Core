// src/providers/openai.ts
// ARMAGEDDON Level 7 - OpenAI Provider Adapter
// APEX Business Systems Ltd.
// DATE: 2026-02-06
// REFACTORED: Extends OpenAICompatibleProvider to eliminate code duplication (SonarQube)

import type { CostConfig, LLMRequest, OpenAIModel, ProviderOptions } from './types.js';
import { OpenAICompatibleProvider } from './openai-compatible-provider.js';

/**
 * OpenAI pricing per 1M tokens (as of 2026)
 */
const OPENAI_COSTS: Record<OpenAIModel, CostConfig> = {
    'gpt-4-turbo': { inputPer1M: 10, outputPer1M: 30 },
    'gpt-4o': { inputPer1M: 5, outputPer1M: 15 },
    'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.6 },
    'gpt-3.5-turbo': { inputPer1M: 0.5, outputPer1M: 1.5 },
};

/**
 * OpenAI Provider - Real LLM integration for adversarial testing
 *
 * Features:
 * - Circuit breaker protected (via BaseProvider)
 * - Cost tracking per request
 * - Retry with exponential backoff
 * - Full metrics collection
 */
export class OpenAIProvider extends OpenAICompatibleProvider {
    readonly name = 'openai' as const;
    readonly model: OpenAIModel;
    readonly label = 'OpenAI';

    constructor(options: ProviderOptions) {
        const model = options.model as OpenAIModel;
        const costConfig = options.costConfig || OPENAI_COSTS[model];

        super(options, 'https://api.openai.com/v1', 'OPENAI_API_KEY', costConfig);
        this.model = model;
    }

    protected getRequestBody(request: LLMRequest): Record<string, unknown> {
        return {
            model: this.model,
            messages: this.buildMessages(request),
            max_tokens: request.maxTokens || 1024,
            temperature: request.temperature ?? 0.7,
            stop: request.stopSequences,
        };
    }
}
