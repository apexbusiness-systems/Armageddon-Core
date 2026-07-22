/**
 * Certification pipeline integration test.
 *
 * Regression shield for the "stuck at EXECUTING 0/13" failure: it proves the
 * server-side execution path the browser console streams actually runs from
 * start to certification. It drives the REAL battery activities, REAL report
 * generation, and REAL finalize activity in the same order
 * ArmageddonLevel7Workflow does, with a fake PostgREST endpoint capturing every
 * armageddon_events insert and armageddon_runs update the reporter performs —
 * i.e. the exact rows the frontend receives over Supabase realtime.
 *
 * Unlike the Temporal-server harness (opt-in, needs a downloaded dev-server
 * binary), this runs in the normal CI vitest suite with no external services.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

// SIM_MODE safety env MUST be set before activities (→ safety singleton) load.
process.env.SIM_MODE = 'true';
process.env.SANDBOX_TENANT = 'armageddon-integration-test';

interface CapturedRow {
    event_type?: string;
    battery_id?: string;
    status?: string;
    batteries_passed?: string[];
    [k: string]: unknown;
}

const captured = { events: [] as CapturedRow[], runUpdates: [] as CapturedRow[] };
let server: http.Server;

function startFakeSupabase(): Promise<string> {
    server = http.createServer((req, res) => {
        let raw = '';
        req.on('data', (c) => (raw += c));
        req.on('end', () => {
            const body = raw ? JSON.parse(raw) : null;
            const single = (req.headers['accept'] ?? '').includes('vnd.pgrst.object');
            if (req.url?.includes('/rest/v1/armageddon_events')) {
                const rows = Array.isArray(body) ? body : [body];
                captured.events.push(...rows);
                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(single ? rows[0] : rows));
                return;
            }
            if (req.url?.includes('/rest/v1/armageddon_runs')) {
                const id = /id=eq\.([0-9a-f-]+)/i.exec(req.url)?.[1];
                const echo = { id, ...(body ?? {}) };
                captured.runUpdates.push(echo);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(single ? echo : [echo]));
                return;
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end('[]');
        });
    });
    return new Promise((resolve) => {
        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address() as AddressInfo;
            resolve(`http://127.0.0.1:${port}`);
        });
    });
}

describe('certification pipeline — start → certification with live telemetry', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mod: any;
    const runId = '11111111-1111-4111-8111-111111111111';

    beforeAll(async () => {
        const url = await startFakeSupabase();
        process.env.SUPABASE_URL = url;
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
        // Import AFTER env is set so the reporter and safety singleton read it.
        mod = await import('../../src/temporal/activities');
    });

    afterAll(() => {
        server?.close();
    });

    it('executes B10–B13, streams per-battery telemetry, and finalizes status=passed', async () => {
        // Seed 1 is a verified clean-pass seed for the deterministic SimulationAdapter.
        const config = { runId, iterations: 100, tier: 'FREE' as const, seed: 1, batteries: ['B10', 'B11', 'B12', 'B13'] };

        // Mirror ArmageddonLevel7Workflow's battery execution order.
        const results = [
            await mod.runBattery10_GoalHijack(config),
            await mod.runBattery11_ToolMisuse(config),
            await mod.runBattery12_MemoryPoison(config),
            await mod.runBattery13_SupplyChain(config),
        ];

        // Every battery must have reached a terminal PASSED verdict.
        expect(results.map((r) => r.status)).toEqual(['PASSED', 'PASSED', 'PASSED', 'PASSED']);

        // Aggregate exactly as the workflow does and persist the terminal state.
        const failureCount = results.filter((r) => r.status === 'FAILED').length;
        const state = {
            status: failureCount > 0 ? 'FAILED' : 'COMPLETED',
            results,
            currentBattery: null,
            startTime: Date.now() - 5000,
            level: 7,
        };
        const report = await mod.generateReport(state);
        await mod.finalizeRunActivity({
            runId,
            status: failureCount > 0 ? 'failed' : 'passed',
            startedAt: state.startTime,
            report,
        });

        // Telemetry the console streams: a STARTED and COMPLETED for each battery.
        const started = captured.events.filter((e) => e.event_type === 'BATTERY_STARTED').map((e) => e.battery_id);
        const completed = captured.events.filter((e) => e.event_type === 'BATTERY_COMPLETED').map((e) => e.battery_id);
        expect(new Set(started)).toEqual(new Set(['B10', 'B11', 'B12', 'B13']));
        expect(new Set(completed)).toEqual(new Set(['B10', 'B11', 'B12', 'B13']));

        // The terminal run row the frontend awaits to unstick "EXECUTING 0/13".
        const terminal = captured.runUpdates.find((u) => u.status === 'passed');
        expect(terminal).toBeTruthy();
        expect(terminal?.batteries_passed).toHaveLength(4);
        expect(report.status).toBe('COMPLETED');
        expect(report.score).toBe(100);
    });

    // Regression shield for a real production finding (2026-07-22, run
    // 6d608387): B14 delegates to a separate engine module and was the only
    // battery of B10-B14 that never pushed BATTERY_STARTED/COMPLETED to
    // armageddon_events, despite being recorded executed/failed on the run
    // row — see docs/audits/PRODUCTION_RUN_DISPATCH_STUCK_2026-07-22.md.
    // iterations:0 deliberately keeps the delegated engine's loop from
    // running at all: that loop calls Temporal's Context.current().heartbeat()
    // unconditionally (unlike B10-B13's runGenericAdversarialBattery, which
    // never touches Context), so it only works inside a live Temporal worker
    // and would throw "Activity context not initialized" in this harness —
    // a separate, pre-existing gap in that engine, not something this fix
    // touches. Zero iterations still exercises exactly what this fix changed
    // (the STARTED/COMPLETED reporter calls) without depending on it.
    it('B14 streams BATTERY_STARTED/COMPLETED telemetry like every other battery', async () => {
        const b14RunId = '22222222-2222-4222-8222-222222222222';
        const config = { runId: b14RunId, iterations: 0, tier: 'FREE' as const, seed: 1, batteries: ['B14'] };

        const result = await mod.runBattery14_IndirectInjection(config);

        expect(['PASSED', 'FAILED']).toContain(result.status);

        const b14Events = captured.events.filter((e) => e.battery_id === 'B14' && (e as { run_id?: string }).run_id === b14RunId);
        const started = b14Events.filter((e) => e.event_type === 'BATTERY_STARTED');
        const completed = b14Events.filter((e) => e.event_type === 'BATTERY_COMPLETED');
        expect(started).toHaveLength(1);
        expect(completed).toHaveLength(1);
    });
});
