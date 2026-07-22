# Cloudflare Static Edge Deployment

**Docs version**: 2026.07.04<br>
**Last reviewed**: 2026-07-04<br>
**Deployment surface**: Static Cloudflare edge assets for `armageddon-site`

Armageddon's production-safe execution path remains the local Docker Moat. Cloudflare is used only for the static containment-interface edge surface; Temporal, the Python bridge, service-role operations, and test batteries remain local/Moat-backed.

## Build

Run from the repository root:

```bash
npm run build:cloudflare -w armageddon-site
```

This sets `CLOUDFLARE_STATIC_EXPORT=true`, causing `armageddon-site/next.config.mjs` to emit a static `out/` build without changing normal local Next.js behavior.

### Required build-time environment (inlined into the static bundle)

`NEXT_PUBLIC_*` values are inlined by Next.js **at build time** — setting them as
Cloudflare Worker/Pages runtime vars or secrets has **no effect on an
already-built bundle**. The following must be present in the environment when
`next build` runs (the `deploy-cloudflare.yml` workflow sets them on the build
step):

| Variable | Value | Why |
| --- | --- | --- |
| `NEXT_PUBLIC_ARMAGEDDON_API_BASE` | `https://armageddontest.icu` | Same-origin backend base URL. **If missing, `isApiConfigured()` is `false` and the console silently locks every backed action** — custom batteries show "requires verified tier", runs cannot start, and the attestation badge reads `Evidence signing key unavailable`, regardless of any Worker secret (including `ADMIN_EMAIL`). |
| `NEXT_PUBLIC_SITE_URL` | `https://armageddontest.icu` | Canonical site URL. |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from secrets | Browser-side Supabase auth. |

> The value in `wrangler.jsonc` `vars` is a **Worker runtime** value only; it does
> not reach the client build. `validate:production-env` warns (non-fatally) when
> `NEXT_PUBLIC_ARMAGEDDON_API_BASE` is absent.

The gatekeeper admin-override and tier checks additionally require the **Worker**
to have `ADMIN_EMAIL` (exact, case-sensitive match of the account email),
`SUPABASE_URL` (or `ARMAGEDDON_DB_URL`), and `SUPABASE_SERVICE_ROLE_KEY` (or `ARMAGEDDON_DB_SERVICE_ROLE_KEY`) set as dashboard secrets — but
these only take effect once the frontend can actually reach the backend (above).

### Which routes the Worker itself serves (verified against `intake-handler.ts`, 2026-07-04)

The Worker's `fetch` handler (`armageddon-site/src/intake-handler.ts`) dispatches a
fixed switch statement **before** falling through to static assets. Only the
routes in that switch return dynamic JSON; everything else — including any
path that merely *looks* like an API route — falls through to
`env.ASSETS.fetch(request)` and, per `wrangler.jsonc`'s
`not_found_handling: single-page-application`, gets the **same 200 HTML SPA
shell as a nonexistent path**, not a 404 and not JSON.

| Route | Served by the Worker? |
| --- | --- |
| `/api/intake` | Yes — `handleIntake` |
| `/api/me/organizations` | Yes — `handleMeOrganizations` |
| `/api/omniport/health` | Yes — `handleOmniportHealth` |
| `/api/gatekeeper` | Yes — `handleGatekeeper` |
| `/api/run` | Yes — `handleRun` (creates a `pending` row; does **not** call Temporal itself — see below) |
| `/api/support-chat` | Yes — `handleSupportChat` (ATLAS) |
| `/api/attestation/pubkey` | **Yes — since PR #184 (2026-07-06)** — `handleAttestationPubkey` in `intake-handler.ts` (CLAUDE.md Invariant 13). WebCrypto Ed25519 derivation, formula-identical to `packages/shared/src/attestation-key.ts`; fail-closed 503 when `ARMAGEDDON_ATTESTATION_SEED` is missing/malformed. (Before 2026-07-06 this route was NOT served: it returned the SPA shell, confirmed live 2026-07-04. The Next.js route at `armageddon-site/src/app/api/attestation/pubkey/route.ts` remains unreachable on the static export — the Worker is the production surface.) |
| `/api/omniport/execute`, `/api/omniport/live-fire`, `/api/omniport/control`, `/api/omniport/waiver`, `/api/omniport/telemetry` | **No.** Same as above — the Next.js route files under `armageddon-site/src/app/api/omniport/` are static-export-only and never served here. |

The routes marked "No" above are only implemented in
`packages/core/src/api-server.ts` (a standalone Node HTTP process — see
`packages/core/Dockerfile.api`). **Where that process runs in production is
not committed to this repository and is UNVERIFIED.** `docker-compose.yml`
(local dev) and `docker-compose.moat.yml` / `docker-compose.moat.cloud.yml`
(operator Moat) all define an `api`/`worker` service. **Corrected 2026-07-22:**
a committed Render Blueprint (`render.yaml`, added 2026-07-05, running
`packages/core/Dockerfile.api`) now exists and defines a candidate production
target for `api-server.ts` — the "no committed cloud config" claim below is
stale. Whether that Render service is actually deployed and reachable in
production remains UNVERIFIED from repository state alone. Do not assume these
routes are reachable at `https://armageddontest.icu` in production without
fresh operator evidence (see `PRODUCTION_STATUS.md`).

`/api/run`'s actual dispatch to Temporal happens out-of-band: the Worker only
inserts a `pending` row in Supabase; `packages/core/src/api-server.ts`'s
background poller (`startPendingRunsLoop`) is what claims that row and starts
the Temporal workflow via gRPC. That poller process must be running
somewhere with connectivity to both Supabase and the `TEMPORAL_ADDRESS`
configured in `wrangler.jsonc` for `/api/run` to ever leave the `pending`
state — this is exactly the "Temporal worker poller" row already flagged
`UNVERIFIED` in `PRODUCTION_STATUS.md`.

## Deploy

Run from the repository root after the static build succeeds:

```bash
CLOUDFLARE_ACCOUNT_ID=<account-id> \
CLOUDFLARE_API_TOKEN=<pages-or-workers-token> \
CLOUDFLARE_WORKER_NAME=armageddon-core \
node scripts/deploy_cloudflare_static.mjs
```

The deploy script uploads the generated `armageddon-site/out` assets to Cloudflare Workers Static Assets through the Cloudflare API and enables the `workers.dev` route for verification.

## Required evidence before release approval

```bash
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
npm run build:cloudflare -w armageddon-site
```

Record Cloudflare API responses, asset upload status, and resulting verification URL in a dated deployment note. Do not claim the public URL is live from repository state alone.

## ATLAS Support-Chat — required operator provisioning

The `/api/support-chat` endpoint (ATLAS agent) requires two resources that are not auto-created by deployment. The operator must run these **before** a production deployment:

### 1. KV namespace for rate limiting

> **Corrected 2026-07-22:** The 2026-06-24 status below is stale. `armageddon-site/wrangler.jsonc` has carried a real KV namespace ID (`92d18e3aa55a4769b4485ffb3616f034`, committed 2026-07-05) in place of the `REPLACE_WITH_KV_NAMESPACE_ID` placeholder since PR that landed that commit — the config-level blocker described below is resolved. Whether that namespace is reachable/functioning against the live Cloudflare account is still **UNVERIFIED** without fresh operator evidence (dashboard check or a live rate-limit-triggering request); this doc reports repository state, not live runtime state.
>
> **Original status (confirmed 2026-06-24, superseded above):** The production `armageddon-core` Worker shows only one binding (`ASSETS`) in the Cloudflare dashboard. `RATE_LIMIT_KV` is **not yet provisioned**. Rate limiting is silently skipped. See OPS runbook 5.2.

```bash
npx wrangler kv namespace create RATE_LIMIT_KV
```

Copy the returned `id` and replace the `REPLACE_WITH_KV_NAMESPACE_ID` placeholder in `armageddon-site/wrangler.jsonc` (already done in the committed config as of 2026-07-05 — this step is for provisioning a *new* namespace, e.g. for a different environment):

```jsonc
"kv_namespaces": [
  { "binding": "RATE_LIMIT_KV", "id": "<paste-id-here>" }
]
```

**Note**: Deploying with the placeholder value is not a hard failure — the Worker binds gracefully and rate limiting is silently skipped. The committed config no longer uses the placeholder, but rate limiting only functions if the referenced namespace actually exists and is reachable in the target Cloudflare account.

### 2. Anthropic API key (required — no fallback)

```bash
npx wrangler secret put ANTHROPIC_API_KEY
```

Without this secret the endpoint returns `503 NOT_CONFIGURED` for every request. It cannot be committed to source control.

### Verification

After provisioning, confirm both resources are visible:

```bash
npx wrangler kv namespace list
npx wrangler secret list
```

## Constraints

- Do not deploy `.env.moat` or service-role secrets to Cloudflare.
- Do not move Temporal worker execution to Cloudflare Workers; the worker requires the Docker Moat runtime.
- Do not alter certification/legal copy during deployment-provider changes.
- Do not reintroduce Render or legacy preview-host configuration unless a new deployment decision record explicitly approves it.
- Do not set `Access-Control-Allow-Origin: *` in `handleSupportChat` — it must remain origin-locked to `canonicalHost`.


### Operator UX readiness copy (2026-06-30)

The static console now explains build-time backend gaps in plain language. If `NEXT_PUBLIC_ARMAGEDDON_API_BASE` is absent when `next build` runs, `/console` shows `Live backend connected` as incomplete and tells operators that real runs cannot start until the variable is configured at build time. If `ARMAGEDDON_ATTESTATION_SEED` is absent on the backend, the attestation UI shows `Evidence signing key unavailable`; no secret values are exposed, and signed certification artifacts remain incomplete until the seed is configured.

### Service worker kill switch and Cloudflare Insights CSP (2026-07-04)

`public/sw.js` is a permanent no-op service worker whose only job is to unregister itself and clear all caches on activate. A prior build shipped a real Workbox service worker at this path; it was removed from the codebase, but browsers that had already registered it kept re-fetching `/sw.js` on every visit — since the static edge falls back to the SPA shell (200 HTML) for any unrecognized path, the stale worker's own update check silently kept re-installing itself instead of ever seeing a 404. Do not delete `public/sw.js` or add a `fetch` handler to it; both would resurrect the stale-worker problem for returning visitors. `_headers` forces `Cache-Control: no-store` on `/sw.js` so the browser's periodic update check always sees the current (empty) file.

Cloudflare Web Analytics loads `https://static.cloudflareinsights.com/beacon.min.js` and reports to `https://cloudflareinsights.com`; both hosts are allow-listed in the `_headers` CSP (`script-src` and `connect-src`). Do not remove them while Cloudflare Web Analytics is enabled on the zone — removing them reproduces the beacon `ERR_NAME_NOT_RESOLVED` / CSP-blocked console errors.

### Build-time env parsing (2026-07-04)

`checkRunEligibility` (via `packages/shared/src/gate.ts`) and `dbRateLimit` (`armageddon-site/src/lib/db-rate-limit.ts`) read Supabase credentials through `readEnv`/`cleanEnvValue` (`packages/shared/src/env.ts`), which strips stray surrounding quotes that dashboards sometimes paste around env values. Canonical `SUPABASE_*` names and `ARMAGEDDON_DB_*` aliases are both accepted. Both Supabase clients are also lazily constructed on first use rather than at module scope — a malformed or absent `SUPABASE_URL` throws inside `supabase-js`'s constructor, and constructing that client at import time previously crashed `next build`'s page-data collection for `/api/run` with `Failed to collect page data for /api/run`. Keep client construction lazy; do not move it back to module scope.
### Supabase environment aliases (2026-07-08)

GitHub/Cloudflare/local/container envs may continue using `SUPABASE_*`. Supabase dashboard secrets must use `ARMAGEDDON_DB_*` aliases when `SUPABASE_*` is rejected. `ADMIN_EMAIL` does not need to change; `ARMAGEDDON_ADMIN_EMAIL` is only an optional alias.

Use this mapping consistently:

| Canonical name | Optional alias |
| --- | --- |
| `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` | `ARMAGEDDON_DB_URL` |
| `SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `ARMAGEDDON_DB_ANON_KEY` |
| `SUPABASE_SERVICE_ROLE_KEY` | `ARMAGEDDON_DB_SERVICE_ROLE_KEY` |
| `ADMIN_EMAIL` | `ARMAGEDDON_ADMIN_EMAIL` |

`ARMAGEDDON_ATTESTATION_SEED` is unchanged.
