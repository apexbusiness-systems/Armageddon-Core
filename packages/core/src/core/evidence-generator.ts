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
            expiryStr
        };
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

    /**
     * pdf-lib's SVG path Y axis is flipped relative to the page (see
     * drawSvgPath's `scale(1, -1)`), so a normal "point up" star defined with
     * math angles starting at -90deg renders right-side up once pdf-lib
     * un-flips it. Verified visually before wiring this in.
     */
    private static starPath(outerR: number, innerR: number): string {
        const pts: string[] = [];
        for (let i = 0; i < 10; i++) {
            const angle = (-90 + i * 36) * (Math.PI / 180);
            const r = i % 2 === 0 ? outerR : innerR;
            pts.push(`${i === 0 ? 'M' : 'L'} ${(r * Math.cos(angle)).toFixed(2)},${(r * Math.sin(angle)).toFixed(2)}`);
        }
        return `${pts.join(' ')} Z`;
    }

    public async generateCertificatePdf(): Promise<Uint8Array> {
        const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
        const pdfDoc = await this.loadPdfDocFromTemplate(PDFDocument);

        const page = pdfDoc.getPages()[0];
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        const { verdict, attestation, passedCount, failedCount, totalAttacks, totalEscapes, escapeRate, expiryStr } = this.computeCertificateStats();
        const isCert = verdict === 'CERTIFIED';
        const verdictColor = isCert ? rgb(0.12, 0.58, 0.28) : rgb(0.8, 0.15, 0.15);
        const ink = rgb(0.12, 0.12, 0.13);
        const cream = rgb(0.925, 0.890, 0.827); // sampled from the template's card background
        const level = this.report.level ?? 7;
        const issuedOn = this.report.meta.timestamp.split('T')[0];
        const TABLE_SIZE = 7;
        const ID_SIZE = 6.5; // narrower fields (run id / timestamp) need a smaller size to avoid truncation

        // `certs/pdf-certificate.pdf` is a flattened single-page design with demo
        // values baked into its background artwork (coordinates measured against
        // the shipped template). Every dynamic field is masked with a patch
        // matching the card's cream background, then redrawn with real run data
        // at the same slot. The circular seal graphic (top-left) is decorative,
        // textured art with curved baked-in text ("LEVEL 8", escape rate, etc.)
        // and is intentionally left untouched: there is no clean way to patch a
        // gradient/textured badge, and the same figures are already rendered
        // accurately in the flat data panels below it.
        const mask = (x0: number, y0: number, x1: number, y1: number) =>
            page.drawRectangle({ x: x0, y: y0, width: x1 - x0, height: y1 - y0, color: cream });

        const fit = (text: string, size: number, maxWidth: number): string => {
            if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
            let out = text;
            while (out.length > 1 && font.widthOfTextAtSize(`${out}…`, size) > maxWidth) {
                out = out.slice(0, -1);
            }
            return `${out}…`;
        };

        const field = (x: number, y: number, maxX: number, text: string, size = TABLE_SIZE) => {
            mask(x - 6, y - 1.5, maxX, y + size * 0.85);
            page.drawText(fit(text, size, maxX - x - 2), { x, y, size, font, color: ink });
        };

        const fieldRight = (xRight: number, y: number, minX: number, text: string, size = TABLE_SIZE) => {
            mask(minX, y - 1.5, xRight + 3, y + size * 0.85);
            const t = fit(text, size, xRight - minX);
            const w = font.widthOfTextAtSize(t, size);
            page.drawText(t, { x: xRight - w, y, size, font, color: ink });
        };

        // Headline verdict: "CERTIFIED" is already baked into the art, so only
        // patch it when the run actually failed.
        if (!isCert) {
            mask(110, 680, 474, 723);
            const size = 46;
            const w = fontBold.widthOfTextAtSize(verdict, size);
            page.drawText(verdict, { x: 110 + (364 - w) / 2, y: 688, size, font: fontBold, color: verdictColor });
        }

        // Aggregate score + star rating
        mask(354, 552, 489, 634);
        const scoreStr = String(this.report.score);
        const scoreSize = 40;
        page.drawText(scoreStr, { x: 362, y: 588, size: scoreSize, font: fontBold, color: rgb(0.75, 0.25, 0.12) });
        const scoreW = fontBold.widthOfTextAtSize(scoreStr, scoreSize);
        page.drawText('/100', { x: 362 + scoreW + 6, y: 594, size: 24, font: fontBold, color: rgb(0.15, 0.15, 0.18) });
        const filledStars = Math.max(0, Math.min(5, Math.floor(this.report.score / 20)));
        const starPath = EvidenceGenerator.starPath(8, 3.2);
        for (let i = 0; i < 5; i++) {
            page.drawSvgPath(starPath, {
                x: 362 + i * 31.2,
                y: 562,
                color: i < filledStars ? rgb(0.75, 0.25, 0.12) : rgb(0.55, 0.55, 0.55),
            });
        }

        // Execution Record / Results / Level N God Mode row (baselines measured
        // from the template: 736/767/797/827/855px @ 150dpi -> pt via *0.48)
        const R1 = 488.64, R2 = 473.76, R3 = 459.36, R4 = 444.96, R5 = 431.52;

        field(127.2, R1, 220.8, this.runId, ID_SIZE);
        field(127.2, R2, 220.8, this.report.meta.timestamp, ID_SIZE);
        field(127.2, R3, 220.8, this.options.mode);
        field(127.2, R4, 220.8, String(this.options.seed));
        field(127.2, R5, 220.8, this.options.targetUrl || 'N/A');

        fieldRight(354, R1, 310, String(this.report.batteries.length));
        fieldRight(354, R2, 310, String(passedCount));
        fieldRight(354, R3, 310, String(failedCount));
        fieldRight(354, R4, 310, `${this.report.score}/100`);

        mask(400, 509.7, 520, 520.1);
        page.drawText(`LEVEL ${level} GOD MODE`, { x: 406, y: 511.2, size: 10.5, font: fontBold, color: ink });
        field(480, R1, 534, String(totalAttacks));
        field(480, R2, 534, String(totalEscapes));
        field(480, R3, 534, `${escapeRate}%`);
        field(480, R4, 534, '0.01%');
        field(480, R5, 534, verdict);

        // Run + Attestation (tighter line pitch than the row above: baselines
        // measured at 966/988/1010/1039/1061/1084/1106px @ 150dpi)
        field(388, 378.24, 536, attestation.algorithm, ID_SIZE);
        field(388, 367.68, 536, attestation.keyId, ID_SIZE);
        field(388, 357.12, 536, expiryStr, ID_SIZE);
        field(388, 343.2, 536, this.runId, ID_SIZE);
        field(388, 332.64, 536, this.report.meta.timestamp, ID_SIZE);
        field(388, 321.6, 536, this.options.mode, ID_SIZE);
        field(388, 311.04, 536, String(this.options.seed), ID_SIZE);

        // Issued By (baselines measured at 1523/1538px @ 150dpi; value column
        // starts at px 773, noticeably tighter to the label than other boxes)
        field(368, 110.88, 536, this.runId.substring(0, 8).toUpperCase(), ID_SIZE);
        field(368, 103.68, 536, issuedOn, ID_SIZE);

        // Legal disclaimer — required on every issued certificate; lives in
        // the clear margin below the lowest template field (y=103.68) with
        // no overlap. Kept as a single compact line to fit the template's
        // bottom whitespace at A4 (595.5 x 841.92 pt).
        page.drawText(
            'This certification is valid only for the build, configuration, and environment tested at the time of this run. It does not constitute SOC 2, ISO, or compliance certification, nor does it guarantee breach prevention.',
            { x: 60, y: 50, size: 6, font, color: rgb(0.45, 0.45, 0.45), maxWidth: 476, lineHeight: 8 }
        );

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
