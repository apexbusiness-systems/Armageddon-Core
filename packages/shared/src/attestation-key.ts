/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SHARED ATTESTATION KEY PRIMITIVES
 *
 * Single source of truth for Ed25519 attestation key derivation used by
 * both the signer (`armageddon-core`) and the public-key publisher
 * (`armageddon-site`). Keeping the seed decoder and the public-key
 * derivation in one workspace prevents drift: if either workspace ever
 * computed a different `keyId` than the other, the third-party verifier
 * would fail and trust would silently break.
 *
 * Depends only on Node `node:crypto` (built-in) so it stays usable inside
 * the Next.js Node-runtime API route without dragging Temporal/Supabase
 * transitive deps into the site bundle.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { createHash, createPrivateKey, createPublicKey, KeyObject } from 'node:crypto';

export const ATTESTATION_VERSION = '1.0' as const;
export const ATTESTATION_ALGORITHM = 'ed25519' as const;
export const ATTESTATION_HASH = 'sha256' as const;
export const ATTESTATION_SPEC = 'armageddon-attestation/1.0' as const;

/**
 * PKCS#8 DER prefix for raw 32-byte Ed25519 seed (RFC 8410 §7).
 * Wrapping a 32-byte seed with this prefix yields a complete PKCS#8
 * private-key encoding that `createPrivateKey` accepts.
 */
export const ED25519_PKCS8_PREFIX = Buffer.from([
    0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06,
    0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
]);

/**
 * Decode the configured attestation seed. Accepts:
 *   • 64 hex characters (32 bytes)
 *   • Base64 or base64url (32 bytes after decoding)
 *
 * Rejects every other shape so misconfiguration fails closed instead of
 * silently picking up a different key than expected.
 */
export function decodeSeed(envValue: string): Buffer {
    const trimmed = envValue.trim();

    if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
        return Buffer.from(trimmed, 'hex');
    }

    const b64 = trimmed
        .replaceAll('-', '+')
        .replaceAll('_', '/')
        .padEnd(Math.ceil(trimmed.length / 4) * 4, '=');

    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) {
        throw new Error('Invalid ARMAGEDDON_ATTESTATION_SEED: expected 32-byte hex or base64');
    }
    const decoded = Buffer.from(b64, 'base64');
    if (decoded.length !== 32) {
        throw new Error(`Invalid ARMAGEDDON_ATTESTATION_SEED length: expected 32 bytes, got ${decoded.length}`);
    }
    return decoded;
}

/**
 * Material derived from a single 32-byte seed.
 *
 * `privateKey` is returned only for callers that need to sign. Consumers
 * that should only publish the public key (e.g. the site's
 * `/api/attestation/pubkey` endpoint) can discard `privateKey` immediately
 * after construction.
 */
export interface AttestationKeyMaterial {
    privateKey: KeyObject;
    publicKey: KeyObject;
    publicKeyRaw: Buffer;
    publicKeyB64: string;
    keyId: string;
}

/**
 * Derive Ed25519 key material from a 32-byte seed. Pure function: the same
 * seed always yields the same `keyId` and `publicKeyB64`.
 */
export function deriveAttestationKeyMaterial(seed: Buffer): AttestationKeyMaterial {
    if (seed.length !== 32) {
        throw new Error(`Ed25519 seed must be 32 bytes (got ${seed.length})`);
    }
    const der = Buffer.concat([ED25519_PKCS8_PREFIX, seed]);
    const privateKey = createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
    const publicKey = createPublicKey(privateKey);
    const jwk = publicKey.export({ format: 'jwk' }) as { x?: string };
    if (!jwk.x) {
        throw new Error('Failed to derive Ed25519 public key (no JWK x parameter)');
    }
    // JWK `x` is base64url-encoded 32-byte raw public key. Normalize back to
    // strict base64 so the published form is round-trip stable.
    const rawBytes = Buffer.from(
        jwk.x
            .replaceAll('-', '+')
            .replaceAll('_', '/')
            .padEnd(Math.ceil(jwk.x.length / 4) * 4, '='),
        'base64',
    );
    const publicKeyB64 = rawBytes.toString('base64');
    const keyId = createHash('sha256').update(rawBytes).digest('hex').slice(0, 16);

    return {
        privateKey,
        publicKey,
        publicKeyRaw: rawBytes,
        publicKeyB64,
        keyId,
    };
}

/**
 * Public summary safe to surface to any consumer.
 */
export interface AttestationPublicKeySummary {
    keyId: string;
    publicKey: string;
    algorithm: typeof ATTESTATION_ALGORITHM;
    spec: typeof ATTESTATION_SPEC;
}

export function toPublicKeySummary(km: AttestationKeyMaterial): AttestationPublicKeySummary {
    return {
        keyId: km.keyId,
        publicKey: km.publicKeyB64,
        algorithm: ATTESTATION_ALGORITHM,
        spec: ATTESTATION_SPEC,
    };
}
