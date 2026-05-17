// armageddon-site/src/lib/attestation-pubkey.ts
// Public-key derivation for the Armageddon Attestation Layer.
//
// Thin wrapper around `@armageddon/shared`'s attestation-key primitives.
// Keeping the seed decoding + key derivation in one shared module is what
// guarantees the site's published verification key matches what the signer
// emits — if either side ever forked the formula, the third-party verifier
// would fail and trust would silently break.
//
// This wrapper adds environment-variable wiring and a small per-process
// cache; it deliberately drops the private key returned by the shared
// derivation so it never reaches the browser-facing API surface.

import {
    ATTESTATION_ALGORITHM,
    ATTESTATION_SPEC,
    decodeSeed,
    deriveAttestationKeyMaterial,
} from '@armageddon/shared/attestation-key';

export { ATTESTATION_ALGORITHM, ATTESTATION_SPEC };

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

    const km = deriveAttestationKeyMaterial(decodeSeed(envSeed));

    cached = {
        keyId: km.keyId,
        publicKey: km.publicKeyB64,
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
