# Armageddon Production Release Posture

> **DOCS VERSION**: 2026.06.25<br>
> **LAST REVIEWED**: 2026-06-25<br>
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
| ATLAS support-chat edge endpoint | Defined — operator provisioning required | `armageddon-site/src/intake-handler.ts` → `handleSupportChat`. Requires KV namespace (`RATE_LIMIT_KV`, **not yet bound in production as of 2026-06-24**) and `ANTHROPIC_API_KEY` secret. See `docs/CLOUDFLARE_DEPLOYMENT.md` and `CLAUDE.md` for provisioning steps. See OPS runbook 5.2. |
| Support chat / privacy pages | Defined | `armageddon-site/src/app/support/page.tsx` and `armageddon-site/src/app/privacy/page.tsx` shipped in PR #143. |
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
| 2026-06-24 | Added ATLAS support-chat agent (`/api/support-chat`) with injection-hardened Cloudflare Worker backend; added privacy policy page. | PR #143, `armageddon-site/src/intake-handler.ts`, `armageddon-site/src/app/support/page.tsx`, `armageddon-site/src/app/privacy/page.tsx`. |
| 2026-06-24 | Fixed two security bugs in `validateSupportInput` (empty-string code and over-broad base64 pattern); exported security functions for test coverage. | PR #143, `armageddon-site/tests/unit/worker-support-chat-security.test.ts`. |
| 2026-06-24 | Created `CLAUDE.md` as the frozen canonical security invariants and guardrails document. | `CLAUDE.md`. |
| 2026-06-24 | Fixed two stale-URL bugs: `DEFAULT_CANONICAL_HOST` in `intake-handler.ts` and default zone name in `deploy_cloudflare_static.mjs` both incorrectly referenced `armageddon.icu` instead of `armageddontest.icu`. These would cause CORS failures and failed local/manual deployments without `CLOUDFLARE_ZONE_NAME` set. | PR #143, commit after `5a4be97`. |
| 2026-06-24 | Confirmed via Cloudflare dashboard: `RATE_LIMIT_KV` binding is **not yet provisioned** (only `ASSETS` bound). Rate limiting is silently skipped. Operator must run `npx wrangler kv namespace create RATE_LIMIT_KV` and update `wrangler.jsonc`. Documented in `CLAUDE.md` Invariant 6 and `OPS_RUNBOOKS.md` runbook 5.2. | Cloudflare Workers dashboard — armageddon-core bindings panel. |
| 2026-05-15 | Removed stale Render blueprint files from source control. | Documentation audit `docs/DOCUMENTATION_AUDIT_2026-05-15.md`. |
| 2026-05-15 | Removed generated test-output and push-log artifacts. | Documentation audit `docs/DOCUMENTATION_AUDIT_2026-05-15.md`. |
| 2026-05-15 | Replaced unverifiable live-health wording with repository-verifiable release posture. | This file. |
