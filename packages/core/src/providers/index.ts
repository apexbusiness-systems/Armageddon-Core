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
    HttpTargetConfig,
} from './types';
import { OpenAIProvider } from './openai';
import { AnthropicProvider } from './anthropic';
import { SimulationProvider } from './simulation';
import { GroqProvider } from './groq';
import { HttpTargetProvider } from './http-target';
import { CircuitBreakerRegistry } from './circuit-breaker';

// Re-export types
export * from './types';
export { CircuitBreaker, CircuitBreakerRegistry } from './circuit-breaker';
export { OpenAIProvider } from './openai';
export { AnthropicProvider } from './anthropic';
export { SimulationProvider } from './simulation';
export { GroqProvider } from './groq';
export { OpenAICompatibleProvider } from './openai-compatible-provider';
export {
    HttpTargetProvider,
    createHttpTargetConfigFromEnv,
    buildHttpTargetConfig,
    interpolateBodyTemplate,
    extractResponseByPath,
    isHostAllowlisted,
    isNonProductionLikeHost,
} from './http-target';
export type { RawHttpTargetInput, BodyTemplateVars } from './http-target';

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
    // Generic HTTP target — a real app/agent endpoint, not a named model
    'http-target': 'http',
};

/**
 * True for any real, named model identifier usable as a CERTIFIED target
 * (excludes the 'sim-001' stub and the 'http-target' sentinel, which are
 * selected via --target-provider simulation|http, not --target-model).
 */
export function isKnownTargetModel(value: string): value is Exclude<ModelIdentifier, 'sim-001' | 'http-target'> {
    return value in MODEL_PROVIDER_MAP && value !== 'sim-001' && value !== 'http-target';
}

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
        case 'http':
            return new HttpTargetProvider(options);
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
        /** Required when targetModel === 'http-target'. */
        httpTarget?: HttpTargetConfig;
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

    if (targetModel === 'http-target' && !options?.httpTarget) {
        throw new Error(
            "[Providers] targetModel 'http-target' requires options.httpTarget. Refusing to silently fall back to simulation."
        );
    }

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
            httpTarget: options?.httpTarget,
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
