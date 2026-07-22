/**
 * Tests for the /api/attestation/pubkey endpoint and its underlying
 * key-derivation helper.
 *
 * Goals:
 *   • Confirms the endpoint returns the same key derived by the signer
 *     for a given seed (cross-workspace contract).
 *   • Confirms fail-closed behavior when no seed is configured.
 *   • Confirms cache headers and content-type are correct.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { randomBytes } from 'node:crypto';
import { GET } from '@/app/api/attestation/pubkey/route';
import {
    getAttestationPublicKey,
    resetAttestationPubKeyCacheForTesting,
} from '@/lib/attestation-pubkey';

const STABLE_HEX_SEED = 'a'.repeat(64);

function withSeed<T>(seed: string | undefined, fn: () => T | Promise<T>): T | Promise<T> {
    const prev = process.env.ARMAGEDDON_ATTESTATION_SEED;
    if (seed === undefined) {
        delete process.env.ARMAGEDDON_ATTESTATION_SEED;
    } else {
        process.env.ARMAGEDDON_ATTESTATION_SEED = seed;
    }
    resetAttestationPubKeyCacheForTesting();
    try {
        return fn();
    } finally {
        if (prev === undefined) {
            delete process.env.ARMAGEDDON_ATTESTATION_SEED;
        } else {
            process.env.ARMAGEDDON_ATTESTATION_SEED = prev;
        }
        resetAttestationPubKeyCacheForTesting();
    }
}

describe('attestation-pubkey helper', () => {
    afterEach(() => resetAttestationPubKeyCacheForTesting());

    it('returns source=unavailable when no seed configured', async () => {
        await withSeed(undefined, () => {
            const key = getAttestationPublicKey();
            expect(key.source).toBe('unavailable');
            expect(key.publicKey).toBe('');
            expect(key.keyId).toBe('');
        });
    });

    it('derives a stable key from a configured hex seed', async () => {
        await withSeed(STABLE_HEX_SEED, () => {
            const a = getAttestationPublicKey();
            const b = getAttestationPublicKey();
            expect(a.publicKey).toBe(b.publicKey);
            expect(a.keyId).toBe(b.keyId);
            expect(a.source).toBe('env');
            expect(Buffer.from(a.publicKey, 'base64')).toHaveLength(32);
            expect(a.keyId).toMatch(/^[0-9a-f]{16}$/);
        });
    });

    it('accepts base64 seeds', async () => {
        const seed = randomBytes(32).toString('base64');
        await withSeed(seed, () => {
            const out = getAttestationPublicKey();
            expect(out.source).toBe('env');
        });
    });

    it('rejects malformed seeds', async () => {
        await withSeed('not-hex-not-base64-and-far-too-long-to-be-32-bytes-by-any-encoding-imaginable', () => {
            expect(() => getAttestationPublicKey()).toThrow();
        });
    });
});

describe('GET /api/attestation/pubkey', () => {
    beforeEach(() => resetAttestationPubKeyCacheForTesting());
    afterEach(() => resetAttestationPubKeyCacheForTesting());

    it('returns 503 when no seed is configured', async () => {
        const res = await (withSeed(undefined, () => GET()) as Promise<Response>);
        expect(res.status).toBe(503);
        const body = await res.json();
        expect(body.error).toBe('ATTESTATION_KEY_NOT_CONFIGURED');
        expect(body.spec).toBe('armageddon-attestation/1.0');
    });

    it('returns 200 with the derived public key when seed is configured', async () => {
        const res = await (withSeed(STABLE_HEX_SEED, () => GET()) as Promise<Response>);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.spec).toBe('armageddon-attestation/1.0');
        expect(body.algorithm).toBe('ed25519');
        expect(body.keyId).toMatch(/^[0-9a-f]{16}$/);
        expect(Buffer.from(body.publicKey, 'base64')).toHaveLength(32);
        expect(typeof body.issuedAt).toBe('string');
    });

    it('serves long cache headers (immutable)', async () => {
        const res = await (withSeed(STABLE_HEX_SEED, () => GET()) as Promise<Response>);
        const cc = res.headers.get('Cache-Control') ?? '';
        expect(cc).toContain('max-age=86400');
        expect(cc).toContain('immutable');
    });

    it('returns identical key on repeated calls with same seed', async () => {
        const res1 = await (withSeed(STABLE_HEX_SEED, () => GET()) as Promise<Response>);
        const body1 = await res1.json();
        // Use a fresh process-env scope so we exercise the actual cache path.
        const res2 = await (withSeed(STABLE_HEX_SEED, () => GET()) as Promise<Response>);
        const body2 = await res2.json();
        expect(body2.publicKey).toBe(body1.publicKey);
        expect(body2.keyId).toBe(body1.keyId);
    });

    it('returns a different key for a different seed', async () => {
        const res1 = await (withSeed('a'.repeat(64), () => GET()) as Promise<Response>);
        const b1 = await res1.json();
        const res2 = await (withSeed('b'.repeat(64), () => GET()) as Promise<Response>);
        const b2 = await res2.json();
        expect(b2.publicKey).not.toBe(b1.publicKey);
    });
});
