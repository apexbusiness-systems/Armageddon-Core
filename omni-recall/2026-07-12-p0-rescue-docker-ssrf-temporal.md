---
date: 2026-07-12
status: resolved
severity: P0
pr: apex/infra/render-exec-engine-repair
---

# 2026-07-12 — P0 Rescue: Docker Build, SSRF Hardening, Temporal Determinism, Provider Fail-Closed

## Root Causes Resolved

### RC-1: Missing Docker COPY (Render Deployment Blocker)

**Symptom:** Both production Docker images failed at `RUN npm run bundle:workflows` with
`MODULE_NOT_FOUND: Cannot find module '/app/packages/core/scripts/bundle-workflows.mjs'`.

**Root cause:** `packages/core/scripts/bundle-workflows.mjs` existed in the repository but
was never `COPY`'d into the Docker image. The source files copied were
`packages/core/src` (the TypeScript source) and `packages/core/tsconfig.json`,
but the `scripts/` directory was omitted from both Dockerfiles.

**Fix:**
```dockerfile
COPY packages/core/scripts/bundle-workflows.mjs ./packages/core/scripts/bundle-workflows.mjs
```
Added before the `RUN npm run build … && npm run bundle:workflows …` layer in both
`packages/core/Dockerfile.api` and `packages/core/Dockerfile`.

**Structural prevention:**
- Created `scripts/check-docker-build-contract.mjs` (new) — exits nonzero if either
  Dockerfile invokes `bundle:workflows` without a preceding COPY of the script.
- Added root `check:docker-contract` npm script.
- Added `Docker Build Contract` step to `production-readiness.yml` CI (runs before Docker builds).
- Added new `docker-image-gate` job to CI that builds both images from a clean context on
  every PR and push to main/release.

### RC-2: Temporal Workflow Barrel Import Contamination Risk

**Symptom:** `packages/core/src/temporal/workflows.ts` imported from `@armageddon/shared`
(the barrel). The barrel re-exports `gate.ts`, which imports `@supabase/supabase-js` — a
server-only dependency. This could inflate the Temporal workflow bundle from ~1.4 MiB to
~4.1 MiB and introduce non-deterministic dynamic-require warnings at runtime.

**Fix:**
- Added `./types` subpath export to `packages/shared/package.json`.
- Changed `import { normalizeIterations } from '@armageddon/shared'` to
  `import { normalizeIterations } from '@armageddon/shared/types'` in `workflows.ts`.

**Structural prevention:**
- Added `no-restricted-imports` ESLint rule scoped to `src/temporal/workflows.ts` blocking
  the `@armageddon/shared` barrel with a clear error message.
- Added bundle size ceiling (3 MiB) and Supabase contamination string scan to
  `bundle-workflows.mjs`. Both exit nonzero on violation.

### RC-3: SSRF Validation Missing Ranges

**Missing ranges in the previous `isBlockedIpAddress` implementation:**
- `100.64.0.0/10` — CGNAT (RFC 6598) — telco NAT infrastructure
- `192.0.0.0/24` — IETF Protocol (RFC 5736)
- `192.0.2.0/24` — TEST-NET-1 (RFC 5737)
- `198.18.0.0/15` — Benchmarking (RFC 2544)
- `198.51.100.0/24` — TEST-NET-2 (RFC 5737)
- `203.0.113.0/24` — TEST-NET-3 (RFC 5737)
- IPv4-mapped IPv6 (`::ffff:<ipv4>`, `::ffff:aabb:ccdd`) — did not decode and re-check
- IPv6 documentation (`2001:db8::/32`), discard (`0100::/64`), multicast (`ff00::/8`)
- IPv4-compatible (`::a.b.c.d`) and NAT64 (`64:ff9b::/96`)
- URL userinfo (username or password in the URL) — SSRF/CSRF vector

**Fix:** Replaced the SSRF implementation with `isBlockedIPv4()` and `isBlockedIPv6()`
functions that cover all of the above, plus added URL userinfo rejection in `validateSSRF()`.

### RC-4: Provider Factory Silent Simulation Fallback

**Symptom:** `createProvider()` returned `new SimulationProvider()` silently for `together`
and any unrecognized model, regardless of whether the execution was intended as certified-live.

**Fix:** Added `executionMode: 'simulation' | 'certified-live' = 'simulation'` parameter to
`createProvider()`. When `certified-live`:
- `together` throws `PROVIDER_NOT_IMPLEMENTED`
- unknown model throws `UNSUPPORTED_TARGET_MODEL`

Simulation mode retains the previous fallback behavior (backward compatible).

### RC-5: CI Fake Evidence and Node Version Mismatch

**Issues corrected:**
- Removed `TN:` empty LCOV generation that masked zero-coverage from SonarCloud.
- Fixed Node version from 22 to 20 to match `node:20-bullseye-slim` production images.
- Made `npm audit --audit-level=high` blocking on main/release (removed `|| true`).
- Replaced background-and-sleep battery circuit breaker with a proper Docker gate.

## Verification Commands Used
- `npm run check:docker-contract` → exit 0
- Adversarial probe (COPY removed) → exit 1 with exact file and remediation
- `npm run typecheck` → verified after all changes
- `npm run lint:core` → verified lint barrier active
- `npm run test` → verified all tests pass

## Files Changed
- `packages/core/Dockerfile.api` — add COPY for bundle script
- `packages/core/Dockerfile` — add COPY for bundle script
- `packages/core/scripts/bundle-workflows.mjs` — bundle ceiling, SHA-256, contamination scan
- `packages/core/src/providers/index.ts` — executionMode fail-closed
- `packages/core/src/temporal/workflows.ts` — subpath import fix
- `packages/core/eslint.config.mjs` — workflow import lint barrier
- `packages/shared/package.json` — ./types subpath export
- `packages/shared/src/omniport.ts` — SSRF hardening
- `scripts/check-docker-build-contract.mjs` — NEW Docker contract checker
- `.github/workflows/production-readiness.yml` — Node 20, audit blocking, Docker matrix gate, remove fake LCOV
- `package.json` — add check:docker-contract script
