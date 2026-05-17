/* eslint-disable no-console */
// scripts/demo_attestation.ts
// End-to-end demonstration of the Armageddon Attestation Layer.
//
// Run with: node_modules/.bin/tsx scripts/demo_attestation.ts
//
// 1. Sets a stable signing seed (env var) so the published key is reproducible.
// 2. Constructs a representative ArmageddonReport and runs the real
//    EvidenceGenerator to disk in a temp directory.
// 3. Invokes the shipped verify.mjs against report.json (third-party flow).
// 4. Tampers with the report (status, signature, pinned key) and confirms
//    every tamper path is detected by the verifier with the expected
//    failure code.
// 5. Writes a structured evidence summary to attestation-demo-evidence.json
//    so the result is durable beyond stdout.

import { mkdtempSync, readFileSync, rmSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { EvidenceGenerator } from '../armageddon-core/src/core/evidence-generator';
import type { ArmageddonReport } from '../armageddon-core/src/temporal/activities';

const SEED_HEX = 'c0ffeec0ffeec0ffeec0ffeec0ffeec0ffeec0ffeec0ffeec0ffeec0ffeec0ff';
process.env.ARMAGEDDON_ATTESTATION_SEED = SEED_HEX;

const mockReport: ArmageddonReport = {
    meta: {
        timestamp: '2026-05-17T08:30:00.000Z',
        duration: 12345,
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
            details: { mode: 'sim' },
        },
        {
            batteryId: 'B10_GOAL_HIJACK',
            status: 'PASSED',
            iterations: 2500,
            blockedCount: 2500,
            breachCount: 0,
            driftScore: 0,
            duration: 8000,
            details: { engine: 'SimulationAdapter' },
        },
        {
            batteryId: 'B13_SUPPLY_CHAIN',
            status: 'PASSED',
            iterations: 4,
            blockedCount: 4,
            breachCount: 0,
            driftScore: 0,
            duration: 200,
            details: { engine: 'SimulationAdapter' },
        },
    ],
};

const tmp = mkdtempSync(join(tmpdir(), 'armageddon-demo-'));
console.log(`[demo] Output directory: ${tmp}`);

const gen = new EvidenceGenerator(mockReport, 'demo-run-2026-05-17-001', {
    seed: 0xdeadbeef,
    mode: 'DEMO',
    targetUrl: 'https://sandbox.example.local',
});

async function main(): Promise<void> {

await gen.saveTo(tmp);

const files = readdirSync(tmp)
    .filter(f => !statSync(join(tmp, f)).isDirectory())
    .map(f => ({ name: f, bytes: statSync(join(tmp, f)).size }));
console.log('[demo] Generated artifacts:');
for (const f of files) {
    console.log(`  - ${f.name.padEnd(20)} ${f.bytes} bytes`);
}

const reportRaw = readFileSync(join(tmp, 'report.json'), 'utf8');
const report = JSON.parse(reportRaw) as {
    run_id: string;
    attestation: {
        spec: string;
        algorithm: string;
        chainId: string;
        keyId: string;
        merkleRoot: string;
        digest: string;
        signature: string;
        publicKey: string;
        leaves: Array<{ id: string; hash: string }>;
    };
};

console.log('\n[demo] Attestation block (extracted from report.json):');
console.log(`  spec        ${report.attestation.spec}`);
console.log(`  algorithm   ${report.attestation.algorithm}`);
console.log(`  chainId     ${report.attestation.chainId}`);
console.log(`  keyId       ${report.attestation.keyId}`);
console.log(`  merkleRoot  ${report.attestation.merkleRoot}`);
console.log(`  digest      ${report.attestation.digest}`);
console.log(`  signature   ${report.attestation.signature.slice(0, 32)}…`);
console.log(`  leaves      ${report.attestation.leaves.length} (META + ${report.attestation.leaves.length - 1} batteries)`);

console.log('\n[demo] Step 1: Third-party offline verification (clean report)');
const validOutput = execFileSync(process.execPath, [join(tmp, 'verify.mjs'), join(tmp, 'report.json')], {
    encoding: 'utf8',
});
console.log(validOutput.trim().split('\n').map(l => '   ' + l).join('\n'));
if (!validOutput.includes('[VALID]')) {
    console.error('[demo] FAIL: Good-path verify did not print [VALID].');
    process.exit(1);
}

console.log('\n[demo] Step 2: Tamper with the report (PASSED -> FAILED on a battery)');
const tampered = JSON.parse(reportRaw) as typeof report & { batteries: Array<Record<string, unknown>> };
tampered.batteries[1].status = 'FAILED';
const tamperedPath = join(tmp, 'report.tampered.json');
writeFileSync(tamperedPath, JSON.stringify(tampered, null, 2));

let tamperedExitCode = 0;
let tamperedStderr = '';
try {
    execFileSync(process.execPath, [join(tmp, 'verify.mjs'), tamperedPath], { encoding: 'utf8' });
} catch (e) {
    const err = e as { status: number; stderr: string };
    tamperedExitCode = err.status;
    tamperedStderr = err.stderr;
}
console.log(`   exit code: ${tamperedExitCode}`);
console.log(`   stderr:    ${tamperedStderr.trim()}`);
if (tamperedExitCode !== 1 || !tamperedStderr.includes('MERKLE_MISMATCH')) {
    console.error('[demo] FAIL: tamper detection broke.');
    process.exit(1);
}

console.log('\n[demo] Step 3: Forge the signature (flip first byte)');
const sigTampered = JSON.parse(reportRaw) as typeof report;
const sigBytes = Buffer.from(sigTampered.attestation.signature, 'base64');
sigBytes[0] ^= 0x01;
sigTampered.attestation.signature = sigBytes.toString('base64');
const sigPath = join(tmp, 'report.forged-sig.json');
writeFileSync(sigPath, JSON.stringify(sigTampered, null, 2));

let sigExitCode = 0;
let sigStderr = '';
try {
    execFileSync(process.execPath, [join(tmp, 'verify.mjs'), sigPath], { encoding: 'utf8' });
} catch (e) {
    const err = e as { status: number; stderr: string };
    sigExitCode = err.status;
    sigStderr = err.stderr;
}
console.log(`   exit code: ${sigExitCode}`);
console.log(`   stderr:    ${sigStderr.trim()}`);
if (sigExitCode !== 1 || !sigStderr.includes('SIGNATURE_INVALID')) {
    console.error('[demo] FAIL: forged-signature detection broke.');
    process.exit(1);
}

console.log('\n[demo] Step 4: Pin verification with the correct public key');
const pinOutput = execFileSync(process.execPath, [
    join(tmp, 'verify.mjs'),
    join(tmp, 'report.json'),
    '--pubkey',
    report.attestation.publicKey,
], { encoding: 'utf8' });
console.log(pinOutput.trim().split('\n').map(l => '   ' + l).join('\n'));

console.log('\n[demo] Step 5: Pin verification with WRONG public key');
let pinFailCode = 0;
let pinFailErr = '';
try {
    execFileSync(process.execPath, [
        join(tmp, 'verify.mjs'),
        join(tmp, 'report.json'),
        '--pubkey',
        Buffer.alloc(32, 0xaa).toString('base64'),
    ], { encoding: 'utf8' });
} catch (e) {
    const err = e as { status: number; stderr: string };
    pinFailCode = err.status;
    pinFailErr = err.stderr;
}
console.log(`   exit code: ${pinFailCode}`);
console.log(`   stderr:    ${pinFailErr.trim()}`);
if (pinFailCode !== 1 || !pinFailErr.includes('KEY_MISMATCH')) {
    console.error('[demo] FAIL: wrong-pubkey detection broke.');
    process.exit(1);
}

const summary = {
    spec: report.attestation.spec,
    seed_hex: SEED_HEX,
    runId: report.run_id,
    keyId: report.attestation.keyId,
    publicKey: report.attestation.publicKey,
    merkleRoot: report.attestation.merkleRoot,
    digest: report.attestation.digest,
    signatureFirst32: report.attestation.signature.slice(0, 32),
    artifacts: files.map(f => ({ name: f.name, bytes: f.bytes })),
    verification: {
        clean_report:        'VALID (exit 0)',
        tampered_status:     `INVALID MERKLE_MISMATCH (exit ${tamperedExitCode})`,
        forged_signature:    `INVALID SIGNATURE_INVALID (exit ${sigExitCode})`,
        correct_pin:         'VALID (exit 0)',
        wrong_pin:           `INVALID KEY_MISMATCH (exit ${pinFailCode})`,
    },
};

const summaryPath = join(process.cwd(), 'attestation-demo-evidence.json');
writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
console.log(`\n[demo] Evidence summary written to ${summaryPath}`);

console.log('\n[demo] All five attestation paths passed. Tamper-evidence is verified end-to-end.');
rmSync(tmp, { recursive: true, force: true });
}

main().catch(err => { console.error(err); process.exit(1); });
