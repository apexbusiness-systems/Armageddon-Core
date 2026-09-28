/**
 * Regression shield: a leaked credential must never be re-committed.
 *
 * A real account password was committed in two Playwright specs. Those specs
 * now read E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD from the environment and skip
 * when unset. This test fails if the leaked value reappears in any tracked
 * file. The needle is assembled at runtime so this file never contains it.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(__dirname, '..', '..', '..');
const LEAKED_PASSWORD = ['Apex', '143'].join('');

/** Tracked files containing `needle` (fixed string); [] when none. */
function trackedFilesContaining(needle: string): string[] {
    try {
        const out = execFileSync('git', ['grep', '-l', '-I', '-F', needle], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        return out.split('\n').filter(Boolean);
    } catch (error) {
        // `git grep` exits 1 when nothing matches; anything else is a real failure.
        if ((error as { status?: number }).status === 1) return [];
        throw error;
    }
}

describe('no committed credentials', () => {
    it('no tracked file contains the leaked admin password', () => {
        expect(trackedFilesContaining(LEAKED_PASSWORD)).toEqual([]);
    });

    it('E2E specs read admin credentials from the environment and skip when unset', () => {
        for (const spec of ['initiate-sequence.spec.ts', 'admin-bypass.spec.ts']) {
            const source = readFileSync(join(__dirname, '..', '..', 'e2e', spec), 'utf8');
            expect(source).toContain('process.env.E2E_ADMIN_EMAIL');
            expect(source).toContain('process.env.E2E_ADMIN_PASSWORD');
            expect(source).toContain("'E2E admin credentials not configured'");
        }
    });

    it('.env.example documents the E2E credential keys with empty values', () => {
        const example = readFileSync(join(__dirname, '..', '..', '.env.example'), 'utf8');
        expect(example).toMatch(/^E2E_ADMIN_EMAIL=$/m);
        expect(example).toMatch(/^E2E_ADMIN_PASSWORD=$/m);
    });
});
