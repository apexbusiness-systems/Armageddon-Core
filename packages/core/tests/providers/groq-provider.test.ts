import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GroqProvider } from '../../src/providers/groq';
import { CircuitBreakerRegistry } from '../../src/providers/circuit-breaker';
import { LLMRequest } from '../../src/providers/types';

describe('GroqProvider', () => {
    const mockApiKey = 'gsk-test-api-key-12345';
    const defaultOptions = {
        apiKey: mockApiKey,
        model: 'llama-3.3-70b-versatile' as const,
    };

    beforeEach(() => {
        vi.restoreAllMocks();
        CircuitBreakerRegistry.getInstance().resetAll();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Initialization', () => {
        it('should initialize with provided apiKey and model', () => {
            const provider = new GroqProvider(defaultOptions);
            expect(provider.name).toBe('groq');
            expect(provider.model).toBe('llama-3.3-70b-versatile');
            expect((provider as any).apiKey).toBe(mockApiKey);
            expect((provider as any).baseUrl).toBe('https://api.groq.com/openai/v1');
        });

        it('should fall back to process.env.GROQ_API_KEY', () => {
            process.env.GROQ_API_KEY = 'env-groq-key';
            const provider = new GroqProvider({ model: 'llama-3.1-8b-instant' });
            expect((provider as any).apiKey).toBe('env-groq-key');
            delete process.env.GROQ_API_KEY;
        });

        it('should use custom baseUrl if provided', () => {
            const provider = new GroqProvider({
                ...defaultOptions,
                baseUrl: 'https://custom.groq.proxy',
            });
            expect((provider as any).baseUrl).toBe('https://custom.groq.proxy');
        });
    });

    describe('executeRequest (complete)', () => {
        const mockSuccessResponse = {
            id: 'chatcmpl-123',
            object: 'chat.completion',
            created: 1677858889,
            model: 'llama-3.3-70b-versatile',
            choices: [
                {
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: 'This is a mock response from Groq.',
                    },
                    finish_reason: 'stop',
                },
            ],
            usage: {
                prompt_tokens: 15,
                completion_tokens: 20,
                total_tokens: 35,
            },
        };

        it('should execute a chat completions request and format body correctly', async () => {
            const mockFetch = vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => mockSuccessResponse,
            } as Response);
            vi.stubGlobal('fetch', mockFetch);

            const provider = new GroqProvider(defaultOptions);
            const request: LLMRequest = {
                prompt: 'Hello Groq!',
                systemPrompt: 'You are a helpful assistant.',
                maxTokens: 150,
                temperature: 0.5,
                stopSequences: ['\n'],
            };

            const response = await provider.complete(request);

            // Verify fetch target and method
            expect(mockFetch).toHaveBeenCalledTimes(1);
            const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
            expect(init.method).toBe('POST');

            // Verify headers
            const headers = init.headers as Record<string, string>;
            expect(headers['Content-Type']).toBe('application/json');
            expect(headers['Authorization']).toBe(`Bearer ${mockApiKey}`);

            // Verify body properties
            const body = JSON.parse(init.body as string);
            expect(body.model).toBe('llama-3.3-70b-versatile');
            expect(body.messages).toEqual([
                { role: 'system', content: 'You are a helpful assistant.' },
                { role: 'user', content: 'Hello Groq!' },
            ]);
            expect(body.max_completion_tokens).toBe(150);
            expect(body.max_tokens).toBeUndefined(); // Verify max_tokens is NOT sent to Groq
            expect(body.temperature).toBe(0.5);
            expect(body.stop).toEqual(['\n']);

            // Verify normalized response
            expect(response.content).toBe('This is a mock response from Groq.');
            expect(response.model).toBe('llama-3.3-70b-versatile');
            expect(response.inputTokens).toBe(15);
            expect(response.outputTokens).toBe(20);
            expect(response.totalTokens).toBe(35);
            expect(response.finishReason).toBe('stop');
            expect(response.raw).toEqual(mockSuccessResponse);
        });

        it('should propagate API errors correctly', async () => {
            const mockFetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 400,
                text: async () => 'Bad Request: invalid_model',
            } as Response);
            vi.stubGlobal('fetch', mockFetch);

            const provider = new GroqProvider(defaultOptions);
            const request: LLMRequest = {
                prompt: 'Hello Groq!',
            };

            await expect(provider.complete(request)).rejects.toThrow(
                '[Groq] API Error 400: Bad Request: invalid_model'
            );
        });
    });
});
