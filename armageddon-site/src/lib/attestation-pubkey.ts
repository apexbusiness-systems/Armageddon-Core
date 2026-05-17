// armageddon-site/src/lib/attestation-pubkey.ts
// Public-key derivation for the Armageddon Attestation Layer.
//
// This module mirrors the key-derivation conventions defined in
// `armageddon-core/src/core/attestation.ts`. It deliberately depends on
// `node:crypto` only — no cross-workspace imports — so the site bundle stays
// free of Temporal/Supabase signer dependencies. The two implementations
// share an env var (`ARMAGEDDON_ATTESTATION_SEED`) and a key-id formula
// (`SHA-256(rawPubKey)[0..16]`); if either side ever drifts, the site
// publishes a key that does not match what the signer emits, and the
// attestation verifier surface fails closed.

import {
    createHash,
    createPrivateKey,
    createPublicKey,
} from 'node:crypto';

export const ATTESTATION_ALGORITHM = 'ed25519' as const;
export const ATTESTATION_SPEC = 'armageddon-attestation/1.0' as const;

const ED25519_PKCS8_PREFIX = Buffer.from([
    0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06,
    0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
]);

function decodeSeed(envValue: string): Buffer {
    const trimmed = envValue.trim();
    if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
        return Buffer.from(trimmed, 'hex');
    }
    const b64 = trimmed.replace(/-/g, '+').replace(/_/g, '/').padEnd(
        Math.ceil(trimmed.length / 4) * 4,
        '='
    );
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) {
        throw new Error('Invalid ARMAGEDDON_ATTESTATION_SEED: expected 32-byte hex or base64');
    }
    const decoded = Buffer.from(b64, 'base64');
    if (decoded.length !== 32) {
        throw new Error(`Invalid ARMAGEDDON_ATTESTATION_SEED length: expected 32 bytes, got ${decoded.length}`);
    }
    return decoded;
}

export interface AttestationPublicKey {
    keyId: string;
    publicKey: string;
    algorithm: typeof ATTESTATION_ALGORITHM;
    spec: typeof ATTESTATION_SPEC;
    source: 'env' | 'unavailable';
}

let cached: AttestationPublicKey | null = null;
let cachedSeed: string | undefined;

/**
 * Derive the attestation public key from the configured seed.
 * Returns `source: 'unavailable'` (with empty key fields) when no seed is
 * configured, so callers can serve an honest 404/503 instead of synthesizing
 * a key the signer will never use.
 */
export function getAttestationPublicKey(): AttestationPublicKey {
    const envSeed = process.env.ARMAGEDDON_ATTESTATION_SEED;
    if (!envSeed || envSeed.trim().length === 0) {
        return {
            keyId: '',
            publicKey: '',
            algorithm: ATTESTATION_ALGORITHM,
            spec: ATTESTATION_SPEC,
            source: 'unavailable',
        };
    }
    if (cached && cachedSeed === envSeed) {
        return cached;
    }

    const seed = decodeSeed(envSeed);
    const der = Buffer.concat([ED25519_PKCS8_PREFIX, seed]);
    const privateKey = createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
    const publicKey = createPublicKey(privateKey);
    const jwk = publicKey.export({ format: 'jwk' }) as { x?: string };
    if (!jwk.x) {
        throw new Error('Failed to derive Ed25519 public key (no JWK x parameter)');
    }
    const rawBytes = Buffer.from(jwk.x.replace(/-/g, '+').replace(/_/g, '/').padEnd(
        Math.ceil(jwk.x.length / 4) * 4,
        '='
    ), 'base64');
    const publicKeyB64 = rawBytes.toString('base64');
    const keyId = createHash('sha256').update(rawBytes).digest('hex').slice(0, 16);

    cached = {
        keyId,
        publicKey: publicKeyB64,
        algorithm: ATTESTATION_ALGORITHM,
        spec: ATTESTATION_SPEC,
        source: 'env',
    };
    cachedSeed = envSeed;
    return cached;
}

/**
 * Reset cached key material. FOR TESTING ONLY.
 */
export function resetAttestationPubKeyCacheForTesting(): void {
    cached = null;
    cachedSeed = undefined;
}
