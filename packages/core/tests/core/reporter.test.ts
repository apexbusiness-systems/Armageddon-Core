import { describe, it, expect, vi, beforeEach } from 'vitest';

// Capture inserted rows + control the simulated DB error.
const insertMock = vi.fn();
const sendMock = vi.fn().mockResolvedValue(undefined);

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => ({
        from: vi.fn(() => ({ insert: insertMock })),
        channel: vi.fn(() => ({ send: sendMock })),
    })),
}));

import { SupabaseReporter } from '../../src/core/reporter';

describe('SupabaseReporter — armageddon_events schema alignment', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.SUPABASE_URL = 'http://localhost';
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
        delete process.env.ARMAGEDDON_DB_URL;
        delete process.env.ARMAGEDDON_DB_SERVICE_ROLE_KEY;
        insertMock.mockResolvedValue({ error: null });
        sendMock.mockResolvedValue(undefined);
    });

    // T1
    it('maps the event to the snake_case Supabase schema with iteration defaulting to 0', async () => {
        const reporter = new SupabaseReporter('run-123');
        await reporter.pushEvent('B10', 'BREACH', { prompt: 'x' });

        expect(insertMock).toHaveBeenCalledTimes(1);
        const row = insertMock.mock.calls[0][0];

        expect(row.run_id).toBe('run-123');
        expect(row.battery_id).toBe('B10');
        expect(row.event_type).toBe('BREACH');
        expect(row.severity).toBe('critical');     // BREACH → critical
        expect(row.iteration).toBe(0);              // NOT NULL → default 0
        expect(typeof row.message).toBe('string');  // NOT NULL
        expect(row.message.length).toBeGreaterThan(0);

        // No camelCase leakage from the old broken shape.
        expect(row).not.toHaveProperty('runId');
        expect(row).not.toHaveProperty('batteryId');
        expect(row).not.toHaveProperty('eventType');
        expect(row).not.toHaveProperty('timestamp');
    });

    it('preserves a numeric payload.iteration', async () => {
        const reporter = new SupabaseReporter('run-123');
        await reporter.pushEvent('B11', 'ATTACK_BLOCKED', { iteration: 42 });
        const row = insertMock.mock.calls[0][0];
        expect(row.iteration).toBe(42);
        expect(row.severity).toBe('blocked'); // ATTACK_BLOCKED → blocked enum value
    });



    it('uses ARMAGEDDON_DB_URL and ARMAGEDDON_DB_SERVICE_ROLE_KEY aliases', async () => {
        delete process.env.SUPABASE_URL;
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;
        process.env.ARMAGEDDON_DB_URL = 'http://alias-localhost';
        process.env.ARMAGEDDON_DB_SERVICE_ROLE_KEY = 'alias-service-key';

        const reporter = new SupabaseReporter('run-alias');
        await reporter.pushEvent('B10', 'BREACH', { prompt: 'x' });

        expect(insertMock).toHaveBeenCalledTimes(1);
    });

    // T2
    it('throws when the DB insert returns an error (proof-critical persistence)', async () => {
        insertMock.mockResolvedValue({ error: { message: 'insert violates not-null' } });
        const reporter = new SupabaseReporter('run-123');

        await expect(reporter.pushEvent('B10', 'BREACH')).rejects.toThrow(/insert violates not-null/);
    });
});
