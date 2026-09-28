# Armageddon Quick Start

**Docs version**: 2026.09.28<br>
**Last reviewed**: 2026-09-28<br>
**Primary package manager**: npm<br>
**Verified against**: root `package.json`, `packages/core/package.json`, `armageddon-site/package.json`

Use this guide for local development and first-run validation. Run commands from the repository root unless a step explicitly changes directories.

## Prerequisites

- Node.js 22 for parity with CI (`>=20` is the workspace minimum).
- npm with lockfile installs (`npm ci`).
- Docker if you are running the local Temporal/Postgres Moat stack.
- `.env.moat` or local environment variables for integrations that require Supabase/Temporal credentials. Never commit populated env files.
- `GROQ_API_KEY` configured in the environment if executing runs with Groq models in `packages/core`.

## Install and verify the repo

```bash
npm ci
npm run docs:check
npm run lint
npm run typecheck
npm run test
npm run build
```

Expected result: all workspace checks complete without TypeScript, ESLint, test, or build failures (these mirror `.github/workflows/ci.yml`).

### Production artifact (Cloudflare static export)

```bash
cd armageddon-site
node ../scripts/build_cloudflare_static.mjs          # local: logs the Stripe link count
CI=true node ../scripts/build_cloudflare_static.mjs  # CI mode: enforces the revenue gate
```

Public `NEXT_PUBLIC_*` values (API base, Supabase URL, the five Stripe Payment Links) are filled from `armageddon-site/wrangler.jsonc` `vars` when not already set. See `docs/CLOUDFLARE_DEPLOYMENT.md`.

### Playwright E2E (optional, not run in CI)

Admin-credential specs skip unless `E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD` are exported in your shell (key names are in `armageddon-site/.env.example`; never commit values).

## Run the site locally

```bash
npm run dev -w armageddon-site
```

Default Next.js URL: `http://localhost:3000`.

## Run the worker locally

```bash
npm run worker -w armageddon-core
```

The worker uses the Temporal address from environment configuration, falling back to `localhost:7233` where the code supports a local default.

## Run the local Moat stack

Use this when you need Temporal/Postgres orchestration instead of isolated workspace commands.

```bash
cp .env.moat.example .env.moat
# Edit .env.moat locally; do not commit secrets.
docker-compose -f docker-compose.moat.yml up -d
npm run worker -w armageddon-core
```

PowerShell operators can use the deployment wrapper documented in `DEPLOYMENT.md`:

```powershell
.\scripts\deploy_moat.ps1
```

## Run a certification flow locally

1. Start the local site: `npm run dev -w armageddon-site`.
2. Start Temporal/Postgres via Docker if the flow needs orchestration.
3. Start the worker: `npm run worker -w armageddon-core`.
4. Open `http://localhost:3000`.
5. Authenticate through GitHub OAuth if the route requires a user session.
6. Start the run from the UI and monitor worker logs plus the browser network tab.

## Troubleshooting matrix

| Symptom | Likely cause | Verification | Fix |
| --- | --- | --- | --- |
| `/api/run` fails to enqueue | Temporal is unavailable | Check worker logs and Temporal port `7233` | Start Docker Moat stack and worker. |
| Auth button does nothing | Supabase public env vars missing | Browser console logs Supabase initialization warning | Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. |
| Rate-limit check fails during build | Service role credentials not available in local build | Build logs mention missing Supabase credentials | Expected for static/local builds unless testing server-side quota paths. |
| Paid pricing CTAs show `payment=pending` locally | `next dev` / plain `next build` do not read `wrangler.jsonc` `vars` | `grep -c buy.stripe.com` on the built pricing page | Expected in dev. Use the static export build above, or export the `NEXT_PUBLIC_STRIPE_LINK_*` values. |
| Shared package imports fail | `packages/shared` not built | Check `packages/shared/dist/` | Run `npm ci` or `npm run build:shared`. |

## Canonical follow-up docs

- Documentation hub: `docs/README.md`
- Deployment protocol: `DEPLOYMENT.md`
- Operations runbooks: `OPS_RUNBOOKS.md`
- Cloudflare deployment: `docs/CLOUDFLARE_DEPLOYMENT.md`
- Sonar quality gate policy: `docs/compliance/SONAR_GATE_POLICY.md`
