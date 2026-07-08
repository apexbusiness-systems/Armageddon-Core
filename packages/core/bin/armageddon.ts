#!/usr/bin/env tsx
import { Command } from 'commander';
import { Connection, Client } from '@temporalio/client';
import { createArmageddonWorker } from '../src/worker';
import { EvidenceGenerator } from '../src/core/evidence-generator';
import { resolveTarget, describeResolvedTarget } from '../src/cli/resolve-target';
import { configureRunModeEnv, applyHttpTargetEnv } from '../src/cli/run-setup';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.error(
  '⚠ APEX OmniHub — Authorized use only.\n' +
  '  Run only on systems you own or have explicit written permission to test.'
);


const program = new Command();

program
  .name('armageddon')
  .description('Armageddon Level 7 Certification CLI')
  .version('1.0.0');

program
  .command('run')
  .description('Execute certification run')
  .option('--mode <mode>', 'Operational mode (simulation|destructive)', 'simulation')
  .option('--config <path>', 'Path to config file')
  .option('--seed <number>', 'Chaos seed', '42')
  .option('--output <dir>', 'Output directory', './results')
  .option('--iterations <number>', 'Number of iterations per battery', '100')
  .option('--target <url>', 'Target URL')
  .option('--level <number>', 'Certification level', '7')
  .option('--no-worker', 'Skip starting a local worker (use external)')
  .option('--target-provider <kind>', 'CERTIFIED target for B10-B14: simulation|model|http')
  .option('--target-model <model>', 'Named model to attack when --target-provider model')
  .option('--target-endpoint <url>', 'Real app/agent endpoint to attack when --target-provider http')
  .option('--target-body-template <json>', 'JSON body template with {{prompt}}/{{systemPrompt}}/{{uuid}} placeholders')
  .option('--target-response-path <path>', 'Dot-path into the JSON response used as the target reply')
  .option('--target-auth-header-env <envName>', 'Env var holding the bearer token sent to the HTTP target')
  .option('--batteries <codes>', 'Comma-separated battery codes to run (default: B10-B14)')
  .action(async (options) => {
    const runId = uuidv4();
    const seed = Number.parseInt(options.seed, 10);
    const mode = options.mode;
    const iterations = Number.parseInt(options.iterations, 10);
    const level = Number.parseInt(options.level, 10);
    const batteries = options.batteries
        ? String(options.batteries).split(',').map((s: string) => s.trim()).filter(Boolean)
        : undefined;

    console.log(`[CLI] Starting Armageddon Run ${runId} (Level ${level})`);
    console.log(`[CLI] Mode: ${mode}, Seed: ${seed}`);

    // Set Environment Variables for the run (exits process on invalid destructive-mode config)
    configureRunModeEnv(mode, seed);

    // Resolve what B10-B14 will actually attack. Fails loudly (throws) rather
    // than silently defaulting to the 'sim-001' stub for a CERTIFIED run.
    let resolvedTarget;
    try {
        resolvedTarget = resolveTarget({
            mode,
            targetProvider: options.targetProvider,
            targetModel: options.targetModel,
            targetEndpoint: options.targetEndpoint,
            targetBodyTemplate: options.targetBodyTemplate,
            targetResponsePath: options.targetResponsePath,
            targetAuthHeaderEnv: options.targetAuthHeaderEnv,
        });
    } catch (err) {
        console.error('[CLI]', err instanceof Error ? err.message : String(err));
        process.exit(1);
        return;
    }
    console.log(`[CLI] Target resolved: ${describeResolvedTarget(resolvedTarget)}`);
    // Propagate to the worker process (in-process or external via its own
    // env) so LiveFireAdapter's createHttpTargetConfigFromEnv() sees it.
    applyHttpTargetEnv(resolvedTarget);

    let worker;
    let runPromise;

    try {
        if (options.worker) {
            console.log('[CLI] Starting local worker...');
            // We need to re-verify safety because worker uses process.env
            worker = await createArmageddonWorker();
            // Start worker without awaiting completion (it runs until shutdown)
            runPromise = worker.run();
        }

        // Connect Client
        console.log('[CLI] Connecting to Temporal...');
        const connection = await Connection.connect({ address: process.env.TEMPORAL_ADDRESS || 'localhost:7233' });
        const client = new Client({ connection });

        // Start Workflow
        const tier = mode === 'destructive' ? 'CERTIFIED' : 'FREE';
        const workflowId = `armageddon-${runId}`;

        // Disable SupabaseReporter since we don't have a valid organization ID to satisfy foreign key constraints locally.
        process.env.DISABLE_REPORTER = 'true';

        console.log(`[CLI] Submitting workflow ${workflowId}...`);

        const handle = await client.workflow.start('ArmageddonLevel7Workflow', {
            taskQueue: 'armageddon-level-7',
            workflowId,
            args: [{
                runId,
                iterations,
                level,
                tier,
                targetEndpoint: options.target || process.env.TARGET_URL || 'http://localhost:3000',
                targetModel: resolvedTarget.targetModel,
                seed,
                batteries
            }],
        });

        console.log(`[CLI] Workflow started. Waiting for results...`);

        // Wait for result
        const report = await handle.result();

        console.log(`[CLI] Run completed. Verdict: ${report.status}`);
        console.log(`[CLI] Score: ${report.score}/100 (Grade: ${report.grade})`);

        // Generate Evidence
        const generator = new EvidenceGenerator(report, runId, {
            seed,
            mode,
            tier,
            targetUrl: options.target || process.env.TARGET_URL
        });

        await generator.saveTo(options.output);
        console.log(`[CLI] Evidence saved to ${options.output}`);

    } catch (err) {
        console.error('[CLI] Run failed:', err);
        process.exit(1);
    } finally {
        if (worker) {
            console.log('[CLI] Shutting down worker...');
            worker.shutdown();
            await runPromise;
        }
    }
  });

program
  .command('verify')
  .description('Verify existing report artifact')
  .requiredOption('--report <path>', 'Path to report.json')
  .action(async (options) => {
    try {
        const reportPath = path.resolve(options.report);
        const reportContent = await fs.promises.readFile(reportPath, 'utf-8');
        const report = JSON.parse(reportContent);

        if (!report.run_id || !report.verdict) {
            throw new Error('Invalid report format: missing run_id or verdict');
        }

        console.log(`[VERIFY] Report ${report.run_id} is VALID.`);
        console.log(`[VERIFY] Verdict: ${report.verdict}`);
        console.log(`[VERIFY] Score: ${report.score}`);
    } catch (err) {
        console.error('[VERIFY] Verification failed:', err);
        process.exit(1);
    }
  });

program
  .command('certify')
  .description('Generate certificate from report')
  .requiredOption('--report <path>', 'Path to report.json')
  .option('--tier <tier>', 'Certification tier', 'verified')
  .action(async (options) => {
    try {
        const reportPath = path.resolve(options.report);
        const reportContent = await fs.promises.readFile(reportPath, 'utf-8');
        const reportJson = JSON.parse(reportContent);

        // Hydrate ArmageddonReport from JSON
        // Note: report.json structure differs slightly from internal ArmageddonReport (flat vs nested details)
        // We need to map it back or adjust EvidenceGenerator to accept JSON report.
        // For simplicity, we'll re-construct minimal ArmageddonReport
        const report: any = {
            meta: { timestamp: reportJson.timestamp, duration: 0 },
            status: reportJson.verdict === 'CERTIFIED' ? 'COMPLETED' : 'FAILED',
            grade: reportJson.grade,
            score: reportJson.score,
            batteries: reportJson.batteries.map((b: any) => ({
                batteryId: b.full_id || `B${b.id}_${b.name.replaceAll(' ', '_').toUpperCase()}`,
                status: b.status,
                iterations: b.tests_run,
                blockedCount: b.blocked,
                breachCount: b.breaches,
                duration: b.duration_ms,
                details: b.metrics
            }))
        };

        const generator = new EvidenceGenerator(report, reportJson.run_id, {
            seed: reportJson.chaos_seed,
            mode: reportJson.mode,
            // Older report.json files predate the `tier` field. Fall back to
            // trusting the report's own already-decided verdict so existing
            // evidence can still be re-certified; new reports always carry tier.
            tier: reportJson.tier ?? (reportJson.verdict === 'CERTIFIED' ? 'CERTIFIED' : 'FREE'),
            targetUrl: reportJson.target_url
        });

        const cert = await generator.generateCertificatePdf();
        const certPath = path.join(path.dirname(reportPath), 'certificate.pdf');
        await fs.promises.writeFile(certPath, cert);

        console.log(`[CERTIFY] Certificate generated at ${certPath}`);
    } catch (err) {
        console.error('[CERTIFY] Certification failed:', err);
        process.exit(1);
    }
  });

program
  .command('target-check')
  .description('Resolve and print the effective B10-B14 target without starting Temporal or making any network call')
  .option('--mode <mode>', 'Operational mode (simulation|destructive)', 'simulation')
  .option('--target-provider <kind>', 'CERTIFIED target for B10-B14: simulation|model|http')
  .option('--target-model <model>', 'Named model to attack when --target-provider model')
  .option('--target-endpoint <url>', 'Real app/agent endpoint to attack when --target-provider http')
  .option('--target-body-template <json>', 'JSON body template with {{prompt}}/{{systemPrompt}}/{{uuid}} placeholders')
  .option('--target-response-path <path>', 'Dot-path into the JSON response used as the target reply')
  .option('--target-auth-header-env <envName>', 'Env var holding the bearer token sent to the HTTP target')
  .action((options) => {
    try {
        const resolved = resolveTarget({
            mode: options.mode,
            targetProvider: options.targetProvider,
            targetModel: options.targetModel,
            targetEndpoint: options.targetEndpoint,
            targetBodyTemplate: options.targetBodyTemplate,
            targetResponsePath: options.targetResponsePath,
            targetAuthHeaderEnv: options.targetAuthHeaderEnv,
        });
        console.log('[TARGET-CHECK] No network calls made. Resolved configuration:');
        console.log(describeResolvedTarget(resolved));
        process.exit(0);
    } catch (err) {
        console.error('[TARGET-CHECK] FAILED:', err instanceof Error ? err.message : String(err));
        process.exit(1);
    }
  });

program.parse(process.argv);
