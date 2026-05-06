# Cloudflare Static Edge Deployment

Armageddon's production-safe path remains the local Docker Moat. Cloudflare is used only for the static containment interface edge surface; Temporal, the Python bridge, service-role operations, and test batteries remain local/Moat-backed.

## Build

```bash
npm run build:cloudflare -w armageddon-site
```

This sets `CLOUDFLARE_STATIC_EXPORT=true`, causing `armageddon-site/next.config.mjs` to emit a static `out/` build without changing normal local Next.js behavior.

## Deploy

```bash
CLOUDFLARE_ACCOUNT_ID=<account-id> \
CLOUDFLARE_API_TOKEN=<pages-or-workers-token> \
CLOUDFLARE_WORKER_NAME=armageddon-core \
node scripts/deploy_cloudflare_static.mjs
```

The deploy script uploads the generated `armageddon-site/out` assets to Cloudflare Workers Static Assets through the Cloudflare API and enables the `workers.dev` route for verification.

## Constraints

- Do not deploy `.env.moat` or service-role secrets to Cloudflare.
- Do not move Temporal worker execution to Cloudflare Workers; the worker requires the Docker Moat runtime.
- Do not alter certification/legal copy during deployment-provider changes.
