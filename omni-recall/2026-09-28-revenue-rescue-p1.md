---
date: 2026-09-28
status: verified-in-session
contract: "armageddontest.icu Revenue Rescue v1.0 (issued 2026-09-27) — not committed verbatim: it quotes a leaked credential"
---

# Revenue Rescue P1 (Phases 0–2)

Full evidence: `docs/audits/REVENUE_RESCUE_2026-09-28.md`. New invariants: CLAUDE.md 16–18.

## Durable facts

1. `deploy-cloudflare.yml` failed at parse time on every run from 2026-07-22 (last green: run #272) to 2026-09-28 because `deploy` declared `needs:` on a job that lives in `ci.yml`. Production in that window was deployed manually (`scripts/run_deploy_cf.mjs`, which loads a local env file). Fixed; merges to `main` auto-deploy again, pull requests never do.
2. Live `/pricing` had 5 working Stripe links on 2026-09-28 only because of that manual deploy. A CI build had 0. The build now inlines `NEXT_PUBLIC_*` from `wrangler.jsonc` and a CI revenue gate blocks < 5 links.
3. Paid upgrades are still manual (no webhook). Checkout links carry `client_reference_id` = org UUID for signed-in buyers — use it to match Stripe payments to orgs.
4. No client-callable funnel-event pipeline exists (WI-6 blocked pending approval). Cloudflare Web Analytics page views of `/pricing` are the only funnel signal today.
5. Non-English dictionaries are largely ASCII-folded (missing diacritics, e.g. "uberlebt", "Ver precos"). Pre-existing; not changed wholesale (needs native review). New strings use correct spelling.
6. Search indexing is ENABLED (repo + live, 2026-09-28): `robots.txt` allows public pages; `layout.tsx` `robots: { index: true }`. The PR #215 full block was reverted by `13aaa1d`; older notes saying "noindex" are stale.
7. The Enterprise pricing card CTA goes to the Stripe deposit link whenever it is configured (it is); only its fallback and the footer link go to `/intake?tier=enterprise`. Owner decision pending on which the card should use.

## Durable corrections

- Verify a finding live before acting on it: F1 ("paid CTAs never reach Stripe in production") was true for CI builds but false for the live site.
- A contract or brief that quotes a secret must never be committed as-is; `tests/unit/no-committed-credentials.test.ts` enforces this for the known leak.
- framer-motion test mocks must return a stable component per tag; a fresh type per access remounts subtrees and detaches nodes on any re-render.
