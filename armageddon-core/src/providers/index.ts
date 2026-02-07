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
} from './types';
import { OpenAIProvider } from './openai';
import { AnthropicProvider } from './anthropic';
import { SimulationProvider } from './simulation';
import { CircuitBreakerRegistry } from './circuit-breaker';

// Re-export types
export * from './types';
export { CircuitBreaker, CircuitBreakerRegistry } from './circuit-breaker';
export { OpenAIProvider } from './openai';
export { AnthropicProvider } from './anthropic';
export { SimulationProvider } from './simulation';

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
    'claude-3-opus-20240229': 'anthropic',
    'claude-3-sonnet-20240229': 'anthropic',
    'claude-3-haiku-20240307': 'anthropic',
    // Together
    'meta-llama/Llama-3-70b-chat-hf': 'together',
    'mistralai/Mixtral-8x7B-Instruct-v0.1': 'together',
    // Groq
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
        case 'simulation':
            return new SimulationProvider(options);
        case 'together':
        case 'groq':
            // @see https://github.com/apexbusiness-systems/Armageddon-Core/issues/42
            // Together and Groq providers planned for v2.0 release
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
        };
    }
): AdversarialConfig {
    const attackerModel = options?.attackerModel || 'gpt-4o-mini';
    const judgeModel = options?.judgeModel || 'claude-3-haiku-20240307';

    return {
        attacker: createProvider({
            model: attackerModel,
            apiKey: options?.apiKeys?.openai,
            circuitBreaker: { maxCostUSD: 5 }, // $5 limit for attacker
        }),
        target: createProvider({
            model: targetModel,
            apiKey: MODEL_PROVIDER_MAP[targetModel] === 'openai' 
                ? options?.apiKeys?.openai 
                : options?.apiKeys?.anthropic,
            circuitBreaker: { maxCostUSD: 3 }, // $3 limit for target
        }),
        judge: createProvider({
            model: judgeModel,
            apiKey: options?.apiKeys?.anthropic,
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
import { hashString } from '../core/utils';

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
