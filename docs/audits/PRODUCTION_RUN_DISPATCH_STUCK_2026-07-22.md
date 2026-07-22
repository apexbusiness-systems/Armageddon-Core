# Production Certification Run Never Reaches Terminal State — Dispatch Gap

**Date**: 2026-07-22
**Status**: RESOLVED (deployed) — see "Final update" below. Originally OPEN.
**Severity**: P1 (no certification run can complete in production; no certificate can be issued)
**Evidence source**: Live E2E against `https://armageddontest.icu` using an authorized certified-tier account.

---

## Final update (same day) — root-cause fixes merged, deployed, and confirmed live

PR #206 (merged) shipped root-cause fixes for the free-tier idle/cold-start problem this doc describes, without any paid plan or new dependency:

- **Wake-on-Enqueue** (`armageddon-site/src/intake-handler.ts`, `wakeExecutor`): the edge fires one fire-and-forget wake request to the executor the instant a run is enqueued.
- **Active-Run Self-Sustain** (`packages/core/src/api-server.ts`, `startSelfSustainLoop`): while a run is in flight, the service self-pings its own `RENDER_EXTERNAL_URL` to reset Render's idle timer; goes quiet when idle so the free tier can still sleep.
- The B14 telemetry defect described below is fixed (reporter calls added to `runBattery14_IndirectInjection`).

PR #207 (merged, commit `e833cd5`) additionally fixed the verdict-integrity defect this investigation surfaced (see its own commit message): `EvidenceGenerator.computeVerdict()` was binary and mislabelled a clean simulation pass as `FAILED`; it is now three-state (`CERTIFIED | VALIDATED | FAILED`).

**Deployment confirmed live, 2026-07-22 ~08:06 UTC** (verified directly, not assumed):
- Render (`armageddon-exec-api`): deploy for commit `e833cd5` status `live`; `/api/omniport/health` reports `temporalConnected:true, supabaseConnected:true`.
- Cloudflare (`armageddontest.icu`): `/deployment.json` → `sourceCommit: e833cd50...`, matching `main` HEAD exactly.
- A real Level 7 run dispatched after this confirmation (see repo history / session record for the run ID and result) exercises the deployed code directly.

The original dispatch gap is closed: a run created through the normal onboarding flow now wakes the executor automatically, and a long-running battery set keeps the executor warm for itself. Operators no longer need to manually curl the health endpoint to unstick a pending run.

## Update (same day) — follow-up run + B14 telemetry defect found and fixed in code

After waking the idle Render service directly (`https://armageddon-exec-api.onrender.com/health`), a fresh Level 7 run (id `6d608387-98ab-4a72-9ee5-e87f35034e14`, all 5 batteries B10-B14) reached a real terminal state: `failed`, score 80/100, 1 breach. This confirms the dispatcher *does* work once the free-tier service is awake — the P1 above is specifically about it going idle, not a logic defect in the dispatch code path.

That run surfaced a second, distinct, code-level defect: **B14_INDIRECT_INJECTION emitted zero `armageddon_events` rows** despite being marked `executed`/`failed` on the run record — every other battery (B10-B13) had start/complete telemetry. Root cause: `runBattery14_IndirectInjection` (`packages/core/src/temporal/activities.ts`) is the only battery that delegates to a separate legacy engine module (`core/engine/activities.ts`) and never called the reporter itself. **Fixed** (commit `2a3499f` on this branch) by pushing the same `BATTERY_STARTED`/`BATTERY_COMPLETED` events every other battery pushes, with a new regression test in `certification-pipeline.test.ts`. Not yet live — `render.yaml` only auto-deploys from `main`, and this fix has not been merged.

Also resolved with certainty while investigating: telemetry showing `engine=SIMULATION` for a CERTIFIED-tier run is **intentional, not a bug** — `api-server.ts:1080` forces `workflowTier='FREE'` whenever `SIM_MODE==='true'`, and the deployed worker requires `SIM_MODE=true` to boot at all (`CLAUDE.md` Invariant 10). Live-fire cannot execute in this deployment for any tier today, by design.

---

## Summary

A real, authenticated certification run was created in production but **never progressed past `status='pending'`**. The user-facing onboarding→console flow is healthy; the **backend execution pipeline does not drain pending runs**, so no run reaches `passed`/`failed` and no attestation/certificate is ever produced.

## Reproduction (live, 2026-07-22)

Ran `scripts/staging-e2e-cert.mjs` against production with a real certified-tier login:

| Step | Result |
| --- | --- |
| Supabase auth (email+password) | ✅ signed in |
| `GET /api/me/organizations` | ✅ real `organization_id` resolved |
| `GET /api/omniport/health` | ⚠️ `degraded` — `temporalConnected:false` |
| `POST /api/run` | ✅ run row created (`status:pending`) |
| Poll `armageddon_runs` to terminal (300s) | ❌ stuck at `pending` the entire window |
| `armageddon_events` rows for the run | ❌ zero events persisted |

Health endpoint body (edge worker):
```json
{"status":"degraded","simMode":false,"temporalConnected":false,
 "temporalError":"Temporal Cloud not configured (TEMPORAL_ADDRESS/NAMESPACE/API_KEY)",
 "supabaseConnected":true,"omniPortEnabled":true}
```

## Root cause (evidence-backed)

1. **The edge Cloudflare Worker does not dispatch to Temporal** — by design. `createRunRecord` in `armageddon-site/src/intake-handler.ts` only inserts a `pending` row; the HTTP `temporalStartWorkflow` helper in that file has no call sites. The edge health `temporalConnected:false` is therefore expected for the edge (it has no `TEMPORAL_*` bindings) and is **not** the dispatch mechanism.
2. **The Node `api-server` dispatcher is not draining runs in production.** `packages/core/src/api-server.ts` (`startPendingRunsLoop` → `pollPendingRunsOnce` → `dispatchPendingRun`, lines ~1106–1151) is the process that polls Supabase for `pending` runs and starts the Temporal workflow that the worker then executes. The run sitting at `pending` for 300s with zero events proves this loop is not processing runs in the deployed environment — the process is not running, not reaching Temporal Cloud, or not deployed. `render.yaml` defines a Render service for `packages/core/Dockerfile.api`, but its live runtime state cannot be verified from the repository.

## Why this could not be resolved from the validation session

The self-drain path (run the dispatcher + worker locally against production Temporal Cloud + Supabase — legitimate here because the stuck run is `sim_mode:true`, which the `SIM_MODE=true` worker-startup gate permits) was attempted and is **blocked by network egress**, not by credentials:

- `@temporalio/client` `Connection.connect()` to `armageddon-prod.smvtx.tmprl.cloud:7233` → **"Failed to connect before the deadline."**
- Raw `TCP /dev/tcp/…:7233` → **timeout**; `curl https://…tmprl.cloud/` → **connection reset**.
- Supabase (HTTPS) auth in the same session succeeded and the Temporal API key is present (404 chars), so this is a **gRPC egress limitation of the execution sandbox**, not a bad credential.

## Next executable actions (operator)

1. On the Render service (or wherever `api-server.ts` runs), confirm the process is up and its startup log shows `[PendingLoop] Pending run dispatcher started.` with real `TEMPORAL_ADDRESS/NAMESPACE/TASK_QUEUE` values — **not** `[PendingLoop] Temporal not ready` / `Missing Supabase credentials`.
2. Confirm that host can reach `armageddon-prod.smvtx.tmprl.cloud:7233` over gRPC (TLS + API-key auth).
3. Confirm the **worker** (`packages/core/src/worker.ts`, `SIM_MODE=true`) is running and polling the same `TEMPORAL_TASK_QUEUE` the dispatcher targets (`${prefix}-${organizationId}` topology — see `RUNBOOK_EXECUTION_ENGINE_2026-07-06.md` and its 2026-07-18 amendment).
4. Re-run `scripts/staging-e2e-cert.mjs` from a host with Temporal Cloud gRPC egress; a run reaching `passed`/`failed` with persisted events confirms closure.

## Scope note

This is a **deployment/runtime gap**, not a code defect found in this repository — the dispatch code path exists and is correct on inspection. No certificate/seal should be issued until a run reaches a terminal state through this pipeline; producing one otherwise would be fabricated evidence.
