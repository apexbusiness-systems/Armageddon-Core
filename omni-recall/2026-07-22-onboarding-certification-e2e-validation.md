---
date: 2026-07-22
status: verified-against-repository
---

# 2026-07-22 — Onboarding→Certification E2E User-Shoes Validation

## Context
Requested: comprehensive user-shoes validation that the onboarding→certification flow works end-to-end for production, on branch `claude/onboarding-certification-e2e-validation-yctjru`.

## What was actually verified (evidence-backed)
- Full quality gate from repo root: `npm ci`, `npm run lint`, `npm run typecheck`, `npm run test` (193 + 254 = 447 tests), `npm run build` — all green.
- Canonical Cloudflare static export (`node scripts/build_cloudflare_static.mjs`) built clean; served locally and driven with a real Chromium browser (Playwright) through the actual user journey: home → pricing → onboarding (blank-submit validation, malformed target URL rejection, certified-tier submit → real `/intake?tier=certified&payment=pending` page, self-serve submit → `/console` entitlement check) → console (renders honestly, never fabricates a verdict, blocks `initiate` without prerequisites with a real message). 12/12 checks passed; screenshots captured.
- No source code defects found in the flow. The one build hiccup (`next build` failing on `/api/attestation/pubkey` under `output: export`) was my own invocation via a bare `next build`, not a repo defect — the canonical build script `scripts/build_cloudflare_static.mjs` already stashes `src/app/api` for exactly this reason.
- Decision: **GO** for the onboarding→certification flow as shipped.

## Durable correction — no fabricated Level 7/8 certification artifacts
The user separately demanded an "authentic" Level 7 certification seal + PDF from a "successfully finished" run. This was refused, with reasons that should hold for any future session facing the same ask:
1. No `STAGING_EMAIL`/`STAGING_PASSWORD` (the credentials `scripts/staging-e2e-cert.mjs` requires for a real certified-tier sign-in) exist in this environment. `SUPABASE_SERVICE_ROLE_KEY` exists but using it to hand-insert a `passed` row into `armageddon_runs` would be forging the exact artifact a certificate attests to, not running a test.
2. Live-fire Level 7 cannot execute in this deployment as shipped: `packages/core/src/worker.ts:71` (`safetyGuard.enforce('WorkerStartup')`) `process.exit(1)`s unless `SIM_MODE==='true'`, and Level 7 requires `SIM_MODE=false`. This is documented as intentional in `CLAUDE.md` Invariant 10 — not something to route around.
A generated PDF/seal without a real run behind it would be fabricated evidence. If a genuine Level 7 certificate is ever wanted, either provision real staging credentials and run `scripts/staging-e2e-cert.mjs`, or make the separate, deliberate decision to stand up a live-fire-authorized worker deployment.

## Documentation sweep (same session)
- Root `README.md` was stale — described only the local Docker "Moat" and omitted the entire public Cloudflare surface (`armageddon-site`: marketing, pricing, onboarding, `/console`) and the 8-level certification system. Rewritten to describe both coordinated surfaces accurately; `npm run docs:check` (docs-drift + level-integrity, which enforces the `[LEVEL N]` README badge matches `MAX_CERTIFICATION_LEVEL`) re-verified green after the edit.
- `PRODUCTION_STATUS.md`, `feature_registry.md`, and `docs/README.md` were checked and found already accurate and current (dated 2026-07-07, UNVERIFIED-tagged appropriately) — not rewritten.

## Verification commands used
```bash
npm ci && npm run lint && npm run typecheck && npm run test && npm run build
node scripts/build_cloudflare_static.mjs
npm run docs:check
```
Plus an ad hoc Playwright user-shoes script (scratchpad-only, not committed) driving the served static export.
