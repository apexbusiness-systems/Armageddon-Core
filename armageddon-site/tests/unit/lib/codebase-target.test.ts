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
        expect(validateTargetEndpointUrl('not-a-url')).toBe('Enter an http(s) target endpoint or deployed app URL.');
        expect(validateTargetEndpointUrl('git@github.com:acme/app.git')).toBe('Enter an http(s) target endpoint or deployed app URL.');
        expect(validateTargetEndpointUrl('https://app.example.com')).toBeNull();
    });

    it('accepts both http and https (aligned with core safety policy) and rejects other protocols', () => {
        // Core policy (packages/core/src/core/safety.ts validateTarget) allows
        // http and https; local/http targets are a required testing case, so the
        // validator must not reject them.
        expect(validateTargetEndpointUrl('http://localhost:3000')).toBeNull();
        expect(validateTargetEndpointUrl('http://127.0.0.1:8080/health')).toBeNull();
        // Non-http(s) protocols are unsafe targets and must be rejected.
        expect(validateTargetEndpointUrl('ftp://files.example.com')).toBe('Enter an http(s) target endpoint or deployed app URL.');
        expect(validateTargetEndpointUrl('javascript:alert(1)')).toBe('Enter an http(s) target endpoint or deployed app URL.');
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
        expect(canStartRunForTarget(null)).toEqual({
            ok: false,
            reason: 'Configure the deployed app URL, API endpoint, or LLM/agent endpoint before starting a run.',
        });
    });
});
