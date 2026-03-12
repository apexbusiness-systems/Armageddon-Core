# ARMAGEDDON DEPLOYMENT PROTOCOL [LEVEL 8]

> **CLASSIFICATION**: PROPRIETARY / INTERNAL
> **VERSION**: 3.0.0 (Moat Edition — Linux-first)
> **DATE**: 2026-02-25

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

    ```bash
    # Linux/macOS (canonical)
    cp .env.moat.example .env.moat

    # Windows (PowerShell)
    Copy-Item .env.moat.example .env.moat
    ```

2.  **Populate Secrets**:
    - `SUPABASE_SERVICE_ROLE_KEY`: Required for Row Level Security bypass in the worker.
    - `SIM_MODE=true`: **MANDATORY** for all non-terminal testing.

> **WARNING**: Never commit `.env.moat` to version control. It is git-ignored by design.

---

## 🚀 DEPLOYMENT AUTOMATION

### Linux / CI (Canonical)

The **canonical** deployment method for production and CI is the Bash script suite:

#### DEPLOY: `scripts/deploy_moat.sh`

1.  **Validation**: Checks Docker daemon, `.env.moat`, and required files.
2.  **Versioning**: Generates a release tag (`YYYYMMDD-HHMM-<git-short>`).
3.  **Build**: Compiles the `armageddon-worker` Docker image.
4.  **Deploy**: Executes `docker compose up -d --force-recreate`.
5.  **Health Wait**: Polls container health for up to 120s.
6.  **Smoke Test**: Prints running container states.

```bash
chmod +x scripts/deploy_moat.sh
bash scripts/deploy_moat.sh
```

#### KILL SWITCH (SEV-1): `scripts/kill_moat.sh`

Immediately terminates all Moat containers. Use `--volumes` for full data wipe.

```bash
# Containers only (data preserved)
bash scripts/kill_moat.sh

# Full wipe including postgres_data volume
bash scripts/kill_moat.sh --volumes
```

#### KILL-SWITCH VERIFICATION: `scripts/verify_kill_moat.sh`

Full lifecycle test: deploy → health wait → kill → verify shutdown.

```bash
bash scripts/verify_kill_moat.sh          # Standard
bash scripts/verify_kill_moat.sh --stress # With Temporal stress injection
```

---

### Windows Development (Alternative)

PowerShell scripts are maintained for Windows dev environments:

```powershell
.\scripts\deploy_moat.ps1    # Deploy
.\scripts\kill_moat.ps1      # Kill switch
```

> **NOTE**: PowerShell scripts are convenience wrappers for Windows. The Bash scripts are authoritative for production and CI.

---

## 📦 ARCHITECTURE (MOAT)

The "Moat" infrastructure is defined in `docker-compose.moat.yml` and consists of:

- **armageddon-worker-moat**: The Kinetic Engine (Node.js + Python Bridge).
- **armageddon-temporal-moat**: Orchestration Server.
- **armageddon-postgres-moat**: Persistence Layer (named volume: `postgres_data`).
- **armageddon-temporal-ui-moat**: Visibility Dashboard (Port 8080).

Values are hard-pinned to specific versions to prevent supply-chain drift.

---

## 🔀 DEPLOYMENT BOUNDARY

| Component                                     | Platform       | File                          |
| --------------------------------------------- | -------------- | ----------------------------- |
| **Kinetic Moat** (worker, Temporal, Postgres) | Docker Compose | `docker-compose.moat.yml`     |
| **Marketing Site** (armageddon-site)          | Vercel         | `armageddon-site/vercel.json` |

> **IMPORTANT**: Vercel and Render configurations do **not** apply to the Moat stack. The Moat runs exclusively via Docker Compose. `render.yaml` is retained for reference only — the canonical worker deployment target is Docker.

---

**APEX Business Systems Ltd.** // _Omnipotence via Rigor_
