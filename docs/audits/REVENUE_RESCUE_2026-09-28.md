# Revenue Rescue P1 — Audit Record (2026-09-28)

Scope: execution contract "armageddontest.icu Revenue Rescue v1.0" (issued 2026-09-27), Phases 0, 1, 2.
Phase 3 (automated Stripe entitlements) is gated on owner approval and is **not** implemented.
Evidence below is from commands run in this session unless marked UNVERIFIED.

## Baseline vs after (repository gates, CI-equivalent)

| Gate | Baseline (`2b2a501`) | After |
| --- | --- | --- |
| `npm ci` | pass | pass |
| `npm run docs:check` | pass | pass |
| `npm run lint` | pass | pass |
| `npm run typecheck` | pass | pass |
| `npm run test -- --coverage` | 491 passed (core 226 + site 265) | 554 passed (core 226 + site 328), 0 failed |
| `npm run build -w armageddon-site` | pass | pass |

## Findings verified this session

| # | Finding | Evidence | Status |
| --- | --- | --- | --- |
| F1 | CI static export ships paid CTAs on `payment=pending` | Local `CLOUDFLARE_STATIC_EXPORT` build without `NEXT_PUBLIC_STRIPE_*`: 0 `buy.stripe.com` links in `out/pricing.html` | Fixed (WI-1): CI-mode build → 5 distinct links, identical to `wrangler.jsonc` |
| F1-live | Live `/pricing` | `curl https://armageddontest.icu/pricing` (2026-09-28): 5 distinct `buy.stripe.com` links, identical to `wrangler.jsonc` | Live site is NOT broken today — it was deployed manually from a local env file |
| F4+ | Deploy workflow invalid | `deploy-cloudflare.yml` had `needs: [cloudflare-local-build]`, a job defined in `ci.yml`. GitHub Actions: last successful run #272 (2026-07-22); every run since failed at parse time | Fixed (WI-0). Consequence: merging to `main` will auto-deploy again |
| F4 | PRs could deploy to production | Old condition allowed same-repo `pull_request` | Fixed (WI-0) |
| F5 | Password committed in 2 E2E specs | `git grep`; also in history (`19531af`, `9a09a05`) | Removed from tracked files (WI-3). History unchanged — rotation required |
| F6 | Homepage H1 `sr-only` | `DestructionConsole.tsx` | Fixed (WI-4) |
| F7 | Homepage perf | Local static export, Playwright, 412px, 4x CPU, 1.6 Mbps/150 ms, 3 runs: LCP ≈ 2.1 s (hero wordmark AVIF, already preloaded); **CLS 0.249** | CLS → 0.000 (WI-5). LCP unchanged; field 5.3 s not reproducible locally (UNVERIFIED cause) |
| New | Tier-lock overlay covered free Step 1 | Screenshot + DOM: overlay `absolute inset-0` positioned against the Step 1 + Step 2 container | Fixed (scoped to Step 2) |
| F9 | No funnel events | No client-callable event pipeline exists (`armageddon_events.run_id` is `NOT NULL` FK to runs; Worker has no event route) | **Blocked (WI-6)** — needs approval to add one |

## Stripe documentation checks (WI-2)

- `client_reference_id` (docs.stripe.com/payment-links/url-parameters): alphanumerics, dashes, underscores, ≤ 200 chars; invalid values silently dropped; echoed on `checkout.session.completed`. An org UUID qualifies.
- `prefilled_email` (docs.stripe.com/payment-links/customize): must be a valid email; buyer can still edit it; percent-encoding recommended (`URLSearchParams` encodes `@` as `%40`).

## New test files

| File | Shields |
| --- | --- |
| `armageddon-site/tests/unit/deploy-workflow-gate.test.ts` | Invariant 16 |
| `armageddon-site/tests/unit/no-committed-credentials.test.ts` | Invariant 18 |
| `armageddon-site/tests/unit/public-build-env.test.ts` | Invariant 17 (JSONC parse, env precedence, both gate halves, validity parity) |
| `armageddon-site/tests/unit/lib/payment-links-checkout-context.test.ts` | `withCheckoutContext` |
| `armageddon-site/tests/unit/pricing-checkout-context.test.tsx` | Pricing CTA context + honest notes |
| `armageddon-site/tests/unit/components/DestructionConsole-hero.test.tsx` | Visible H1, CTAs, overlay scope |

Extended: `TargetConfigPanel.test.tsx` (static-HTML box reservation), `hero-lcp.test.ts` (tab icon).

## Owner actions (not performed by this change)

- **S0 (P0):** rotate every credential in the shared env file and the committed E2E password; enable 2FA.
- **S1:** decide on a history purge (after rotation).
- **J:** confirm the fulfilment SLA (the site now states "within 1 business day" — an assumption) and the support address.
- **K / L:** Phase 3 mapping decision (Pro/Team have no `OrganizationTier`) and webhook registration.
- **Enterprise card routing:** the card CTA goes to the Stripe deposit link (configured, live); the UI contract previously read as if it went to `/intake`. Decide: keep deposit, or route the card to scope review.
- Paid upgrades remain **manual**: match Stripe Checkout Sessions to orgs by `client_reference_id`, then set `organizations.current_tier`.

## Documentation refreshed (same branch)

| Document | Change |
| --- | --- |
| `README.md` | Checkout/fulfilment reality, deploy trigger, revenue gate, gate list incl. `docs:check`, 554-test baseline, `/api/leaderboard`, `scripts/lib` |
| `.understand-anything/CANONICAL_STATE_2026-09-28.md` | New snapshot; 2026-07-22 snapshot marked superseded |
| `omni-recall/` | Session record, start-here entry + canonical-state pointer, standing constraints in `user-operating-model.md`, CLAUDE.md mirror |
| `CLAUDE.md` | Invariants 16–18 |
| `AGENTS.md` | Env-template rule corrected (two templates, key names only); merge = production deploy; agents never merge |
| `PRODUCTION_STATUS.md` | Decision row; Playwright (not in CI), static-edge (CI deploy restored) and search-indexing rows corrected |
| `feature_registry.md` | Revenue/deploy-safety domain; indexing entry corrected (enabled since `13aaa1d`, verified live) |
| `OPS_RUNBOOKS.md` | 6.1 revenue-gate failure, 6.2 manual paid fulfilment SOP, post-incident rotation scope |
| `docs/CLOUDFLARE_DEPLOYMENT.md` | Execution path corrected (Render + Temporal Cloud), build-time `vars` inlining, revenue gate, `/api/leaderboard`, CI deploy trigger |
| `docs/CANONICAL_UI_CONTRACT.md` | Pricing note line semantics; Enterprise fallback vs configured-link wording aligned with the enforced assertion |
| `docs/QUICKSTART.md` | `docs:check`, static-export build, E2E credential setup, `payment=pending`-in-dev troubleshooting |
| `docs/README.md` | Links to the new snapshot and this audit |
| `docs/READINESS_ASSESSMENT.md`, `RUNBOOK_EXECUTION_ENGINE_2026-07-06.md` | Dated annotations (historical records not rewritten) |

