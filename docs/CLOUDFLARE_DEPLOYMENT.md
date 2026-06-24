# Cloudflare Static Edge Deployment

**Docs version**: 2026.06.24<br>
**Last reviewed**: 2026-06-24<br>
**Deployment surface**: Static Cloudflare edge assets for `armageddon-site`

Armageddon's production-safe execution path remains the local Docker Moat. Cloudflare is used only for the static containment-interface edge surface; Temporal, the Python bridge, service-role operations, and test batteries remain local/Moat-backed.

## Build

Run from the repository root:

```bash
npm run build:cloudflare -w armageddon-site
```

This sets `CLOUDFLARE_STATIC_EXPORT=true`, causing `armageddon-site/next.config.mjs` to emit a static `out/` build without changing normal local Next.js behavior.

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

```bash
npx wrangler kv namespace create RATE_LIMIT_KV
```

Copy the returned `id` and replace the `REPLACE_WITH_KV_NAMESPACE_ID` placeholder in `armageddon-site/wrangler.jsonc`:

```jsonc
"kv_namespaces": [
  { "binding": "RATE_LIMIT_KV", "id": "<paste-id-here>" }
]
```

**Note**: Deploying with the placeholder value is not a hard failure — the Worker binds gracefully and rate limiting is silently skipped. However, rate limiting will not function until the real ID is in place.

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
