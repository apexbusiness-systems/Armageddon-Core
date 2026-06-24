# ARMAGEDDON DEPLOYMENT PROTOCOL [LEVEL 8]

> **CLASSIFICATION**: PROPRIETARY / INTERNAL
> **VERSION**: 2.0.2 (Moat Edition docs refresh)
> **LAST REVIEWED**: 2026-06-24

---

## 🌐 DEPLOYMENT ARCHITECTURE (Static Intake vs Dynamic Console)

`armageddontest.icu` is built as a **Cloudflare static export** (`next.config.mjs` sets
`output: 'export'` when `CLOUDFLARE_STATIC_EXPORT=true`, via `npm run build:cloudflare`).

A static export **cannot serve dynamic Next.js App Router API routes**. The following are
**NOT** available on the static deployment and return nothing there:

- `/api/run`
- `/api/gatekeeper`
- `/api/attestation/pubkey`
- `/api/me/organizations`
- `/api/omniport/*` (health, control, execute, live-fire, waiver, telemetry)

Only the Worker-backed `/api/intake` exists on the static edge.

The full console (live-fire runs, org resolution, OmniPort) requires a **separate dynamic
runtime** (Node.js / Workers) whose origin is provided to the browser at build time via
`NEXT_PUBLIC_ARMAGEDDON_API_BASE`. The frontend gates every backed action on
`isApiConfigured()` and routes calls through `apiFetch()` to that base — when the base is
unset, the console **degrades honestly** and never fabricates a run, verdict, or certificate.

> The console UI must not be treated as functional on the static deployment unless
> `NEXT_PUBLIC_ARMAGEDDON_API_BASE` points at a dynamic runtime that serves the routes above.

---

## 🔑 SUPABASE AUTH URL CONFIGURATION (REQUIRED BEFORE FIRST PRODUCTION DEPLOY)

> **ROOT CAUSE GUARDRAIL**: Verification/magic-link emails embed the Supabase project's
> **Site URL**. If this is `http://localhost:3000` (the default when bootstrapped locally),
> every email link breaks in production with `ERR_CONNECTION_REFUSED`. This is a Supabase
> dashboard setting — it cannot be fixed by code alone.

### Steps (one-time, per Supabase project):

1. Go to **Supabase Dashboard → Authentication → URL Configuration**
2. Set **Site URL** to: `https://armageddontest.icu`
3. Under **Redirect URLs**, add:
   - `https://armageddontest.icu/**`
   - `https://armageddontest.icu/auth/callback`
4. Save changes.

### Verify:
- Send a test magic link / verification email and confirm the link points to `https://armageddontest.icu/auth/callback`.
- Run `node scripts/validate-armageddon-production-env.mjs` with production env vars loaded — it will catch a localhost `NEXT_PUBLIC_SUPABASE_URL` at build time.

---

## 🛑 PRE-FLIGHT CHECKLIST

Before initiating the "Proprietary Moat" deployment, ensure the following constraints are met. The repository documentation source of truth is `docs/README.md`.

- [ ] **Docker Engine** is active and healthy (`docker ps`).
- [ ] **Secrets** are configured in `.env.moat` (See `SECRETS MANAGEMENT`).
- [ ] **Repo Context** is clean (no uncommitted critical changes).
- [ ] **Validation** has passed with `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build` when code changed.
- [ ] **Supabase Site URL** is set to `https://armageddontest.icu` (not localhost) — see above.
- [ ] **Env validation** passes: `node scripts/validate-armageddon-production-env.mjs`.
- [ ] **Staging E2E** passes: `node scripts/staging-e2e-cert.mjs` (requires live Supabase + dynamic API).

---

## 🔐 SECRETS MANAGEMENT

The Kinetic Engine requires specific high-entropy secrets to function. These are MANUALLY managed to ensure air-gap safety.

1.  **Create Configuration**:
    ```powershell
    Copy-Item .env.moat.example .env.moat
    ```
2.  **Populate Secrets**:
    - `SUPABASE_SERVICE_ROLE_KEY`: Required for Row Level Security bypass in the worker.
    - `SIM_MODE=true`: **MANDATORY** for all non-terminal testing.

> **WARNING**: Never commit `.env.moat` to version control. It is git-ignored by design.

---

## 🚀 DEPLOYMENT AUTOMATION

We utilize a "One-Click" PowerShell automation suite to ensure deterministic deployments.

### COMMAND: `scripts/deploy_moat.ps1`

This script performs the following atomic operations:

1.  **Validation**: Checks for `.env.moat` and required tools.
2.  **Versioning**: Generates a release tag (`yyyyMMdd-HHmm-gitHASH`).
3.  **Build**: Compiles the `armageddon-worker` Docker image.
4.  **Bridge Verification**: Runs `verify_kinetic_moat.ts` in an ephemeral container to test the Python Bridge.
5.  **Deployment**: Executes `docker-compose up -d` with `force-recreate` to ensure zero drift.
6.  **Smoke Test**: Probes the running container for immediate health feedback.

**Usage**:

```powershell
.\scripts\deploy_moat.ps1
```

---

## ☢️ KILL SWITCH (SEV-1)

In the event of a Containment Breach or uncontrolled loop:

**COMMAND**: `scripts/kill_moat.ps1`

**Effect**:

- Immediately issues `SIGKILL` to all Moat containers.
- Force-removes container artifacts.
- Logs the termination event.

**Usage**:

```powershell
.\scripts\kill_moat.ps1
```

---

## 📦 ARCHITECTURE (MOAT)

The "Moat" infrastructure is defined in `docker-compose.moat.yml` and consists of:

- **armageddon-worker-moat**: The Kinetic Engine (Node.js + Python Bridge).
- **armageddon-temporal-moat**: Orchestration Server.
- **armageddon-postgres-moat**: Persistence Layer.
- **armageddon-temporal-ui-moat**: Visibility Dashboard (Port 8080).

Values are hard-pinned to specific versions to prevent supply-chain drift.

---

**APEX Business Systems Ltd.** // _Omnipotence via Rigor_
