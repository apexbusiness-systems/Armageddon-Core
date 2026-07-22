# Production Certification Run Never Reaches Terminal State — Dispatch Gap

**Date**: 2026-07-22
**Status**: OPEN — requires operator with Render + Temporal Cloud dashboard access
**Severity**: P1 (no certification run can complete in production; no certificate can be issued)
**Evidence source**: Live E2E against `https://armageddontest.icu` using an authorized certified-tier account.

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
