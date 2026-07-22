/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Tests for the cryptographic attestation layer.
 *
 * Covers:
 *   • Canonical JSON: key ordering, undefined drops, non-finite rejection.
 *   • Merkle tree: empty, single, even, odd-leaf level reductions.
 *   • Key management: env-seed determinism, ephemeral fallback,
 *     hex vs base64 vs base64url seed accepting, length validation.
 *   • createAttestation / verifyAttestation: roundtrip success, tamper
 *     detection across every field, deterministic with stable key.
 *   • Standalone verifier: emits a valid ESM script.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createHash, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
    ATTESTATION_VERSION,
    ATTESTATION_SPEC,
    ATTESTATION_ALGORITHM,
    canonicalJson,
    computeMerkleRoot,
    createAttestation,
    getAttestationPublicKey,
    renderStandaloneVerifier,
    resetAttestationKeyForTesting,
    sha256Hex,
    verifyAttestation,
    type AttestationInput,
} from '../../src/core/attestation';

const STABLE_HEX_SEED = 'a'.repeat(64);
const STABLE_HEX_SEED_2 = 'b'.repeat(64);

function withSeed<T>(seed: string | undefined, fn: () => T): T {
    const prev = process.env.ARMAGEDDON_ATTESTATION_SEED;
    if (seed === undefined) {
        delete process.env.ARMAGEDDON_ATTESTATION_SEED;
    } else {
        process.env.ARMAGEDDON_ATTESTATION_SEED = seed;
    }
    resetAttestationKeyForTesting();
    try {
        return fn();
    } finally {
        if (prev === undefined) {
            delete process.env.ARMAGEDDON_ATTESTATION_SEED;
        } else {
            process.env.ARMAGEDDON_ATTESTATION_SEED = prev;
        }
        resetAttestationKeyForTesting();
    }
}

function mkInput(overrides: Partial<AttestationInput> = {}): AttestationInput {
    return {
        runId: 'run-fixture',
        issuedAt: '2026-05-17T08:00:00.000Z',
        verdict: 'CERTIFIED',
        score: 95,
        grade: 'A',
        seed: 12345,
        mode: 'TEST_MODE',
        targetUrl: 'https://example.com',
        batteries: [
            {
                batteryId: 'B1_CHAOS_STRESS',
                status: 'PASSED',
                iterations: 100,
                blockedCount: 0,
                breachCount: 0,
                driftScore: 0,
                duration: 500,
                details: { mode: 'sim' },
            },
            {
                batteryId: 'B10_GOAL_HIJACK',
                status: 'FAILED',
                iterations: 50,
                blockedCount: 40,
                breachCount: 10,
                driftScore: 0.5,
                duration: 200,
                details: {},
            },
        ],
        ...overrides,
    };
}

describe('attestation: canonicalJson', () => {
    it('sorts object keys lexicographically', () => {
        const out = canonicalJson({ b: 1, a: 2, c: { y: 1, x: 2 } });
        expect(out).toBe('{"a":2,"b":1,"c":{"x":2,"y":1}}');
    });

    it('drops undefined properties (matches JSON.stringify semantics)', () => {
        expect(canonicalJson({ a: 1, b: undefined })).toBe('{"a":1}');
    });

    it('handles primitives and null', () => {
        expect(canonicalJson(null)).toBe('null');
        expect(canonicalJson(true)).toBe('true');
        expect(canonicalJson(false)).toBe('false');
        expect(canonicalJson('hi')).toBe('"hi"');
        expect(canonicalJson(0)).toBe('0');
    });

    it('preserves array order', () => {
        expect(canonicalJson([3, 1, 2])).toBe('[3,1,2]');
    });

    it('rejects non-finite numbers', () => {
        expect(() => canonicalJson(Number.NaN)).toThrow(/non-finite/);
        expect(() => canonicalJson(Number.POSITIVE_INFINITY)).toThrow(/non-finite/);
        expect(() => canonicalJson(Number.NEGATIVE_INFINITY)).toThrow(/non-finite/);
    });

    it('rejects bigints', () => {
        expect(() => canonicalJson(1n)).toThrow(/bigint/);
    });
});

describe('attestation: computeMerkleRoot', () => {
    it('hashes empty input to sha256 of empty buffer', () => {
        const empty = sha256Hex(Buffer.alloc(0));
        expect(computeMerkleRoot([])).toBe(empty);
    });

    it('returns a deterministic root for the same leaves', () => {
        const root1 = computeMerkleRoot(['a', 'b', 'c']);
        const root2 = computeMerkleRoot(['a', 'b', 'c']);
        expect(root1).toBe(root2);
    });

    it('differs when leaves change', () => {
        expect(computeMerkleRoot(['a', 'b'])).not.toBe(computeMerkleRoot(['a', 'c']));
    });

    it('uses domain separation: leaf hash != node hash of same bytes', () => {
        // RFC 6962 prevents second-preimage: hashing "a" as a leaf yields
        // a different result than hashing it as an internal node payload.
        const onlyLeaf = computeMerkleRoot(['a']);
        const rawSha = sha256Hex(Buffer.from('a'));
        expect(onlyLeaf).not.toBe(rawSha);
    });

    it('handles odd levels by duplicating the trailing leaf', () => {
        // 3 leaves: should produce a stable, reproducible root.
        const r3 = computeMerkleRoot(['x', 'y', 'z']);
        expect(r3).toMatch(/^[0-9a-f]{64}$/);
        // changing trailing element changes root
        expect(computeMerkleRoot(['x', 'y', 'w'])).not.toBe(r3);
    });
});

describe('attestation: key management', () => {
    afterEach(() => resetAttestationKeyForTesting());

    it('derives a stable public key from a hex seed', () => {
        const a = withSeed(STABLE_HEX_SEED, getAttestationPublicKey);
        const b = withSeed(STABLE_HEX_SEED, getAttestationPublicKey);
        expect(a.publicKey).toBe(b.publicKey);
        expect(a.keyId).toBe(b.keyId);
        expect(a.source).toBe('env');
        expect(a.keyId).toMatch(/^[0-9a-f]{16}$/);
        expect(Buffer.from(a.publicKey, 'base64')).toHaveLength(32);
    });

    it('derives a different key from a different seed', () => {
        const a = withSeed(STABLE_HEX_SEED, getAttestationPublicKey);
        const b = withSeed(STABLE_HEX_SEED_2, getAttestationPublicKey);
        expect(a.publicKey).not.toBe(b.publicKey);
        expect(a.keyId).not.toBe(b.keyId);
    });

    it('accepts base64 seeds', () => {
        const seedB64 = randomBytes(32).toString('base64');
        const out = withSeed(seedB64, getAttestationPublicKey);
        expect(out.source).toBe('env');
    });

    it('accepts base64url seeds', () => {
        const seedB64url = randomBytes(32).toString('base64url');
        const out = withSeed(seedB64url, getAttestationPublicKey);
        expect(out.source).toBe('env');
    });

    it('rejects seeds of wrong length', () => {
        expect(() => withSeed('deadbeef', getAttestationPublicKey)).toThrow(/length|hex|base64/);
    });

    it('falls back to ephemeral key when no seed is configured', () => {
        const out = withSeed(undefined, getAttestationPublicKey);
        expect(out.source).toBe('ephemeral');
        expect(out.publicKey).not.toBe('');
        expect(out.keyId).toMatch(/^[0-9a-f]{16}$/);
    });

    it('keyId is SHA-256(rawPubKey).slice(0,16)', () => {
        const out = withSeed(STABLE_HEX_SEED, getAttestationPublicKey);
        const rawPub = Buffer.from(out.publicKey, 'base64');
        const expectedKid = createHash('sha256').update(rawPub).digest('hex').slice(0, 16);
        expect(out.keyId).toBe(expectedKid);
    });
});

function detailsLeafFor(details: Record<string, unknown>): string {
    const att = createAttestation(
        mkInput({ batteries: [{
            batteryId: 'BX_NORMALIZE',
            status: 'PASSED',
            iterations: 1,
            blockedCount: 0,
            breachCount: 0,
            driftScore: 0,
            duration: 0,
            details,
        }] }),
    );
    return att.leaves[1].hash; // META is leaves[0]
}

describe('attestation: details normalization (JSON-equivalent semantics)', () => {
    // The signer must see the exact same battery `details` shape that the
    // verifier reconstructs from the published `report.json`. These tests
    // pin the explicit normalizer to JSON-roundtrip semantics so any drift
    // is caught at unit-test time, not at signature-validation time.
    afterEach(() => resetAttestationKeyForTesting());

    it('produces a deterministic leaf hash for structurally-equal inputs', () => {
        withSeed(STABLE_HEX_SEED, () => {
            const a = detailsLeafFor({ a: 1, b: 'x', c: true, d: [1, 2], e: { nested: 'y' } });
            const b = detailsLeafFor({ a: 1, b: 'x', c: true, d: [1, 2], e: { nested: 'y' } });
            expect(a).toBe(b);
        });
    });

    it('drops undefined properties (matches JSON.stringify)', () => {
        withSeed(STABLE_HEX_SEED, () => {
            const withUndef = detailsLeafFor({ a: 1, b: undefined });
            const without = detailsLeafFor({ a: 1 });
            expect(withUndef).toBe(without);
        });
    });

    it('coerces non-finite numbers to null (matches JSON.stringify)', () => {
        withSeed(STABLE_HEX_SEED, () => {
            const fromNaN = detailsLeafFor({ value: Number.NaN });
            const fromNull = detailsLeafFor({ value: null });
            expect(fromNaN).toBe(fromNull);
            expect(detailsLeafFor({ value: Number.POSITIVE_INFINITY })).toBe(fromNull);
            expect(detailsLeafFor({ value: Number.NEGATIVE_INFINITY })).toBe(fromNull);
        });
    });

    it('replaces undefined/function/symbol in arrays with null', () => {
        withSeed(STABLE_HEX_SEED, () => {
            const fromUndef = detailsLeafFor({ arr: [1, undefined, 3] });
            const fromNull = detailsLeafFor({ arr: [1, null, 3] });
            expect(fromUndef).toBe(fromNull);
        });
    });

    it('rejects bigints (no JSON representation)', () => {
        withSeed(STABLE_HEX_SEED, () => {
            expect(() => detailsLeafFor({ big: 1n })).toThrow(/bigint/);
        });
    });
});

describe('attestation: createAttestation/verifyAttestation', () => {
    afterEach(() => resetAttestationKeyForTesting());

    it('round-trips successfully with a stable seed', () => {
        withSeed(STABLE_HEX_SEED, () => {
            const input = mkInput();
            const a = createAttestation(input);
            expect(a.algorithm).toBe(ATTESTATION_ALGORITHM);
            expect(a.spec).toBe(ATTESTATION_SPEC);
            expect(a.version).toBe(ATTESTATION_VERSION);
            expect(a.leaves).toHaveLength(1 + input.batteries.length);
            expect(a.leaves[0].id).toBe('META');
            expect(verifyAttestation(a, input)).toEqual({ valid: true });
        });
    });

    it('is deterministic: same input + same seed → same attestation', () => {
        withSeed(STABLE_HEX_SEED, () => {
            const input = mkInput();
            const a = createAttestation(input);
            const b = createAttestation(input);
            expect(b).toEqual(a);
        });
    });

    it('detects tampering: changed battery status', () => {
        withSeed(STABLE_HEX_SEED, () => {
            const input = mkInput();
            const a = createAttestation(input);
            const tampered: AttestationInput = {
                ...input,
                batteries: input.batteries.map((b, i) =>
                    i === 1 ? { ...b, status: 'PASSED' } : b
                ),
            };
            expect(verifyAttestation(a, tampered).valid).toBe(false);
            expect(verifyAttestation(a, tampered).reason).toBe('MERKLE_MISMATCH');
        });
    });

    it('detects tampering: changed score', () => {
        withSeed(STABLE_HEX_SEED, () => {
            const input = mkInput();
            const a = createAttestation(input);
            expect(verifyAttestation(a, { ...input, score: 100 }).valid).toBe(false);
        });
    });

    it('detects tampering: changed runId', () => {
        withSeed(STABLE_HEX_SEED, () => {
            const input = mkInput();
            const a = createAttestation(input);
            expect(verifyAttestation(a, { ...input, runId: 'other' }).valid).toBe(false);
        });
    });

    it('detects tampering: forged signature', () => {
        withSeed(STABLE_HEX_SEED, () => {
            const input = mkInput();
            const a = createAttestation(input);
            const forged = {
                ...a,
                signature: Buffer.alloc(64, 0xff).toString('base64'),
            };
            const result = verifyAttestation(forged, input);
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('SIGNATURE_INVALID');
        });
    });

    it('detects tampering: swapped public key', () => {
        const inputA = mkInput();
        const a = withSeed(STABLE_HEX_SEED, () => createAttestation(inputA));
        const otherPub = withSeed(STABLE_HEX_SEED_2, getAttestationPublicKey).publicKey;
        const forged = { ...a, publicKey: otherPub };
        const result = verifyAttestation(forged, inputA);
        expect(result.valid).toBe(false);
        // Either signature fails or key-pin fails depending on path.
        expect(['SIGNATURE_INVALID', 'KEY_MISMATCH']).toContain(result.reason);
    });

    it('enforces expected-public-key pin when supplied', () => {
        withSeed(STABLE_HEX_SEED, () => {
            const input = mkInput();
            const a = createAttestation(input);
            const wrongPin = Buffer.alloc(32, 0x11).toString('base64');
            expect(verifyAttestation(a, input, wrongPin).reason).toBe('KEY_MISMATCH');
            expect(verifyAttestation(a, input, a.publicKey).valid).toBe(true);
        });
    });

    it('rejects malformed attestations early', () => {
        const r = verifyAttestation({} as unknown as Parameters<typeof verifyAttestation>[0], mkInput());
        expect(r.reason).toBe('BAD_SHAPE');
    });

    it('rejects unsupported algorithm/spec', () => {
        withSeed(STABLE_HEX_SEED, () => {
            const input = mkInput();
            const a = createAttestation(input);
            expect(verifyAttestation({ ...a, algorithm: 'rsa' as never }, input).reason).toBe('UNSUPPORTED_ALGORITHM');
            expect(verifyAttestation({ ...a, spec: 'foo/9.9' }, input).reason).toBe('UNSUPPORTED_SPEC');
        });
    });

    it('handles empty batteries array (META leaf only)', () => {
        withSeed(STABLE_HEX_SEED, () => {
            const input = mkInput({ batteries: [] });
            const a = createAttestation(input);
            expect(a.leaves).toHaveLength(1);
            expect(verifyAttestation(a, input).valid).toBe(true);
        });
    });

    it('binds attestation to runId — cannot replay across runs', () => {
        withSeed(STABLE_HEX_SEED, () => {
            const inputA = mkInput({ runId: 'run-A' });
            const inputB = mkInput({ runId: 'run-B' });
            const attA = createAttestation(inputA);
            // attA cannot validate inputB even though all batteries match.
            expect(verifyAttestation(attA, inputB).valid).toBe(false);
        });
    });
});

/**
 * Build the same `report.json` shape that EvidenceGenerator emits, so the
 * verifier exercises the published surface. Accepts an `overrides` map for
 * negative tests that need to mutate a published field after signing.
 */
function buildPublishedReport(
    input: AttestationInput,
    attestation: ReturnType<typeof createAttestation>,
    overrides: Partial<{ score: number }> = {},
): Record<string, unknown> {
    return {
        run_id: input.runId,
        timestamp: input.issuedAt,
        chaos_seed: input.seed,
        mode: input.mode,
        target_url: input.targetUrl,
        verdict: input.verdict,
        score: overrides.score ?? input.score,
        grade: input.grade,
        batteries: input.batteries.map(b => ({
            full_id: b.batteryId,
            status: b.status,
            tests_run: b.iterations,
            blocked: b.blockedCount,
            breaches: b.breachCount,
            drift_score: b.driftScore,
            duration_ms: b.duration,
            metrics: b.details,
        })),
        attestation,
    };
}

/**
 * Stage `report.json` + `verify.mjs` in a temp dir and return both paths.
 */
function stageVerifierBundle(
    tmp: string,
    publishedReport: Record<string, unknown>,
): { reportPath: string; verifyPath: string } {
    const reportPath = join(tmp, 'report.json');
    const verifyPath = join(tmp, 'verify.mjs');
    writeFileSync(reportPath, JSON.stringify(publishedReport, null, 2));
    writeFileSync(verifyPath, renderStandaloneVerifier());
    return { reportPath, verifyPath };
}

/**
 * Run the standalone verifier with optional CLI args. Returns the captured
 * exit code, stdout, and stderr — never throws.
 */
function runVerifier(
    verifyPath: string,
    reportPath: string,
    extraArgs: string[] = [],
): { exitCode: number; stdout: string; stderr: string } {
    try {
        const stdout = execFileSync(
            process.execPath,
            [verifyPath, reportPath, ...extraArgs],
            { encoding: 'utf8' },
        );
        return { exitCode: 0, stdout, stderr: '' };
    } catch (e) {
        const err = e as { status: number; stderr: string; stdout: string };
        return { exitCode: err.status, stdout: err.stdout, stderr: err.stderr };
    }
}

describe('attestation: standalone verifier script', () => {
    let tmp: string;

    beforeEach(() => {
        tmp = mkdtempSync(join(tmpdir(), 'armageddon-attest-'));
    });

    afterEach(() => {
        rmSync(tmp, { recursive: true, force: true });
        resetAttestationKeyForTesting();
    });

    it('emits a Node-runnable ESM script', () => {
        const script = renderStandaloneVerifier();
        expect(script).toContain('node:crypto');
        expect(script).toContain('ARMAGEDDON ATTESTATION VERIFIER');
        expect(script).toContain('SPEC = \'armageddon-attestation/1.0\'');
        expect(script).toContain('Usage: node verify.mjs <report.json>');
    });

    it('verifier accepts a real signed report (end-to-end exec)', () => {
        withSeed(STABLE_HEX_SEED, () => {
            const input = mkInput();
            const attestation = createAttestation(input);
            const published = buildPublishedReport(input, attestation);
            const { reportPath, verifyPath } = stageVerifierBundle(tmp, published);

            const { exitCode, stdout } = runVerifier(verifyPath, reportPath);
            expect(exitCode).toBe(0);
            expect(stdout).toContain('[VALID]');
            expect(stdout).toContain(input.runId);
            expect(stdout).toContain(attestation.merkleRoot);
        });
    });

    it('verifier rejects a tampered report (exit code 1)', () => {
        withSeed(STABLE_HEX_SEED, () => {
            const input = mkInput();
            const attestation = createAttestation(input);
            const published = buildPublishedReport(input, attestation, { score: 100 });
            const { reportPath, verifyPath } = stageVerifierBundle(tmp, published);

            const { exitCode, stderr } = runVerifier(verifyPath, reportPath);
            expect(exitCode).toBe(1);
            expect(stderr).toContain('[INVALID]');
        });
    });

    it('verifier honours --pubkey pin (rejects mismatch)', () => {
        withSeed(STABLE_HEX_SEED, () => {
            const input = mkInput();
            const attestation = createAttestation(input);
            const published = buildPublishedReport(input, attestation);
            const { reportPath, verifyPath } = stageVerifierBundle(tmp, published);
            const wrongPub = Buffer.alloc(32, 0x42).toString('base64');

            const { exitCode, stderr } = runVerifier(verifyPath, reportPath, ['--pubkey', wrongPub]);
            expect(exitCode).toBe(1);
            expect(stderr).toContain('KEY_MISMATCH');
        });
    });
});
