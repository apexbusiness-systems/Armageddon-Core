
import { describe, bench, vi } from 'vitest';
import { SupabaseReporter } from '../../src/core/reporter';
import { createClient } from '@supabase/supabase-js';

// Mock console to suppress error logs during expected errors
const originalConsoleError = console.error;
console.error = vi.fn();

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

describe('Reporter Optimization Verification', () => {
  const TEST_RUN_ID = 'verify-opt-run';
  const EVENT_COUNT = 100;
  const LATENCY_MS = 1; // 1ms network latency simulation

  // Mock Environment
  process.env.SUPABASE_URL = 'https://mock.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-key';

  // Metrics
  let insertCalls = 0;

  const mockInsert = vi.fn().mockImplementation(async (data) => {
    insertCalls++;
    await new Promise(resolve => setTimeout(resolve, LATENCY_MS));
    return { error: null };
  });

  const mockFrom = vi.fn().mockReturnValue({
      insert: mockInsert,
      upsert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockResolvedValue({ error: null })
  });

  (createClient as any).mockReturnValue({
    from: mockFrom,
  });

  const reporter = new SupabaseReporter(TEST_RUN_ID);

  // Data Setup
  const events = Array.from({ length: EVENT_COUNT }, (_, i) => ({
      batteryId: 'B_VERIFY',
      eventType: 'ATTACK_BLOCKED' as any,
      payload: { iteration: i }
  }));

  bench('Optimized: Batch Insert (pushEvents)', async () => {
    insertCalls = 0;
    await reporter.pushEvents(events);
    // In a real test we'd assert insertCalls === 1, but bench just measures time
  }, { iterations: 5 });

  bench('Unoptimized: N+1 Loop (pushEvent)', async () => {
    insertCalls = 0;
    for (const event of events) {
        await reporter.pushEvent(event.batteryId, event.eventType, event.payload);
    }
    // In a real test we'd assert insertCalls === EVENT_COUNT
  }, { iterations: 1 }); // Reduce iterations because it's slow
});
