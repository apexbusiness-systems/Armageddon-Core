
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BatteryConfig } from '../../src/temporal/activities';

// Mock process.env BEFORE imports to ensure SafetyGuard initializes correctly if not mocked
const originalEnv = process.env;

// Mock safety module to allow dynamic singleton access
vi.mock('../../src/core/safety', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/core/safety')>();
  return {
    ...actual,
    safetyGuard: {
      enforce: (context: string) => {
        // Forward to the current singleton instance to respect resets
        actual.SafetyGuard.getInstance().enforce(context);
      },
    },
  };
});

// Mock the reporter to avoid Supabase calls
vi.mock('../../src/core/reporter', () => ({
  createReporter: () => ({
    pushEvent: vi.fn().mockResolvedValue(undefined),
    pushEvents: vi.fn().mockResolvedValue(undefined),
    upsertProgress: vi.fn().mockResolvedValue(undefined),
  }),
}));

// Import AFTER mocks
import * as activities from '../../src/temporal/activities';
import { SafetyGuard } from '../../src/core/safety';

describe('Core Batteries Logic', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv, SIM_MODE: 'true', SANDBOX_TENANT: 'test-tenant' };
    // Reset SafetyGuard state so it picks up the new env
    SafetyGuard.resetForTesting();
    SafetyGuard.getInstance(); // Re-init
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  const baseConfig: BatteryConfig = {
    runId: 'test-run-id',
    iterations: 10,
    tier: 'FREE',
    seed: 42,
    targetEndpoint: 'http://localhost:3000',
  };

  it('Battery 1 (Chaos Stress) runs and returns result', async () => {
    // Mock runStressTest to avoid actual stress testing
    vi.mock('../../src/core/stress', () => ({
      runStressTest: vi.fn().mockResolvedValue({
        failedRequests: 0,
        successfulRequests: 10,
        totalRequests: 10,
        duration: 100,
        rps: { mean: 10 },
        latency: { p99: 10 },
        errors: [],
        mode: 'SIMULATED_SMOKE',
      }),
    }));

    const result = await activities.runBattery1_ChaosStress(baseConfig);
    expect(result.status).toBe('PASSED');
    expect(result.batteryId).toBe('B1_CHAOS_STRESS');
  });

  it('Battery 2 (Chaos Engine) is deterministic with seed 42', async () => {
    const result1 = await activities.runBattery2_ChaosEngine(baseConfig);
    const result2 = await activities.runBattery2_ChaosEngine(baseConfig);

    expect(result1.status).toBe('PASSED'); // Expect pass with seed 42
    expect(result1).toEqual(result2); // Determinism check
  });

  it('Battery 3 (Prompt Injection) fails for FREE tier (upsell strategy)', async () => {
    const config = { ...baseConfig, tier: 'FREE' as const };
    const result = await activities.runBattery3_PromptInjection(config);

    // OMNIFINANCE: Free tier MUST show vulnerability (FAILED) to motivate upgrade
    expect(result.status).toBe('FAILED');
    expect(result.breachCount).toBeGreaterThan(0);
    // TypeScript may not infer the dynamic structure of details correctly without casting or specific checks
    expect((result.details as any).educational_value).toBe('HIGH');
  });

  it('Battery 3 (Prompt Injection) passes for CERTIFIED tier', async () => {
    const config = { ...baseConfig, tier: 'CERTIFIED' as const };
    const result = await activities.runBattery3_PromptInjection(config);

    // CERTIFIED: 100% Protection
    expect(result.status).toBe('PASSED');
    expect(result.breachCount).toBe(0);
  });

  it('Battery 3 (Prompt Injection) is deterministic', async () => {
    const config = { ...baseConfig, tier: 'FREE' as const };
    const result1 = await activities.runBattery3_PromptInjection(config);
    const result2 = await activities.runBattery3_PromptInjection(config);

    expect(result1.status).toBe('FAILED');
    // Duration can vary slightly between runs, so we compare critical properties
    expect(result1.blockedCount).toBe(result2.blockedCount);
    expect(result1.breachCount).toBe(result2.breachCount);
    expect(result1.details).toEqual(result2.details);
  });

  it('Battery 4 (Security Auth) is deterministic', async () => {
    const result1 = await activities.runBattery4_SecurityAuth(baseConfig);
    const result2 = await activities.runBattery4_SecurityAuth(baseConfig);

    expect(result1.status).toBe('PASSED');
    expect(result1).toEqual(result2);
  });

  it('Battery 8 (Asset Smoke) handles missing target gracefully', async () => {
    const config = { ...baseConfig, targetEndpoint: undefined };
    const result = await activities.runBattery8_AssetSmoke(config);
    expect(result.status).toBe('PASSED'); // Simulation mode
  });

  it('Battery 6 (Unsafe Gate) fails correctly when unsafe', async () => {
    // This test actually sabotages the environment inside the function itself
    // We just verify it returns passed=true (meaning the gate worked)
    const result = await activities.runBattery6_UnsafeGate(baseConfig);
    expect(result.status).toBe('PASSED'); // Passed means it successfully blocked the unsafe run
    expect(result.details.gateEnforced).toBe(true);
  });

  it('Battery 10 (Goal Hijack) runs and returns result', async () => {
    const result = await activities.runBattery10_GoalHijack(baseConfig);
    expect(result.batteryId).toBe('B10_GOAL_HIJACK');
    expect(result.status).toBeDefined();
  });
});
