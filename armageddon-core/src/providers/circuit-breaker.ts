// src/providers/circuit-breaker.ts
// ARMAGEDDON Level 7 - Circuit Breaker for LLM Cost/Rate Control
// APEX Business Systems Ltd.
// DATE: 2026-02-06

import type { CircuitBreakerConfig, CircuitState, ProviderMetrics, CostConfig } from './types';

/**
 * Default circuit breaker configuration
 * Conservative defaults to prevent runaway costs
 */
export const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
    maxCostUSD: 10,                // $10 hard stop
    maxTokensPerRun: 100_000,      // 100k tokens
    maxRequestsPerMinute: 60,      // 1 RPS sustained
    maxConsecutiveErrors: 5,       // Trip after 5 failures
    cooldownMs: 30_000,            // 30 second cooldown
};

/**
 * Default cost configuration (OpenAI GPT-4 Turbo pricing)
 */
export const DEFAULT_COST_CONFIG: CostConfig = {
    inputPer1M: 10,   // $10 per 1M input tokens
    outputPer1M: 30,  // $30 per 1M output tokens
};

/**
 * CircuitBreaker - Protects against cost overruns and cascading failures
 * 
 * APEX-POWER: "Zero Tolerance" - Hard stops prevent financial damage
 * OMNIFINANCE: Cost tracking enables tier-based monetization
 */
export class CircuitBreaker {
    private state: CircuitState = 'CLOSED';
    private readonly config: CircuitBreakerConfig;
    private readonly costConfig: CostConfig;
    private metrics: ProviderMetrics;
    private requestTimestamps: number[] = [];
    private consecutiveErrors: number = 0;
    private lastTripTime: number = 0;
    private parent?: CircuitBreaker;

    constructor(
        config: Partial<CircuitBreakerConfig> = {},
        costConfig: Partial<CostConfig> = {}
    ) {
        this.config = { ...DEFAULT_CIRCUIT_CONFIG, ...config };
        this.costConfig = { ...DEFAULT_COST_CONFIG, ...costConfig };
        this.metrics = this.createEmptyMetrics();
    }

    setParent(parent: CircuitBreaker): void {
        this.parent = parent;
    }

    /**
     * Check if a request can proceed
     */
    canProceed(): boolean {
        // Check parent circuit state first
        if (this.parent && !this.parent.canProceed()) {
            return false;
        }

        // Check circuit state
        if (this.state === 'OPEN') {
            // Check if cooldown expired
            if (Date.now() - this.lastTripTime > this.config.cooldownMs) {
                this.state = 'HALF_OPEN';
            } else {
                return false;
            }
        }

        // Check cost limit
        if (this.metrics.totalCostUSD >= this.config.maxCostUSD) {
            this.trip('COST_LIMIT');
            return false;
        }

        // Check token limit
        if (this.metrics.totalTokens >= this.config.maxTokensPerRun) {
            this.trip('TOKEN_LIMIT');
            return false;
        }

        // Check rate limit
        const now = Date.now();
        const oneMinuteAgo = now - 60_000;
        this.requestTimestamps = this.requestTimestamps.filter(t => t > oneMinuteAgo);
        
        if (this.requestTimestamps.length >= this.config.maxRequestsPerMinute) {
            return false; // Rate limited but don't trip
        }

        return true;
    }

    /**
     * Record a successful request
     */
    recordSuccess(inputTokens: number, outputTokens: number, latencyMs: number): void {
        const sanitizedLatencyMs = Math.max(0, latencyMs);

        if (this.parent) {
            this.parent.recordSuccess(inputTokens, outputTokens, sanitizedLatencyMs);
        }

        this.requestTimestamps.push(Date.now());
        this.consecutiveErrors = 0;
        
        if (this.state === 'HALF_OPEN') {
            this.state = 'CLOSED';
        }

        // Update metrics
        const cost = this.calculateCost(inputTokens, outputTokens);
        this.metrics.totalCalls++;
        this.metrics.totalTokens += inputTokens + outputTokens;
        this.metrics.totalCostUSD += cost;
        this.metrics.avgLatencyMs = 
            (this.metrics.avgLatencyMs * (this.metrics.totalCalls - 1) + sanitizedLatencyMs) / this.metrics.totalCalls;
        this.metrics.lastCallAt = new Date();
    }

    /**
     * Record a failed request
     */
    recordError(): void {
        if (this.parent) {
            this.parent.recordError();
        }

        this.consecutiveErrors++;
        this.metrics.errorCount++;
        this.metrics.lastCallAt = new Date();

        if (this.consecutiveErrors >= this.config.maxConsecutiveErrors) {
            this.trip('CONSECUTIVE_ERRORS');
        }
    }

    /**
     * Calculate cost for token usage
     */
    calculateCost(inputTokens: number, outputTokens: number): number {
        const inputCost = (inputTokens / 1_000_000) * this.costConfig.inputPer1M;
        const outputCost = (outputTokens / 1_000_000) * this.costConfig.outputPer1M;
        return inputCost + outputCost;
    }

    /**
     * Get current metrics
     */
    getMetrics(): ProviderMetrics {
        return { ...this.metrics };
    }

    /**
     * Get circuit state
     */
    getState(): CircuitState {
        return this.state;
    }

    /**
     * Get remaining budget
     */
    getRemainingBudget(): { costUSD: number; tokens: number } {
        return {
            costUSD: Math.max(0, this.config.maxCostUSD - this.metrics.totalCostUSD),
            tokens: Math.max(0, this.config.maxTokensPerRun - this.metrics.totalTokens),
        };
    }

    /**
     * Reset circuit breaker state
     */
    reset(): void {
        this.state = 'CLOSED';
        this.metrics = this.createEmptyMetrics();
        this.requestTimestamps = [];
        this.consecutiveErrors = 0;
        this.lastTripTime = 0;
    }

    private trip(reason: string): void {
        this.state = 'OPEN';
        this.lastTripTime = Date.now();
        console.warn(`[CircuitBreaker] TRIPPED: ${reason}`, {
            cost: this.metrics.totalCostUSD,
            tokens: this.metrics.totalTokens,
            errors: this.consecutiveErrors,
        });
    }

    private createEmptyMetrics(): ProviderMetrics {
        return {
            totalCalls: 0,
            totalTokens: 0,
            totalCostUSD: 0,
            avgLatencyMs: 0,
            errorCount: 0,
            lastCallAt: null,
        };
    }
}

/**
 * Shared circuit breaker registry for cross-provider limits
 */
export class CircuitBreakerRegistry {
    private static instance: CircuitBreakerRegistry;
    private readonly breakers: Map<string, CircuitBreaker> = new Map();
    private readonly globalBreaker: CircuitBreaker;

    private constructor() {
        this.globalBreaker = new CircuitBreaker({
            maxCostUSD: 50,          // $50 global limit
            maxTokensPerRun: 500_000, // 500k tokens global
        });
    }

    static getInstance(): CircuitBreakerRegistry {
        if (!CircuitBreakerRegistry.instance) {
            CircuitBreakerRegistry.instance = new CircuitBreakerRegistry();
        }
        return CircuitBreakerRegistry.instance;
    }

    getOrCreate(providerId: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
        if (!this.breakers.has(providerId)) {
            const breaker = new CircuitBreaker(config);
            breaker.setParent(this.globalBreaker);
            this.breakers.set(providerId, breaker);
        }
        return this.breakers.get(providerId)!;
    }

    getGlobal(): CircuitBreaker {
        return this.globalBreaker;
    }

    resetAll(): void {
        this.breakers.forEach(b => b.reset());
        this.globalBreaker.reset();
    }

    getTotalCost(): number {
        let total = 0;
        this.breakers.forEach(b => {
            total += b.getMetrics().totalCostUSD;
        });
        return total;
    }
}
