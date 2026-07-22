---
version: 1.2.0
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
