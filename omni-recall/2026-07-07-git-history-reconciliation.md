---
version: 1.0.0
date: 2026-07-07
status: verified (against git history and GitHub PR records, not live runtime)
---

# 2026-07-07 — Git-History Reconciliation & Doc Sync

Omni-Recall had not been updated since 2026-07-05. This note reconciles the durable
memory and the canonical status docs against the actual remote repository state,
using git history and the GitHub PR record as the source of truth.

## Ground truth: what merged since the last audit (2026-07-05)

| PR | Merged | Summary |
| --- | --- | --- |
| #180 | 2026-07-05 | Restored the legal disclaimer dropped in the PDF certificate template rewrite. |
| #181 | 2026-07-06 | SettingsModal (operator/billing/FAQ), Support & Privacy nav links, CEO admin bypass. **Note:** the fabricated org-membership part of this bypass was reverted by #184 (Invariant 12). |
| #182 | 2026-07-06 | Forward Supabase bearer tokens to gatekeeper UI calls (AuthHeader, SettingsModal). |
| #183 | 2026-07-06 | Cap certified-tier client execution at Level 7; regression tests; added `omni-recall/2026-07-06-p2-admin-run-level-repair.md`. |
| #184 | 2026-07-06 | Release gate: removed fabricated admin org identity (fixed `/api/run` 500), edge `/api/attestation/pubkey`, pricing SoT, claim integrity, SEO/GEO assets. Added **CLAUDE.md Invariants 12–15** and four regression-shield test files. |
| #185 | 2026-07-07 | Core Web Vitals restored to Good (LCP anti-fade, backdrop-blur removal). |
| #186 | 2026-07-07 | Authenticated operators no longer bounced from onboarding to pre-purchase intake (perceived-logout bug). |
| #187 | 2026-07-07 | Execution-engine runbook (`RUNBOOK_EXECUTION_ENGINE_2026-07-06.md`); api-server CORS locked to site origin (`CORS_ALLOW_ORIGIN`). |
| #188 | 2026-07-07 | `docker-compose.exec.yml` — the api-server dispatcher + worker deploy file the runbook references. |
| #189 | 2026-07-07 | Certification-pipeline integration test (proves start→certification code path) + `docs/EXECUTION_ENGINE_VERIFICATION_2026-07-07.md`. |
| #190 | 2026-07-07 (open) | J3 onboarding fix: target URL format validation + edited URLs no longer silently reverted to the stale saved target. |

## Defect found during reconciliation: stranded post-merge commits

PR #189 merged at 17:48Z with head `b30fd10`. A later session pushed two more
commits to the **already-merged** branch `claude/stuck-testing-sequence-p4i39v`:

- `3724259` — `docs/COWORK_UI_UX_EXECUTION_CONTRACT.md`
- `5cae8de` — `docs/EXECUTOR_DEPLOY_TURNKEY.md` + contract corrections (full 6-tier pricing table, J3 safety/UX split)

These never reached `main`. They were recovered by cherry-picking both commits
onto the PR #190 branch during this session. **Durable lesson:** commits pushed
to a branch after its PR merges are silently stranded — always verify
`merged_at` vs. the pushed SHA, or start a fresh branch.

## Drift corrected this session

- `omni-recall/CLAUDE.md` — was a 2026-07-04 snapshot missing Invariants 12–15; re-synced verbatim from root `CLAUDE.md` (which matches `main`).
- `PRODUCTION_STATUS.md` — header bumped to 2026-07-07; decisions ledger extended with the #181–#189 record.
- `feature_registry.md` — header bumped; new "Release Gate & Execution Engine" domain covering PRs #181–#190.
- `docs/README.md` — hub now links the execution-engine runbook, turnkey guide, verification evidence, Cowork contract, release gate, and Omni-Recall.
- `docs/CLOUDFLARE_DEPLOYMENT.md` — `/api/attestation/pubkey` row corrected: it **is** served by the Worker since PR #184 (the doc still claimed the pre-#184 SPA-shell behavior).
- `omni-recall/start-here.md` — Last Verified Session updated to 2026-07-07.

## Still UNVERIFIED (requires operator / live runtime)

- Production deployment of the two execution-engine processes (api-server dispatcher + Temporal worker). Until deployed, runs still stall at `EXECUTING 0/13`. Remedy: `docs/EXECUTOR_DEPLOY_TURNKEY.md`.
- `RATE_LIMIT_KV` binding provisioning (known gap since 2026-06-24, OPS runbook 5.2).
- Live behavior of the edge attestation endpoint after the next `wrangler deploy`.
