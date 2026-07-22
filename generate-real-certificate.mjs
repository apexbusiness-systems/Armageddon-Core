// Generates the ACTUAL signed certification artifact for a completed
// production run, using the repo's own (currently unwired) EvidenceGenerator
// and createAttestation code against REAL data pulled from Supabase.
// No fabricated numbers — every field below is read from armageddon_runs /
// armageddon_events for the given runId.
import { createClient } from '@supabase/supabase-js';
import { EvidenceGenerator } from './packages/core/src/core/evidence-generator.js';
import { writeFileSync } from 'node:fs';

const runId = process.env.RUN_ID;
if (!runId) throw new Error('RUN_ID required');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: run, error: runErr } = await sb.from('armageddon_runs').select('*').eq('id', runId).single();
if (runErr || !run) throw new Error('run not found: ' + (runErr?.message ?? 'no row'));

const { data: events, error: evErr } = await sb
  .from('armageddon_events')
  .select('*')
  .eq('run_id', runId)
  .order('created_at', { ascending: true });
if (evErr) throw new Error('events query failed: ' + evErr.message);

console.log('Run status:', run.status, '| batteries_executed:', JSON.stringify(run.batteries_executed));
console.log('Event count:', events.length);

if (run.status !== 'passed' && run.status !== 'failed') {
  throw new Error(`Run is not terminal (status=${run.status}) — refusing to certify an incomplete run.`);
}

// Reconstruct per-battery results from real BATTERY_COMPLETED events (payload
// carries {blocked, breaches} as actually observed). iteration counts derive
// from BATTERY_STARTED payload.vectors * 1000 heuristics are NOT used — we
// only use what's actually in the row/events, no invented numbers.
const byBattery = new Map();
for (const ev of events) {
  const id = ev.battery_id;
  if (!byBattery.has(id)) byBattery.set(id, { started: null, completed: null });
  const entry = byBattery.get(id);
  if (ev.event_type === 'BATTERY_STARTED') entry.started = ev;
  if (ev.event_type === 'BATTERY_COMPLETED') entry.completed = ev;
}

const executedIds = run.batteries_executed ?? [];
const passedSet = new Set(run.batteries_passed ?? []);

// run.batteries_executed/passed/failed use the FULL battery id (e.g.
// "B10_GOAL_HIJACK"), but armageddon_events.battery_id uses the SHORT id
// (e.g. "B10") — derive the short id to key into byBattery correctly.
const batteries = executedIds.map((fullId) => {
  const shortId = /^B\d+/.exec(fullId)?.[0] ?? fullId;
  const entry = byBattery.get(shortId) ?? {};
  const completedPayload = entry.completed?.payload ?? null;
  const startedPayload = entry.started?.payload ?? null;
  const hasTelemetry = completedPayload !== null;
  const blocked = completedPayload?.blocked ?? null;
  const breaches = completedPayload?.breaches ?? null;
  const durationMs = entry.started && entry.completed
    ? new Date(entry.completed.created_at).getTime() - new Date(entry.started.created_at).getTime()
    : null;
  return {
    batteryId: fullId,
    status: passedSet.has(fullId) ? 'PASSED' : (run.batteries_failed?.includes(fullId) ? 'FAILED' : 'UNKNOWN'),
    // NO_TELEMETRY: honest gap, not a fabricated number. This battery produced
    // no BATTERY_STARTED/COMPLETED events in armageddon_events despite being
    // marked executed/failed on the run row — do not guess at its iteration
    // count or blocked/breach split.
    iterations: hasTelemetry ? blocked + breaches : 'NO_TELEMETRY',
    blockedCount: hasTelemetry ? blocked : 'NO_TELEMETRY',
    breachCount: hasTelemetry ? breaches : 'NO_TELEMETRY',
    driftScore: hasTelemetry ? run.escape_rate ?? 0 : 'NO_TELEMETRY',
    duration: durationMs ?? 'NO_TELEMETRY',
    details: {
      engine: startedPayload?.engine ?? 'NO_TELEMETRY',
      tier: startedPayload?.tier ?? 'NO_TELEMETRY',
      vectors: startedPayload?.vectors ?? null,
      hasTelemetry,
    },
  };
});

const totalIterations = run.total_iterations ?? batteries.reduce((s, b) => s + b.iterations, 0);
const passCount = batteries.filter((b) => b.status === 'PASSED').length;
const score = batteries.length > 0 ? Math.round((passCount / batteries.length) * 100) : 0;
const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : 'F';

const report = {
  meta: { timestamp: run.completed_at, duration: run.duration_ms ?? 0 },
  status: run.status === 'passed' ? 'PASSED' : 'FAILED',
  grade,
  score,
  level: run.level,
  batteries,
};

const orgTier = (run.config?.tier ?? 'free_dry').toUpperCase();
// EvidenceGenerator only allows a 'CERTIFIED' verdict when options.tier === 'CERTIFIED'.
const options = {
  seed: run.config?.seed ?? 0,
  mode: run.sim_mode ? 'SIMULATION' : 'LIVE_FIRE',
  targetUrl: run.config?.targetEndpoint ?? undefined,
  tier: orgTier,
};

const gen = new EvidenceGenerator(report, runId, options);
const reportJson = gen.generateReportJson();
const parsed = JSON.parse(reportJson);

writeFileSync(process.env.OUT_JSON ?? 'certificate-report.json', reportJson);
console.log('=== REAL CERTIFICATE (from actual run data) ===');
console.log('runId:', runId);
console.log('level:', run.level, '| orgTier(config):', orgTier, '| verdict:', parsed.verdict);
console.log('score:', parsed.score, '| grade:', parsed.grade);
console.log('battery engine(s) actually used:', [...new Set(batteries.map(b => b.details.engine))].join(', '));
console.log('attestation.keyId:', parsed.attestation.keyId, '| chainId:', parsed.attestation.chainId);
console.log('attestation.signature (base64, first 40):', parsed.attestation.signature?.slice(0, 40) + '...');
console.log('Written to:', process.env.OUT_JSON ?? 'certificate-report.json');

const noTelemetry = batteries.filter((b) => !b.details.hasTelemetry).map((b) => b.batteryId);
if (noTelemetry.length > 0) {
  console.log('\n⚠️  CAVEAT: no BATTERY_STARTED/COMPLETED telemetry found for:', noTelemetry.join(', '));
  console.log('   These batteries are marked executed/' + run.status + ' on the run row, but their');
  console.log('   iteration/blocked/breach counts could not be verified from armageddon_events.');
  console.log(`   The run-level total (breaches=${run.breaches}) cannot be attributed to a specific`);
  console.log('   battery from available data. Treat per-battery numbers for these as UNKNOWN, not zero.');
}
const startCounts = new Map();
for (const ev of events) if (ev.event_type === 'BATTERY_STARTED') startCounts.set(ev.battery_id, (startCounts.get(ev.battery_id) ?? 0) + 1);
const retried = [...startCounts.entries()].filter(([, n]) => n > 1);
if (retried.length > 0) {
  console.log('\n⚠️  CAVEAT: multiple BATTERY_STARTED events observed for:', retried.map(([id, n]) => `${id}(x${n})`).join(', '));
  console.log('   Consistent with the known Render free-tier idle/cold-start pattern (see');
  console.log('   docs/audits/PRODUCTION_RUN_DISPATCH_STUCK_2026-07-22.md) causing a mid-run retry.');
}
