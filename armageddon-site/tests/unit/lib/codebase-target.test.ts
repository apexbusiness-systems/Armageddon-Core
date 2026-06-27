import { describe, expect, it } from 'vitest';
import {
    canStartRunForTarget,
    createRepositoryTarget,
    createZipArchiveTarget,
    parseCodebaseTarget,
    targetSummary,
    validateRepositoryUrl,
} from '@/lib/codebase-target';

describe('codebase target helpers', () => {
    it('validates empty and malformed repository URLs', () => {
        expect(validateRepositoryUrl('')).toBe('Repository URL is required.');
        expect(validateRepositoryUrl('not-a-repo')).toBe('Enter an HTTPS, SSH, or git repository URL.');
        expect(validateRepositoryUrl('https://github.com/acme/app.git')).toBeNull();
        expect(validateRepositoryUrl('git@github.com:acme/app.git')).toBeNull();
    });

    it('creates durable repository target state', () => {
        const target = createRepositoryTarget(' https://github.com/acme/app.git ', 'Checkout API');
        expect(target.kind).toBe('repository');
        expect(target.status).toBe('local-only');
        expect(target.repositoryUrl).toBe('https://github.com/acme/app.git');
        expect(parseCodebaseTarget(JSON.stringify(target))).toEqual(target);
        expect(targetSummary(target)).toContain('Checkout API');
    });

    it('blocks zip execution while preserving local metadata', () => {
        const target = createZipArchiveTarget({ name: 'app.zip', size: 2048, type: 'application/zip' }, 'Zip app');
        expect(target.status).toBe('backend-required');
        expect(targetSummary(target)).toContain('local metadata only');
        expect(canStartRunForTarget(target)).toEqual({
            ok: false,
            reason: 'Zip archive analysis is blocked until real archive storage and ingestion are connected. Only local file metadata is saved.',
        });
    });
});
