/**
 * Regression shield for the 2026-07-06 Level 7 live-sequence outage.
 *
 * Root cause: handleMeOrganizations returned a hard-coded mock membership
 * ('apex-corporate-org-id') for the admin account. That non-UUID id flowed
 * into POST /api/run and every armageddon_runs insert failed (Postgres 22P02
 * uuid parse) → opaque 500 "Failed to create run record."
 *
 * These tests lock the three layers of the fix:
 *  1. No fabricated organization ids anywhere in the worker source.
 *  2. /api/attestation/pubkey is routed at the edge (the Next.js route is
 *     unreachable on the static-export deployment) and the edge seed decoder
 *     matches the shared derivation contract.
 *  3. Insert failures surface a sanitized dbCode for diagnosability.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { decodeAttestationSeedEdge } from '../../src/intake-handler';

const workerSrc = readFileSync(join(__dirname, '..', '..', 'src', 'intake-handler.ts'), 'utf8');
const orgRouteSrc = readFileSync(
    join(__dirname, '..', '..', 'src', 'app', 'api', 'me', 'organizations', 'route.ts'),
    'utf8',
);

describe('worker run-path integrity', () => {
    it('never fabricates organization ids (root cause of the /api/run 500)', () => {
        for (const src of [workerSrc, orgRouteSrc]) {
            expect(src).not.toContain('apex-corporate-org-id');
            expect(src).not.toMatch(/mockMemberships/);
        }
    });

    it('validates organizationId as a UUID before the armageddon_runs insert', () => {
        expect(workerSrc).toContain('organizationId must be a valid UUID.');
    });

    it('surfaces a sanitized dbCode when the run insert fails', () => {
        // Client gets the fixed message + a short code, never the raw DB body.
        expect(workerSrc).toMatch(/error: 'Failed to create run record\.', dbCode/);
        // The raw insertError may only appear in a server-side console.error log,
        // never inside a jsonResponse body returned to the caller.
        expect(workerSrc).not.toMatch(/jsonResponse\([^;]*\binsertError\b/);
    });

    it('routes /api/attestation/pubkey at the edge', () => {
        expect(workerSrc).toContain("case '/api/attestation/pubkey':");
    });


    it('persists targetEndpoint from edge /api/run into pending run config', () => {
        expect(workerSrc).toContain('targetEndpoint: string | null');
        expect(workerSrc).toContain('targetEndpoint && !isAllowedTargetEndpoint(targetEndpoint)');
        expect(workerSrc).toContain('targetModel: defaultTargetModel(tier), targetEndpoint');
        expect(workerSrc).toContain('input.targetEndpoint');
    });
});

describe('edge attestation seed decoder (parity with @armageddon/shared)', () => {
    const hexSeed = 'ab'.repeat(32);

    it('decodes 64-char hex to 32 bytes', () => {
        const out = decodeAttestationSeedEdge(hexSeed);
        expect(out).toHaveLength(32);
        expect(out[0]).toBe(0xab);
    });

    it('decodes base64 and base64url to identical bytes', () => {
        const bytes = Uint8Array.from({ length: 32 }, (_, i) => i);
        const b64 = Buffer.from(bytes).toString('base64');
        const b64url = Buffer.from(bytes).toString('base64url');
        expect(Array.from(decodeAttestationSeedEdge(b64))).toEqual(Array.from(bytes));
        expect(Array.from(decodeAttestationSeedEdge(b64url))).toEqual(Array.from(bytes));
    });

    it('fails closed on malformed or wrong-length seeds', () => {
        expect(() => decodeAttestationSeedEdge('not-a-seed!')).toThrow();
        expect(() => decodeAttestationSeedEdge(Buffer.alloc(16).toString('base64'))).toThrow();
        expect(() => decodeAttestationSeedEdge('')).toThrow();
    });

    it('matches the shared decodeSeed byte-for-byte on the same input', async () => {
        const shared = await import('../../../packages/shared/src/attestation-key');
        const seed = Buffer.from(Uint8Array.from({ length: 32 }, (_, i) => 255 - i)).toString('base64');
        expect(Array.from(decodeAttestationSeedEdge(seed))).toEqual(Array.from(shared.decodeSeed(seed)));
    });
});
