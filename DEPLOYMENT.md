# ARMAGEDDON DEPLOYMENT PROTOCOL [LEVEL 8]

> **CLASSIFICATION**: PROPRIETARY / INTERNAL
> **VERSION**: 2.1.1 (Hybrid Cloud Edition)
> **DATE**: 2026-02-11

---

## 🛑 PRE-FLIGHT CHECKLIST

Before initiating the "Proprietary Moat" deployment, ensure the following constraints are met:

- [ ] **Docker Engine** is active and healthy (`docker ps`).
- [ ] **Secrets** are configured in `.env.moat` (See `SECRETS MANAGEMENT`).
- [ ] **Repo Context** is clean (no uncommitted critical changes).

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
    - **Cloud Authentication** (Hybrid Mode):
      - `TEMPORAL_ADDRESS`: `us-central1.gcp.api.temporal.io:7233`
      - `TEMPORAL_NAMESPACE`: Your Namespace ID.
      - `TEMPORAL_API_KEY`: Your Cloud API Key.
      - _(Alternative)_: mTLS Certs in `certs/` directory (mapped automatically).

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

## 📦 ARCHITECTURE (HYBRID MOAT)

The "Moat" infrastructure is defined in `docker-compose.moat.yml` and consists of:

- **armageddon-worker-moat**: The Kinetic Engine (Node.js + Python Bridge).
  - Connected to **Temporal Cloud** via API Key / mTLS.
- **armageddon-postgres-moat**: Local Persistence Layer (Optional/Fallback).
- **armageddon-temporal-moat**: Local Orchestration Server (Backup/Offline Mode).

Values are hard-pinned to specific versions to prevent supply-chain drift.

---

**APEX Business Systems Ltd.** // _Omnipotence via Rigor_
