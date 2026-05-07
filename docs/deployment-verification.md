# Deployment Verification Commands — Cloudflare/Local Proof Gates

**Date:** 2026-05-06
**Scope:** Non-destructive verification commands for proving the local Docker Moat and local frontend path before deprecating Vercel production reliance.
**Safety:** These commands do not alter test batteries, branding copy, certification copy, or production secrets.

## Secret Handling Rules

- Do not paste provider tokens into commands.
- Do not commit `.env.moat` or generated secret files.
- Use `.env.moat.example` only as the template for local verification.
- Use provider dashboards or CI secret stores for Cloudflare credentials.

## Gate 0 — Repository Hygiene

Run from repository root:

```bash
git status --short --branch
rg -n --hidden -S 'vercel|@vercel|wrangler|cloudflare|render|docker-compose\.moat|deploy_moat|kill_moat|armageddon-core\.vercel\.app' \
  -g '*.{md,json,yml,yaml,toml,js,ts,tsx,ps1,env,example}' \
  -g '!node_modules' \
  -g '!vendor' \
  -g '!dist' \
  -g '!build' \
  -g '!.git' \
  -g '!package-lock.json' \
  -g '!*.tsbuildinfo' \
  .
```

Pass criteria:

- Worktree state is understood before edits.
- Vercel/Cloudflare references are classified before removal.

## Gate 1 — Local Dependency and Build Proof

```bash
npm ci
npm run typecheck
npm run build
npm --prefix armageddon-site run build
```

Pass criteria:

- Workspace dependencies install from lockfile.
- Shared/core/site type checks pass.
- Shared/core/site builds pass.
- Site builds outside Vercel.

## Gate 2 — Moat Compose Configuration Proof

Create local Moat env if it does not already exist:

```bash
cp .env.moat.example .env.moat
```

Then validate the compose model:

```bash
docker compose -f docker-compose.moat.yml --env-file .env.moat config
```

Pass criteria:

- Compose resolves without undefined required variables.
- Services remain localhost-bound where defined.
- `SIM_MODE=true` remains enforced for the worker.

## Gate 3 — Moat Runtime Proof

```bash
docker compose -f docker-compose.moat.yml --env-file .env.moat up -d --build
docker compose -f docker-compose.moat.yml --env-file .env.moat ps
docker inspect --format='{{json .State.Health.Status}}' armageddon-worker-moat
curl -fsS http://127.0.0.1:8080 >/dev/null
```

Pass criteria:

- Worker image builds.
- Postgres, Temporal, Temporal UI, and worker containers start.
- Worker health check returns a healthy status, or a concrete readiness defect is captured before Vercel deprecation proceeds.
- Temporal UI responds on `127.0.0.1:8080`.

Cleanup after runtime proof:

```bash
docker compose -f docker-compose.moat.yml --env-file .env.moat down
```

## Gate 4 — Local Site Runtime Proof

Use one terminal for the site process:

```bash
npm --prefix armageddon-site run start
```

Use a second terminal for the probe:

```bash
curl -fsS http://127.0.0.1:3000 >/dev/null
```

Pass criteria:

- Next.js serves the frontend locally after `npm --prefix armageddon-site run build`.
- Vercel is not required to load the UI.

## Gate 5 — Cloudflare Frontend Proof

No Cloudflare command is defined in this repository yet. Add Cloudflare configuration only after Gates 1-4 pass.

Minimum acceptance criteria for the future Cloudflare patch:

- Cloudflare config is committed as code.
- New dependencies are justified by runtime compatibility, performance, cost, and security impact.
- `/api/run` Temporal dispatch remains local/Moat-backed unless Cloudflare compatibility is explicitly proven.
- Local Moat verification continues to pass unchanged.

## Deprecation Authorization Checklist

Before treating Vercel as fully decommissioned, confirm:

- [ ] Gate 1 passed.
- [ ] Gate 2 passed.
- [ ] Gate 3 passed.
- [ ] Gate 4 passed.
- [ ] `vercel.json` disables automatic provider Git deployments with `git.deploymentEnabled=false`.
- [ ] Active README assets are repository-local or Cloudflare-hosted and load.
- [ ] Footer deployment copy reflects Cloudflare/local Moat posture.
- [ ] Cloudflare frontend proof exists, or local-only replacement is explicitly accepted.
- [ ] `/api/run` Temporal dispatch is still backed by a proven local/Moat service.
- [ ] Provider GitHub integration / required check is removed from provider or GitHub settings if it still appears.
- [ ] Post-change `rg` scan shows only intentional historical/audit or provider-disable references remain.

## Recommended Verification Order

```bash
npm ci
npm run typecheck
npm run build
npm --prefix armageddon-site run build
cp .env.moat.example .env.moat
docker compose -f docker-compose.moat.yml --env-file .env.moat config
docker compose -f docker-compose.moat.yml --env-file .env.moat up -d --build
docker compose -f docker-compose.moat.yml --env-file .env.moat ps
docker inspect --format='{{json .State.Health.Status}}' armageddon-worker-moat
curl -fsS http://127.0.0.1:8080 >/dev/null
docker compose -f docker-compose.moat.yml --env-file .env.moat down
```
