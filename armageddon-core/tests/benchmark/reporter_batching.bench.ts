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

  bench('Batched pushEvents (Proposed)', async () => {
    // Note: We are testing against the intended API even if not yet implemented
    // This will fail to compile or run until Step 2 is done,
    // but we can also use a temporary mock/cast if we want to run it now.
    const events = Array.from({ length: EVENT_COUNT }, (_, i) => ({
      batteryId: 'B1',
      eventType: 'ATTACK_BLOCKED' as any,
      payload: { iteration: i }
    }));

    // We cast to any here because pushEvents doesn't exist yet
    if ((reporter as any).pushEvents) {
        await (reporter as any).pushEvents(events);
    } else {
        // Fallback simulation for baseline if pushEvents not yet there
        // This allows us to establish a baseline before the method exists
        const rows = events.map(e => ({ ...e, runId: TEST_RUN_ID, timestamp: new Date().toISOString() }));
        await mockInsert(rows);
    }
  }, { iterations: 1 });
});
