---
date: 2026-09-28
baseline_commit: 2b2a5010c4375037fb45a9138d85de1c4c0cc873 (main) + branch claude/intelligent-shannon-2zmczs (Revenue Rescue P1, unmerged)
supersedes: CANONICAL_STATE_2026-07-22.md
status: verified-against-repository
---

# Armageddon-Core — Canonical State Snapshot (2026-09-28)

Point-in-time, evidence-backed answer to "what is this repo, right now". Session history
and durable corrections live in `omni-recall/` (start at `omni-recall/start-here.md`).
Anything marked UNVERIFIED needs a live check before it is relied on.

## What ships

1. **`armageddon-site/`** — Next.js app, static-exported to Cloudflare Workers Assets
   (`wrangler.jsonc`, domain `armageddontest.icu`). The only dynamic backend at the edge is
   the Worker `src/intake-handler.ts`: `/api/intake`, `/api/run`, `/api/gatekeeper`,
   `/api/me/organizations`, `/api/attestation/pubkey`, `/api/leaderboard`,
   `/api/omniport/health`, `/api/support-chat`.
2. **`packages/core/`** — Node.js Temporal worker (`worker.ts`) + API server
   (`api-server.ts`) that executes adversarial batteries. Production: `armageddon-exec-api`
   on Render (API server + worker in one container). Local: Docker "Moat".

`packages/shared/` is the source of truth for the 8 certification levels (`src/levels.ts`),
batteries (`src/batteries.ts`), tier model (`src/gate.ts`: `OrganizationTier = 'free_dry' |
'verified' | 'certified'`) and OmniPort auth/crypto (`src/omniport.ts`).

## Certification levels and live-fire (unchanged since 2026-07-22)

Levels 1–6 simulate the adversary. Level 7 drives a real LLM adversary (PAIR loop) across
B10–B14. Level 8 is Level 7 air-gapped in local Docker (`environment: 'MOAT'`), never
reachable from a cloud path. `worker.ts` refuses to boot unless `SIM_MODE=true` (process
gate); a `tier: 'CERTIFIED'` run with a real `targetModel` still executes real live-fire
inside that process (CLAUDE.md Invariant 10). Real live-fire was verified on 2026-07-22 via
the waiver-gated OmniPort endpoint (~19–24 s per battery vs ~3 s simulated). Verdicts are
three-state: `FAILED`, `VALIDATED` (clean simulated pass), `CERTIFIED` (clean live-fire pass).

## Commercial path (as of 2026-09-28)

- **Catalog** (`src/lib/pricing.ts`, CAD): Self-Serve Dry Run (free), Pro, Team, Verified,
  Certified, Enterprise. Pro and Team have **no matching `OrganizationTier`** — granting them
  needs an owner decision (retire the plans, or add tiers via an additive migration).
- **Checkout:** Stripe Payment Links. Public URLs live in `wrangler.jsonc` `vars`; the
  Cloudflare build inlines them (`scripts/lib/public-build-env.mjs`) and, on CI, fails when
  any of the 5 paid links is missing/invalid or the exported pricing page has < 5 distinct
  `buy.stripe.com` links (Invariant 17). Live `/pricing` carried the 5 links on 2026-09-28.
- **Attribution:** signed-in buyers' links carry `client_reference_id` = org UUID and
  `prefilled_email` (`withCheckoutContext`). Anonymous buyers get the plain link.
- **Fulfilment: manual.** No Stripe webhook exists; nothing writes
  `organizations.current_tier` from a payment. The pricing page promises an upgrade
  "within 1 business day" — an owner-confirmed SLA is still pending.
- **Funnel measurement:** none beyond Cloudflare Web Analytics page views. No
  client-callable event pipeline exists (`armageddon_events.run_id` is a NOT NULL FK).

## Deploy path

`.github/workflows/deploy-cloudflare.yml` deploys production on push to `main` or
`workflow_dispatch` only; pull requests never deploy (Invariant 16). From 2026-07-22 to
2026-09-28 that workflow was invalid (cross-workflow `needs`) and failed every run, so
production in that window was deployed manually via `scripts/run_deploy_cf.mjs` (loads a
local env file). Once the branch above merges, merges auto-deploy again. PR build
verification is `ci.yml` (docs, lint, typecheck, tests with coverage, site build).

## Homepage

Visible value proposition (single H1 "Know if your release can survive before customers
do.", subline, "Start free dry run" → console Step 1, "See pricing"). LCP element is the
AVIF hero wordmark (preloaded). Local measurement (412 px, 4x CPU): LCP ≈ 2.1 s, CLS 0.000
(was 0.249 before the TargetConfigPanel fix). Field LCP 5.3 s reported by Cloudflare Web
Analytics is not reproduced locally — cause UNVERIFIED.

## Quality gate

`npm ci && npm run docs:check && npm run lint && npm run typecheck && npm run test && npm run build`
— all green on 2026-09-28: 554 tests (core 226, site 328). Playwright E2E specs under
`armageddon-site/e2e/` exist but run in no workflow; admin-credential specs skip unless
`E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` are set.

## Known debt (not fixed, owner decisions)

- **Credential rotation (P0):** a password was committed in two E2E specs (removed from
  tracked files 2026-09-28; still in git history) and a full secret set was shared in chat.
  Rotation is the fix.
- 12 stale open PRs (#33, #69, #72, #78, #97, #103–#109, Feb–Mar 2026) against far-behind bases.
- Non-English dictionaries are largely ASCII-folded (missing diacritics); needs native review.
- Phase 3 (Stripe webhook → entitlements, Pro/Team tier mapping) not started; gated on
  owner approval.

## Infrastructure (last live checks)

- Site `https://armageddontest.icu` — reachable, `/pricing` 200 with 5 Stripe links (2026-09-28).
- `armageddon-exec-api` (Render), Temporal Cloud, Supabase prod — last live-verified
  2026-07-22; current state UNVERIFIED.
- `RATE_LIMIT_KV` — real namespace id committed; binding in the live account UNVERIFIED.
