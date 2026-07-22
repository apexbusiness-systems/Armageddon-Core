---
version: 1.4.0
last_audited: 2026-07-22
status: verified
---

# Start Here

If a future run needs the user's durable memory, this directory is the default entry point.

## Required Read Order

1. `CLAUDE.md`
2. `user-operating-model.md`
3. `quality-bar.md`
4. `do-not-do.md`
5. `default-use-rule.md`

## Usage Rule

Use Omni-Recall by default for continuity, correction memory, and durable operating preferences unless the user explicitly supersedes it.

## Silent Compounding Rule

The system should:
- stay quiet by default
- reduce repeated prompting
- prefer canonical updates over duplicate notes
- promote stable corrections into durable memory
- remain honest about missing access or incomplete backfill

## Last Verified Session

- Audit date: 2026-07-22, latest same-day continuation — real live-fire certification + critical sim-downgrade fix + baseline tag (see `2026-07-22-real-live-fire-and-baseline.md`)
- Key facts: Provisioned a genuinely separate OmniHub staging deployment (new Supabase project, two new Render services) and executed real OmniPort live-fire dispatches. Found and fixed (PR #211, merged) a critical defect: every OmniPort dispatch path omitted `targetModel`, so `AdversarialEngine` silently ran the fake `SimulationProvider` for any `tier: 'CERTIFIED'` run while telemetry still claimed `engine: 'LIVE_FIRE'` — caught by noticing battery durations (2.7–3.4s) were far too fast for real LLM round trips, not by trusting the label. `AdversarialEngine` now throws instead of silently degrading; re-verified with two subsequent real dispatches (~19–24s/battery, consistent with genuine network calls). Also fixed: the OmniPort task-queue orphaning bug (silently stuck every prior live-fire dispatch on the shared deployment), leaderboard build-name + dedup, a PDF certificate box-overlap defect, and a Markdown report section that read as blank on a clean pass. `main` tagged as this session's verified baseline after full quality-gate re-confirmation (479 tests). CLAUDE.md Invariant 10 corrected (was wrongly inferring the `SIM_MODE` boot gate meant live-fire could never execute — it doesn't; the boot gate and the per-run real/simulated choice are independent). New `.understand-anything/CANONICAL_STATE_2026-07-22.md` added as a point-in-time repo-state snapshot separate from this session-history log.
- Durable correction: never trust the `engine: 'LIVE_FIRE'` telemetry tag alone as proof a run was real — it is self-reported from `tier` alone, which is exactly what was wrong here. Cross-check independent signal (battery duration, real token/cost counts) before treating a run as genuinely live-fire.

## Previous Verified Session (2026-07-22, same-day continuation — free-tier cold-start + verdict integrity)

- Audit date: 2026-07-22, same-day continuation (free-tier cold-start root-cause fix + certificate verdict integrity, merged and LIVE-DEPLOY VERIFIED — see `2026-07-22b-cold-start-fix-and-verdict-integrity.md`)
- Key facts: The user supplied real E2E credentials + a Render API key mid-session, which unblocked genuine production runs (earlier attempts were blocked by sandbox network egress, not missing access). Two PRs merged to `main`: **#206** — Wake-on-Enqueue + Active-Run Self-Sustain (root-cause fix for the free-tier idle/cold-start problem, zero cost/deps) and a real B14-telemetry code defect fix; **#207** — fixed a genuine verdict-integrity defect (a clean simulation pass was labelled `FAILED`; now three-state `CERTIFIED | VALIDATED | FAILED`) plus three real PDF layout defects, found by actually rendering a certificate and inspecting it. Both merges **confirmed live** by direct API checks against GitHub, Render, and Cloudflare (not assumed from the merge event) — see that session file for the exact commands. A clean post-deploy Level 7 run (all 5 batteries, 0 breaches, 100/100, zero telemetry gaps, no cold-start retry) produced the final certificate. `PRODUCTION_STATUS.md` and `docs/audits/PRODUCTION_RUN_DISPATCH_STUCK_2026-07-22.md` corrected to close out the P1. Root `CLAUDE.md` had a second stale claim (RATE_LIMIT_KV "not yet provisioned") found and corrected, then re-mirrored to `omni-recall/CLAUDE.md`.
- Durable correction (supersedes the note below): a genuine Level 7 run and real signed certificate **were** produced this session, once real credentials were available — the earlier caution about not fabricating one still holds when credentials/access are absent.

## Previous Verified Session (2026-07-22, earlier same day — onboarding→certification E2E validation)

- Audit date: 2026-07-22 (onboarding→certification E2E user-shoes validation — see `2026-07-22-onboarding-certification-e2e-validation.md`)
- Key facts: Full root quality gate (lint/typecheck/test/build, 447 tests) and a real-browser onboarding→console user-shoes journey (12/12 checks) passed against the canonical Cloudflare static export. Decision: GO for the onboarding→certification flow. Root `README.md` was stale (Moat-only) and was rewritten to describe both shipped surfaces (public Cloudflare site + execution engine) and the 8-level system; `npm run docs:check` re-verified green. Durable correction: do not fabricate a Level 7/8 certification seal/PDF without a real run — no staging test credentials exist in this environment, and `packages/core/src/worker.ts` refuses to start live-fire (`SIM_MODE=false`) by design (CLAUDE.md Invariant 10).

## Previous Verified Session (2026-07-07 — git-history reconciliation)

- Audit date: 2026-07-07 (git-history reconciliation — see `2026-07-07-git-history-reconciliation.md`)
- Key facts: Release gate PR #184 landed CLAUDE.md Invariants 12–15 (run-record integrity, edge attestation endpoint, pricing SoT, marketing claim integrity). Execution-engine gap ("EXECUTING 0/13") root-caused as a deployment gap, not a code defect; deploy path merged via PRs #187–#189 (`docker-compose.exec.yml`, runbook, certification-pipeline integration test). Production deployment of api-server + worker remains UNVERIFIED (operator action). J3 onboarding validation defect fixed in PR #190.
- Docs synced this session: `PRODUCTION_STATUS.md`, `feature_registry.md`, `docs/README.md`, `docs/CLOUDFLARE_DEPLOYMENT.md`, `omni-recall/CLAUDE.md` (re-synced from root — it had drifted, missing Invariants 12–15).
- 2026-07-08: Env alias resolver added for Supabase/Admin variables; see `2026-07-08-env-alias-resolver.md`.

## Previous Verified Session (2026-07-05)

- Key facts: P0 Access Control Bypass (email substring match) resolved. Rate Limiting reordered. SSRF mitigation applied to `targetEndpoint`. M4 and M2/M3 issues addressed. P0-4 KV binding drift flagged as PENDING OPERATOR VERIFICATION.
- Docs synced that session: `PRODUCTION_STATUS.md`, `feature_registry.md`, `OPS_RUNBOOKS.md`, `CLAUDE.md`.
