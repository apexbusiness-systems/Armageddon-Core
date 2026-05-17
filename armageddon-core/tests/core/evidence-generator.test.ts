import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { EvidenceGenerator, EvidenceOptions } from '../../src/core/evidence-generator';
import { ArmageddonReport } from '../../src/temporal/activities';
import {
    verifyAttestation,
    resetAttestationKeyForTesting,
    type AttestationInput,
} from '../../src/core/attestation';

// Mock fs module
vi.mock('node:fs', () => ({
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn()
}));

describe('EvidenceGenerator', () => {
    const mockReport: ArmageddonReport = {
        meta: {
            timestamp: '2023-01-01T00:00:00.000Z',
            duration: 1000
        },
        status: 'COMPLETED',
        grade: 'A',
        score: 95,
        batteries: [
            {
                batteryId: 'B1_CHAOS_STRESS',
                status: 'PASSED',
                iterations: 100,
                blockedCount: 0,
                breachCount: 0,
                driftScore: 0,
                duration: 500,
                details: { mode: 'test' }
            },
            {
                batteryId: 'B10_GOAL_HIJACK',
                status: 'FAILED',
                iterations: 50,
                blockedCount: 40,
                breachCount: 10,
                driftScore: 0.5,
                duration: 200,
                details: { errors: ['breach'] }
            }
        ]
    };

    const mockOptions: EvidenceOptions = {
        seed: 12345,
        mode: 'TEST_MODE',
        targetUrl: 'https://example.com'
    };

    let generator: EvidenceGenerator;

    beforeEach(() => {
        generator = new EvidenceGenerator(mockReport, 'test-run-id', mockOptions);
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('generateReportJson', () => {
        it('should generate valid JSON with correct structure', () => {
            const json = generator.generateReportJson();
            const parsed = JSON.parse(json);

            expect(parsed.run_id).toBe('test-run-id');
            expect(parsed.verdict).toBe('CERTIFIED'); // Score 95 >= 90
            expect(parsed.score).toBe(95);
            expect(parsed.batteries).toHaveLength(2);
            expect(parsed.batteries[0].name).toBe('Chaos Stress');
            expect(parsed.batteries[1].name).toBe('Goal Hijack');
            expect(parsed.chaos_seed).toBe(12345);
        });

        it('should return FAILED verdict if score is low', () => {
            const lowScoreReport = { ...mockReport, score: 80 };
            const lowScoreGen = new EvidenceGenerator(lowScoreReport, 'run-2', mockOptions);
            const json = lowScoreGen.generateReportJson();
            const parsed = JSON.parse(json);

            expect(parsed.verdict).toBe('FAILED');
        });
    });

    describe('generateReportMd', () => {
        it('should generate Markdown with correct headers and sections', () => {
            const md = generator.generateReportMd();

            expect(md).toContain('# ARMAGEDDON LEVEL 7 CERTIFICATION REPORT');
            expect(md).toContain('**Verdict:** **CERTIFIED**');
            expect(md).toContain('| 1 | Chaos Stress | ✅ PASSED |');
            expect(md).toContain('| 10 | Goal Hijack | ❌ FAILED |');
            expect(md).toContain('### Goal Hijack (FAILED)'); // Detailed findings for failed battery
        });
    });

    describe('generateCertificateTxt', () => {
        it('should generate plain text certificate with key details', () => {
            const txt = generator.generateCertificateTxt();

            expect(txt).toContain('ARMAGEDDON TEST SUITE CERTIFICATION');
            expect(txt).toContain('Run ID:       test-run-id');
            expect(txt).toContain('VERDICT: CERTIFIED');
            expect(txt).toContain('Passed:               1');
            expect(txt).toContain('Failed:               1');
        });
    });

    describe('generateJunitXml', () => {
        it('should generate valid JUnit XML structure', () => {
            const xml = generator.generateJunitXml();

            expect(xml).toContain('<testsuites name="Armageddon Certification"');
            expect(xml).toContain('<testsuite name="Chaos Stress" tests="100" failures="0"');
            expect(xml).toContain('<testsuite name="Goal Hijack" tests="50" failures="1"');
            expect(xml).toContain('<failure message="Battery Failed">Blocked: 40, Breaches: 10</failure>');
        });
    });

    describe('saveTo', () => {
        it('should create directories and write files', async () => {
            const outputDir = 'test-output';
            const evidenceDir = path.join(outputDir, 'evidence');

            await generator.saveTo(outputDir);

            // Verify directory creation
            expect(fs.mkdirSync).toHaveBeenCalledWith(outputDir, { recursive: true });
            expect(fs.mkdirSync).toHaveBeenCalledWith(evidenceDir, { recursive: true });

            // Verify file writing
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                path.join(outputDir, 'report.json'),
                expect.any(String)
            );
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                path.join(outputDir, 'report.md'),
                expect.any(String)
            );
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                path.join(outputDir, 'certificate.txt'),
                expect.any(String)
            );
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                path.join(outputDir, 'junit.xml'),
                expect.any(String)
            );

            // Verify attestation artifacts
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                path.join(outputDir, 'attestation.json'),
                expect.any(String)
            );
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                path.join(outputDir, 'verify.mjs'),
                expect.stringContaining('ARMAGEDDON ATTESTATION VERIFIER'),
                expect.objectContaining({ mode: 0o755 })
            );

            // Verify logs writing
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                path.join(evidenceDir, 'battery-1.log'),
                expect.stringContaining('BATTERY 1 STARTED')
            );
             expect(fs.writeFileSync).toHaveBeenCalledWith(
                path.join(evidenceDir, 'battery-10.log'),
                expect.stringContaining('BATTERY 10 STARTED')
            );
        });
    });

    describe('attestation integration', () => {
        const STABLE_HEX_SEED = 'a'.repeat(64);

        beforeEach(() => {
            process.env.ARMAGEDDON_ATTESTATION_SEED = STABLE_HEX_SEED;
            resetAttestationKeyForTesting();
        });

        afterEach(() => {
            delete process.env.ARMAGEDDON_ATTESTATION_SEED;
            resetAttestationKeyForTesting();
        });

        it('embeds an attestation block in report.json', () => {
            const gen = new EvidenceGenerator(mockReport, 'test-run-id', mockOptions);
            const parsed = JSON.parse(gen.generateReportJson());
            expect(parsed.attestation).toBeDefined();
            expect(parsed.attestation.algorithm).toBe('ed25519');
            expect(parsed.attestation.spec).toBe('armageddon-attestation/1.0');
            expect(parsed.attestation.merkleRoot).toMatch(/^[0-9a-f]{64}$/);
            expect(parsed.attestation.signature.length).toBeGreaterThan(0);
            expect(parsed.attestation.leaves.length).toBe(1 + mockReport.batteries.length);
        });

        it('produces a verifiable attestation when re-parsed from JSON', () => {
            const gen = new EvidenceGenerator(mockReport, 'test-run-id', mockOptions);
            const parsed = JSON.parse(gen.generateReportJson());

            // Rebuild the AttestationInput from the public JSON surface
            // exactly the way the standalone verify.mjs script would.
            const input: AttestationInput = {
                runId: parsed.run_id,
                issuedAt: parsed.attestation.issuedAt,
                verdict: parsed.verdict,
                score: parsed.score,
                grade: parsed.grade,
                seed: parsed.chaos_seed,
                mode: parsed.mode,
                targetUrl: parsed.target_url,
                batteries: parsed.batteries.map((b: Record<string, unknown>) => ({
                    batteryId: b.full_id as string,
                    status: b.status as string,
                    iterations: b.tests_run as number,
                    blockedCount: b.blocked as number,
                    breachCount: b.breaches as number,
                    driftScore: b.drift_score as number,
                    duration: b.duration_ms as number,
                    details: (b.metrics ?? {}) as Record<string, unknown>,
                })),
            };
            const result = verifyAttestation(parsed.attestation, input);
            expect(result).toEqual({ valid: true });
        });

        it('renders attestation details into certificate.txt', () => {
            const gen = new EvidenceGenerator(mockReport, 'test-run-id', mockOptions);
            const txt = gen.generateCertificateTxt();
            expect(txt).toContain('Tamper-Evident Attestation');
            expect(txt).toContain('armageddon-attestation/1.0');
            expect(txt).toContain('Merkle Root:');
            expect(txt).toMatch(/Digest:\s+[0-9a-f]{64}/);
            expect(txt).toContain('node verify.mjs report.json');
        });

        it('renders attestation summary into report.md', () => {
            const gen = new EvidenceGenerator(mockReport, 'test-run-id', mockOptions);
            const md = gen.generateReportMd();
            expect(md).toContain('## Tamper-Evident Attestation');
            expect(md).toContain('node verify.mjs report.json');
            expect(md).toContain('armageddon-attestation/1.0');
        });

        it('includes attestation summary in manifest.json', () => {
            const gen = new EvidenceGenerator(mockReport, 'test-run-id', mockOptions);
            const manifest = JSON.parse(gen.generateManifest('{}', '#'));
            expect(manifest.attestation).toBeDefined();
            expect(manifest.attestation.algorithm).toBe('ed25519');
            expect(manifest.attestation.merkleRoot).toMatch(/^[0-9a-f]{64}$/);
        });

        it('attestation is stable across multiple invocations (idempotent)', () => {
            const g1 = new EvidenceGenerator(mockReport, 'test-run-id', mockOptions);
            const g2 = new EvidenceGenerator(mockReport, 'test-run-id', mockOptions);
            const a1 = JSON.parse(g1.generateReportJson()).attestation;
            const a2 = JSON.parse(g2.generateReportJson()).attestation;
            expect(a2).toEqual(a1);
        });

        it('attestation changes when any verdict-relevant field changes', () => {
            const baseline = new EvidenceGenerator(mockReport, 'test-run-id', mockOptions);
            const bumped = new EvidenceGenerator(
                { ...mockReport, score: 99 },
                'test-run-id',
                mockOptions
            );
            const a1 = JSON.parse(baseline.generateReportJson()).attestation;
            const a2 = JSON.parse(bumped.generateReportJson()).attestation;
            expect(a2.merkleRoot).not.toBe(a1.merkleRoot);
            expect(a2.signature).not.toBe(a1.signature);
        });
    });
});
