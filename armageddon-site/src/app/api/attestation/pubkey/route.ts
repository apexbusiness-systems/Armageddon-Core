/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARMAGEDDON ATTESTATION — PUBLIC KEY ENDPOINT
 *
 * GET /api/attestation/pubkey
 *
 * Publishes the Ed25519 verification key used to sign Armageddon
 * certification receipts. Third parties (auditors, procurement officers,
 * customers) fetch this once and pin it to verify any number of certificates
 * fully offline via the bundled `verify.mjs` script.
 *
 * Returns `503 Service Unavailable` if no signing seed is configured —
 * never synthesizes a key that the signer would not actually use. This
 * fail-closed behavior preserves audit integrity.
 *
 * Response shape (200):
 *   {
 *     "spec":      "armageddon-attestation/1.0",
 *     "algorithm": "ed25519",
 *     "keyId":     "<16-hex-chars>",
 *     "publicKey": "<base64 32-byte raw Ed25519 public key>",
 *     "issuedAt":  "<ISO-8601 UTC>"
 *   }
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { NextResponse } from 'next/server';
import { getAttestationPublicKey } from '@/lib/attestation-pubkey';

// Force the Node.js runtime so `node:crypto` (Ed25519) is available.
// The Edge runtime does not expose the Ed25519 KeyObject APIs we need.
export const runtime = 'nodejs';

// Cache for a day — the public key only changes when the signing seed is
// rotated, which is an explicit operator action.
const CACHE_HEADERS = {
    'Cache-Control': 'public, max-age=86400, s-maxage=86400, immutable',
    'Content-Type': 'application/json; charset=utf-8',
} as const;

export async function GET(): Promise<NextResponse> {
    try {
        const key = getAttestationPublicKey();
        if (key.source !== 'env') {
            return NextResponse.json(
                {
                    error: 'ATTESTATION_KEY_NOT_CONFIGURED',
                    message: 'Set ARMAGEDDON_ATTESTATION_SEED to publish a stable verification key.',
                    spec: key.spec,
                    algorithm: key.algorithm,
                },
                { status: 503 }
            );
        }

        return NextResponse.json(
            {
                spec: key.spec,
                algorithm: key.algorithm,
                keyId: key.keyId,
                publicKey: key.publicKey,
                issuedAt: new Date().toISOString(),
            },
            { status: 200, headers: CACHE_HEADERS }
        );
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json(
            {
                error: 'ATTESTATION_KEY_DERIVATION_FAILED',
                message,
            },
            { status: 500 }
        );
    }
}
