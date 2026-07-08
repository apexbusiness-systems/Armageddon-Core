# Runbook — Deploy the ARMAGEDDON Execution Engine (Node API/dispatcher + Temporal worker)

**Purpose:** make certification runs actually execute instead of hanging at `EXECUTING 0/13`.
**Audience:** operator/infra. **Grounded in:** `packages/core/src/{api-server.ts,worker.ts}`, `packages/core/Dockerfile`, `docker-compose.moat.cloud.yml`, `.env.moat.example`.
**Date:** 2026-07-06.

---

## 1. Why the run hangs today (root cause)

The public site (`armageddontest.icu`) is a Cloudflare **static export + edge Worker**. The edge Worker's `POST /api/run` only **inserts** an `armageddon_runs` row with `status='pending'` — it *cannot* start a Temporal workflow (Workers have no gRPC and no long-running execution). Nothing else advances that row, so the console subscribes to a telemetry stream that never emits. Result: `0/13` forever.

The repo already contains the two Node processes that do the real work — they are simply **not deployed** in the current topology:

| Service | Entry | Role |
|---|---|---|
| **API / dispatcher** | `dist/api-server.js` (`npm run api`) | Serves the full dynamic API. `POST /api/run` authenticates, inserts the run, then `client.workflow.start('ArmageddonLevel7Workflow', …)` on the task queue, and flips the row to `status='running'`. |
| **Temporal worker** | `dist/worker.js` (`npm run worker`, Dockerfile default `CMD`) | Long-polls the same task queue, executes the battery activities, and (via `core/reporter.ts`) writes `armageddon_events` + `armageddon_runs` progress that the console streams over Supabase realtime. |

**The wiring change that makes it work:** point the site's API base (`NEXT_PUBLIC_ARMAGEDDON_API_BASE`) at the deployed **API/dispatcher** so `/api/run` hits the Node service (which starts the workflow) instead of the edge Worker (which only inserts). The api-server serves the *entire* route surface the frontend uses — `/api/me/organizations`, `/api/gatekeeper`, `/api/run` (POST+GET), `/api/attestation/pubkey`, `/api/omniport/*` — so this is a clean drop-in, not a partial one.

---

## 2. Prerequisites (operator provides — the repo cannot)

1. **Temporal Cloud** namespace + API key, and a **task-queue name** both services will share. (Or a self-hosted Temporal cluster.)
2. **Supabase service-role key** for the project `qhjqselqpkfqjfpuxykb` (already the site's DB).
3. **A host** that can run two containers with **outbound** network to Temporal Cloud + Supabase, and **one public HTTPS ingress** for the API service only (the worker needs no inbound).
4. **Attestation seed**: the same 32-byte `ARMAGEDDON_ATTESTATION_SEED` already bound to the edge Worker — reuse it so issued certificates verify against the published public key.
5. Docker + Docker Compose (or your container platform of choice).

---

## 3. Secrets file — `.env.moat` (uncommitted)

Copy `.env.moat.example` → `.env.moat` and set (Temporal Cloud values shown):

```dotenv
# Supabase (required)
SUPABASE_URL=https://qhjqselqpkfqjfpuxykb.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role key>

# Temporal Cloud (required) — API and worker MUST share TEMPORAL_TASK_QUEUE
TEMPORAL_ADDRESS=<namespace>.<account>.tmprl.cloud:7233
TEMPORAL_NAMESPACE=<namespace>.<account>
TEMPORAL_API_KEY=<temporal cloud api key>
TEMPORAL_TASK_QUEUE=armageddon-level-7

# Simulation tier — REQUIRED true; the worker process.exit(1)s at boot otherwise
# (packages/core/src/worker.ts → safetyGuard.enforce('WorkerStartup'), Invariant 10).
# Live-fire (SIM_MODE=false) is a separate, deliberate decision + waiver flow — out of scope here.
SIM_MODE=true
SANDBOX_TENANT=armageddon-prod

# Attestation — reuse the edge Worker's seed so cert keyIds match the published pubkey
ARMAGEDDON_ATTESTATION_SEED=<same 32-byte hex/base64 seed as the edge worker>

# OmniPort — leave disabled unless wiring APEX-OmniHub live-fire
OMNIPORT_ENABLED=false

# Optional model provider (only if a real LLM target model is selected on CERTIFIED live-fire)
GROQ_API_KEY=<optional>
```

> `SIM_MODE=true` is correct for self-serve/pro/team and the simulation certified path (the "10,000 statistical iterations" claim). Do **not** flip it to run live-fire without the waiver flow.

---

## 4. Build one image, run it two ways

The Dockerfile (`packages/core/Dockerfile`) builds both entrypoints; its default `CMD` is `node dist/worker.js`. The **API** service overrides the command.

`docker-compose.exec.yml` (new — model it on `docker-compose.moat.cloud.yml`):

```yaml
services:
  api:
    build: { context: ., dockerfile: packages/core/Dockerfile }
    image: armageddon-core:${VERSION:-latest}
    command: ["node", "dist/api-server.js"]     # override worker default
    env_file: [ .env.moat ]
    environment:
      - NODE_ENV=production
      - API_PORT=8081
    ports: [ "8081:8081" ]                       # put a TLS reverse proxy in front
    healthcheck:
      test: ["CMD","curl","-f","http://localhost:8081/ready"]
      interval: 30s; timeout: 10s; retries: 3; start_period: 40s
    restart: always

  worker:
    build: { context: ., dockerfile: packages/core/Dockerfile }
    image: armageddon-core:${VERSION:-latest}
    # default CMD ["node","dist/worker.js"]
    env_file: [ .env.moat ]
    environment: [ NODE_ENV=production ]
    healthcheck:
      test: ["CMD","curl","-f","http://localhost:8081/health"]  # worker's internal health monitor
      interval: 30s; timeout: 10s; retries: 3; start_period: 40s
    restart: always
    depends_on: [ api ]
```

> Both processes default their health port to **8081**. That's fine in separate containers (each has its own `localhost`). Only publish the **API** container's 8081 through your HTTPS proxy; keep the worker private.

Bring up: `docker compose -f docker-compose.exec.yml up -d --build`
Put the API behind TLS at e.g. `https://api.armageddontest.icu` (Cloudflare Tunnel, an ALB, Caddy, etc.).

---

## 5. Wire the site to the dispatcher

Set the build-time env var on the Cloudflare site and redeploy:

```
NEXT_PUBLIC_ARMAGEDDON_API_BASE=https://api.armageddontest.icu
```

Then rebuild/redeploy `armageddon-site`. `isApiConfigured()` becomes true and every `apiFetch('/api/…')` (including `/api/run`) now targets the Node dispatcher. Browser CORS is served by the api-server, now **locked to `https://armageddontest.icu` by default** (override per environment with `CORS_ALLOW_ORIGIN` — see §8).

---

## 6. Verification (do these in order)

1. **API health:** `curl https://api.armageddontest.icu/ready` → `{"ready":true,"temporalOk":true,"supabaseOk":true}`. If `temporalOk:false`, fix Temporal creds; if `supabaseOk:false`, fix the service-role key.
2. **Worker boot:** logs show `[Worker] Safety checks passed. SIM_MODE=true verified.` and it registers on `TEMPORAL_TASK_QUEUE`. (If it `exit(1)`s, `SIM_MODE` isn't `true`.)
3. **Queue match:** `TEMPORAL_TASK_QUEUE` is **identical** in both services (default `armageddon-level-7`). A mismatch = workflow starts but nothing polls it → still stuck.
4. **End-to-end:** sign in on the site, start a Level 7 run. In Supabase, the `armageddon_runs` row should go `pending → running`, `armageddon_events` rows should appear, and the console should advance past `0/13` with live telemetry, ending in a signed artifact.
5. **Attestation:** `curl https://api.armageddontest.icu/api/attestation/pubkey` returns the **same** `keyId` as the edge Worker's endpoint (proves the seed matches).

---

## 7. Failure modes & rollback

| Symptom | Likely cause | Action |
|---|---|---|
| Run inserts but stays `pending` | Site still hitting the edge Worker | Confirm `NEXT_PUBLIC_ARMAGEDDON_API_BASE` is set and the site was rebuilt |
| Run flips to `failed` immediately | Temporal unreachable from API | Check `TEMPORAL_ADDRESS`/`TEMPORAL_API_KEY`; `/ready` shows `temporalOk:false` |
| `running` but no events / no `0/13` progress | Queue-name mismatch, or worker not up | Align `TEMPORAL_TASK_QUEUE`; check worker logs/health |
| Worker container crash-loops at boot | `SIM_MODE` not `true` | Set `SIM_MODE=true` in `.env.moat` |
| Certs won't verify | API seed ≠ edge seed | Set identical `ARMAGEDDON_ATTESTATION_SEED` on both |

**Rollback:** unset `NEXT_PUBLIC_ARMAGEDDON_API_BASE` and redeploy the site — it returns to edge-only behavior (runs insert but don't execute; no worse than today). Scale the two services to zero.

---

## 8. Security notes

- **Secrets:** `.env.moat` must never be committed (it's already git-ignored). Rotate the Supabase service-role and Temporal keys if they were ever exposed.
- **CORS (applied):** the api-server now returns `Access-Control-Allow-Origin: ${CORS_ALLOW_ORIGIN}` (+ `Vary: Origin`), defaulting to `https://armageddontest.icu`. Set `CORS_ALLOW_ORIGIN` in `.env.moat` for staging/local origins. OmniPort routes are server-to-server (bearer-auth) and unaffected.
- **SIM_MODE gate is load-bearing** (Invariant 10). Keep `SIM_MODE=true` unless you are deliberately standing up a *separate* live-fire-authorized deployment with the waiver flow.
- **Blast radius:** this runbook deploys new services and sets one site env var. No application code changes are required to make simulation runs execute. Optional hardening (CORS lock) is called out above.

---

## 9. Single most useful next action

Provision the Temporal Cloud namespace/API key + task queue, fill `.env.moat`, `docker compose -f docker-compose.exec.yml up -d --build`, then set `NEXT_PUBLIC_ARMAGEDDON_API_BASE` and redeploy the site. Verify with §6 step 4 (a real run reaching live telemetry).
### Supabase environment aliases (2026-07-08)

GitHub/Cloudflare/local/container envs may continue using `SUPABASE_*`. Supabase dashboard secrets must use `ARMAGEDDON_DB_*` aliases when `SUPABASE_*` is rejected. `ADMIN_EMAIL` does not need to change; `ARMAGEDDON_ADMIN_EMAIL` is only an optional alias.

Use this mapping consistently:

| Canonical name | Optional alias |
| --- | --- |
| `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` | `ARMAGEDDON_DB_URL` |
| `SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `ARMAGEDDON_DB_ANON_KEY` |
| `SUPABASE_SERVICE_ROLE_KEY` | `ARMAGEDDON_DB_SERVICE_ROLE_KEY` |
| `ADMIN_EMAIL` | `ARMAGEDDON_ADMIN_EMAIL` |

`ARMAGEDDON_ATTESTATION_SEED` is unchanged.
