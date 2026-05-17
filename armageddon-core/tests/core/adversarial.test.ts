// tests/core/adversarial.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdversarialEngine, createAdversarialEngine } from '../../src/core/adversarial';

describe('AdversarialEngine (simulation mode — FREE tier)', () => {
  const baseConfig = {
    tier: 'FREE' as const,
    runId: 'test-run-adversarial-001',
    maxIterations: 2, // keep fast
    maxCostUSD: 1.0,
  };

  // ── Construction ──────────────────────────────────────────────────────────
  it('creates engine via constructor without throwing', () => {
    expect(() => new AdversarialEngine(baseConfig)).not.toThrow();
  });

  it('creates engine via factory function without throwing', () => {
    expect(() => createAdversarialEngine(baseConfig)).not.toThrow();
  });

  it('createAdversarialEngine returns an AdversarialEngine instance', () => {
    const engine = createAdversarialEngine(baseConfig);
    expect(engine).toBeInstanceOf(AdversarialEngine);
  });

  // ── isAvailable ───────────────────────────────────────────────────────────
  it('isAvailable() returns true on a fresh engine', () => {
    const engine = createAdversarialEngine(baseConfig);
    expect(engine.isAvailable()).toBe(true);
  });

  // ── getMetrics ────────────────────────────────────────────────────────────
  it('getMetrics() returns zero cost on a fresh engine', () => {
    const engine = createAdversarialEngine(baseConfig);
    const metrics = engine.getMetrics();
    expect(metrics.totalCost).toBe(0);
    expect(metrics.totalTokens).toBe(0);
  });

  // ── reset ─────────────────────────────────────────────────────────────────
  it('reset() restores isAvailable and zeroes metrics', () => {
    const engine = createAdversarialEngine(baseConfig);
    engine.reset();
    expect(engine.isAvailable()).toBe(true);
    const metrics = engine.getMetrics();
    expect(metrics.totalCost).toBe(0);
    expect(metrics.totalTokens).toBe(0);
  });

  // ── runPAIRAttack — result shape ──────────────────────────────────────────
  it('runPAIRAttack returns a valid result structure', async () => {
    const engine = createAdversarialEngine(baseConfig);
    const result = await engine.runPAIRAttack('test goal: generate safe content');

    expect(result).toMatchObject({
      goal: 'test goal: generate safe content',
      totalIterations: expect.any(Number),
      successfulAttacks: expect.any(Number),
      highestScore: expect.any(Number),
      avgScore: expect.any(Number),
      attacks: expect.any(Array),
      totalTokens: expect.any(Number),
      totalCostUSD: expect.any(Number),
    });
  }, 30_000);

  it('runPAIRAttack goal field matches the provided goal string', async () => {
    const engine = createAdversarialEngine(baseConfig);
    const goal = 'unique-goal-string-abc123';
    const result = await engine.runPAIRAttack(goal);
    expect(result.goal).toBe(goal);
  }, 30_000);

  // ── runPAIRAttack — score ranges ──────────────────────────────────────────
  it('runPAIRAttack avgScore is between 0 and 1 inclusive', async () => {
    const engine = createAdversarialEngine(baseConfig);
    const result = await engine.runPAIRAttack('test');
    expect(result.avgScore).toBeGreaterThanOrEqual(0);
    expect(result.avgScore).toBeLessThanOrEqual(1);
  }, 30_000);

  it('runPAIRAttack highestScore is between 0 and 1 inclusive', async () => {
    const engine = createAdversarialEngine(baseConfig);
    const result = await engine.runPAIRAttack('test');
    expect(result.highestScore).toBeGreaterThanOrEqual(0);
    expect(result.highestScore).toBeLessThanOrEqual(1);
  }, 30_000);

  // ── runPAIRAttack — iteration bounds ──────────────────────────────────────
  it('runPAIRAttack totalIterations does not exceed maxIterations', async () => {
    const engine = createAdversarialEngine({ ...baseConfig, maxIterations: 2 });
    const result = await engine.runPAIRAttack('boundary test');
    expect(result.totalIterations).toBeGreaterThanOrEqual(0);
    expect(result.totalIterations).toBeLessThanOrEqual(2);
  }, 30_000);

  it('runPAIRAttack attacks array length equals totalIterations', async () => {
    const engine = createAdversarialEngine(baseConfig);
    const result = await engine.runPAIRAttack('count check');
    expect(result.attacks).toHaveLength(result.totalIterations);
  }, 30_000);

  // ── runPAIRAttack — attack result shape ───────────────────────────────────
  it('each attack in attacks array has valid shape', async () => {
    const engine = createAdversarialEngine(baseConfig);
    const result = await engine.runPAIRAttack('shape check');

    for (const attack of result.attacks) {
      expect(attack).toMatchObject({
        success: expect.any(Boolean),
        iteration: expect.any(Number),
        attackPrompt: expect.any(String),
        targetResponse: expect.any(String),
        judgmentScore: expect.any(Number),
        judgmentReason: expect.any(String),
        tokens: {
          attacker: expect.any(Number),
          target: expect.any(Number),
          judge: expect.any(Number),
        },
        latency: {
          attacker: expect.any(Number),
          target: expect.any(Number),
          judge: expect.any(Number),
        },
      });
      expect(attack.judgmentScore).toBeGreaterThanOrEqual(0);
      expect(attack.judgmentScore).toBeLessThanOrEqual(1);
    }
  }, 30_000);

  // ── runPAIRAttack — successfulAttacks count ───────────────────────────────
  it('successfulAttacks equals attacks with score >= 0.5', async () => {
    const engine = createAdversarialEngine(baseConfig);
    const result = await engine.runPAIRAttack('count successful');
    const expected = result.attacks.filter(a => a.judgmentScore >= 0.5).length;
    expect(result.successfulAttacks).toBe(expected);
  }, 30_000);

  // ── runPAIRAttack — cost/token accounting ─────────────────────────────────
  it('totalCostUSD is non-negative', async () => {
    const engine = createAdversarialEngine(baseConfig);
    const result = await engine.runPAIRAttack('cost check');
    expect(result.totalCostUSD).toBeGreaterThanOrEqual(0);
  }, 30_000);

  it('totalTokens is non-negative', async () => {
    const engine = createAdversarialEngine(baseConfig);
    const result = await engine.runPAIRAttack('token check');
    expect(result.totalTokens).toBeGreaterThanOrEqual(0);
  }, 30_000);

  // ── highestScore consistency ──────────────────────────────────────────────
  it('highestScore >= avgScore when attacks are present', async () => {
    const engine = createAdversarialEngine(baseConfig);
    const result = await engine.runPAIRAttack('score relationship');
    if (result.totalIterations > 0) {
      expect(result.highestScore).toBeGreaterThanOrEqual(result.avgScore);
    }
  }, 30_000);

  // ── empty goal edge case ─────────────────────────────────────────────────
  it('runPAIRAttack handles empty string goal without throwing', async () => {
    const engine = createAdversarialEngine(baseConfig);
    await expect(engine.runPAIRAttack('')).resolves.toMatchObject({
      goal: '',
      totalIterations: expect.any(Number),
    });
  }, 30_000);
});
