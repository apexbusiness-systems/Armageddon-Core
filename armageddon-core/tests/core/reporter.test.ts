import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { SupabaseReporter } from '../../src/core/reporter';
import { createClient } from '@supabase/supabase-js';

// Mock the supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

describe('SupabaseReporter', () => {
  const originalEnv = process.env;
  let mockInsert: Mock;
  let mockUpsert: Mock;
  let mockUpdate: Mock;
  let mockFrom: Mock;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

    mockInsert = vi.fn().mockResolvedValue({ error: null });
    mockUpsert = vi.fn().mockResolvedValue({ error: null });
    mockUpdate = vi.fn().mockResolvedValue({ error: null });

    // Chainable mock
    const mockEq = vi.fn().mockReturnValue({ error: null });

    mockUpdate.mockReturnValue({ eq: mockEq });

    mockFrom = vi.fn().mockImplementation((table) => {
        if (table === 'armageddon_events') return { insert: mockInsert };
        if (table === 'armageddon_runs') return { upsert: mockUpsert, update: mockUpdate };
        return {};
    });

    (createClient as Mock).mockReturnValue({
      from: mockFrom,
    });
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  it('should throw if env vars are missing', () => {
    delete process.env.SUPABASE_URL;
    expect(() => new SupabaseReporter('run-1')).toThrow(/SUPABASE_URL/);
  });

  it('should push event to armageddon_events', async () => {
    const reporter = new SupabaseReporter('run-1');
    await reporter.pushEvent('B1', 'BATTERY_STARTED', { foo: 'bar' });

    expect(mockFrom).toHaveBeenCalledWith('armageddon_events');
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        runId: 'run-1',
        batteryId: 'B1',
        eventType: 'BATTERY_STARTED',
        payload: { foo: 'bar' }
    }));
  });

  it('should upsert progress', async () => {
    const reporter = new SupabaseReporter('run-1');
    await reporter.upsertProgress({
        batteryId: 'B1',
        currentIteration: 10,
        totalIterations: 100,
        blockedCount: 5,
        breachCount: 0,
        driftScore: 0,
        status: 'RUNNING'
    });

    expect(mockFrom).toHaveBeenCalledWith('armageddon_runs');
    expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({
        runId: 'run-1',
        batteryId: 'B1',
        currentIteration: 10
    }), { onConflict: 'runId,batteryId' });
  });

  it('should finalize run', async () => {
    const reporter = new SupabaseReporter('run-1');
    await reporter.finalizeRun('COMPLETED', { score: 100 });

    expect(mockFrom).toHaveBeenCalledWith('armageddon_runs');
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        status: 'COMPLETED',
        summary: { score: 100 }
    }));
  });

  it('should push multiple events in batch', async () => {
    const reporter = new SupabaseReporter('run-1');
    await reporter.pushEvents([
        { batteryId: 'B1', eventType: 'ATTACK_BLOCKED', payload: { i: 1 } },
        { batteryId: 'B1', eventType: 'BREACH', payload: { i: 2 } }
    ]);

    expect(mockFrom).toHaveBeenCalledWith('armageddon_events');
    expect(mockInsert).toHaveBeenCalledWith([
        expect.objectContaining({ batteryId: 'B1', eventType: 'ATTACK_BLOCKED', payload: { i: 1 } }),
        expect.objectContaining({ batteryId: 'B1', eventType: 'BREACH', payload: { i: 2 } })
    ]);
  });
});
