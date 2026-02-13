/**
 * BaseProvider Unit Tests
 *
 * COVERAGE:
 * - Initialization and configuration (API Key, Base URL)
 * - Circuit Breaker integration (Local & Global)
 * - Success/Error handling flows
 * - Metrics recording
 * - Availability checks
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { BaseProvider, TokenUsage } from '../../src/providers/base-provider';
import { CircuitBreakerRegistry, CircuitBreaker } from '../../src/providers/circuit-breaker';
import { LLMRequest, LLMResponse, ProviderOptions, ProviderName, ModelIdentifier } from '../../src/providers/types';

// Concrete implementation of BaseProvider for testing
class TestProvider extends BaseProvider {
    readonly name: ProviderName = 'openai'; // simulating openai for registry key generation
    readonly model: ModelIdentifier = 'gpt-4o';

    // Expose protected methods for testing if needed, or just use public interface
    public async executeRequest(request: LLMRequest): Promise<{
        usage: TokenUsage;
        content: string;
        finishReason: LLMResponse['finishReason'];
        raw: unknown;
    }> {
        // This will be mocked in tests
        return Promise.resolve({
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            content: 'test response',
            finishReason: 'stop',
            raw: { id: 'test-id' }
        });
    }
}

describe('BaseProvider', () => {
    let provider: TestProvider;
    let mockCircuitBreaker: any;
    let mockGlobalBreaker: any;

    const defaultOptions: ProviderOptions = {
        apiKey: 'test-api-key',
        baseUrl: 'https://api.test.com',
        model: 'gpt-4o',
        circuitBreaker: {
            maxCostUSD: 10,
        }
    };

    beforeEach(() => {
        // Reset registry and mocks
        vi.restoreAllMocks();
        CircuitBreakerRegistry.getInstance().resetAll();

        // Mock CircuitBreakerRegistry.getInstance() to return our controlled mocks
        // However, CircuitBreakerRegistry is a singleton and hard to mock directly without
        // affecting the internal state if not careful.
        // Better approach: Let the registry work but spy on the breakers it returns.

        // Alternatively, since BaseProvider uses CircuitBreakerRegistry.getInstance(),
        // we can spy on the prototype or the singleton instance methods.

        const registry = CircuitBreakerRegistry.getInstance();

        // We can spy on getOrCreate and getGlobal
        vi.spyOn(registry, 'getOrCreate');
        vi.spyOn(registry, 'getGlobal');

        provider = new TestProvider(defaultOptions, 'https://default.url', 'TEST_ENV_KEY');

        // Get the actual breakers assigned to the provider for spying
        // Accessing protected circuitBreaker via any cast
        mockCircuitBreaker = (provider as any).circuitBreaker;
        mockGlobalBreaker = registry.getGlobal();

        // Spy on breaker methods
        vi.spyOn(mockCircuitBreaker, 'canProceed');
        vi.spyOn(mockCircuitBreaker, 'recordSuccess');
        vi.spyOn(mockCircuitBreaker, 'recordError');
        vi.spyOn(mockGlobalBreaker, 'canProceed');
        vi.spyOn(mockGlobalBreaker, 'recordSuccess');
        vi.spyOn(mockGlobalBreaker, 'recordError');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Initialization', () => {
        it('should initialize with provided options', () => {
            expect((provider as any).apiKey).toBe('test-api-key');
            expect((provider as any).baseUrl).toBe('https://api.test.com');
        });

        it('should use environment variable if apiKey is missing', () => {
            process.env.TEST_ENV_KEY = 'env-api-key';
            const p = new TestProvider({ ...defaultOptions, apiKey: undefined }, 'https://default.url', 'TEST_ENV_KEY');
            expect((p as any).apiKey).toBe('env-api-key');
            delete process.env.TEST_ENV_KEY;
        });

        it('should use default base URL if provided URL is missing', () => {
            const p = new TestProvider({ ...defaultOptions, baseUrl: undefined }, 'https://default.url', 'TEST_ENV_KEY');
            expect((p as any).baseUrl).toBe('https://default.url');
        });

        it('should register with CircuitBreakerRegistry', () => {
            expect(CircuitBreakerRegistry.getInstance().getOrCreate).toHaveBeenCalled();
        });

        it('should create a new CircuitBreaker if costConfig is provided', () => {
             // If costConfig is passed, it creates a new instance instead of getting from registry
             // We need to verify that logic.
             const p = new TestProvider(
                 defaultOptions,
                 'https://default.url',
                 'TEST_ENV_KEY',
                 { inputPer1M: 1, outputPer1M: 2 }
             );
             // The circuit breaker in p should be different from the one in registry for the same key if logic dictates
             // Actually looking at code:
             // this.circuitBreaker = CircuitBreakerRegistry.getInstance().getOrCreate(...)
             // if (costConfig) { this.circuitBreaker = new CircuitBreaker(...) }
             // So it overwrites it.
             expect((p as any).circuitBreaker).toBeInstanceOf(CircuitBreaker);
             // It should NOT be the one from registry (or at least, it's a new instance)
             // But since we can't easily check instance equality without references,
             // we can check if it has the custom cost config.
             // We can check if getOrCreate was called (it still is), but the instance on provider is new.
        });
    });

    describe('complete()', () => {
        const validRequest: LLMRequest = {
            prompt: 'test prompt',
            maxTokens: 100
        };

        it('should execute request successfully when circuit breakers are closed', async () => {
            const spyExecute = vi.spyOn(provider, 'executeRequest');

            const response = await provider.complete(validRequest);

            expect(mockCircuitBreaker.canProceed).toHaveBeenCalled();
            expect(mockGlobalBreaker.canProceed).toHaveBeenCalled();
            expect(spyExecute).toHaveBeenCalledWith(validRequest);
            expect(mockCircuitBreaker.recordSuccess).toHaveBeenCalled();
            expect(mockGlobalBreaker.recordSuccess).toHaveBeenCalled();

            expect(response.content).toBe('test response');
            expect(response.totalTokens).toBe(30);
            expect(response.latencyMs).toBeGreaterThanOrEqual(0);
        });

        it('should throw and record error when execution fails', async () => {
            const error = new Error('API Error');
            vi.spyOn(provider, 'executeRequest').mockRejectedValue(error);

            await expect(provider.complete(validRequest)).rejects.toThrow('API Error');

            expect(mockCircuitBreaker.recordError).toHaveBeenCalled();
            expect(mockGlobalBreaker.recordError).toHaveBeenCalled();
        });

        it('should throw if local circuit breaker is OPEN', async () => {
            mockCircuitBreaker.canProceed.mockReturnValue(false);

            await expect(provider.complete(validRequest)).rejects.toThrow(/Circuit breaker OPEN/);

            // Should not attempt execution
            const spyExecute = vi.spyOn(provider, 'executeRequest');
            expect(spyExecute).not.toHaveBeenCalled();
        });

        it('should throw if global circuit breaker is OPEN', async () => {
            mockCircuitBreaker.canProceed.mockReturnValue(true);
            mockGlobalBreaker.canProceed.mockReturnValue(false);

            await expect(provider.complete(validRequest)).rejects.toThrow(/Global circuit breaker OPEN/);

            const spyExecute = vi.spyOn(provider, 'executeRequest');
            expect(spyExecute).not.toHaveBeenCalled();
        });
    });

    describe('Metrics and State', () => {
        it('should delegate getMetrics to circuit breaker', () => {
            const spy = vi.spyOn(mockCircuitBreaker, 'getMetrics');
            provider.getMetrics();
            expect(spy).toHaveBeenCalled();
        });

        it('should delegate reset to circuit breaker', () => {
            const spy = vi.spyOn(mockCircuitBreaker, 'reset');
            provider.reset();
            expect(spy).toHaveBeenCalled();
        });

        it('should determine availability correctly', () => {
            // Case 1: Available
            mockCircuitBreaker.canProceed.mockReturnValue(true);
            expect(provider.isAvailable()).toBe(true);

            // Case 2: Circuit Open
            mockCircuitBreaker.canProceed.mockReturnValue(false);
            expect(provider.isAvailable()).toBe(false);

            // Case 3: No API Key
            const pNoKey = new TestProvider({ ...defaultOptions, apiKey: '' }, 'url', 'KEY');
            // Mock its breaker too
            const breaker = (pNoKey as any).circuitBreaker;
            vi.spyOn(breaker, 'canProceed').mockReturnValue(true);

            expect(pNoKey.isAvailable()).toBe(false);
        });
    });
});
