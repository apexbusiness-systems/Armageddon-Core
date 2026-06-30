import { describe, expect, it } from 'vitest';
import {
    canStartRunForTarget,
    createEndpointTarget,
    parseCodebaseTarget,
    targetSummary,
    validateTargetEndpointUrl,
} from '@/lib/codebase-target';

describe('target endpoint helpers', () => {
    it('validates empty and malformed target endpoint URLs', () => {
        expect(validateTargetEndpointUrl('')).toBe('Target endpoint or app URL is required.');
        expect(validateTargetEndpointUrl('not-a-url')).toBe('Enter an HTTPS target endpoint or deployed app URL.');
        expect(validateTargetEndpointUrl('git@github.com:acme/app.git')).toBe('Enter an HTTPS target endpoint or deployed app URL.');
        expect(validateTargetEndpointUrl('https://app.example.com')).toBeNull();
    });

    it('creates durable endpoint target state', () => {
        const target = createEndpointTarget(' https://app.example.com ', 'Checkout API');
        expect(target.kind).toBe('endpoint');
        expect(target.status).toBe('local-only');
        expect(target.endpointUrl).toBe('https://app.example.com');
        expect(parseCodebaseTarget(JSON.stringify(target))).toEqual(target);
        expect(targetSummary(target)).toContain('Checkout API');
    });

    it('normalizes legacy repository-shaped local drafts to endpoint targets', () => {
        const target = parseCodebaseTarget(JSON.stringify({ kind: 'repository', repositoryUrl: 'https://app.example.com', label: 'Legacy target' }));
        expect(target?.kind).toBe('endpoint');
        expect(target?.endpointUrl).toBe('https://app.example.com');
    });

    it('requires a configured target before runs can start', () => {
        expect(canStartRunForTarget(null)).toEqual({ ok: false, code: 'missing' });
    });

    it('flags an invalid saved target', () => {
        const target = { ...createEndpointTarget('https://app.example.com', 'Checkout API'), status: 'invalid' as const };
        expect(canStartRunForTarget(target)).toEqual({ ok: false, code: 'invalid' });
    });
});
