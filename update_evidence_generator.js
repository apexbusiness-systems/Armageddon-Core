const fs = require('fs');
const file = 'armageddon-core/src/core/evidence-generator.ts';
let content = fs.readFileSync(file, 'utf8');

// The instructions require:
// Update armageddon-core/src/core/evidence-generator.ts to hash the JSON/MD output and produce a manifest.json.
// Include a lightweight AIBOM (extracting versions from package.json), seed, workflow ID, and environment markers in the manifest.

content = `import * as crypto from 'node:crypto';\n` + content;

const manifestCode = `
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
        } catch (e) {
            aibom = { error: 'Failed to read package.json' };
        }

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
            aibom
        };

        return JSON.stringify(manifest, null, 2);
    }
`;

content = content.replace(
    "    public async saveTo(outputDir: string): Promise<void> {",
    manifestCode + "\n    public async saveTo(outputDir: string): Promise<void> {"
);

const saveToBody = `
        const jsonContent = this.generateReportJson();
        const mdContent = this.generateReportMd();
        
        fs.writeFileSync(path.join(outputDir, 'report.json'), jsonContent);
        fs.writeFileSync(path.join(outputDir, 'report.md'), mdContent);
        fs.writeFileSync(path.join(outputDir, 'certificate.txt'), this.generateCertificateTxt());
        fs.writeFileSync(path.join(outputDir, 'junit.xml'), this.generateJunitXml());
        fs.writeFileSync(path.join(outputDir, 'manifest.json'), this.generateManifest(jsonContent, mdContent));
`;

content = content.replace(
    /        fs\.writeFileSync\(path\.join\(outputDir, 'report\.json'\), this\.generateReportJson\(\)\);\n        fs\.writeFileSync\(path\.join\(outputDir, 'report\.md'\), this\.generateReportMd\(\)\);\n        fs\.writeFileSync\(path\.join\(outputDir, 'certificate\.txt'\), this\.generateCertificateTxt\(\)\);\n        fs\.writeFileSync\(path\.join\(outputDir, 'junit\.xml'\), this\.generateJunitXml\(\)\);/,
    saveToBody
);

// We need to parse B14 battery appropriately in the parser
content = content.replace(
    `            ['B10','B11','B12','B13'].some(prefix => b.batteryId.startsWith(prefix))`,
    `            ['B10','B11','B12','B13','B14'].some(prefix => b.batteryId.startsWith(prefix))`
);

fs.writeFileSync(file, content);
