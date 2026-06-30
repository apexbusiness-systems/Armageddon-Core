import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ACTIVE_UI_FILES = [
    'src/app/onboarding/page.tsx',
    'src/components/DestructionConsole.tsx',
    'src/components/TargetConfigPanel.tsx',
    'src/components/RunReadinessChecklist.tsx',
    'src/i18n/dictionaries/en.ts',
    'src/i18n/dictionaries/fr.ts',
    'src/i18n/dictionaries/de.ts',
    'src/i18n/dictionaries/it.ts',
    'src/i18n/dictionaries/es.ts',
    'src/i18n/dictionaries/zh-CN.ts',
    'src/i18n/dictionaries/pt.ts',
];

const FORBIDDEN_ACTIVE_COPY = [
    /Repository URL/i,
    /zip upload/i,
    /code analysis/i,
    /upload archive/i,
    /Zip archive/i,
];

describe('active target configuration copy', () => {
    it('does not claim repository, zip upload, or code analysis capabilities', () => {
        for (const file of ACTIVE_UI_FILES) {
            const source = readFileSync(join(process.cwd(), file), 'utf8');
            for (const pattern of FORBIDDEN_ACTIVE_COPY) {
                expect(source, `${file} should not contain ${pattern}`).not.toMatch(pattern);
            }
        }
    });
});
