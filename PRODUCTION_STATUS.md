# Armageddon Production Release Posture

> **DOCS VERSION**: 2026.07.04<br>
> **LAST REVIEWED**: 2026-07-04<br>
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
| OmniPort connector (Level 8 / Kinetic Moat) | Defined, not provisioned | `packages/core/src/api-server.ts` → `handleOmniPort*`; `packages/shared/src/omniport.ts`; `docker-compose.moat.cloud.yml`. `OMNIPORT_ENABLED` is unset everywhere (safe default: routes return 503). No per-operator Temporal Cloud credentials exist, and **where `api-server.ts` itself runs in production is not committed to this repository** (see `docs/CLOUDFLARE_DEPLOYMENT.md` — no Fly.io/Render/Railway config exists for it). **Not usable for a real live-fire run today regardless of provisioning**: `packages/core/src/worker.ts` refuses to start unless `SIM_MODE=true` (protected invariant, `CLAUDE.md`), which this work does not and must not change. See `feature_registry.md` "OmniPort Connector" domain. |
| Attestation public-key endpoint on the public domain | **Corrected 2026-07-04 — previously misdocumented as live** | Live-verified via `curl` against `https://armageddontest.icu/api/attestation/pubkey`: returns HTTP 200 with the SPA HTML shell, identical to a nonexistent path — not the JSON attestation response, not a 503. `armageddon-site/src/intake-handler.ts` never routes this path (confirmed against its switch statement); the Next.js route is static-export-only and never served. The endpoint **is** implemented in `packages/core/src/api-server.ts` → `handleAttestationPubkey`, so it works if and only if that process is deployed and publicly reachable — see the OmniPort row above for why that is unverified. `feature_registry.md`'s prior "Implemented and live-tested" status for this feature was inaccurate and has been corrected. |

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
| 2026-07-05 | Resolved critical authorization bypass by replacing insecure substring matching (`.includes('apex')`) with strict `ADMIN_EMAIL` exact matching across `route.ts` and `intake-handler.ts`. Enforced SSRF validation on `targetEndpoint` via `validateSSRF`. Reordered `/api/run` org rate-limits to execute post-authorization. Marked 6/27 audit P0-1 (Marketing drift), P0-2 (Model drift), P0-4 (CSP), and P0-5 (B6 race condition) as RESOLVED. P0-4 KV binding drift remains PENDING OPERATOR VERIFICATION. | `omni-recall/audits/2026-07-05_P0_Access_Control_Resolution.md` |
| 2026-07-04 | Live-verified `GET https://armageddontest.icu/api/attestation/pubkey` returns the SPA HTML shell (200), not the JSON attestation response — identical behavior to a nonexistent path, confirming `intake-handler.ts` never routes it. Corrected `feature_registry.md` (previously "Implemented and live-tested") and `docs/CLOUDFLARE_DEPLOYMENT.md` (previously listed this route as served by the Worker) to state the actual, verified behavior. | `curl` transcript against the production domain; `armageddon-site/src/intake-handler.ts` switch statement (no `/api/attestation/pubkey` case). |
| 2026-07-04 | Wired the OmniPort connector (execute/live-fire/control/waiver/telemetry) into `packages/core/src/api-server.ts` — previously unreachable in both production backends (the Next.js routes are static-export-only and never served). Extracted shared auth/crypto primitives to `packages/shared/src/omniport.ts` so `armageddon-site` and `armageddon-core` cannot drift. Fixed a `targetUrl`/`targetEndpoint` field-name mismatch that silently dropped the target from every OmniPort-triggered workflow. Added per-operator Temporal task-queue resolution and a `docker-compose.moat.cloud.yml` for the "Moat-pulls" custody model. Confirmed this does **not** make live-fire executable: `packages/core/src/worker.ts`'s `SIM_MODE=true` startup gate (protected in `CLAUDE.md`) is untouched and still blocks it — flagged as a known, deliberate limitation, not fixed here. | PR #174, `packages/shared/src/omniport.ts`, `packages/core/src/api-server.ts`, `docker-compose.moat.cloud.yml`, `feature_registry.md`. |
| 2026-07-04 | Confirmed `npm run build` succeeds end-to-end (Next.js production build) on an unrestricted-network environment; closes the sandbox-network-only build-verification gap from the 2026-06-24 release-gate audit. | `docs/audits/BUILD_VERIFICATION_2026-07-04.log`, exit code 0. |
| 2026-06-24 | Added ATLAS support-chat agent (`/api/support-chat`) with injection-hardened Cloudflare Worker backend; added privacy policy page. | PR #143, `armageddon-site/src/intake-handler.ts`, `armageddon-site/src/app/support/page.tsx`, `armageddon-site/src/app/privacy/page.tsx`. |
| 2026-06-24 | Fixed two security bugs in `validateSupportInput` (empty-string code and over-broad base64 pattern); exported security functions for test coverage. | PR #143, `armageddon-site/tests/unit/worker-support-chat-security.test.ts`. |
| 2026-06-24 | Created `CLAUDE.md` as the frozen canonical security invariants and guardrails document. | `CLAUDE.md`. |
| 2026-06-24 | Fixed two stale-URL bugs: `DEFAULT_CANONICAL_HOST` in `intake-handler.ts` and default zone name in `deploy_cloudflare_static.mjs` both incorrectly referenced `armageddon.icu` instead of `armageddontest.icu`. These would cause CORS failures and failed local/manual deployments without `CLOUDFLARE_ZONE_NAME` set. | PR #143, commit after `5a4be97`. |
| 2026-06-24 | Confirmed via Cloudflare dashboard: `RATE_LIMIT_KV` binding is **not yet provisioned** (only `ASSETS` bound). Rate limiting is silently skipped. Operator must run `npx wrangler kv namespace create RATE_LIMIT_KV` and update `wrangler.jsonc`. Documented in `CLAUDE.md` Invariant 6 and `OPS_RUNBOOKS.md` runbook 5.2. | Cloudflare Workers dashboard — armageddon-core bindings panel. |
| 2026-05-15 | Removed stale Render blueprint files from source control. | Documentation audit `docs/DOCUMENTATION_AUDIT_2026-05-15.md`. |
| 2026-05-15 | Removed generated test-output and push-log artifacts. | Documentation audit `docs/DOCUMENTATION_AUDIT_2026-05-15.md`. |
| 2026-05-15 | Replaced unverifiable live-health wording with repository-verifiable release posture. | This file. |
