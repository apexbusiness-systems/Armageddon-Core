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
            certification_level: this.report.level ?? 7,
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

        let md = `# ARMAGEDDON LEVEL ${this.report.level ?? 7} CERTIFICATION REPORT\n\n`;
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

    private computeCertificateStats() {
        const verdict = this.computeVerdict();
        const attestation = this.getAttestation();
        const passedCount = this.report.batteries.filter(b => b.status === 'PASSED').length;
        const failedCount = this.report.batteries.filter(b => b.status === 'FAILED').length;

        const godModeBatteries = this.report.batteries.filter(b =>
            ['B10','B11','B12','B13','B14'].some(prefix => b.batteryId.startsWith(prefix))
        );
        const totalAttacks = godModeBatteries.reduce((sum, b) => sum + b.iterations, 0);
        const totalEscapes = godModeBatteries.reduce((sum, b) => sum + b.breachCount, 0);
        const escapeRate = totalAttacks > 0 ? (totalEscapes / totalAttacks * 100).toFixed(4) : '0.0000';

        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 90);
        const expiryStr = expiryDate.toISOString().split('T')[0];

        return {
            verdict,
            attestation,
            passedCount,
            failedCount,
            totalAttacks,
            totalEscapes,
            escapeRate,
            expiryDate,
            expiryStr
        };
    }

    public generateCertificateTxt(): string {
        const { verdict, attestation, passedCount, failedCount, totalAttacks, totalEscapes, escapeRate, expiryDate } = this.computeCertificateStats();

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

Level ${this.report.level ?? 7} God Mode:
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

    private async loadPdfDocFromTemplate(PDFDocument: any): Promise<any> {
        const candidatePaths = [
            path.resolve(__dirname, '../../../../certs/pdf-certificate.pdf'),
            path.resolve(__dirname, '../../../certs/pdf-certificate.pdf'),
            path.resolve(__dirname, '../../certs/pdf-certificate.pdf'),
            path.resolve(__dirname, '../certs/pdf-certificate.pdf'),
            path.resolve(__dirname, 'certs/pdf-certificate.pdf'),
            path.resolve(process.cwd(), 'certs/pdf-certificate.pdf'),
            path.resolve(process.cwd(), '../certs/pdf-certificate.pdf'),
            path.resolve(process.cwd(), '../../certs/pdf-certificate.pdf'),
        ];
        const templatePath = candidatePaths.find(p => fs.existsSync(p));
        if (!templatePath) {
            throw new Error(
                `PDF template not found. Searched:\n${candidatePaths.join('\n')}\n` +
                'Ensure certs/pdf-certificate.pdf is present in the repository root.'
            );
        }
        const templateBytes = fs.readFileSync(templatePath);
        return await PDFDocument.load(templateBytes);
    }

    private renderPdfTable(
        page: any,
        startY: number,
        rowHeight: number,
        rows: Array<{ xLabel: number; label: string; xVal: number; val: string; valFont?: any; valColor?: any; valSize?: number }>,
        style: { fontBold: any; labelColor: any; defaultFont: any; defaultColor: any }
    ): void {
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const y = startY - (i * rowHeight);
            page.drawText(row.label, { x: row.xLabel, y, size: 9, font: style.fontBold, color: style.labelColor });
            page.drawText(row.val, {
                x: row.xVal,
                y,
                size: row.valSize ?? 9,
                font: row.valFont ?? style.defaultFont,
                color: row.valColor ?? style.defaultColor
            });
        }
    }

    private renderPdfFooter(
        page: any,
        footerY: number,
        width: number,
        expiryStr: string,
        style: { font: any; fontBold: any; rgb: any }
    ): void {
        page.drawLine({
            start: { x: 60, y: footerY },
            end: { x: width - 60, y: footerY },
            thickness: 1,
            color: style.rgb(0.8, 0.8, 0.8)
        });

        const disclaimerLines = [
            { text: 'Legal Disclaimer:', isDis: true },
            { text: 'Armageddon is designed for controlled sandbox and authorized non-production testing and does not', isDis: true },
            { text: 'guarantee breach prevention. Certification reflects results of the tested build/configuration at time of run.', isDis: true },
            { text: '', isDis: true },
            { text: `Issued by: APEX Business Systems Ltd.   |   Certification ID: ${this.runId.substring(0, 8).toUpperCase()}   |   Valid Until: ${expiryStr}`, isDis: false }
        ];

        for (let i = 0; i < disclaimerLines.length; i++) {
            const line = disclaimerLines[i];
            const y = footerY - 15 - (i * 12);
            page.drawText(line.text, {
                x: 60,
                y,
                size: line.isDis ? 7.5 : 8,
                font: line.isDis ? style.font : style.fontBold,
                color: line.isDis ? style.rgb(0.5, 0.5, 0.5) : style.rgb(0.2, 0.2, 0.2)
            });
        }
    }

    public async generateCertificatePdf(): Promise<Uint8Array> {
        const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
        const pdfDoc = await this.loadPdfDocFromTemplate(PDFDocument);
        
        const page = pdfDoc.getPages()[0];
        const { width, height } = page.getSize();
        
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const fontMono = await pdfDoc.embedFont(StandardFonts.Courier);

        const { verdict, attestation, passedCount, failedCount, totalAttacks, totalEscapes, escapeRate, expiryStr } = this.computeCertificateStats();
        const isCert = verdict === 'CERTIFIED';
        const verdictColor = isCert ? rgb(0.12, 0.58, 0.28) : rgb(0.8, 0.15, 0.15);
        const labelColor = rgb(0.4, 0.4, 0.4);
        const valueColor = rgb(0.1, 0.1, 0.1);
        const tableStyle = { fontBold, labelColor, defaultFont: font, defaultColor: valueColor };

        page.drawText('ARMAGEDDON CERTIFICATION', { x: 60, y: height - 120, size: 20, font: fontBold, color: rgb(0.08, 0.18, 0.36) });
        page.drawText(verdict, { x: 60, y: height - 165, size: 32, font: fontBold, color: verdictColor });
        page.drawLine({ start: { x: 60, y: height - 185 }, end: { x: width - 60, y: height - 185 }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });

        const metaRows = [
            { xLabel: 60, label: 'Run ID:', xVal: 140, val: this.runId },
            { xLabel: 60, label: 'Timestamp:', xVal: 140, val: this.report.meta.timestamp },
            { xLabel: 60, label: 'Mode:', xVal: 140, val: this.options.mode },
            { xLabel: 60, label: 'Chaos Seed:', xVal: 140, val: String(this.options.seed) },
            { xLabel: 60, label: 'Target URL:', xVal: 140, val: this.options.targetUrl || 'N/A' },
            { xLabel: 340, label: 'Total Batteries:', xVal: 440, val: String(this.report.batteries.length) },
            { xLabel: 340, label: 'Passed:', xVal: 440, val: String(passedCount) },
            { xLabel: 340, label: 'Failed:', xVal: 440, val: String(failedCount) },
            { xLabel: 340, label: 'Aggregate Score:', xVal: 440, val: `${this.report.score}/100`, valFont: fontBold, valColor: isCert ? rgb(0.12, 0.58, 0.28) : valueColor }
        ];
        this.renderPdfTable(page, height - 210, 16, metaRows, tableStyle);

        page.drawText(`LEVEL ${this.report.level ?? 7} GOD MODE PERFORMANCE:`, { x: 60, y: height - 315, size: 11, font: fontBold, color: rgb(0.08, 0.18, 0.36) });
        const godRows = [
            { xLabel: 60, label: 'Total Attacks:', xVal: 150, val: String(totalAttacks) },
            { xLabel: 60, label: 'Escapes:', xVal: 150, val: String(totalEscapes) },
            { xLabel: 60, label: 'Escape Rate:', xVal: 150, val: `${escapeRate}%` },
            { xLabel: 60, label: 'Threshold:', xVal: 150, val: '0.01%' },
            { xLabel: 60, label: 'Status:', xVal: 150, val: verdict, valFont: fontBold, valColor: isCert ? rgb(0.12, 0.58, 0.28) : valueColor }
        ];
        this.renderPdfTable(page, height - 333, 15, godRows, tableStyle);

        page.drawText('TAMPER-EVIDENT ATTESTATION:', { x: 60, y: height - 425, size: 11, font: fontBold, color: rgb(0.08, 0.18, 0.36) });
        const attestRows = [
            { xLabel: 60, label: 'Spec:', xVal: 150, val: attestation.spec, valFont: fontMono, valSize: 8 },
            { xLabel: 60, label: 'Algorithm:', xVal: 150, val: attestation.algorithm, valFont: fontMono, valSize: 8 },
            { xLabel: 60, label: 'Chain ID:', xVal: 150, val: attestation.chainId, valFont: fontMono, valSize: 8 },
            { xLabel: 60, label: 'Key ID:', xVal: 150, val: attestation.keyId, valFont: fontMono, valSize: 8 },
            { xLabel: 60, label: 'Merkle Root:', xVal: 150, val: attestation.merkleRoot, valFont: fontMono, valSize: 8 },
            { xLabel: 60, label: 'Digest:', xVal: 150, val: attestation.digest, valFont: fontMono, valSize: 8 }
        ];
        this.renderPdfTable(page, height - 443, 15, attestRows, tableStyle);

        this.renderPdfFooter(page, height - 565, width, expiryStr, { font, fontBold, rgb });

        return await pdfDoc.save();
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
        fs.writeFileSync(path.join(outputDir, 'certificate.pdf'), await this.generateCertificatePdf());
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
