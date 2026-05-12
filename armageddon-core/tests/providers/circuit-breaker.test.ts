// tests/providers/circuit-breaker.test.ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CircuitBreaker, CircuitBreakerRegistry, DEFAULT_CIRCUIT_CONFIG } from '../../src/providers/circuit-breaker';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      maxCostUSD: 1.0,
      maxTokensPerRun: 1000,
      maxRequestsPerMinute: 10,
      maxConsecutiveErrors: 3,
      cooldownMs: 5000,
    });
  });

  // ── 1. CLOSED state, no limits hit ──────────────────────────────────────
  it('allows requests when circuit is CLOSED and within limits', () => {
    expect(breaker.canProceed()).toBe(true);
    expect(breaker.getState()).toBe('CLOSED');
  });

  // ── 2. Cost limit exceeded ───────────────────────────────────────────────
  it('blocks when cost limit is exceeded', () => {
    // inputPer1M = $10, so 1_000_000 input tokens = $10.00 > $1.00 limit
    breaker.recordSuccess(1_000_000, 0, 100);
    expect(breaker.canProceed()).toBe(false);
  });

  // ── 3. Token limit exceeded ──────────────────────────────────────────────
  it('blocks when token limit is exceeded', () => {
    // 1001 input tokens puts totalTokens over the 1000 limit
    breaker.recordSuccess(1001, 0, 50);
    expect(breaker.canProceed()).toBe(false);
  });

  // ── 4. Trip OPEN after maxConsecutiveErrors ──────────────────────────────
  it('trips OPEN after maxConsecutiveErrors', () => {
    breaker.recordError();
    breaker.recordError();
    breaker.recordError();
    expect(breaker.getState()).toBe('OPEN');
    expect(breaker.canProceed()).toBe(false);
  });

  // ── 5. OPEN → HALF_OPEN after cooldown ──────────────────────────────────
  it('transitions OPEN → HALF_OPEN after cooldown', () => {
    const now = Date.now();
    const spy = vi.spyOn(Date, 'now');
    spy.mockReturnValue(now);

    breaker.recordError();
    breaker.recordError();
    breaker.recordError();
    expect(breaker.getState()).toBe('OPEN');

    // Advance past the 5000 ms cooldown
    spy.mockReturnValue(now + 6000);
    expect(breaker.canProceed()).toBe(true);
    expect(breaker.getState()).toBe('HALF_OPEN');

    spy.mockRestore();
  });

  // ── 6. HALF_OPEN → CLOSED on success ────────────────────────────────────
  it('transitions HALF_OPEN → CLOSED on success', () => {
    const now = Date.now();
    const spy = vi.spyOn(Date, 'now');
    spy.mockReturnValue(now);

    breaker.recordError();
    breaker.recordError();
    breaker.recordError();

    spy.mockReturnValue(now + 6000);
    breaker.canProceed(); // triggers HALF_OPEN transition

    breaker.recordSuccess(10, 10, 50);
    expect(breaker.getState()).toBe('CLOSED');

    spy.mockRestore();
  });

  // ── 7. HALF_OPEN still OPEN while cooldown has not elapsed ───────────────
  it('stays OPEN when cooldown has not elapsed', () => {
    const now = Date.now();
    const spy = vi.spyOn(Date, 'now');
    spy.mockReturnValue(now);

    breaker.recordError();
    breaker.recordError();
    breaker.recordError();
    expect(breaker.getState()).toBe('OPEN');

    // Only 1 second has passed — cooldown is 5000 ms
    spy.mockReturnValue(now + 1000);
    expect(breaker.canProceed()).toBe(false);
    expect(breaker.getState()).toBe('OPEN');

    spy.mockRestore();
  });

  // ── 8. getRemainingBudget ────────────────────────────────────────────────
  it('getRemainingBudget returns correct remaining values after partial usage', () => {
    // recordSuccess(100 input, 100 output, 50ms)
    // totalTokens = 200, remaining = 1000 - 200 = 800
    // cost = (100/1_000_000)*10 + (100/1_000_000)*30 = 0.001 + 0.003 = $0.004
    breaker.recordSuccess(100, 100, 50);
    const budget = breaker.getRemainingBudget();
    expect(budget.tokens).toBe(800);
    expect(budget.costUSD).toBeGreaterThan(0);
    expect(budget.costUSD).toBeLessThan(1.0);
    expect(budget.costUSD).toBeCloseTo(0.996, 3);
  });

  it('getRemainingBudget returns full budget on fresh breaker', () => {
    const budget = breaker.getRemainingBudget();
    expect(budget.tokens).toBe(1000);
    expect(budget.costUSD).toBeCloseTo(1.0, 5);
  });

  // ── 9. reset() clears all state ──────────────────────────────────────────
  it('reset clears all state', () => {
    breaker.recordError();
    breaker.recordError();
    breaker.recordError();
    expect(breaker.getState()).toBe('OPEN');

    breaker.reset();

    expect(breaker.getState()).toBe('CLOSED');
    expect(breaker.canProceed()).toBe(true);

    const metrics = breaker.getMetrics();
    expect(metrics.totalCalls).toBe(0);
    expect(metrics.totalCostUSD).toBe(0);
    expect(metrics.errorCount).toBe(0);
    expect(metrics.totalTokens).toBe(0);
  });

  // ── 10. calculateCost ────────────────────────────────────────────────────
  it('calculates cost correctly for input-only tokens', () => {
    // $10/1M input → 500k = $5.00
    expect(breaker.calculateCost(500_000, 0)).toBeCloseTo(5.0, 5);
  });

  it('calculates cost correctly for output-only tokens', () => {
    // $30/1M output → 500k = $15.00
    expect(breaker.calculateCost(0, 500_000)).toBeCloseTo(15.0, 5);
  });

  it('calculates combined cost correctly ($10 input + $30 output per 1M)', () => {
    // 1M input ($10) + 1M output ($30) = $40
    const cost = breaker.calculateCost(1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(40, 2);
  });

  it('calculates zero cost for zero tokens', () => {
    expect(breaker.calculateCost(0, 0)).toBe(0);
  });

  // ── 11. Metrics tracking ─────────────────────────────────────────────────
  it('tracks metrics correctly after a single success', () => {
    breaker.recordSuccess(100, 200, 150);
    const m = breaker.getMetrics();
    expect(m.totalCalls).toBe(1);
    expect(m.totalTokens).toBe(300);
    expect(m.avgLatencyMs).toBe(150);
    expect(m.errorCount).toBe(0);
    expect(m.totalCostUSD).toBeGreaterThan(0);
  });

  it('accumulates errorCount across multiple recordError calls', () => {
    breaker.recordError();
    breaker.recordError();
    const m = breaker.getMetrics();
    expect(m.errorCount).toBe(2);
  });

  it('averages latency correctly over multiple calls', () => {
    breaker.recordSuccess(10, 10, 100);
    breaker.recordSuccess(10, 10, 200);
    const m = breaker.getMetrics();
    // avg = (100 * 1 + 200) / 2 = 150
    expect(m.avgLatencyMs).toBeCloseTo(150, 1);
    expect(m.totalCalls).toBe(2);
  });

  // ── 12. Rate limiting ────────────────────────────────────────────────────
  it('blocks when rate limit (maxRequestsPerMinute) is exceeded', () => {
    // Our breaker has maxRequestsPerMinute: 10
    // Each recordSuccess pushes a timestamp
    for (let i = 0; i < 10; i++) {
      breaker.recordSuccess(1, 1, 10);
    }
    // The 11th call should be rate-limited (not tripped, just blocked)
    expect(breaker.canProceed()).toBe(false);
    // State stays CLOSED — rate limit doesn't trip the breaker
    expect(breaker.getState()).toBe('CLOSED');
  });

  // ── 13. DEFAULT_CIRCUIT_CONFIG export ────────────────────────────────────
  it('DEFAULT_CIRCUIT_CONFIG has expected shape', () => {
    expect(typeof DEFAULT_CIRCUIT_CONFIG.maxCostUSD).toBe('number');
    expect(typeof DEFAULT_CIRCUIT_CONFIG.maxTokensPerRun).toBe('number');
    expect(typeof DEFAULT_CIRCUIT_CONFIG.maxRequestsPerMinute).toBe('number');
    expect(typeof DEFAULT_CIRCUIT_CONFIG.maxConsecutiveErrors).toBe('number');
    expect(typeof DEFAULT_CIRCUIT_CONFIG.cooldownMs).toBe('number');
    expect(DEFAULT_CIRCUIT_CONFIG.maxCostUSD).toBeGreaterThan(0);
    expect(DEFAULT_CIRCUIT_CONFIG.cooldownMs).toBeGreaterThan(0);
  });

  // ── 14. Custom cost config ────────────────────────────────────────────────
  it('respects custom cost config', () => {
    const cheapBreaker = new CircuitBreaker(
      { maxCostUSD: 1.0, maxTokensPerRun: 100_000 },
      { inputPer1M: 1, outputPer1M: 2 } // much cheaper
    );
    // 1M input at $1/1M = $1.00 → exactly at limit
    // calculateCost itself should return $1.00
    expect(cheapBreaker.calculateCost(1_000_000, 0)).toBeCloseTo(1.0, 5);
  });
});

describe('CircuitBreakerRegistry', () => {
  beforeEach(() => {
    CircuitBreakerRegistry.getInstance().resetAll();
  });

  afterEach(() => {
    CircuitBreakerRegistry.getInstance().resetAll();
  });

  it('getInstance returns same singleton', () => {
    const reg1 = CircuitBreakerRegistry.getInstance();
    const reg2 = CircuitBreakerRegistry.getInstance();
    expect(reg1).toBe(reg2);
  });

  it('returns same breaker for the same providerId', () => {
    const reg = CircuitBreakerRegistry.getInstance();
    const b1 = reg.getOrCreate('provider-a');
    const b2 = reg.getOrCreate('provider-a');
    expect(b1).toBe(b2);
  });

  it('returns different breakers for different providerIds', () => {
    const reg = CircuitBreakerRegistry.getInstance();
    const b1 = reg.getOrCreate('provider-a');
    const b2 = reg.getOrCreate('provider-b');
    expect(b1).not.toBe(b2);
  });

  it('resetAll resets all registered breakers', () => {
    const reg = CircuitBreakerRegistry.getInstance();
    const b = reg.getOrCreate('provider-reset-test', { maxConsecutiveErrors: 3 });
    b.recordError();
    b.recordError();
    b.recordError();
    expect(b.getState()).toBe('OPEN');

    reg.resetAll();

    expect(b.getState()).toBe('CLOSED');
    expect(b.canProceed()).toBe(true);
  });

  it('getGlobal returns a CircuitBreaker instance', () => {
    const reg = CircuitBreakerRegistry.getInstance();
    const global = reg.getGlobal();
    expect(global).toBeInstanceOf(CircuitBreaker);
    expect(global.canProceed()).toBe(true);
  });

  it('getTotalCost sums costs across all registered breakers', () => {
    const reg = CircuitBreakerRegistry.getInstance();
    const bA = reg.getOrCreate('provider-cost-a');
    const bB = reg.getOrCreate('provider-cost-b');

    // Use default cost config: $10/1M input
    // 100k input tokens → $1.00 each
    bA.recordSuccess(100_000, 0, 10);
    bB.recordSuccess(100_000, 0, 10);

    const total = reg.getTotalCost();
    expect(total).toBeCloseTo(2.0, 4);
  });

  it('getOrCreate accepts custom config for new breakers', () => {
    const reg = CircuitBreakerRegistry.getInstance();
    const b = reg.getOrCreate('provider-custom-config', { maxCostUSD: 999 });
    expect(b).toBeInstanceOf(CircuitBreaker);
    const budget = b.getRemainingBudget();
    expect(budget.costUSD).toBeCloseTo(999, 1);
  });
});
