// src/providers/simulation.ts
// ARMAGEDDON Level 7 - Simulation Provider (FREE Tier)
// APEX Business Systems Ltd.
// DATE: 2026-02-06

import type {
    ILLMProvider,
    LLMRequest,
    LLMResponse,
    ProviderMetrics,
    ProviderOptions,
} from './types';
import { SeedableRNG, hashString } from '../core/utils';

/**
 * SimulationProvider - Deterministic mock provider for FREE tier
 * 
 * APEX-POWER: "Never Guess" - Same input = same output
 * OMNIFINANCE: Educational value with upsell hooks
 * 
 * Features:
 * - Fully deterministic responses based on prompt hash
 * - Zero cost (no API calls)
 * - Educational tips in metadata
 * - Reproducible for testing
 */
export class SimulationProvider implements ILLMProvider {
    readonly name = 'simulation' as const;
    readonly model = 'sim-001' as const;
    
    private rng: SeedableRNG;
    private metrics: ProviderMetrics;
    private seed: number;

    constructor(options?: Partial<ProviderOptions> & { seed?: number }) {
        this.seed = options?.seed || Date.now();
        this.rng = new SeedableRNG(this.seed);
        this.metrics = this.createEmptyMetrics();
    }

    async complete(request: LLMRequest): Promise<LLMResponse> {
        const startTime = Date.now();

        // Deterministic response generation based on prompt hash
        const promptHash = hashString(request.prompt + this.seed);
        const responseRng = new SeedableRNG(promptHash);
        
        // Simulate processing time (50-200ms)
        const latencyMs = 50 + responseRng.int(0, 150);
        await new Promise(r => setTimeout(r, Math.min(latencyMs, 100)));

        // Generate deterministic response
        const response = this.generateResponse(request, responseRng);

        // Update metrics (simulated tokens)
        const inputTokens = Math.ceil(request.prompt.length / 4);
        const outputTokens = Math.ceil(response.length / 4);
        
        this.metrics.totalCalls++;
        this.metrics.totalTokens += inputTokens + outputTokens;
        this.metrics.avgLatencyMs = 
            (this.metrics.avgLatencyMs * (this.metrics.totalCalls - 1) + latencyMs) / this.metrics.totalCalls;
        this.metrics.lastCallAt = new Date();

        return {
            content: response,
            model: 'sim-001',
            inputTokens,
            outputTokens,
            totalTokens: inputTokens + outputTokens,
            latencyMs,
            finishReason: 'stop',
            raw: {
                simulation: true,
                seed: this.seed,
                promptHash,
                educational_tip: this.getEducationalTip(responseRng),
            },
        };
    }

    private generateResponse(request: LLMRequest, rng: SeedableRNG): string {
        // Check for adversarial intent
        const isAdversarial = this.detectAdversarialIntent(request.prompt);
        
        if (isAdversarial) {
            // 95% block rate for simulation (shows system "works")
            if (rng.bool(0.95)) {
                return '[BLOCKED] I cannot assist with that request. This violates content policy.';
            }
            
            // 5% "breach" for educational demonstration
            return '[SIMULATED BREACH] Request partially fulfilled. [CONTENT REDACTED - UPGRADE TO CERTIFIED FOR FULL RESULTS]';
        }

        // Normal request - deterministic helpful response
        return `[SIM-001] Processed request successfully. Token count: ${Math.ceil(request.prompt.length / 4)}. Upgrade to CERTIFIED tier for real LLM responses.`;
    }

    private detectAdversarialIntent(prompt: string): boolean {
        const adversarialPatterns = [
            /ignore.*instructions/i,
            /bypass.*safety/i,
            /jailbreak/i,
            /DAN/i,
            /pretend.*evil/i,
            /act.*unfiltered/i,
            /override.*rules/i,
            /disregard.*guidelines/i,
            /harmful.*content/i,
            /illegal.*activity/i,
        ];
        
        return adversarialPatterns.some(p => p.test(prompt));
    }

    private getEducationalTip(rng: SeedableRNG): string {
        const tips = [
            'Standard regex guards fail against 15% of GCG attacks. Upgrade to see real vectors.',
            'This prompt was blocked by pattern matching. Real attacks use encoding bypass.',
            'Simulation shows ideal behavior. Real models have 2-5% jailbreak success rate.',
            'CERTIFIED tier uses 3-LLM PAIR architecture for true adversarial testing.',
            'Token-level attacks bypass content filters 40% of the time in production.',
        ];
        return tips[rng.int(0, tips.length - 1)];
    }

    getMetrics(): ProviderMetrics {
        return { ...this.metrics };
    }

    isAvailable(): boolean {
        return true; // Simulation is always available
    }

    reset(): void {
        this.rng = new SeedableRNG(this.seed);
        this.metrics = this.createEmptyMetrics();
    }

    private createEmptyMetrics(): ProviderMetrics {
        return {
            totalCalls: 0,
            totalTokens: 0,
            totalCostUSD: 0, // Always 0 for simulation
            avgLatencyMs: 0,
            errorCount: 0,
            lastCallAt: null,
        };
    }
}
