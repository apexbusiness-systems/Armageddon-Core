/**
 * BaseProvider Unit Tests
 *
 * COVERAGE:
 * - Initialization and configuration (API Key, Base URL)
 * - Circuit Breaker integration (Local & Global)
 * - Success/Error handling flows
 * - Metrics recording
 * - Availability checks
 * - Provider name derivation
 */

import { describe, it, expect, beforeEach, vi, afterEach, MockInstance } from 'vitest';
import { BaseProvider, TokenUsage } from '../../src/providers/base-provider';
import { CircuitBreakerRegistry, CircuitBreaker } from '../../src/providers/circuit-breaker';
import { LLMRequest, LLMResponse, ProviderOptions, ProviderName, ModelIdentifier } from '../../src/providers/types';

// Concrete implementation of BaseProvider for testing
class TestProvider extends BaseProvider {
    readonly name: ProviderName = 'openai'; // simulating openai for registry key generation
    readonly model: ModelIdentifier = 'gpt-4o';

    // Expose protected members for testing
    public get testApiKey(): string { return this.apiKey; }
    public get testBaseUrl(): string { return this.baseUrl; }
    public get testCircuitBreaker(): CircuitBreaker { return this.circuitBreaker; }

    public testRecordSuccess(usage: TokenUsage, latencyMs: number): void {
        this.recordSuccess(usage, latencyMs);
    }

    public async executeRequest(request: LLMRequest): Promise<{
        usage: TokenUsage;
        content: string;
        finishReason: LLMResponse['finishReason'];
        raw: unknown;
    }> {
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
    let localBreaker: CircuitBreaker;
    let globalBreaker: CircuitBreaker;

    let localCanProceedSpy: MockInstance;
    let localRecordSuccessSpy: MockInstance;
    let localRecordErrorSpy: MockInstance;

    let globalCanProceedSpy: MockInstance;
    let globalRecordSuccessSpy: MockInstance;
    let globalRecordErrorSpy: MockInstance;

    const defaultOptions: ProviderOptions = {
        apiKey: 'test-api-key',
        baseUrl: 'https://api.test.com',
        model: 'gpt-4o',
        circuitBreaker: {
            maxCostUSD: 10,
        }
    };

    beforeEach(() => {
        vi.restoreAllMocks();
        CircuitBreakerRegistry.getInstance().resetAll();

        const registry = CircuitBreakerRegistry.getInstance();
        vi.spyOn(registry, 'getOrCreate');
        vi.spyOn(registry, 'getGlobal');

        provider = new TestProvider(defaultOptions, 'https://default.url', 'TEST_ENV_KEY');

        localBreaker = provider.testCircuitBreaker;
        globalBreaker = registry.getGlobal();

        localCanProceedSpy = vi.spyOn(localBreaker, 'canProceed');
        localRecordSuccessSpy = vi.spyOn(localBreaker, 'recordSuccess');
        localRecordErrorSpy = vi.spyOn(localBreaker, 'recordError');

        globalCanProceedSpy = vi.spyOn(globalBreaker, 'canProceed');
        globalRecordSuccessSpy = vi.spyOn(globalBreaker, 'recordSuccess');
        globalRecordErrorSpy = vi.spyOn(globalBreaker, 'recordError');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Initialization', () => {
        it('should initialize with provided options', () => {
            expect(provider.testApiKey).toBe('test-api-key');
            expect(provider.testBaseUrl).toBe('https://api.test.com');
        });

        it('should use environment variable if apiKey is missing', () => {
            process.env.TEST_ENV_KEY = 'env-api-key';
            const p = new TestProvider({ ...defaultOptions, apiKey: undefined }, 'https://default.url', 'TEST_ENV_KEY');
            expect(p.testApiKey).toBe('env-api-key');
            delete process.env.TEST_ENV_KEY;
        });

        it('should use default base URL if provided URL is missing', () => {
            const p = new TestProvider({ ...defaultOptions, baseUrl: undefined }, 'https://default.url', 'TEST_ENV_KEY');
            expect(p.testBaseUrl).toBe('https://default.url');
        });

        it('should register with CircuitBreakerRegistry using derived name and model', () => {
            const registry = CircuitBreakerRegistry.getInstance();
            // TestProvider -> test
            expect(registry.getOrCreate).toHaveBeenCalledWith('test:gpt-4o', defaultOptions.circuitBreaker);
        });

        it('should correctly derive provider name from class name', () => {
            class CustomAnthropicProvider extends BaseProvider {
                readonly name: ProviderName = 'anthropic';
                readonly model: ModelIdentifier = 'claude-3-opus-20240229';
                protected async executeRequest() {
                    return {
                        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
                        content: '',
                        finishReason: 'stop' as const,
                        raw: {}
                    };
                }
            }

            const registry = CircuitBreakerRegistry.getInstance();
            const spy = vi.spyOn(registry, 'getOrCreate');
            const p = new CustomAnthropicProvider({ model: 'claude-3-opus-20240229' }, 'url', 'KEY');

            // CustomAnthropicProvider -> customanthropic
            expect(spy).toHaveBeenCalledWith('customanthropic:claude-3-opus-20240229', undefined);
            expect(p.name).toBe('anthropic');
        });

        it('should create a new CircuitBreaker if costConfig is provided', () => {
            const costConfig = { inputPer1M: 1, outputPer1M: 2 };
            const p = new TestProvider(
                defaultOptions,
                'https://default.url',
                'TEST_ENV_KEY',
                costConfig
            );

            expect(p.testCircuitBreaker).toBeInstanceOf(CircuitBreaker);

            // Verify it uses the provided costConfig
            // We can check this by recording a success and seeing the cost update
            const usage = { inputTokens: 1_000_000, outputTokens: 1_000_000, totalTokens: 2_000_000 };
            p.testRecordSuccess(usage, 100);

            const metrics = p.getMetrics();
            // input 1, output 2 -> total 3
            expect(metrics.totalCostUSD).toBe(3);
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

            expect(localCanProceedSpy).toHaveBeenCalled();
            expect(globalCanProceedSpy).toHaveBeenCalled();
            expect(spyExecute).toHaveBeenCalledWith(validRequest);

            expect(localRecordSuccessSpy).toHaveBeenCalledWith(10, 20, expect.any(Number));
            expect(globalRecordSuccessSpy).toHaveBeenCalledWith(10, 20, expect.any(Number));

            expect(response.content).toBe('test response');
            expect(response.totalTokens).toBe(30);
            expect(response.latencyMs).toBeGreaterThanOrEqual(0);
        });

        it('should throw and record error when execution fails', async () => {
            const error = new Error('API Error');
            vi.spyOn(provider, 'executeRequest').mockRejectedValue(error);

            await expect(provider.complete(validRequest)).rejects.toThrow('API Error');

            expect(localRecordErrorSpy).toHaveBeenCalled();
            expect(globalRecordErrorSpy).toHaveBeenCalled();
        });

        it('should throw if local circuit breaker is OPEN', async () => {
            localCanProceedSpy.mockReturnValue(false);

            await expect(provider.complete(validRequest)).rejects.toThrow(/Circuit breaker OPEN/);

            const spyExecute = vi.spyOn(provider, 'executeRequest');
            expect(spyExecute).not.toHaveBeenCalled();
        });

        it('should throw if global circuit breaker is OPEN', async () => {
            localCanProceedSpy.mockReturnValue(true);
            globalCanProceedSpy.mockReturnValue(false);

            await expect(provider.complete(validRequest)).rejects.toThrow(/Global circuit breaker OPEN/);

            const spyExecute = vi.spyOn(provider, 'executeRequest');
            expect(spyExecute).not.toHaveBeenCalled();
        });
    });

    describe('Metrics and State', () => {
        it('should delegate getMetrics to circuit breaker', () => {
            const spy = vi.spyOn(localBreaker, 'getMetrics');
            provider.getMetrics();
            expect(spy).toHaveBeenCalled();
        });

        it('should delegate reset to circuit breaker', () => {
            const spy = vi.spyOn(localBreaker, 'reset');
            provider.reset();
            expect(spy).toHaveBeenCalled();
        });

        it('should determine availability correctly', () => {
            // Case 1: Available
            localCanProceedSpy.mockReturnValue(true);
            globalCanProceedSpy.mockReturnValue(true);
            expect(provider.isAvailable()).toBe(true);

            // Case 2: Local Circuit Open
            localCanProceedSpy.mockReturnValue(false);
            expect(provider.isAvailable()).toBe(false);

            // Case 3: Global Circuit Open
            localCanProceedSpy.mockReturnValue(true);
            globalCanProceedSpy.mockReturnValue(false);
            expect(provider.isAvailable()).toBe(false);

            // Case 4: No API Key
            const pNoKey = new TestProvider({ ...defaultOptions, apiKey: '' }, 'url', 'KEY');
            const breaker = pNoKey.testCircuitBreaker;
            vi.spyOn(breaker, 'canProceed').mockReturnValue(true);
            // Global breaker still mocked from beforeEach to return false if we don't fix it
            globalCanProceedSpy.mockReturnValue(true);

            expect(pNoKey.isAvailable()).toBe(false);
        });
    });
});
