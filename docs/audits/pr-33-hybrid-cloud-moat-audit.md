# PR #33 Audit — `feat/hybrid-cloud-moat`

Date: 2026-02-23
Auditor: Codex
Scope: Validate whether the changes described in PR #33 are already merged/implemented in the current repository state.

## Executive verdict

**Partially implemented only.**

The repository contains some moat-related baseline assets (`docker-compose.moat.yml`, `.env.moat.example`, deployment scripts, `.env.moat` ignore rules), but the **core hybrid-cloud integration claims from PR #33 are not present** in the current codebase.

## Claimed change vs. current state

### 1) Hybrid Authentication in `worker.ts` and `api/run/route.ts`

**Claim:** dual support for mTLS certificates and API key authentication for Temporal Cloud.

**Observed:**
- `armageddon-core/src/worker.ts` uses `NativeConnection.connect({ address })` with no TLS/mTLS/API key options.
- No references to `TEMPORAL_API_KEY`, `tls`, cert paths, or Temporal Cloud endpoint logic.
- `armageddon-site/src/app/api/run/route.ts` starts workflows via an app-level client helper and does not include hybrid auth logic.

**Status:** ❌ Not implemented in these files.

### 2) Infrastructure in `docker-compose.moat.yml`

**Claim:** mount `certs/` and inject `TEMPORAL_API_KEY`.

**Observed:**
- Worker service includes `env_file: .env.moat` and basic environment flags.
- No `certs/` volume mounts on worker.
- No explicit `TEMPORAL_API_KEY` injection in compose service definition.
- Compose stack still provisions local Temporal (`temporal` service), indicating local deployment pattern remains primary.

**Status:** ❌ Not implemented as claimed.

### 3) Security ignores for `.env.moat` and `certs/`

**Claim:** `.env.moat` and `certs/` added to `.gitignore`.

**Observed:**
- `.env.moat` is ignored.
- `certs/` is **not** ignored in current `.gitignore`.

**Status:** ⚠️ Partially implemented.

### 4) Tooling `scripts/generate_certs.js`

**Claim:** script exists for local mTLS cert generation.

**Observed:**
- `scripts/generate_certs.js` is absent.

**Status:** ❌ Missing.

### 5) `.env.moat.example` Temporal Cloud templates

**Claim:** updated with Temporal Cloud templates.

**Observed:**
- `.env.moat.example` points to local Temporal defaults (`TEMPORAL_ADDRESS=temporal:7233`, `TEMPORAL_NAMESPACE=default`).
- No Temporal Cloud hostname example, no API-key fields, no cert path variables.

**Status:** ❌ Not updated as claimed.

## Additional evidence from history

- Local git history contains moat-related commits, but no commit messages indicating the PR #33 hybrid-cloud/auth pivot was merged in this branch history snapshot.
- Without remote refs in this environment, this audit is based on the checked-out repository content and local commit graph only.

## Conclusion

PR #33’s described outcomes are **not fully represented** in the present repository snapshot. What appears present is an earlier/local moat deployment baseline, not the claimed hybrid cloud + Temporal Cloud authentication implementation.

## Recommended remediation checklist

1. Implement worker Temporal connection strategy supporting:
   - mTLS cert pair (client cert/key + optional server CA), and/or
   - API key headers/token where supported by Temporal SDK/client.
2. Wire corresponding configuration into API temporal client path (or shared temporal client factory).
3. Update `docker-compose.moat.yml` worker service:
   - mount `./certs:/app/certs:ro` (or chosen secure path),
   - provide `TEMPORAL_API_KEY` and cert-related env vars.
4. Add `certs/` to `.gitignore`.
5. Add `scripts/generate_certs.js` (or equivalent) and document usage.
6. Update `.env.moat.example` with explicit Temporal Cloud templates and fallback local values.
