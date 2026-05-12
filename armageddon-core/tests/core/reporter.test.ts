// tests/core/reporter.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock @supabase/supabase-js before any reporter import ─────────────────

const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
const mockUpsert = vi.fn().mockResolvedValue({ data: null, error: null });
const mockEq = vi.fn().mockResolvedValue({ data: null, error: null });
const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
const mockSelect = vi.fn().mockReturnValue({
  limit: vi.fn().mockResolvedValue({ data: [], error: null }),
});
const mockFrom = vi.fn().mockReturnValue({
  insert: mockInsert,
  upsert: mockUpsert,
  update: mockUpdate,
  select: mockSelect,
});
const mockSend = vi.fn().mockResolvedValue({ status: 'ok' });
const mockChannel = vi.fn().mockReturnValue({ send: mockSend });
const mockRemoveChannel = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn().mockReturnValue({
    from: mockFrom,
    channel: mockChannel,
    removeChannel: mockRemoveChannel,
  }),
}));

// ─── Environment setup ────────────────────────────────────────────────────

beforeEach(() => {
  process.env.SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  vi.clearAllMocks();
  // Re-apply mock return values after clearAllMocks
  mockFrom.mockReturnValue({
    insert: mockInsert,
    upsert: mockUpsert,
    update: mockUpdate,
    select: mockSelect,
  });
  mockChannel.mockReturnValue({ send: mockSend });
  mockInsert.mockResolvedValue({ data: null, error: null });
  mockUpsert.mockResolvedValue({ data: null, error: null });
  mockEq.mockResolvedValue({ data: null, error: null });
  mockSend.mockResolvedValue({ status: 'ok' });
});

afterEach(() => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

// ─── SupabaseReporter construction ────────────────────────────────────────

describe('SupabaseReporter construction', () => {
  it('constructs successfully when env vars are present', async () => {
    const { SupabaseReporter } = await import('../../src/core/reporter');
    expect(() => new SupabaseReporter('run-construct-ok')).not.toThrow();
  });

  it('throws [Reporter] error when SUPABASE_URL is missing', async () => {
    delete process.env.SUPABASE_URL;
    const { SupabaseReporter } = await import('../../src/core/reporter');
    expect(() => new SupabaseReporter('run-no-url')).toThrow('[Reporter]');
  });

  it('throws [Reporter] error when SUPABASE_SERVICE_ROLE_KEY is missing', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { SupabaseReporter } = await import('../../src/core/reporter');
    expect(() => new SupabaseReporter('run-no-key')).toThrow('[Reporter]');
  });

  it('throws when both env vars are missing', async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { SupabaseReporter } = await import('../../src/core/reporter');
    expect(() => new SupabaseReporter('run-no-env')).toThrow();
  });
});

// ─── createReporter factory ───────────────────────────────────────────────

describe('createReporter factory', () => {
  it('returns a SupabaseReporter instance', async () => {
    const { createReporter, SupabaseReporter } = await import('../../src/core/reporter');
    const reporter = createReporter('run-factory-001');
    expect(reporter).toBeInstanceOf(SupabaseReporter);
  });

  it('returns cached instance for the same runId', async () => {
    const { createReporter } = await import('../../src/core/reporter');
    const r1 = createReporter('run-cached-001');
    const r2 = createReporter('run-cached-001');
    expect(r1).toBe(r2);
  });

  it('clears cached instance on clearReporter', async () => {
    const { createReporter, clearReporter } = await import('../../src/core/reporter');
    const r1 = createReporter('run-clear-001');
    clearReporter('run-clear-001');
    const r2 = createReporter('run-clear-001');
    expect(r1).not.toBe(r2);
  });

  it('creates distinct instances for different runIds', async () => {
    const { createReporter } = await import('../../src/core/reporter');
    const r1 = createReporter('run-distinct-aaa');
    const r2 = createReporter('run-distinct-bbb');
    expect(r1).not.toBe(r2);
  });
});

// ─── pushEvent ────────────────────────────────────────────────────────────

describe('SupabaseReporter.pushEvent', () => {
  it('does not throw on a valid event', async () => {
    const { createReporter } = await import('../../src/core/reporter');
    const reporter = createReporter('run-push-event-001');
    await expect(
      reporter.pushEvent('B1', 'BATTERY_STARTED', { test: true })
    ).resolves.not.toThrow();
  });

  it('calls supabase insert with correct table name', async () => {
    const { createReporter } = await import('../../src/core/reporter');
    const reporter = createReporter('run-push-event-002');
    await reporter.pushEvent('B2', 'BREACH', { severity: 'high' });
    expect(mockFrom).toHaveBeenCalledWith('armageddon_events');
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it('passes correct event shape to insert', async () => {
    const { createReporter } = await import('../../src/core/reporter');
    const reporter = createReporter('run-push-event-003');
    await reporter.pushEvent('B3', 'ATTACK_BLOCKED', { note: 'blocked' });
    const insertArg = mockInsert.mock.calls[0][0];
    expect(insertArg).toMatchObject({
      runId: 'run-push-event-003',
      batteryId: 'B3',
      eventType: 'ATTACK_BLOCKED',
      payload: { note: 'blocked' },
      timestamp: expect.any(String),
    });
  });

  it('also calls channel.send when pushing an event', async () => {
    const { createReporter } = await import('../../src/core/reporter');
    const reporter = createReporter('run-channel-send-001');
    await reporter.pushEvent('B4', 'DRIFT_DETECTED');
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('does not throw when payload is undefined', async () => {
    const { createReporter } = await import('../../src/core/reporter');
    const reporter = createReporter('run-no-payload-001');
    await expect(reporter.pushEvent('B5', 'RUN_STARTED')).resolves.not.toThrow();
  });
});

// ─── pushEvents (batch) ───────────────────────────────────────────────────

describe('SupabaseReporter.pushEvents', () => {
  it('does not call insert for an empty array', async () => {
    const { createReporter } = await import('../../src/core/reporter');
    const reporter = createReporter('run-push-events-empty-001');
    await reporter.pushEvents([]);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('does not call channel.send for an empty array', async () => {
    const { createReporter } = await import('../../src/core/reporter');
    const reporter = createReporter('run-push-events-empty-002');
    await reporter.pushEvents([]);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('calls insert once for a batch of events', async () => {
    const { createReporter } = await import('../../src/core/reporter');
    const reporter = createReporter('run-batch-001');
    await reporter.pushEvents([
      { batteryId: 'B1', eventType: 'ATTACK_BLOCKED' },
      { batteryId: 'B2', eventType: 'BREACH' },
    ]);
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it('inserts rows with correct runId for batch', async () => {
    const { createReporter } = await import('../../src/core/reporter');
    const reporter = createReporter('run-batch-002');
    await reporter.pushEvents([
      { batteryId: 'B1', eventType: 'RUN_STARTED', payload: { x: 1 } },
    ]);
    const rows = mockInsert.mock.calls[0][0];
    expect(Array.isArray(rows)).toBe(true);
    expect(rows[0]).toMatchObject({
      runId: 'run-batch-002',
      batteryId: 'B1',
      eventType: 'RUN_STARTED',
      payload: { x: 1 },
      timestamp: expect.any(String),
    });
  });

  it('calls channel.send once for a batch of events', async () => {
    const { createReporter } = await import('../../src/core/reporter');
    const reporter = createReporter('run-batch-003');
    await reporter.pushEvents([
      { batteryId: 'B1', eventType: 'ATTACK_BLOCKED' },
      { batteryId: 'B2', eventType: 'BREACH' },
    ]);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });
});

// ─── upsertProgress ───────────────────────────────────────────────────────

describe('SupabaseReporter.upsertProgress', () => {
  it('calls upsert on armageddon_runs table', async () => {
    const { createReporter } = await import('../../src/core/reporter');
    const reporter = createReporter('run-upsert-001');
    await reporter.upsertProgress({
      batteryId: 'B1',
      currentIteration: 5,
      totalIterations: 10,
      blockedCount: 3,
      breachCount: 1,
      driftScore: 0.42,
      status: 'RUNNING',
    });
    expect(mockFrom).toHaveBeenCalledWith('armageddon_runs');
    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  it('upserts with correct runId and status', async () => {
    const { createReporter } = await import('../../src/core/reporter');
    const reporter = createReporter('run-upsert-002');
    await reporter.upsertProgress({
      batteryId: 'B1',
      currentIteration: 1,
      totalIterations: 5,
      blockedCount: 0,
      breachCount: 0,
      driftScore: 0,
      status: 'RUNNING',
    });
    const row = mockUpsert.mock.calls[0][0];
    expect(row.runId).toBe('run-upsert-002');
    expect(row.status).toBe('RUNNING');
    expect(row.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

// ─── finalizeRun ──────────────────────────────────────────────────────────

describe('SupabaseReporter.finalizeRun', () => {
  it('calls insert (via pushEvent) and update on finalizeRun COMPLETED', async () => {
    const { createReporter } = await import('../../src/core/reporter');
    const reporter = createReporter('run-finalize-001');
    await reporter.finalizeRun('COMPLETED', { score: 42 });
    // pushEvent inserts into armageddon_events
    expect(mockInsert).toHaveBeenCalledTimes(1);
    // finalizeRun also updates armageddon_runs
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it('calls insert (via pushEvent) and update on finalizeRun FAILED', async () => {
    const { createReporter } = await import('../../src/core/reporter');
    const reporter = createReporter('run-finalize-002');
    await reporter.finalizeRun('FAILED', { reason: 'timeout' });
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it('does not throw for finalizeRun with empty summary', async () => {
    const { createReporter } = await import('../../src/core/reporter');
    const reporter = createReporter('run-finalize-003');
    await expect(reporter.finalizeRun('COMPLETED', {})).resolves.not.toThrow();
  });
});
