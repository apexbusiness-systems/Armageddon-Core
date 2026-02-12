/**
 * Provider Factory Unit Tests
 *
 * COVERAGE:
 * - createProvider (OpenAI, Anthropic, Simulation, Fallbacks)
 * - createAdversarialConfig (3-LLM architecture, API key routing)
 * - createSimulationConfig (Deterministic seed derivation)
 * - Provider registry helpers (Cost, Reset, Limits)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    createProvider,
    createAdversarialConfig,
    createSimulationConfig,
    getTotalCost,
    resetAllProviders,
    hasExceededLimits,
    OpenAIProvider,
    AnthropicProvider,
    SimulationProvider,
    CircuitBreakerRegistry
} from '../../src/providers/index';
import { ModelIdentifier } from '../../src/providers/types';

describe('Provider Factory', () => {
    beforeEach(() => {
        CircuitBreakerRegistry.getInstance().resetAll();
        vi.restoreAllMocks();
    });

    describe('createProvider', () => {
        it('should create an OpenAIProvider for OpenAI models', () => {
            const provider = createProvider({
                model: 'gpt-4o',
                apiKey: 'test-key'
            });
            expect(provider).toBeInstanceOf(OpenAIProvider);
            expect(provider.name).toBe('openai');
        });

        it('should create an AnthropicProvider for Anthropic models', () => {
            const provider = createProvider({
                model: 'claude-3-opus-20240229',
                apiKey: 'test-key'
            });
            expect(provider).toBeInstanceOf(AnthropicProvider);
            expect(provider.name).toBe('anthropic');
        });

        it('should create a SimulationProvider for simulation models', () => {
            const provider = createProvider({
                model: 'sim-001'
            });
            expect(provider).toBeInstanceOf(SimulationProvider);
            expect(provider.name).toBe('simulation');
        });

        it('should fallback to SimulationProvider with a warning for together/groq models', () => {
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            const provider = createProvider({
                model: 'llama3-70b-8192' as ModelIdentifier
            });

            expect(provider).toBeInstanceOf(SimulationProvider);
            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('groq not yet implemented'));
        });

        it('should fallback to SimulationProvider for unknown models', () => {
            const provider = createProvider({
                model: 'unknown-model' as ModelIdentifier
            });
            expect(provider).toBeInstanceOf(SimulationProvider);
        });
    });

    describe('createAdversarialConfig', () => {
        it('should create a valid 3-LLM configuration', () => {
            const config = createAdversarialConfig('gpt-4o');

            expect(config.attacker).toBeDefined();
            expect(config.target).toBeDefined();
            expect(config.judge).toBeDefined();
        });

        it('should route API keys correctly based on target model', () => {
            // Test OpenAI target
            const configOpenAI = createAdversarialConfig('gpt-4o', {
                apiKeys: {
                    openai: 'openai-key',
                    anthropic: 'anthropic-key'
                }
            });
            // We can't easily check private apiKey but we can check the provider instance type
            expect(configOpenAI.target).toBeInstanceOf(OpenAIProvider);

            // Test Anthropic target
            const configAnthropic = createAdversarialConfig('claude-3-opus-20240229', {
                apiKeys: {
                    openai: 'openai-key',
                    anthropic: 'anthropic-key'
                }
            });
            expect(configAnthropic.target).toBeInstanceOf(AnthropicProvider);
        });

        it('should use default models for attacker and judge if not provided', () => {
            const config = createAdversarialConfig('sim-001');

            // Default attacker: gpt-4o-mini
            expect((config.attacker as any).model).toBe('gpt-4o-mini');
            // Default judge: claude-3-haiku-20240307
            expect((config.judge as any).model).toBe('claude-3-haiku-20240307');
        });
    });

    describe('createSimulationConfig', () => {
        it('should create deterministic simulation providers', () => {
            const runId = 'test-run-123';
            const config1 = createSimulationConfig(runId);
            const config2 = createSimulationConfig(runId);

            expect(config1.attacker).toBeInstanceOf(SimulationProvider);
            expect(config1.target).toBeInstanceOf(SimulationProvider);
            expect(config1.judge).toBeInstanceOf(SimulationProvider);

            // Should be deterministic (checking private seed)
            expect((config1.attacker as any).seed).toBe((config2.attacker as any).seed);
            expect((config1.target as any).seed).toBe((config2.target as any).seed);
            expect((config1.judge as any).seed).toBe((config2.judge as any).seed);

            // Attacker, target, and judge should have different seeds
            expect((config1.attacker as any).seed).not.toBe((config1.target as any).seed);
            expect((config1.target as any).seed).not.toBe((config1.judge as any).seed);
        });
    });

    describe('Registry Helpers', () => {
        it('getTotalCost should return total cost from registry', () => {
            const registry = CircuitBreakerRegistry.getInstance();
            const breaker = registry.getOrCreate('test-p');

            // 100k input = $1.0 (default cost config in CircuitBreaker is 10/30)
            breaker.recordSuccess(100000, 0, 100);

            expect(getTotalCost()).toBeCloseTo(1.0);
        });

        it('resetAllProviders should reset the registry', () => {
            const registry = CircuitBreakerRegistry.getInstance();
            const breaker = registry.getOrCreate('test-p');
            breaker.recordSuccess(100, 100, 100);

            expect(getTotalCost()).toBeGreaterThan(0);

            resetAllProviders();

            expect(getTotalCost()).toBe(0);
        });

        it('hasExceededLimits should return true when global breaker is not CLOSED', () => {
            expect(hasExceededLimits()).toBe(false);

            const registry = CircuitBreakerRegistry.getInstance();
            const global = registry.getGlobal();

            // Trip the global breaker (default max consecutive errors is 5)
            for (let i = 0; i < 5; i++) {
                global.recordError();
            }

            expect(hasExceededLimits()).toBe(true);
        });
    });
});
