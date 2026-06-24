# Armageddon Production Release Posture

> **DOCS VERSION**: 2026.05.15<br>
> **LAST REVIEWED**: 2026-05-15<br>
> **STATUS SCOPE**: Repository-verified production readiness, not live runtime telemetry<br>
> **OPERATOR**: Proprietary Moat

---

## Release posture: READY FOR OPERATOR VERIFICATION

This status file reports what can be proven from the repository checkout. Public URL health, Cloudflare account state, Supabase project state, and local Moat runtime health require fresh operator evidence from the target environment before release approval.

| Component | Repository-verified status | Evidence |
| --- | --- | --- |
| Root workspace gates | Defined | `package.json` exposes `lint`, `typecheck`, `test`, `build`, and `docs:check`. |
| Shared package | Defined | `packages/shared/package.json` exposes `build`, `typecheck`, and `lint`. |
| Temporal worker/core | Defined | `packages/core/package.json` exposes `worker`, `build`, `typecheck`, `lint`, and non-e2e `test`. |
| Next.js site | Defined | `armageddon-site/package.json` exposes `dev`, `build`, `start`, `test`, `lint`, `typecheck`, `build:cloudflare`, and `deploy:cloudflare`. |
| Local Moat orchestration | Defined | `docker-compose.moat.yml` and `scripts/deploy_moat.*` remain the local execution path. |
| Static Cloudflare edge | Defined | `armageddon-site/wrangler.jsonc`, `scripts/deploy_cloudflare_static.mjs`, and `docs/CLOUDFLARE_DEPLOYMENT.md` define static asset deployment. |
| Render deployment | Removed | Deprecated `render.yaml` and duplicate `renderyaml` were removed on 2026-05-15. |
| Secrets template | Defined | `.env.moat.example` is the committed environment template; populated `.env.moat` must remain uncommitted. |

---

## Required release verification commands

Run from the repository root before release approval:

```bash
npm ci
npm run docs:check
npm run lint
npm run typecheck
npm run test
npm run build
```

For Cloudflare static-edge release candidates, also run:

```bash
npm run build:cloudflare -w armageddon-site
```

For local Moat runtime release candidates, validate Docker Compose configuration and runtime health in an environment with Docker available:

```bash
docker compose -f docker-compose.moat.yml --env-file .env.moat config
docker compose -f docker-compose.moat.yml --env-file .env.moat up -d --build
```

---

## Runtime state requiring fresh evidence

| Runtime surface | Current repository statement | Required proof |
| --- | --- | --- |
| Public site URL | Not provable from checkout alone | HTTP status, response headers, and deployment identifier from the target URL. |
| Cloudflare deployment | Not provable from checkout alone | Cloudflare API/deploy output and verified asset URL. |
| Supabase Auth/DB | Not provable from checkout alone | Supabase project health and migration status from the target project. |
| Temporal worker poller | Not provable from checkout alone | Temporal UI/CLI evidence that the worker is polling the expected task queue. |
| Docker Moat containers | Not provable unless Docker is available in the runtime environment | `docker compose ps` plus health checks after Moat startup. |

---

## Security posture enforced by repository controls

- `SIM_MODE` is part of the Moat environment contract.
- `.env.moat.example` is the only committed Moat environment template.
- Root docs and agent instructions prohibit committing populated secrets.
- Secret scanning is represented by `.github/workflows/secret-scanning.yml`.
- Safety controls must not be removed to make tests pass.

---

## Recent repository decisions

| Date | Decision | Evidence |
| --- | --- | --- |
| 2026-05-15 | Removed stale Render blueprint files from source control. | Documentation audit `docs/DOCUMENTATION_AUDIT_2026-05-15.md`. |
| 2026-05-15 | Removed generated test-output and push-log artifacts. | Documentation audit `docs/DOCUMENTATION_AUDIT_2026-05-15.md`. |
| 2026-05-15 | Replaced unverifiable live-health wording with repository-verifiable release posture. | This file. |
| 2026-05-14 | Standardized canonical docs on npm root gates. | Previous documentation cleanup, superseded by the 2026-05-15 audit. |
