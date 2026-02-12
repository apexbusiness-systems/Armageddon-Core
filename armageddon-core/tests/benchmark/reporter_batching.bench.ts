import { describe, bench, vi } from 'vitest';
import { SupabaseReporter } from '../../src/core/reporter';
import { createClient } from '@supabase/supabase-js';

// Mock the supabase client with artificial latency
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

describe('Reporter Batching Performance', () => {
  const TEST_RUN_ID = 'bench-run-123';
  const EVENT_COUNT = 100;
  const LATENCY_MS = 50; // Simulates 50ms database round-trip

  // Setup environment for Reporter
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

  const mockInsert = vi.fn().mockImplementation(async () => {
    await new Promise(resolve => setTimeout(resolve, LATENCY_MS));
    return { error: null };
  });

  const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });

  (createClient as any).mockReturnValue({
    from: mockFrom,
  });

  const reporter = new SupabaseReporter(TEST_RUN_ID);

  bench('Unoptimized: Sequential pushEvent (N database calls)', async () => {
    // Baseline: 100 events x 50ms = ~5000ms total
    for (let i = 0; i < EVENT_COUNT; i++) {
      await reporter.pushEvent('B1', 'ATTACK_BLOCKED', { iteration: i });
    }
  }, { iterations: 1 });

  bench('Optimized: Batched pushEvents (1 database call)', async () => {
    // Optimization: 100 events in 1 call = ~50ms total
    // Expected improvement: 100x faster (5000ms -> 50ms)
    const events = Array.from({ length: EVENT_COUNT }, (_, i) => ({
      batteryId: 'B1',
      eventType: 'ATTACK_BLOCKED' as const,
      payload: { iteration: i }
    }));

    await reporter.pushEvents(events);
  }, { iterations: 1 });
});
