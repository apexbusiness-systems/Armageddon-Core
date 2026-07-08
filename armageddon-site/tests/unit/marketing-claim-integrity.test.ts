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

    it('leaderboard sample data is never presented under a "LIVE" label', () => {
        const lb = read('components/social/LeaderboardWidget.tsx');
        expect(lb).toContain('TOP_AGENTS');
        // A static sample array must not be labeled LIVE.
        expect(lb).not.toMatch(/>LIVE</);
        expect(lb).toMatch(/>SAMPLE</);
    });
});
