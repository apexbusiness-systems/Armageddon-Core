import * as crypto from 'node:crypto';
// src/core/evidence-generator.ts
// ARMAGEDDON LEVEL 7 - EVIDENCE GENERATOR
// APEX Business Systems Ltd.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { ArmageddonReport } from '../temporal/activities';
import {
    Attestation,
    AttestationInput,
    createAttestation,
    renderStandaloneVerifier,
} from './attestation';

export interface EvidenceOptions {
    seed: number;
    mode: string;
    targetUrl?: string;
}

const LEGAL_DISCLAIMER = `
Legal Disclaimer:
Armageddon is designed for controlled sandbox and
authorized non-production testing and does not
guarantee breach prevention. Certification reflects
results of the tested build/configuration at time
of run.

Issued by: APEX Business Systems Ltd.
`;

const LEGAL_HEADER_MD = `> **Legal Notice:** This certification is valid only for the specific build, configuration, and environment tested at the time of this run. It does not constitute SOC 2, ISO, or compliance certification, nor does it guarantee breach prevention.`;

export class EvidenceGenerator {
    private readonly report: ArmageddonReport;
    private readonly runId: string;
    private readonly options: EvidenceOptions;
    private cachedAttestation: Attestation | null = null;

    constructor(report: ArmageddonReport, runId: string, options: EvidenceOptions) {
        this.report = report;
        this.runId = runId;
        this.options = options;
    }

    private computeVerdict(): 'CERTIFIED' | 'FAILED' {
        return (this.report.status === 'COMPLETED' || this.report.status === 'PASSED') && this.report.score >= 90
            ? 'CERTIFIED'
            : 'FAILED';
    }

    private buildAttestationInput(): AttestationInput {
        return {
            runId: this.runId,
            issuedAt: this.report.meta.timestamp,
            verdict: this.computeVerdict(),
            score: this.report.score,
            grade: this.report.grade,
            seed: this.options.seed,
            mode: this.options.mode,
            targetUrl: this.options.targetUrl,
            batteries: this.report.batteries.map(b => ({
                batteryId: b.batteryId,
                status: b.status,
                iterations: b.iterations,
                blockedCount: b.blockedCount,
                breachCount: b.breachCount,
                driftScore: b.driftScore,
                duration: b.duration,
                details: b.details,
            })),
        };
    }

    /**
     * Build (or reuse) the cryptographic attestation for this report.
     * Deterministic: same report + same signing key → same attestation.
     */
    public getAttestation(): Attestation {
        this.cachedAttestation ??= createAttestation(this.buildAttestationInput());
        return this.cachedAttestation;
    }

    private parseBatteryId(fullId: string): { id: number; name: string } {
        // Format: "B1_CHAOS_STRESS" -> id: 1, name: "Chaos Stress"
        // Format: "B10_GOAL_HIJACK" -> id: 10, name: "Goal Hijack"
        const match = /^B(\d+)_(.+)$/.exec(fullId);
        if (match) {
            return {
                id: Number.parseInt(match[1], 10),
                name: match[2].replaceAll('_', ' ').replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase())
            };
        }
        return { id: 0, name: fullId };
    }

    public generateReportJson(): string {
        const verdict = this.computeVerdict();
        const attestation = this.getAttestation();

        const fullReport = {
            run_id: this.runId,
            timestamp: this.report.meta.timestamp,
            chaos_seed: this.options.seed,
            mode: this.options.mode,
            target_url: this.options.targetUrl,
            verdict: verdict,
            score: this.report.score,
            grade: this.report.grade,
            batteries: this.report.batteries.map(b => {
                const { id, name } = this.parseBatteryId(b.batteryId);
                return {
                    id,
                    name,
                    full_id: b.batteryId,
                    status: b.status,
                    duration_ms: b.duration,
                    tests_run: b.iterations,
                    blocked: b.blockedCount,
                    breaches: b.breachCount,
                    drift_score: b.driftScore,
                    metrics: b.details
                };
            }),
            attestation,
            legal_notice: LEGAL_HEADER_MD.replace('> ', '')
        };
        return JSON.stringify(fullReport, null, 2);
    }

    public generateAttestationJson(): string {
        return JSON.stringify(this.getAttestation(), null, 2);
    }

    public generateReportMd(): string {
        const verdict = this.computeVerdict();
        const date = new Date(this.report.meta.timestamp).toUTCString();
        const attestation = this.getAttestation();

        let md = `# ARMAGEDDON LEVEL 7 CERTIFICATION REPORT\n\n`;
        md += `${LEGAL_HEADER_MD}\n\n`;

        md += `## Executive Summary\n\n`;
        md += `- **Run ID:** \`${this.runId}\`\n`;
        md += `- **Date:** ${date}\n`;
        md += `- **Verdict:** **${verdict}** (Grade: ${this.report.grade})\n`;
        md += `- **Score:** ${this.report.score}/100\n`;
        md += `- **Mode:** ${this.options.mode}\n`;
        md += `- **Seed:** ${this.options.seed}\n`;
        if (this.options.targetUrl) md += `- **Target:** ${this.options.targetUrl}\n`;

        md += `\n## Tamper-Evident Attestation\n\n`;
        md += `> Verify offline: \`node verify.mjs report.json\`\n\n`;
        md += `- **Spec:** \`${attestation.spec}\`\n`;
        md += `- **Algorithm:** \`${attestation.algorithm}\`\n`;
        md += `- **Chain ID:** \`${attestation.chainId}\`\n`;
        md += `- **Key ID:** \`${attestation.keyId}\`\n`;
        md += `- **Merkle Root:** \`${attestation.merkleRoot}\`\n`;
        md += `- **Digest:** \`${attestation.digest}\`\n`;

        md += `\n## Battery Results\n\n`;
        md += `| ID | Battery Name | Status | Duration | Iterations | Blocked | Breaches |\n`;
        md += `|----|--------------|--------|----------|------------|---------|----------|\n`;

        for (const b of this.report.batteries) {
            const { id, name } = this.parseBatteryId(b.batteryId);
            const statusIcon = b.status === 'PASSED' ? '✅' : '❌';
            md += `| ${id} | ${name} | ${statusIcon} ${b.status} | ${b.duration}ms | ${b.iterations} | ${b.blockedCount} | ${b.breachCount} |\n`;
        }

        md += `\n## Detailed Findings\n\n`;
        for (const b of this.report.batteries) {
            if (b.status === 'FAILED' || b.breachCount > 0) {
                 const { name } = this.parseBatteryId(b.batteryId);
                 md += `### ${name} (${b.status})\n`;
                 md += `**Details:**\n\`\`\`json\n${JSON.stringify(b.details, null, 2)}\n\`\`\`\n\n`;
            }
        }

        md += `\n---\n*Generated by Armageddon Engine v1.0*\n`;
        return md;
    }

    public generateCertificateTxt(): string {
        const verdict = this.computeVerdict();
        const attestation = this.getAttestation();
        const passedCount = this.report.batteries.filter(b => b.status === 'PASSED').length;
        const failedCount = this.report.batteries.filter(b => b.status === 'FAILED').length;

        // Calculate God Mode stats (B10-B13)
        const godModeBatteries = this.report.batteries.filter(b =>
            ['B10','B11','B12','B13','B14'].some(prefix => b.batteryId.startsWith(prefix))
        );
        const totalAttacks = godModeBatteries.reduce((sum, b) => sum + b.iterations, 0);
        const totalEscapes = godModeBatteries.reduce((sum, b) => sum + b.breachCount, 0);
        const escapeRate = totalAttacks > 0 ? (totalEscapes / totalAttacks * 100).toFixed(4) : '0.0000';

        // Expiry date (90 days)
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 90);

        return `============================================
  ARMAGEDDON TEST SUITE CERTIFICATION
  ${verdict}
============================================

Run ID:       ${this.runId}
Timestamp:    ${this.report.meta.timestamp}
Mode:         ${this.options.mode}
Chaos Seed:   ${this.options.seed}

RESULTS:
  Total Batteries:      ${this.report.batteries.length}
  Passed:               ${passedCount}
  Failed:               ${failedCount}
  Aggregate Score:      ${this.report.score}/100

Level 7 God Mode:
  Total Attacks:        ${totalAttacks}
  Escapes:              ${totalEscapes}
  Escape Rate:          ${escapeRate}%
  Threshold:            0.01%
  Status:               ${verdict}

VERDICT: ${verdict}

Tamper-Evident Attestation:
  Spec:               ${attestation.spec}
  Algorithm:          ${attestation.algorithm}
  Chain ID:           ${attestation.chainId}
  Key ID:             ${attestation.keyId}
  Merkle Root:        ${attestation.merkleRoot}
  Digest:             ${attestation.digest}
  Verify offline:     node verify.mjs report.json

${LEGAL_DISCLAIMER}

Certification ID: ${this.runId.substring(0, 8).toUpperCase()}
Valid Until:      ${expiryDate.toISOString().split('T')[0]}

Issued by: APEX Business Systems Ltd.
============================================`;
    }

    public generateJunitXml(): string {
        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        xml += `<testsuites name="Armageddon Certification" time="${this.report.meta.duration / 1000}">\n`;

        for (const b of this.report.batteries) {
            const { name } = this.parseBatteryId(b.batteryId);
            const time = b.duration / 1000;
            const failures = b.status === 'FAILED' ? 1 : 0;

            xml += `  <testsuite name="${name}" tests="${b.iterations}" failures="${failures}" time="${time}">\n`;

            if (b.status === 'PASSED') {
                 xml += `    <testcase name="${name} Execution" time="${time}"/>\n`;
            } else {
                 xml += `    <testcase name="${name} Execution" time="${time}">\n`;
                 xml += `      <failure message="Battery Failed">Blocked: ${b.blockedCount}, Breaches: ${b.breachCount}</failure>\n`;
                 xml += `    </testcase>\n`;
            }
            xml += `  </testsuite>\n`;
        }

        xml += `</testsuites>`;
        return xml;
    }


    public generateManifest(reportJson: string, reportMd: string): string {
        const jsonHash = crypto.createHash('sha256').update(reportJson).digest('hex');
        const mdHash = crypto.createHash('sha256').update(reportMd).digest('hex');

        // Lightweight AIBOM
        let aibom = {};
        try {
            const pkgPath = path.resolve(__dirname, '../../../package.json');
            if (fs.existsSync(pkgPath)) {
                const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
                aibom = {
                    version: pkg.version,
                    dependencies: {
                        typescript: pkg.devDependencies?.typescript,
                        temporalio: pkg.dependencies?.['@temporalio/client'],
                        supabase: pkg.dependencies?.['@supabase/supabase-js']
                    }
                };
            }
        } catch {
            aibom = { error: 'Failed to read package.json' };
        }

        const attestation = this.getAttestation();
        const manifest = {
            run_id: this.runId,
            timestamp: new Date().toISOString(),
            seed: this.options.seed,
            mode: this.options.mode,
            environment: process.env.NODE_ENV || 'development',
            sandbox_tenant: process.env.SANDBOX_TENANT || 'unknown',
            hashes: {
                report_json: jsonHash,
                report_md: mdHash
            },
            attestation: {
                spec: attestation.spec,
                algorithm: attestation.algorithm,
                chainId: attestation.chainId,
                keyId: attestation.keyId,
                publicKey: attestation.publicKey,
                merkleRoot: attestation.merkleRoot,
                digest: attestation.digest,
            },
            aibom
        };

        return JSON.stringify(manifest, null, 2);
    }

    public async saveTo(outputDir: string): Promise<void> {
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const evidenceDir = path.join(outputDir, 'evidence');
        if (!fs.existsSync(evidenceDir)) {
            fs.mkdirSync(evidenceDir, { recursive: true });
        }


        const jsonContent = this.generateReportJson();
        const mdContent = this.generateReportMd();

        fs.writeFileSync(path.join(outputDir, 'report.json'), jsonContent);
        fs.writeFileSync(path.join(outputDir, 'report.md'), mdContent);
        fs.writeFileSync(path.join(outputDir, 'certificate.txt'), this.generateCertificateTxt());
        fs.writeFileSync(path.join(outputDir, 'junit.xml'), this.generateJunitXml());
        fs.writeFileSync(path.join(outputDir, 'manifest.json'), this.generateManifest(jsonContent, mdContent));
        fs.writeFileSync(path.join(outputDir, 'attestation.json'), this.generateAttestationJson());
        fs.writeFileSync(path.join(outputDir, 'verify.mjs'), renderStandaloneVerifier(), { mode: 0o755 });


        // Create per-battery logs (stubbed for now, using details)
        for (const b of this.report.batteries) {
             const { id } = this.parseBatteryId(b.batteryId);
             const logContent = `[${new Date().toISOString()}] BATTERY ${id} STARTED\n` +
                                `[${new Date().toISOString()}] CONFIG: ${JSON.stringify(b.details)}\n` +
                                `[${new Date().toISOString()}] STATUS: ${b.status}\n`;
             fs.writeFileSync(path.join(evidenceDir, `battery-${id}.log`), logContent);
        }
    }
}
