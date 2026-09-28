/**
 * Regression shield: pull requests must never deploy to production.
 *
 * `.github/workflows/deploy-cloudflare.yml` runs `npm run deploy:cloudflare`
 * against the production Worker/routes. It keeps a `pull_request` trigger only
 * so each PR visibly records the deploy job as skipped; the job condition must
 * restrict real deploys to `push` on main or an explicit `workflow_dispatch`.
 *
 * Source-text assertions on purpose: no YAML parser is a declared dependency,
 * and the job condition is a single line whose exact shape is the contract.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const WORKFLOW = readFileSync(
    join(__dirname, '..', '..', '..', '.github', 'workflows', 'deploy-cloudflare.yml'),
    'utf8',
);

/** Returns the lines of one top-level job block (2-space indented key). */
function jobBlock(source: string, job: string): string {
    const lines = source.split('\n');
    const start = lines.findIndex((line) => line === `  ${job}:`);
    if (start === -1) return '';
    const rest = lines.slice(start + 1);
    const end = rest.findIndex((line) => /^ {2}\S/.test(line) || /^\S/.test(line));
    return [lines[start], ...(end === -1 ? rest : rest.slice(0, end))].join('\n');
}

describe('deploy-cloudflare workflow — production deploy gate', () => {
    const deploy = jobBlock(WORKFLOW, 'deploy');

    it('defines the deploy job', () => {
        expect(deploy).toContain('npm run deploy:cloudflare');
    });

    it('only deploys on push to main or workflow_dispatch', () => {
        const condition = /^ {4}if: (.+)$/m.exec(deploy)?.[1];
        expect(condition).toBe(
            "(github.event_name == 'push' && github.ref == 'refs/heads/main') || github.event_name == 'workflow_dispatch'",
        );
    });

    it('never allows the pull_request event through the deploy condition', () => {
        const condition = /^ {4}if: (.+)$/m.exec(deploy)?.[1] ?? '';
        expect(condition).not.toContain('pull_request');
        expect(condition).not.toContain('!=');
    });

    it('does not depend on a job defined in another workflow file (invalid cross-workflow needs)', () => {
        const needs = /^ {4}needs: \[?([^\]\n]+)\]?$/m.exec(deploy)?.[1];
        if (needs === undefined) return;
        for (const job of needs.split(',').map((name) => name.trim())) {
            expect(jobBlock(WORKFLOW, job)).not.toBe('');
        }
    });
});
