/**
 * Regression shield for GET /api/leaderboard (handleLeaderboard, intake-handler.ts).
 *
 * The leaderboard must never fabricate live standings: `live` is true only
 * when the armageddon_runs query actually succeeds with at least one row,
 * and every returned entry must be anonymized (a short codename derived from
 * the run id — never the organization id or name).
 */
import { describe, expect, it, vi, afterEach } from 'vitest';
import intakeWorker from '../../src/intake-handler';

type Env = Parameters<typeof intakeWorker.fetch>[1];

function makeEnv(): Env {
    return {
        ASSETS: { fetch: async () => new Response('') },
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-test-key',
    } as Env;
}

async function callLeaderboard(method = 'GET') {
    const request = new Request('https://armageddontest.icu/api/leaderboard', { method });
    return intakeWorker.fetch(request, makeEnv());
}

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('GET /api/leaderboard — handleLeaderboard contract', () => {
    it('rejects non-GET methods', async () => {
        const res = await callLeaderboard('POST');
        expect(res.status).toBe(405);
    });

    it('returns live:true with anonymized, score-mapped entries on a successful non-empty query', async () => {
        const rows = [
            { id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', escape_rate: 0, breaches: 0, sim_mode: false, config: { tier: 'CERTIFIED' }, completed_at: '2026-07-22T00:00:00Z' },
            { id: '11111111-2222-3333-4444-555555555555', escape_rate: 0.05, breaches: 1, sim_mode: true, config: { tier: 'FREE' }, completed_at: '2026-07-21T00:00:00Z' },
        ];
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(rows), { status: 200 })));

        const res = await callLeaderboard();
        expect(res.status).toBe(200);
        const body = await res.json() as { live: boolean; agents: Array<{ rank: number; id: string; score: number; status: string }> };

        expect(body.live).toBe(true);
        expect(body.agents).toHaveLength(2);

        // Anonymized: derived codename, never the raw run id or any org identifier.
        expect(body.agents[0].id).toBe('OP-AAAAAA');
        expect(body.agents[0].id).not.toContain('aaaaaaaa-bbbb');

        // Genuine live-fire (sim_mode:false + CERTIFIED) reads GOD_MODE; a simulation pass does not.
        expect(body.agents[0].status).toBe('GOD_MODE');
        expect(body.agents[0].score).toBe(100);
        expect(body.agents[1].status).toBe('CERTIFIED');
        expect(body.agents[1].score).toBe(95);
        expect(body.agents[1].rank).toBe(2);
    });

    it('returns live:false with an empty list when the query fails, never fabricating standings', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('db unreachable', { status: 500 })));

        const res = await callLeaderboard();
        expect(res.status).toBe(200);
        const body = await res.json() as { live: boolean; agents: unknown[] };
        expect(body.live).toBe(false);
        expect(body.agents).toEqual([]);
    });
});
