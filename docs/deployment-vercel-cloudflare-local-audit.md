# Deployment Audit — Vercel Deprecation Gate

**Date:** 2026-05-06
**Scope:** Audit deployment dependencies and identify the minimum safe path to deprecate Vercel production reliance after Cloudflare/local proof.
**Patch status:** Documentation-only. No runtime code, test batteries, branding copy, or certification copy changed.

## 1. Current Deployment Paths

### Local Docker Moat — active primary path

The primary production-like path is the localized Docker Moat stack:

- `docker-compose.moat.yml` defines the Moat runtime boundary.
- `scripts/deploy_moat.ps1` builds the worker image, runs bridge verification, and starts the Moat stack.
- `scripts/kill_moat.ps1` stops and removes Moat containers for containment response.
- `DEPLOYMENT.md` and `README.md` document this path as the operating protocol.

Moat services currently include:

- `armageddon-worker-moat` — worker built from `armageddon-core/Dockerfile`.
- `armageddon-postgres-moat` — local Postgres persistence.
- `armageddon-temporal-moat` — local Temporal server.
- `armageddon-temporal-ui-moat` — local Temporal UI bound to `127.0.0.1:8080`.

### Local non-moat compose — active development/support path

`docker-compose.yml` remains a local development/support stack for Temporal, Postgres, and the worker. It should not be removed while Moat operation is protected.

### Next.js site — active local UI path, not bundled in Moat compose

`armageddon-site` exposes standard Next.js scripts (`dev`, `build`, `start`). The Moat compose file does not currently define a Next.js site container, so the local UI path is a separate process until an explicit site service is approved and proven.

### Render Blueprint — stale/deprecated candidate

`render.yaml` defines a Docker worker on Render, but repository status documentation records a pivot away from Render after blueprint failure. Treat this as stale infrastructure residue unless a fresh Render path is explicitly re-approved.

### Cloudflare — signaled, not yet proven

Cloudflare appears in UI status copy, but this repository currently has no `wrangler.toml`, OpenNext Cloudflare adapter config, Cloudflare Pages config, or Cloudflare deploy script. Cloudflare is therefore not a proven deployment path yet.

## 2. Vercel Artifacts and Status

| Artifact | Location | Status | Action gate |
| --- | --- | --- | --- |
| Vercel config | `vercel.json` absent in current tree | Dead/absent | No removal needed. |
| Vercel dependency | No `vercel`/`@vercel/*` dependency in package manifests | Dead/absent | No removal needed. |
| Vercel deploy script | No Vercel deploy script in package manifests | Dead/absent | No removal needed. |
| Local Vercel metadata ignore | `.gitignore` ignores `.vercel/` | Safe | Keep; prevents local metadata commits. |
| README hosted image URLs | `README.md` references `armageddon-core.vercel.app` assets | Active doc/runtime reference | Replace only after replacement assets are proven. |
| Footer Vercel badge/copy | `armageddon-site/src/components/Footer.tsx` | Active visible UI copy | Do not change without explicit branding/deployment-copy approval. |
| Readiness Vercel references | `docs/READINESS_ASSESSMENT.md` | Stale/contradictory | Deprecate only after Cloudflare/local proof. |
| Render blueprint | `render.yaml` | Stale/deprecated candidate | Deprecate separately from Vercel after approval. |

## 3. Cloudflare/Local Replacement Plan

### Gate A — prove local Moat first

Before any Vercel deprecation patch, prove the local Moat stack still resolves, builds, starts, and exposes local health surfaces. This protects Docker Moat operation from drift.

### Gate B — prove local Next.js site second

Build and start `armageddon-site` outside Vercel. This establishes that Vercel is not required for local UI operation.

### Gate C — prove Cloudflare frontend third

Only after local proof, add the minimum Cloudflare Pages/OpenNext configuration needed to build the frontend target. Do not route Temporal workflow dispatch through Cloudflare until compatibility is explicitly proven.

### Gate D — preserve Temporal API safety

`armageddon-site/src/app/api/run/route.ts` starts a Temporal workflow through the server-side Temporal client. The current Temporal client connects to `TEMPORAL_ADDRESS`. That API path should remain local/Moat-backed unless a Cloudflare-compatible Temporal dispatch boundary is designed and tested.

### Gate E — deprecate Vercel references last

After Gates A-C pass:

1. Replace Vercel-hosted README assets with local or Cloudflare-hosted assets.
2. Deprecate stale readiness Vercel checklist items.
3. Update visible footer deployment copy only with explicit approval because it is active UI copy.
4. Keep `.vercel/` ignored.

## 4. Minimal Patch List

Approved and completed by this documentation patch:

1. Add this audit file to classify deployment paths and Vercel artifacts.
2. Add `docs/deployment-verification.md` with proof commands and pass/fail criteria.

Not included in this patch:

- No Cloudflare config files.
- No package dependency changes.
- No package script changes.
- No Docker compose changes.
- No Vercel copy removal.
- No branding or certification copy changes.
- No test battery changes.

## 5. Risk Register

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Removing active Vercel asset URLs too early | Broken README imagery or external asset loads | Replace only after local/Cloudflare asset path is proven. |
| Moving `/api/run` directly to Cloudflare without Temporal proof | Workflow dispatch outage | Keep Temporal dispatch local/Moat-backed until a tested gateway exists. |
| Adding Cloudflare adapter dependencies prematurely | Build/runtime drift and lockfile churn | Add only after local proof and adapter selection. |
| Editing footer deployment text under branding freeze | Scope violation | Require explicit copy approval before UI text changes. |
| Changing compose while auditing | Moat regression | This patch is documentation-only. |

## Decision

Vercel production reliance is not proven as an active deploy mechanism in repository configuration, but active Vercel references remain in docs/assets/UI copy. Deprecation should proceed only after local Moat and local/Cloudflare frontend proof gates pass.
