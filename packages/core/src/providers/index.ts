// src/providers/index.ts
// ARMAGEDDON Level 7 - Provider Factory and Exports
// APEX Business Systems Ltd.
// DATE: 2026-02-06

import type {
    ILLMProvider,
    ProviderName,
    ProviderOptions,
    ModelIdentifier,
    AdversarialConfig,
} from './types.js';
import { OpenAIProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';
import { SimulationProvider } from './simulation.js';
import { GroqProvider } from './groq.js';
import { CircuitBreakerRegistry } from './circuit-breaker.js';

// Re-export types
export * from './types.js';
export { CircuitBreaker, CircuitBreakerRegistry } from './circuit-breaker.js';
export { OpenAIProvider } from './openai.js';
export { AnthropicProvider } from './anthropic.js';
export { SimulationProvider } from './simulation.js';
export { GroqProvider } from './groq.js';
export { OpenAICompatibleProvider } from './openai-compatible-provider.js';

/**
 * Model to provider mapping
 */
const MODEL_PROVIDER_MAP: Record<ModelIdentifier, ProviderName> = {
    // OpenAI
    'gpt-4-turbo': 'openai',
    'gpt-4o': 'openai',
    'gpt-4o-mini': 'openai',
    'gpt-3.5-turbo': 'openai',
    // Anthropic
    'claude-opus-4-6': 'anthropic',
    'claude-sonnet-4-6': 'anthropic',
    'claude-haiku-4-5': 'anthropic',
    'claude-3-opus-20240229': 'anthropic',
    'claude-3-sonnet-20240229': 'anthropic',
    'claude-3-haiku-20240307': 'anthropic',
    // Together
    'meta-llama/Llama-3-70b-chat-hf': 'together',
    'mistralai/Mixtral-8x7B-Instruct-v0.1': 'together',
    // Groq
    'llama-3.1-8b-instant': 'groq',
    'llama-3.3-70b-versatile': 'groq',
    'openai/gpt-oss-120b': 'groq',
    'openai/gpt-oss-20b': 'groq',
    'llama3-70b-8192': 'groq',
    'mixtral-8x7b-32768': 'groq',
    // Simulation
    'sim-001': 'simulation',
};

/**
 * Create a provider instance for the given model
 */
export function createProvider(options: ProviderOptions): ILLMProvider {
    const providerName = MODEL_PROVIDER_MAP[options.model] || 'simulation';

    switch (providerName) {
        case 'openai':
            return new OpenAIProvider(options);
        case 'anthropic':
            return new AnthropicProvider(options);
        case 'groq':
            return new GroqProvider(options);
        case 'simulation':
            return new SimulationProvider(options);
        case 'together':
            // @see https://github.com/apexbusiness-systems/Armageddon-Core/issues/42
            // Together provider planned for v2.0 release
            console.warn(`[Providers] ${providerName} not yet implemented, falling back to simulation`);
            return new SimulationProvider(options);
        default:
            return new SimulationProvider(options);
    }
}

/**
 * Create the 3-LLM adversarial configuration
 * 
 * Architecture:
 * - Attacker (Red Team): Generates adversarial prompts
 * - Target (System Under Test): The LLM being tested
 * - Judge (Blue Team): Evaluates if the attack succeeded
 */
export function createAdversarialConfig(
    targetModel: ModelIdentifier,
    options?: {
        attackerModel?: ModelIdentifier;
        judgeModel?: ModelIdentifier;
        apiKeys?: {
            openai?: string;
            anthropic?: string;
            groq?: string;
        };
    }
): AdversarialConfig {
    const attackerModel = options?.attackerModel || 'gpt-4o-mini';
    const judgeModel = options?.judgeModel || 'claude-3-haiku-20240307';

    const getApiKey = (provider: ProviderName) => {
        if (provider === 'openai') return options?.apiKeys?.openai;
        if (provider === 'anthropic') return options?.apiKeys?.anthropic;
        if (provider === 'groq') return options?.apiKeys?.groq;
        return undefined;
    };

    return {
        attacker: createProvider({
            model: attackerModel,
            apiKey: getApiKey(MODEL_PROVIDER_MAP[attackerModel]),
            circuitBreaker: { maxCostUSD: 5 }, // $5 limit for attacker
        }),
        target: createProvider({
            model: targetModel,
            apiKey: getApiKey(MODEL_PROVIDER_MAP[targetModel]),
            circuitBreaker: { maxCostUSD: 3 }, // $3 limit for target
        }),
        judge: createProvider({
            model: judgeModel,
            apiKey: getApiKey(MODEL_PROVIDER_MAP[judgeModel]),
            circuitBreaker: { maxCostUSD: 2 }, // $2 limit for judge
        }),
    };
}

/**
 * Create simulation-only adversarial config for FREE tier
 */
export function createSimulationConfig(runId: string): AdversarialConfig {
    const seed = hashString(runId);
    
    return {
        attacker: new SimulationProvider({ seed: seed + 1 }),
        target: new SimulationProvider({ seed: seed + 2 }),
        judge: new SimulationProvider({ seed: seed + 3 }),
    };
}

/**
 * Get total cost across all providers
 */
export function getTotalCost(): number {
    return CircuitBreakerRegistry.getInstance().getTotalCost();
}

/**
 * Reset all provider states
 */
export function resetAllProviders(): void {
    CircuitBreakerRegistry.getInstance().resetAll();
}

/**
 * Check if any provider has exceeded limits
 */
export function hasExceededLimits(): boolean {
    const global = CircuitBreakerRegistry.getInstance().getGlobal();
    return global.getState() !== 'CLOSED';
}

// Import hashString for seed generation
import { hashString } from '../core/utils.js';

/**
 * Default configurations for common use cases
 */
export const CONFIGS = {
    // FREE tier: Full simulation
    FREE: {
        create: (runId: string) => createSimulationConfig(runId),
    },
    
    // CERTIFIED tier: Real LLM testing
    CERTIFIED: {
        ADVERSARIAL_LIGHT: {
            attacker: 'gpt-4o-mini' as ModelIdentifier,
            target: 'gpt-4o-mini' as ModelIdentifier,
            judge: 'claude-3-haiku-20240307' as ModelIdentifier,
        },
        ADVERSARIAL_STANDARD: {
            attacker: 'gpt-4o' as ModelIdentifier,
            target: 'gpt-4-turbo' as ModelIdentifier,
            judge: 'claude-3-sonnet-20240229' as ModelIdentifier,
        },
        ADVERSARIAL_MAXIMUM: {
            attacker: 'claude-3-opus-20240229' as ModelIdentifier,
            target: 'gpt-4-turbo' as ModelIdentifier,
            judge: 'claude-3-opus-20240229' as ModelIdentifier,
        },
    },
} as const;
