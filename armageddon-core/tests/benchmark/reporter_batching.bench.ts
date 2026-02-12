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
  const LATENCY_MS = 50;

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

  bench('Sequential pushEvent (N+1)', async () => {
    for (let i = 0; i < EVENT_COUNT; i++) {
      await reporter.pushEvent('B1', 'ATTACK_BLOCKED', { iteration: i });
    }
  }, { iterations: 1 });

  bench('Batched pushEvents (Optimized)', async () => {
    const events = Array.from({ length: EVENT_COUNT }, (_, i) => ({
      batteryId: 'B1',
      eventType: 'ATTACK_BLOCKED' as any,
      payload: { iteration: i }
    }));

    await reporter.pushEvents(events);
  }, { iterations: 1 });
});
