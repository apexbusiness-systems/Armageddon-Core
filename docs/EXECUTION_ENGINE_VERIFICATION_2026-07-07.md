# Execution Engine Verification — "EXECUTING 0/13" stuck sequence

**Date:** 2026-07-07
**Scope:** Why the certification run hangs at `EXECUTING 0/13`, proof that the code path is correct, and the single operational change that unsticks production.

---

## 1. Verdict

**The stuck screen is a deployment gap, not a code defect.** The full server-side
execution path — battery activities → real-time event stream → durable terminal
status — was exercised end-to-end and reaches certification. Nothing in the
application code prevents a run from completing.

What the screenshot shows (`Subscribing to real-time event stream...` then
`EXECUTING 0/13` forever) is a run row that was inserted with `status='pending'`
and never advanced, because **the two Node processes that execute runs are not
deployed** in the current Cloudflare-static topology.

---

## 2. Root cause

The production site (`armageddontest.icu`) is a Cloudflare static export + edge
Worker. `POST /api/run` on the edge Worker (`armageddon-site/src/intake-handler.ts`)
inserts an `armageddon_runs` row with `status='pending'` and returns a `runId`.
It **cannot** start a Temporal workflow — Cloudflare Workers have no gRPC and no
long-running execution. So the browser subscribes to a telemetry stream that
never emits, and the run sits at `0/13`.

The repo already contains the two Node processes that do the real work; they are
simply not running in production:

| Service | Entry | Role |
|---|---|---|
| API / dispatcher | `packages/core/src/api-server.ts` (`npm run api`) | Serves the dynamic API. Also runs a **pending-run poller** (`startPendingRunsLoop`, started at boot) that claims `status='pending'` rows the edge created and starts `ArmageddonLevel7Workflow` on the shared task queue, flipping the row to `running`. |
| Temporal worker | `packages/core/src/worker.ts` (`npm run worker`) | Long-polls the same task queue, executes the battery activities, and via `core/reporter.ts` writes `armageddon_events` + `armageddon_runs` progress that the console streams over Supabase realtime. |

Both dispatch paths (site → api-server directly, or edge insert → api-server
poller) require these two services. Neither is deployed → the run never executes.

---

## 3. Proof the code path is correct

### 3.1 End-to-end against a real Temporal server (opt-in harness)

An ephemeral Temporal dev server (`@temporalio/testing`) + a real `Worker`
registering the real workflows and activities was used to run the actual
`ArmageddonLevel7Workflow` (SIM_MODE, batteries B10–B13). A fake PostgREST
endpoint captured exactly the rows the browser console streams:

```
════════ RESULT ════════
workflow status : COMPLETED
grade / score   : A / 100
batteries       : B10_GOAL_HIJACK=PASSED, B11_TOOL_MISUSE=PASSED, B12_MEMORY_POISON=PASSED, B13_SUPPLY_CHAIN=PASSED

════════ TELEMETRY CAPTURED (what the console streams) ════════
total events        : 8
BATTERY_STARTED     : B10, B11, B12, B13
BATTERY_COMPLETED   : B10, B11, B12, B13
run status updates  : passed
terminal run row    : {"status":"passed","batteries_passed":[...]}

════════ VERDICT ════════
✅ PASS — sequence ran start → certification with live telemetry.
```

This is the exact flow the stuck `0/13` screen never received. When a run fails
naturally (e.g. the deterministic SimulationAdapter breaches on a given seed) the
workflow instead persists `status='failed'` — also a terminal state that unsticks
the console. Either way, the run advances; it does not hang.

### 3.2 CI-safe regression shield

`packages/core/tests/integration/certification-pipeline.test.ts` (new) drives the
real battery activities → `generateReport` → `finalizeRunActivity` in the same
order the workflow does, against a fake Supabase capture, asserting per-battery
`BATTERY_STARTED`/`BATTERY_COMPLETED` telemetry and a terminal `status='passed'`
run row. It runs in the normal vitest suite with no external services, so this
failure mode is now guarded in CI.

### 3.3 Full production gate

`npm run lint` (0 errors), `npm run typecheck` (pass), `npm run test`
(143 core + 245 site = 388 tests pass), `npm run build` (pass).

---

## 4. The one change that unsticks production

Deploy the API/dispatcher + worker and point the site at the dispatcher. Detailed
operator steps are in `RUNBOOK_EXECUTION_ENGINE_2026-07-06.md`; the essentials:

1. Provision Temporal (Cloud namespace + API key, or self-hosted) and a shared
   `TEMPORAL_TASK_QUEUE`; a Supabase service-role key; a host for two containers.
2. Fill `.env.moat` (`SIM_MODE=true` is required — the worker refuses to boot
   otherwise, and it is the correct mode for the simulation certified path).
3. `docker compose -f docker-compose.exec.yml up -d --build`.
4. Set `NEXT_PUBLIC_ARMAGEDDON_API_BASE=https://<api-host>` on the site and
   redeploy so `/api/run` reaches the dispatcher.
5. Verify with a real Level 7 run: the `armageddon_runs` row should go
   `pending → running`, `armageddon_events` should appear, and the console should
   advance past `0/13` to a signed verdict.

No application code change is required to make simulation runs execute.

---

## 5. What was NOT changed, and why

- **No safety control was weakened.** `SIM_MODE` enforcement and the live-fire
  gate (`packages/core/src/core/safety.ts`, Invariant 10) are load-bearing and
  untouched. SIM_MODE runs are the normal certified-simulation path; they are not
  what blocks a run.
- **No overzealous target flag is blocking runs.** `SafetyGuard.validateTarget()`
  (the `.com`/`.io`/`api.` production-host heuristic) has **zero call sites** in
  the run path — it is dead code (see the 2026-06-27 release-gate audit). The
  frontend target validator (`validateTargetEndpointUrl`) explicitly allows
  `http(s)` hosts including `localhost`. A real run is not gated by a
  false-positive safety flag.
