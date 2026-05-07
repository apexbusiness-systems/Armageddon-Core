# Deployment Audit — Cloudflare/Local Migration Gate

**Date:** 2026-05-06
**Scope:** Audit deployment dependencies and identify the minimum safe path to deprecate legacy preview-host production reliance after Cloudflare/local proof.
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

## 2. Legacy Preview-Host Artifacts and Status

| Artifact | Location | Status | Action gate |
| --- | --- | --- | --- |
| Legacy preview-host config | None present in the repository | Removed | Provider integration must be disconnected in GitHub/provider settings if a provider check still appears. |
| Legacy preview-host dependency | No provider dependency in package manifests | Dead/absent | No removal needed. |
| Legacy preview-host deploy script | No provider deploy script in package manifests | Dead/absent | No removal needed. |
| Legacy provider metadata ignore | No provider metadata ignore rule remains | Removed | Do not create or commit provider metadata. |
| README hosted image URLs | `README.md` uses repository-local image assets | Migrated | No external preview-host asset dependency remains. |
| Footer deployment badge/copy | `armageddon-site/src/components/Footer.tsx` | Migrated | Shows Cloudflare/local Moat deployment posture. |
| Readiness deployment references | `docs/READINESS_ASSESSMENT.md` | Migrated | Checklist now points at Cloudflare/local deployment. |
| Render blueprint | `render.yaml` | Stale/deprecated candidate | Deprecate separately from legacy preview host after approval. |

## 3. Cloudflare/Local Replacement Plan

### Gate A — prove local Moat first

Before any legacy-provider decommission patch, prove the local Moat stack still resolves, builds, starts, and exposes local health surfaces. This protects Docker Moat operation from drift.

### Gate B — prove local Next.js site second

Build and start `armageddon-site` outside any legacy preview host. This establishes that a legacy preview host is not required for local UI operation.

### Gate C — prove Cloudflare frontend third

Only after local proof, add the minimum Cloudflare Pages/OpenNext configuration needed to build the frontend target. Do not route Temporal workflow dispatch through Cloudflare until compatibility is explicitly proven.

### Gate D — preserve Temporal API safety

`armageddon-site/src/app/api/run/route.ts` starts a Temporal workflow through the server-side Temporal client. The current Temporal client connects to `TEMPORAL_ADDRESS`. That API path should remain local/Moat-backed unless a Cloudflare-compatible Temporal dispatch boundary is designed and tested.

### Gate E — complete external decommission

After Gates A-C pass:

1. Keep README assets repository-local or Cloudflare-hosted.
2. Keep readiness checklist items aligned to Cloudflare/local deployment.
3. Keep visible footer deployment copy aligned to Cloudflare/local Moat posture.
4. Do not create provider metadata in the repository.
5. Remove the connected Git integration and required check in provider/GitHub settings if it still appears on PRs.

## 4. Minimal Patch List

Completed migration records:

1. Add this audit file to classify deployment paths and legacy preview-host artifacts.
2. Add `docs/deployment-verification.md` with proof commands and pass/fail criteria.

Current repository constraints:

- No package dependency changes.
- No package script changes.
- No Docker compose changes.
- No branding or certification copy changes.
- No test battery changes.
- Active deployment UI/README copy now uses Cloudflare/local wording and repository-local assets.

## 5. Risk Register

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Removing external asset URLs without replacements | Broken README imagery or external asset loads | Use repository-local assets already committed under `armageddon-site/public`. |
| Moving `/api/run` directly to Cloudflare without Temporal proof | Workflow dispatch outage | Keep Temporal dispatch local/Moat-backed until a tested gateway exists. |
| Adding Cloudflare adapter dependencies prematurely | Build/runtime drift and lockfile churn | Add only after local proof and adapter selection. |
| External provider check remains required | Merge blocked despite repo-side disable config | Remove the provider check from GitHub branch protection or disconnect the provider integration. |
| Changing compose while auditing | Moat regression | Do not change compose as part of provider decommissioning. |

## Decision

Legacy preview-host production reliance has been removed from repository configuration, dependencies, scripts, README assets, and visible deployment copy. If the legacy provider check still appears on PRs, it is coming from the connected provider GitHub App/check suite or branch protection settings outside this repository.
