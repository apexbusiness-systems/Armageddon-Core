// src/core/attestation.ts
// ARMAGEDDON LEVEL 8 — CRYPTOGRAPHIC ATTESTATION LAYER
// APEX Business Systems Ltd.
//
// Provides tamper-evident, offline-verifiable certification receipts using:
//   • Ed25519 detached signatures (Node built-in `node:crypto`, zero new deps)
//   • RFC 6962-style Merkle audit tree (SHA-256, domain-separated leaves/nodes)
//   • RFC 8785-inspired canonical JSON serialization for deterministic digests
//
// Compliance alignment: EU AI Act Article 12 (Aug 2026), CAP-SRP v1.0,
// RFC 6962 (Certificate Transparency), NIST AI RMF, SLSA in-toto.
//
// INVARIANTS:
//   1. Same input report → same Merkle root → same signature (deterministic).
//   2. Signing key is never persisted to disk by this module; the seed
//      lives only in process memory (env var) or is generated ephemerally.
//   3. Output artifacts contain only the PUBLIC key — never the private seed.
//   4. Verification requires zero external dependencies — pure Node `crypto`.

import {
    createHash,
    createPublicKey,
    sign as cryptoSign,
    verify as cryptoVerify,
    randomBytes,
    KeyObject,
} from 'node:crypto';
import {
    ATTESTATION_ALGORITHM as SHARED_ATTESTATION_ALGORITHM,
    ATTESTATION_HASH as SHARED_ATTESTATION_HASH,
    ATTESTATION_SPEC as SHARED_ATTESTATION_SPEC,
    ATTESTATION_VERSION as SHARED_ATTESTATION_VERSION,
    AttestationKeyMaterial as SharedAttestationKeyMaterial,
    decodeSeed,
    deriveAttestationKeyMaterial,
} from '@armageddon/shared/attestation-key';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

export const ATTESTATION_VERSION = SHARED_ATTESTATION_VERSION;
export const ATTESTATION_ALGORITHM = SHARED_ATTESTATION_ALGORITHM;
export const ATTESTATION_HASH = SHARED_ATTESTATION_HASH;
export const ATTESTATION_SPEC = SHARED_ATTESTATION_SPEC;

// RFC 6962 domain-separation prefixes for Merkle tree leaves and interior nodes.
// Prevents second-preimage attacks across leaf/node namespaces.
const LEAF_PREFIX = Buffer.from([0x00]);
const NODE_PREFIX = Buffer.from([0x01]);

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A single leaf of the Merkle audit tree. Each battery result contributes
 * one leaf, in deterministic order.
 */
export interface MerkleLeaf {
    /** Stable identifier (e.g. `B10_GOAL_HIJACK` or `META`). */
    readonly id: string;
    /** Lowercase hex SHA-256 of the canonical leaf payload. */
    readonly hash: string;
}

/**
 * The attestation block embedded in every certified Armageddon report.
 * Designed to be self-contained: a verifier only needs this object and the
 * report digest input to re-derive the proof.
 */
export interface Attestation {
    /** Spec version (semver, e.g. `1.0`). */
    readonly version: string;
    /** Stable spec identifier consumers can pin to. */
    readonly spec: string;
    /** Signing algorithm (`ed25519`). */
    readonly algorithm: typeof ATTESTATION_ALGORITHM;
    /** Hash algorithm used for Merkle and digest (`sha256`). */
    readonly hash: typeof ATTESTATION_HASH;
    /** ISO-8601 UTC timestamp of the signing operation. */
    readonly issuedAt: string;
    /** Stable identifier of the signing chain (`armageddon:<keyId>`). */
    readonly chainId: string;
    /** Short, stable identifier for the public key (hex of SHA-256(pubkey)[0..16]). */
    readonly keyId: string;
    /** Base64-encoded raw 32-byte Ed25519 public key. */
    readonly publicKey: string;
    /** Lowercase hex SHA-256 Merkle root over all leaves. */
    readonly merkleRoot: string;
    /** Lowercase hex SHA-256 of the canonical report digest input. */
    readonly digest: string;
    /** Base64-encoded Ed25519 signature over the digest input bytes. */
    readonly signature: string;
    /** Ordered list of Merkle leaves (battery contributions + META). */
    readonly leaves: ReadonlyArray<MerkleLeaf>;
}

// ═══════════════════════════════════════════════════════════════════════════
// CANONICAL JSON (RFC 8785-inspired, scoped to JSON values we emit)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Canonicalize a JSON-compatible value into a deterministic byte string.
 *
 * Rules:
 *   • Object keys are sorted lexicographically (UTF-16 code-unit order).
 *   • `undefined` properties are dropped (same semantics as `JSON.stringify`).
 *   • `null`, booleans, strings, and finite numbers serialize via JSON.
 *   • Non-finite numbers (NaN, ±Infinity) are rejected to prevent ambiguity.
 *   • Arrays preserve order.
 *
 * This intentionally rejects unrepresentable inputs rather than silently
 * coercing them — APEX-POWER: "Never Guess."
 */
export function canonicalJson(value: unknown): string {
    return serializeCanonical(value);
}

/**
 * Pure UTF-16 code-unit ordering. Equivalent to the default `Array#sort`
 * behavior on strings but expressed explicitly so callers (and SonarCloud)
 * can see we are intentionally NOT using locale-dependent ordering.
 */
function codeUnitCompare(a: string, b: string): number {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
}

function serializeCanonical(value: unknown): string {
    if (value === null) return 'null';

    const type = typeof value;

    if (type === 'string') {
        return JSON.stringify(value);
    }
    if (type === 'boolean') {
        return value ? 'true' : 'false';
    }
    if (type === 'number') {
        // Inside this branch `typeof value === 'number'` so the cast is
        // narrowing, not a type-erasing assertion.
        const num = value as number;
        if (!Number.isFinite(num)) {
            throw new TypeError(`canonicalJson: non-finite number is not representable (${num})`);
        }
        return JSON.stringify(num);
    }
    if (type === 'bigint') {
        // BigInts have no canonical JSON form; reject explicitly.
        throw new TypeError('canonicalJson: bigint values are not supported');
    }
    if (Array.isArray(value)) {
        const parts = value.map(serializeCanonical);
        return `[${parts.join(',')}]`;
    }
    if (type === 'object') {
        const obj = value as Record<string, unknown>;
        // RFC 8785 requires UTF-16 code-unit lexicographic ordering of keys.
        // We deliberately do NOT use `localeCompare` here: locale-dependent
        // ordering would make the signature non-portable across runtimes.
        const keys = Object.keys(obj)
            .filter(k => obj[k] !== undefined)
            .sort(codeUnitCompare);
        const parts = keys.map(k => `${JSON.stringify(k)}:${serializeCanonical(obj[k])}`);
        return `{${parts.join(',')}}`;
    }

    // `undefined`, `symbol`, `function` — match JSON.stringify (skip in objects,
    // null in arrays). The array/object paths already handle these.
    return 'null';
}

// ═══════════════════════════════════════════════════════════════════════════
// HASHING & MERKLE TREE
// ═══════════════════════════════════════════════════════════════════════════

export function sha256Hex(input: string | Buffer): string {
    return createHash('sha256').update(input).digest('hex');
}

function leafHash(payload: string): Buffer {
    return createHash('sha256').update(LEAF_PREFIX).update(payload).digest();
}

function nodeHash(left: Buffer, right: Buffer): Buffer {
    return createHash('sha256').update(NODE_PREFIX).update(left).update(right).digest();
}

/**
 * Compute the RFC 6962-style Merkle root over an ordered list of canonical
 * leaf payloads. Domain-separation prefixes (`0x00` for leaves, `0x01` for
 * nodes) prevent second-preimage attacks.
 *
 * For an odd-count level, the trailing element is duplicated (Bitcoin style)
 * which is functionally equivalent for our fixed-shape inputs and keeps the
 * verifier implementation trivial.
 *
 * @returns lowercase hex SHA-256 of the root, or the SHA-256 of an empty
 *          buffer when there are zero leaves.
 */
export function computeMerkleRoot(leafPayloads: ReadonlyArray<string>): string {
    if (leafPayloads.length === 0) {
        return sha256Hex(Buffer.alloc(0));
    }

    let level: Buffer[] = leafPayloads.map(leafHash);

    while (level.length > 1) {
        const next: Buffer[] = [];
        for (let i = 0; i < level.length; i += 2) {
            const left = level[i];
            const right = i + 1 < level.length ? level[i + 1] : level[i];
            next.push(nodeHash(left, right));
        }
        level = next;
    }

    return level[0].toString('hex');
}

// ═══════════════════════════════════════════════════════════════════════════
// KEY MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

interface AttestationKeyMaterial extends SharedAttestationKeyMaterial {
    source: 'env' | 'ephemeral';
}

let cachedKeyMaterial: AttestationKeyMaterial | null = null;

function buildKeyMaterial(seed: Buffer, source: 'env' | 'ephemeral'): AttestationKeyMaterial {
    return {
        ...deriveAttestationKeyMaterial(seed),
        source,
    };
}

function loadKeyMaterial(): AttestationKeyMaterial {
    if (cachedKeyMaterial) return cachedKeyMaterial;

    const envSeed = process.env.ARMAGEDDON_ATTESTATION_SEED;
    if (envSeed && envSeed.trim().length > 0) {
        cachedKeyMaterial = buildKeyMaterial(decodeSeed(envSeed), 'env');
        return cachedKeyMaterial;
    }

    // Ephemeral mode: generate a per-process key. Useful for local development
    // and CI where signature stability across processes is not required.
    // Operators MUST set ARMAGEDDON_ATTESTATION_SEED in production for stable
    // public-key publishing.
    cachedKeyMaterial = buildKeyMaterial(randomBytes(32), 'ephemeral');
    return cachedKeyMaterial;
}

/**
 * Reset cached key material. FOR TESTING ONLY.
 */
export function resetAttestationKeyForTesting(): void {
    cachedKeyMaterial = null;
}

/**
 * Returns the active public key information without exposing the private key.
 * Safe to call from API routes that publish the verification key.
 */
export function getAttestationPublicKey(): {
    keyId: string;
    publicKey: string;
    algorithm: typeof ATTESTATION_ALGORITHM;
    spec: typeof ATTESTATION_SPEC;
    source: 'env' | 'ephemeral';
} {
    const km = loadKeyMaterial();
    return {
        keyId: km.keyId,
        publicKey: km.publicKeyB64,
        algorithm: ATTESTATION_ALGORITHM,
        spec: ATTESTATION_SPEC,
        source: km.source,
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// ATTESTATION INPUT & SIGNING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Minimal shape required from a report to produce an attestation.
 * Intentionally decoupled from `ArmageddonReport` to avoid circular imports.
 */
export interface AttestationInput {
    runId: string;
    issuedAt: string;
    verdict: string;
    score: number;
    grade: string;
    seed: number | string;
    mode: string;
    targetUrl?: string;
    batteries: ReadonlyArray<{
        batteryId: string;
        status: string;
        iterations: number;
        blockedCount: number;
        breachCount: number;
        driftScore: number;
        duration: number;
        details?: Record<string, unknown>;
    }>;
}

/**
 * Recursively project a value onto the same shape that survives
 * `JSON.stringify` → `JSON.parse`. We must NOT use `structuredClone` here:
 * structuredClone preserves `undefined`, custom prototypes, and other
 * fields that the published `report.json` (which goes through JSON
 * serialization) does not carry — and the standalone verifier reads from
 * that JSON, so any divergence would invalidate every signature.
 *
 * Semantics (mirrors JSON.stringify):
 *   • `undefined` / function / symbol values: dropped in objects,
 *     converted to `null` in arrays.
 *   • Non-finite numbers (NaN, ±Infinity): coerced to `null`.
 *   • `bigint`: rejected — JSON cannot represent it.
 *   • Everything else: returned as-is (primitives) or recursively normalized.
 *
 * Implementing this explicitly (rather than `JSON.parse(JSON.stringify())`)
 * keeps the intent visible and avoids the indirect serialization round-trip.
 */
function jsonNormalizeValue(value: unknown): unknown {
    if (value === null) return null;
    const type = typeof value;
    if (type === 'string' || type === 'boolean') return value;
    if (type === 'number') {
        return Number.isFinite(value) ? value : null;
    }
    if (type === 'bigint') {
        throw new TypeError('jsonNormalizeValue: bigint values are not representable in JSON');
    }
    if (type === 'undefined' || type === 'function' || type === 'symbol') {
        return undefined; // marker — callers handle the array/object distinction
    }
    if (Array.isArray(value)) {
        return value.map(v => {
            const normalized = jsonNormalizeValue(v);
            return normalized === undefined ? null : normalized;
        });
    }
    if (type === 'object') {
        const obj = value as Record<string, unknown>;
        const out: Record<string, unknown> = {};
        for (const key of Object.keys(obj)) {
            const normalized = jsonNormalizeValue(obj[key]);
            if (normalized !== undefined) {
                out[key] = normalized;
            }
        }
        return out;
    }
    return undefined;
}

/**
 * Project battery `details` onto the JSON-equivalent shape the verifier sees
 * after reading the published `report.json`. See `jsonNormalizeValue` for
 * the exact semantics.
 */
function normalizeDetails(details: Record<string, unknown> | undefined): Record<string, unknown> {
    if (!details) return {};
    const normalized = jsonNormalizeValue(details);
    return (normalized && typeof normalized === 'object' && !Array.isArray(normalized))
        ? (normalized as Record<string, unknown>)
        : {};
}

/**
 * Build the deterministic leaf payload for a single battery. Anything that
 * influences the certification verdict is included; volatile fields
 * (timestamps inside `details`, free-form logs) are intentionally not
 * touched here — they live in the META leaf.
 */
function batteryLeafPayload(b: AttestationInput['batteries'][number]): string {
    return canonicalJson({
        batteryId: b.batteryId,
        status: b.status,
        iterations: b.iterations,
        blockedCount: b.blockedCount,
        breachCount: b.breachCount,
        driftScore: b.driftScore,
        duration: b.duration,
        details: normalizeDetails(b.details),
    });
}

/**
 * Build the META leaf binding the run-level identity to the tree. This makes
 * it impossible to replay a Merkle root from one run onto another run.
 */
function metaLeafPayload(input: AttestationInput): string {
    return canonicalJson({
        runId: input.runId,
        issuedAt: input.issuedAt,
        verdict: input.verdict,
        score: input.score,
        grade: input.grade,
        seed: input.seed,
        mode: input.mode,
        targetUrl: input.targetUrl ?? null,
        spec: ATTESTATION_SPEC,
    });
}

/**
 * Produce a tamper-evident attestation over a report.
 *
 * Deterministic for fixed inputs and a fixed key seed. The signature covers
 * a canonical JSON digest that binds: spec version, chain id, key id, run id,
 * issuedAt, and the Merkle root — so swapping any of these invalidates it.
 */
export function createAttestation(input: AttestationInput): Attestation {
    const km = loadKeyMaterial();

    const leafPayloads: string[] = [];
    const leaves: MerkleLeaf[] = [];

    const metaPayload = metaLeafPayload(input);
    leafPayloads.push(metaPayload);
    leaves.push({ id: 'META', hash: sha256Hex(metaPayload) });

    for (const battery of input.batteries) {
        const payload = batteryLeafPayload(battery);
        leafPayloads.push(payload);
        leaves.push({ id: battery.batteryId, hash: sha256Hex(payload) });
    }

    const merkleRoot = computeMerkleRoot(leafPayloads);
    const chainId = `armageddon:${km.keyId}`;

    const digestInput = canonicalJson({
        spec: ATTESTATION_SPEC,
        version: ATTESTATION_VERSION,
        algorithm: ATTESTATION_ALGORITHM,
        hash: ATTESTATION_HASH,
        chainId,
        keyId: km.keyId,
        runId: input.runId,
        issuedAt: input.issuedAt,
        merkleRoot,
    });

    const digestInputBytes = Buffer.from(digestInput, 'utf8');
    const digest = sha256Hex(digestInputBytes);

    // Ed25519 signs over the message directly (no pre-hash).
    const signature = cryptoSign(null, digestInputBytes, km.privateKey).toString('base64');

    return {
        version: ATTESTATION_VERSION,
        spec: ATTESTATION_SPEC,
        algorithm: ATTESTATION_ALGORITHM,
        hash: ATTESTATION_HASH,
        issuedAt: input.issuedAt,
        chainId,
        keyId: km.keyId,
        publicKey: km.publicKeyB64,
        merkleRoot,
        digest,
        signature,
        leaves,
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════

export type VerificationFailureCode =
    | 'BAD_SHAPE'
    | 'UNSUPPORTED_ALGORITHM'
    | 'UNSUPPORTED_SPEC'
    | 'MERKLE_MISMATCH'
    | 'DIGEST_MISMATCH'
    | 'SIGNATURE_INVALID'
    | 'KEY_MISMATCH';

export interface VerificationResult {
    valid: boolean;
    reason?: VerificationFailureCode;
    detail?: string;
}

/**
 * Re-derive the Merkle root and signature digest from an attestation +
 * the same `AttestationInput` and verify both match. Returns
 * `{ valid: true }` only if every check passes.
 *
 * `expectedPublicKey`, when provided, must equal `attestation.publicKey`.
 * This lets verifiers pin the key out-of-band (e.g. fetched from
 * `/api/attestation/pubkey`) instead of trusting the key embedded in the
 * report.
 */
export function verifyAttestation(
    attestation: Attestation,
    input: AttestationInput,
    expectedPublicKey?: string,
): VerificationResult {
    if (
        !attestation
        || typeof attestation !== 'object'
        || typeof attestation.signature !== 'string'
        || typeof attestation.publicKey !== 'string'
        || typeof attestation.merkleRoot !== 'string'
    ) {
        return { valid: false, reason: 'BAD_SHAPE', detail: 'Attestation is missing required fields' };
    }

    if (attestation.algorithm !== ATTESTATION_ALGORITHM) {
        return { valid: false, reason: 'UNSUPPORTED_ALGORITHM', detail: attestation.algorithm };
    }

    if (attestation.spec !== ATTESTATION_SPEC) {
        return { valid: false, reason: 'UNSUPPORTED_SPEC', detail: attestation.spec };
    }

    if (expectedPublicKey && expectedPublicKey !== attestation.publicKey) {
        return { valid: false, reason: 'KEY_MISMATCH' };
    }

    // 1. Re-derive Merkle root.
    const leafPayloads: string[] = [metaLeafPayload(input)];
    for (const battery of input.batteries) {
        leafPayloads.push(batteryLeafPayload(battery));
    }
    const recomputedRoot = computeMerkleRoot(leafPayloads);
    if (recomputedRoot !== attestation.merkleRoot) {
        return { valid: false, reason: 'MERKLE_MISMATCH', detail: `expected ${recomputedRoot}` };
    }

    // 2. Re-derive digest input and confirm.
    const digestInput = canonicalJson({
        spec: ATTESTATION_SPEC,
        version: ATTESTATION_VERSION,
        algorithm: ATTESTATION_ALGORITHM,
        hash: ATTESTATION_HASH,
        chainId: attestation.chainId,
        keyId: attestation.keyId,
        runId: input.runId,
        issuedAt: attestation.issuedAt,
        merkleRoot: attestation.merkleRoot,
    });
    const digestInputBytes = Buffer.from(digestInput, 'utf8');
    const recomputedDigest = sha256Hex(digestInputBytes);
    if (recomputedDigest !== attestation.digest) {
        return { valid: false, reason: 'DIGEST_MISMATCH' };
    }

    // 3. Verify Ed25519 signature.
    let signatureBytes: Buffer;
    let publicKeyBytes: Buffer;
    try {
        signatureBytes = Buffer.from(attestation.signature, 'base64');
        publicKeyBytes = Buffer.from(attestation.publicKey, 'base64');
    } catch {
        return { valid: false, reason: 'BAD_SHAPE', detail: 'signature or public key not base64' };
    }
    if (signatureBytes.length !== 64 || publicKeyBytes.length !== 32) {
        return { valid: false, reason: 'BAD_SHAPE', detail: 'unexpected signature or key length' };
    }

    let publicKeyObject: KeyObject;
    try {
        publicKeyObject = createPublicKey({
            key: {
                kty: 'OKP',
                crv: 'Ed25519',
                x: publicKeyBytes.toString('base64url'),
            } as Record<string, unknown>,
            format: 'jwk',
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { valid: false, reason: 'BAD_SHAPE', detail: `public key import failed: ${message}` };
    }

    const ok = cryptoVerify(null, digestInputBytes, publicKeyObject, signatureBytes);
    if (!ok) {
        return { valid: false, reason: 'SIGNATURE_INVALID' };
    }

    return { valid: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// SELF-CONTAINED VERIFIER SCRIPT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Render a stand-alone Node.js verifier script that depends only on
 * `node:crypto`. Shipping this alongside the certificate lets any third
 * party verify an Armageddon attestation offline with `node verify.mjs
 * <report.json>` — no npm install required.
 *
 * The script is intentionally short and readable so auditors can review
 * the full verification path themselves.
 */
export function renderStandaloneVerifier(): string {
    return `#!/usr/bin/env node
// ARMAGEDDON ATTESTATION VERIFIER (standalone, zero dependencies)
// Spec: ${ATTESTATION_SPEC}
// Usage: node verify.mjs <report.json> [--pubkey <base64>]
//
// Exit codes: 0 = VALID, 1 = INVALID, 2 = USAGE
import { readFileSync } from 'node:fs';
import { createHash, createPublicKey, verify as cryptoVerify } from 'node:crypto';

const SPEC = '${ATTESTATION_SPEC}';
const ALGORITHM = '${ATTESTATION_ALGORITHM}';
const LEAF = Buffer.from([0x00]);
const NODE = Buffer.from([0x01]);

function canonicalJson(value) {
    if (value === null) return 'null';
    const t = typeof value;
    if (t === 'string') return JSON.stringify(value);
    if (t === 'boolean') return value ? 'true' : 'false';
    if (t === 'number') {
        if (!Number.isFinite(value)) throw new Error('non-finite number');
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
    if (t === 'object') {
        const keys = Object.keys(value).filter(k => value[k] !== undefined).sort();
        return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalJson(value[k])).join(',') + '}';
    }
    return 'null';
}
function sha256Hex(b) { return createHash('sha256').update(b).digest('hex'); }
function leafHash(p) { return createHash('sha256').update(LEAF).update(p).digest(); }
function nodeHash(l, r) { return createHash('sha256').update(NODE).update(l).update(r).digest(); }
function merkleRoot(payloads) {
    if (payloads.length === 0) return sha256Hex(Buffer.alloc(0));
    let level = payloads.map(leafHash);
    while (level.length > 1) {
        const next = [];
        for (let i = 0; i < level.length; i += 2) {
            next.push(nodeHash(level[i], i + 1 < level.length ? level[i + 1] : level[i]));
        }
        level = next;
    }
    return level[0].toString('hex');
}
function fail(code, detail) {
    console.error('[INVALID]', code, detail || '');
    process.exit(1);
}

const args = process.argv.slice(2);
if (args.length < 1 || args[0] === '--help' || args[0] === '-h') {
    console.error('Usage: node verify.mjs <report.json> [--pubkey <base64>]');
    process.exit(2);
}
const reportPath = args[0];
let pinnedPubKey = null;
for (let i = 1; i < args.length; i++) {
    if (args[i] === '--pubkey' && args[i + 1]) pinnedPubKey = args[++i];
}

const report = JSON.parse(readFileSync(reportPath, 'utf8'));
const a = report.attestation;
if (!a) fail('BAD_SHAPE', 'no attestation block');
if (a.algorithm !== ALGORITHM) fail('UNSUPPORTED_ALGORITHM', a.algorithm);
if (a.spec !== SPEC) fail('UNSUPPORTED_SPEC', a.spec);
if (pinnedPubKey && pinnedPubKey !== a.publicKey) fail('KEY_MISMATCH');

const meta = {
    runId: report.run_id,
    issuedAt: a.issuedAt,
    verdict: report.verdict,
    score: report.score,
    grade: report.grade,
    seed: report.chaos_seed,
    mode: report.mode,
    targetUrl: report.target_url ?? null,
    spec: SPEC,
};
const leafPayloads = [canonicalJson(meta)];
for (const b of report.batteries) {
    leafPayloads.push(canonicalJson({
        batteryId: b.full_id,
        status: b.status,
        iterations: b.tests_run,
        blockedCount: b.blocked,
        breachCount: b.breaches,
        driftScore: b.drift_score,
        duration: b.duration_ms,
        details: b.metrics ?? {},
    }));
}
const root = merkleRoot(leafPayloads);
if (root !== a.merkleRoot) fail('MERKLE_MISMATCH', 'expected ' + root);

const digestInput = canonicalJson({
    spec: SPEC,
    version: a.version,
    algorithm: ALGORITHM,
    hash: 'sha256',
    chainId: a.chainId,
    keyId: a.keyId,
    runId: report.run_id,
    issuedAt: a.issuedAt,
    merkleRoot: a.merkleRoot,
});
const digestBytes = Buffer.from(digestInput, 'utf8');
if (sha256Hex(digestBytes) !== a.digest) fail('DIGEST_MISMATCH');

const pubKey = createPublicKey({
    key: { kty: 'OKP', crv: 'Ed25519', x: Buffer.from(a.publicKey, 'base64').toString('base64url') },
    format: 'jwk',
});
const sig = Buffer.from(a.signature, 'base64');
if (sig.length !== 64) fail('BAD_SHAPE', 'signature length');
const ok = cryptoVerify(null, digestBytes, pubKey, sig);
if (!ok) fail('SIGNATURE_INVALID');

console.log('[VALID]');
console.log('  run_id     ', report.run_id);
console.log('  verdict    ', report.verdict);
console.log('  keyId      ', a.keyId);
console.log('  merkleRoot ', a.merkleRoot);
console.log('  digest     ', a.digest);
process.exit(0);
`;
}
