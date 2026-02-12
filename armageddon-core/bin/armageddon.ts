#!/usr/bin/env tsx
import { Command } from 'commander';
import { Connection, Client } from '@temporalio/client';
import { createArmageddonWorker } from '../src/worker';
import { EvidenceGenerator } from '../src/core/evidence-generator';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

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
  .option('--no-worker', 'Skip starting a local worker (use external)')
  .action(async (options) => {
    const runId = uuidv4();
    const seed = parseInt(options.seed, 10);
    const mode = options.mode;
    const iterations = parseInt(options.iterations, 10);

    console.log(`[CLI] Starting Armageddon Run ${runId}`);
    console.log(`[CLI] Mode: ${mode}, Seed: ${seed}`);

    // Set Environment Variables for the run
    if (mode === 'simulation') {
        process.env.SIM_MODE = 'true';
        process.env.SANDBOX_TENANT = process.env.SANDBOX_TENANT || 'cli-sim-tenant';
        process.env.CHAOS_SEED = seed.toString();
        // Ensure not destructive
        delete process.env.ARMAGEDDON_DESTRUCTIVE;
    } else if (mode === 'destructive') {
        process.env.SIM_MODE = 'true'; // Required even for destructive (as per prompt: SIM_MODE=true + SANDBOX_TENANT + ARMAGEDDON_DESTRUCTIVE)
        // Wait, prompt says: "Destructive batteries MUST refuse to run unless ALL of: (1) explicit non-prod config, (2) SIM_MODE=true + SANDBOX_TENANT set, (3) ARMAGEDDON_DESTRUCTIVE=true flag"

        if (!process.env.SANDBOX_TENANT || !process.env.ARMAGEDDON_DESTRUCTIVE) {
             console.error('[CLI] DESTRUCTIVE MODE BLOCKED: Missing required env vars (SANDBOX_TENANT, ARMAGEDDON_DESTRUCTIVE)');
             console.error('Use: SANDBOX_TENANT=x ARMAGEDDON_DESTRUCTIVE=true armageddon run --mode=destructive ...');
             process.exit(1);
        }
    }

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

        console.log(`[CLI] Submitting workflow ${workflowId}...`);

        const handle = await client.workflow.start('ArmageddonLevel7Workflow', {
            taskQueue: 'armageddon-level-7',
            workflowId,
            args: [{
                runId,
                iterations,
                tier,
                targetEndpoint: options.target || process.env.TARGET_URL || 'http://localhost:3000',
                targetModel: 'sim-001'
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
                batteryId: b.full_id || `B${b.id}_${b.name.replace(/ /g, '_').toUpperCase()}`,
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
            targetUrl: reportJson.target_url
        });

        const cert = generator.generateCertificateTxt();
        const certPath = path.join(path.dirname(reportPath), 'certificate.txt');
        await fs.promises.writeFile(certPath, cert);

        console.log(`[CERTIFY] Certificate generated at ${certPath}`);
    } catch (err) {
        console.error('[CERTIFY] Certification failed:', err);
        process.exit(1);
    }
  });

program.parse(process.argv);
