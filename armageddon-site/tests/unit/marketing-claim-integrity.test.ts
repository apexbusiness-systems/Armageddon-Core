/**
 * Marketing-claim integrity shield (2026-07-06).
 *
 * "We ship validated and evidenced builds to production, not hopes and dreams."
 * Every quantitative claim rendered on the marketing site must match the value
 * the production code actually uses. This test fails the build if copy and code
 * drift apart.
 *
 * Claims locked:
 *  - "Simulation tier runs 10,000 statistical iterations" ⇔
 *     SIM_STATISTICAL_ITERATIONS in intake-handler.ts (the value stored on every
 *     sim_mode run) ⇔ the "10,000" string in EVERY locale dictionary.
 *  - "<0.01% escape threshold" present consistently in copy.
 *  - The homepage leaderboard is never labeled "LIVE" while backed by the
 *     static TOP_AGENTS sample array.
 *  - The Batteries 10 & 13 PAIR engine copy never claims live LLM attacks run
 *     today: every locale that mentions PAIR must also state the engine is
 *     reserved/gated for live-fire-authorized deployments (corrected 2026-07-22
 *     — the prior copy claimed "Batteries 10 & 13 execute real PAIR
 *     adversarial attacks on Certified tier", which is false in this
 *     deployment since packages/core/src/worker.ts refuses to boot unless
 *     SIM_MODE=true, so no tier ever gets live-fire execution).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..', '..', 'src');
const read = (p: string) => readFileSync(join(SRC, p), 'utf8');

const worker = read('intake-handler.ts');
const dictDir = join(SRC, 'i18n', 'dictionaries');
const dictFiles = readdirSync(dictDir).filter((f) => f.endsWith('.ts'));

describe('marketing claim integrity', () => {
    it('code uses exactly 10,000 simulation iterations (the advertised figure)', () => {
        expect(worker).toMatch(/SIM_STATISTICAL_ITERATIONS\s*=\s*10000/);
        // The old, contradicting hard-coded value must not reappear.
        expect(worker).not.toMatch(/const iterations = 2500/);
    });

    it('every locale dictionary claims 10,000 iterations and <0.01% threshold', () => {
        expect(dictFiles.length).toBeGreaterThanOrEqual(7);
        for (const f of dictFiles) {
            const txt = readFileSync(join(dictDir, f), 'utf8');
            if (!txt.includes('statistical iterations') && !/迭代/.test(txt) && !/itération|iteraciones|iterazioni|iterações|Iterationen/i.test(txt)) {
                // Battery-manifest description not present in this dictionary slice — skip.
                continue;
            }
            // Locale number formats: "10,000" (en/zh), "10.000" (de/es/it/pt),
            // "10 000" (fr, non-breaking/space).
            expect(txt, `${f} must reference 10,000`).toMatch(/10[\s., ]?000/);
            // Threshold: "<0.01%" (en/es/zh) or "<0,01%" / "<0,01 %" (de/fr/it/pt).
            expect(txt, `${f} must reference <0.01% threshold`).toMatch(/0[.,]01\s*%/);
        }
    });

    it('every locale gates the PAIR engine claim behind live-fire authorization, never presenting it as active today', () => {
        // Words indicating the engine is gated/reserved rather than running live, one per locale.
        const gatingWords = /reserved|reserviert|reservado|reserve|riservato|预留/i;
        // The specific overclaim this shield exists to prevent: framing PAIR as
        // something that already "executes real" attacks unconditionally.
        const activeOverclaim = /execute[nsz]?\s+(real|echte|reales?|de veritables|veri|reais?)\s+PAIR/i;
        expect(dictFiles.length).toBeGreaterThanOrEqual(7);
        for (const f of dictFiles) {
            const txt = readFileSync(join(dictDir, f), 'utf8');
            if (!txt.includes('PAIR')) continue;
            expect(txt, `${f} must not claim PAIR attacks execute unconditionally`).not.toMatch(activeOverclaim);
            expect(txt, `${f} must gate the PAIR engine behind live-fire authorization`).toMatch(gatingWords);
        }
    });

    it('leaderboard defaults to SAMPLE and only shows LIVE behind a real, non-empty fetch', () => {
        const lb = read('components/social/LeaderboardWidget.tsx');
        expect(lb).toContain('TOP_AGENTS');
        // Initial/SSR state must default to the sample board, never LIVE.
        expect(lb).toMatch(/useState<\{[^}]*\}>\(\{\s*agents:\s*TOP_AGENTS,\s*live:\s*false\s*\}\)/);
        // LIVE may only flip true inside the fetch-success branch, gated on a
        // non-empty real result — never unconditionally, never on failure.
        expect(lb).toMatch(/data\.live && data\.agents\.length === 0\)\s*return;|!data\.live \|\| data\.agents\.length === 0\)\s*return;/);
        expect(lb).toMatch(/live:\s*true/);
        // The header still renders both labels, gated on the same `live` flag.
        expect(lb).toMatch(/>LIVE</);
        expect(lb).toMatch(/>SAMPLE</);
    });
});
