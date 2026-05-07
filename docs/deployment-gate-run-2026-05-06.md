# Deployment Gate Run — 2026-05-06

**Scope:** Execution record for Gates 1-4 from `docs/deployment-verification.md`.
**Decision:** Do not approve the next legacy-provider decommission or Cloudflare-config patch yet, because Gate 2 and Gate 3 could not be proven in this environment.
**Environment limitation:** Docker is not installed in this checkout runtime, so Docker Compose commands fail before repo configuration can be evaluated.

## Gate Results

| Gate | Status | Evidence |
| --- | --- | --- |
| Gate 1 — Local Dependency and Build Proof | Pass | `npm ci`, `npm run typecheck`, `npm run build`, and `npm --prefix armageddon-site run build` completed successfully. |
| Gate 2 — Moat Compose Configuration Proof | Blocked | `docker compose -f docker-compose.moat.yml --env-file .env.moat config` failed with `/bin/bash: line 3: docker: command not found`. |
| Gate 3 — Moat Runtime Proof | Blocked | `docker compose -f docker-compose.moat.yml --env-file .env.moat up -d --build` failed with `/bin/bash: line 1: docker: command not found`. |
| Gate 4 — Local Site Runtime Proof | Pass | `npm --prefix armageddon-site run start` served the built site and `curl -fsS http://127.0.0.1:3000 >/dev/null` completed successfully. |

## Commands Executed

```bash
npm ci
npm run typecheck
npm run build
npm --prefix armageddon-site run build
test -f .env.moat && echo '.env.moat exists' || cp .env.moat.example .env.moat
docker compose -f docker-compose.moat.yml --env-file .env.moat config
docker compose -f docker-compose.moat.yml --env-file .env.moat up -d --build
npm --prefix armageddon-site run start
curl -fsS http://127.0.0.1:3000 >/dev/null
```

## Follow-Up Requirement

Run Gate 2 and Gate 3 again on a host with Docker Compose available before approving any patch that removes active legacy provider references, adds Cloudflare deployment config, or changes deployment-copy behavior.
