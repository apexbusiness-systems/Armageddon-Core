# Turnkey Deploy — Unstick `EXECUTING 0/13` (Execution Engine)

**Goal:** take the site from **State A (edge-only, runs stall at `0/13`)** to **State B (runs execute → verdict)** in one sitting.
**Time:** ~15 min once you have the three secrets in hand.
**What you are deploying:** two Node containers built from `packages/core/Dockerfile` — the **api-server** (a poller that drains `pending` runs into Temporal) and the **Temporal worker** (executes battery activities, streams telemetry).
**You do NOT need to rebuild or redeploy the website** for this path (see §5 for why).

---

## 0. The one trap that keeps it stuck (read first)

`.env.moat.example` ships **self-hosted** Temporal defaults:

```
TEMPORAL_ADDRESS=temporal:7233        # a docker service named "temporal"
TEMPORAL_NAMESPACE=default
# (no TEMPORAL_API_KEY)
```

But `docker-compose.exec.yml` **does not include a `temporal` service** — it's built for **Temporal Cloud** (both containers are outbound-only). If you copy the example unchanged and bring up `exec.yml`, the api-server can't reach `temporal:7233`, `/ready` returns `temporalOk:false`, the api never goes healthy, the worker never starts (it waits on `service_healthy`), pending runs are never drained — and you're **still stuck at 0/13**.

**Fix:** pick ONE topology in §2 and set the Temporal vars to match it. That's the whole game.

---

## 1. Prerequisites (only you can provide these)

1. **Supabase service-role key** for the site's project (`qhjqselqpkfqjfpuxykb`). Supabase dashboard → Project Settings → API → `service_role` secret.
2. **A reachable Temporal** — choose in §2:
   - **Temporal Cloud** (recommended): namespace + API key. → `docker-compose.exec.yml` as-is.
   - **Self-hosted**: a `temporal` cluster (bundled in `docker-compose.moat.yml`).
3. **Attestation seed** — the *same* 32-byte `ARMAGEDDON_ATTESTATION_SEED` bound to the edge Worker, so issued certs verify against the already-published public key. (Cross-check later: `/api/attestation/pubkey` `keyId` must match on both.)
4. A host with Docker + Docker Compose and outbound network to Supabase + Temporal.

---

## 2. Pick a topology, fill `.env.moat`

```bash
cp .env.moat.example .env.moat
```

### Topology A — Temporal Cloud (recommended, matches `exec.yml`)

Edit `.env.moat` — override the three Temporal lines and fill the secrets:

```dotenv
SUPABASE_URL=https://qhjqselqpkfqjfpuxykb.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role key>

# Temporal Cloud — api-server AND worker MUST share TEMPORAL_TASK_QUEUE
TEMPORAL_ADDRESS=<namespace>.<account>.tmprl.cloud:7233
TEMPORAL_NAMESPACE=<namespace>.<account>
TEMPORAL_API_KEY=<temporal cloud api key>      # ← REQUIRED for Cloud (enables TLS+auth)
TEMPORAL_TASK_QUEUE=armageddon-level-7

# Safety gate — worker process.exit(1)s at boot unless this is exactly 'true' (Invariant 10)
SIM_MODE=true
SANDBOX_TENANT=armageddon-prod

# Reuse the edge Worker's seed so cert keyIds match the published pubkey
ARMAGEDDON_ATTESTATION_SEED=<same 32-byte hex/base64 seed as the edge worker>

OMNIPORT_ENABLED=false
```

Bring it up:

```bash
docker compose -f docker-compose.exec.yml up -d --build
```

### Topology B — Self-hosted Temporal

Keep the example's `TEMPORAL_ADDRESS=temporal:7233` / `TEMPORAL_NAMESPACE=default` (no API key), and run the bundled cluster from `docker-compose.moat.yml` (it provides `temporal` + `postgresql` + `temporal-ui`) **alongside** the api-server. `moat.yml` already runs the `worker`; you additionally need the **api-server (poller)** from `exec.yml`. Simplest: run both files on one project so they share the network:

```bash
docker compose -f docker-compose.moat.yml -f docker-compose.exec.yml up -d --build
```

(Ensure both files' services resolve `temporal:7233` on the same compose network; `TEMPORAL_TASK_QUEUE` must be identical for the api poller and the worker.)

> Either way, the **non-negotiables**: `SIM_MODE=true`, one shared `TEMPORAL_TASK_QUEUE`, and both processes pointed at the **same Supabase project the public site uses**.

---

## 3. Verify boot (30 seconds)

```bash
# 1. api-server readiness — BOTH must be true. This is the exact signal that was false in State A.
docker exec armageddon-api-exec curl -fs http://localhost:8081/ready
#   expect: {"ready":true,"temporalOk":true,"supabaseOk":true}
#   temporalOk:false → Temporal creds/address wrong (the §0 trap)
#   supabaseOk:false → service-role key wrong

# 2. worker booted past the safety gate and registered
docker logs armageddon-worker-exec 2>&1 | grep -E "Safety checks passed|Worker started|SIM_MODE"
#   expect: "[Worker] Safety checks passed. SIM_MODE=true verified."
#   if it exited: SIM_MODE isn't exactly 'true'

# 3. poller is live
docker logs armageddon-api-exec 2>&1 | grep "PendingLoop"
#   expect: "[PendingLoop] Pending run dispatcher started."
```

---

## 4. Prove State B end-to-end (the real acceptance test)

1. Sign in on `https://armageddontest.icu`, set an **authorized** target, click **INITIATE SEQUENCE**.
2. Watch the run row (Supabase → `armageddon_runs`, newest): it should go **`pending → running`** within ~5s (poller `PENDING_POLL_MS`), then to **`passed`/`failed`**.
3. Watch the console: it must **advance past `EXECUTING 0/13`**, stream `armageddon_events` (BATTERY_STARTED/COMPLETED per battery), the threat matrix leaves `0/64`, and it ends on a verdict.
4. In `armageddon-api-exec` logs you should see: `[PendingLoop] Dispatched run <id> → workflow armageddon-<id>`.

If all four hold, you're **GREEN**. Re-run the Cowork contract (`docs/COWORK_UI_UX_EXECUTION_CONTRACT.md`, journey J6) to record it.

> Note: the poller only claims runs created in the **last 10 minutes** (`PENDING_CLAIM_WINDOW_MS`). Old stuck `pending` rows won't auto-drain — just start a **fresh** run to verify.

---

## 5. Why no website rebuild is needed (poller path)

The site's `POST /api/run` (Cloudflare edge worker → `createRunRecord`) already **inserts** the `pending` row and returns a `runId` — that's why the console currently reaches "Workflow started… / Subscribing…" before stalling. The **only** missing piece is something to turn `pending → running`. The api-server's `startPendingRunsLoop` does exactly that by polling Supabase — it doesn't need the browser to talk to it directly. So deploying these two services drains the existing insert path with **zero site changes**.

(The alternative — set `NEXT_PUBLIC_ARMAGEDDON_API_BASE` to the api-server and rebuild the site — makes `/api/run` hit the dispatcher directly and start the workflow synchronously. That's a valid path too, but it *does* require a site rebuild and a public HTTPS ingress for the api container. The poller path above avoids both.)

---

## 6. If it's still stuck — triage table

| Symptom | Cause | Fix |
|---|---|---|
| `/ready` `temporalOk:false` | §0 trap: exec.yml has no `temporal`, but env points at `temporal:7233` | Set Temporal Cloud `TEMPORAL_ADDRESS`/`NAMESPACE`/`API_KEY`, or run Topology B |
| `/ready` `supabaseOk:false` | wrong/blank service-role key | Paste the real `service_role` secret |
| worker container exits at boot | `SIM_MODE` ≠ `true` | Set `SIM_MODE=true` in `.env.moat` |
| run flips `pending → failed` instantly | Temporal reachable but rejects start (queue/namespace) | Align `TEMPORAL_TASK_QUEUE` + `TEMPORAL_NAMESPACE` across api + worker |
| `running` but no events / no `0/13` progress | task-queue mismatch, or worker down | Make `TEMPORAL_TASK_QUEUE` identical in both containers; check worker logs |
| certs won't verify | api seed ≠ edge seed | Set identical `ARMAGEDDON_ATTESTATION_SEED` on both surfaces |
| old run still `pending` | poller's 10-min claim window | Start a fresh run |

**Rollback:** `docker compose -f docker-compose.exec.yml down`. The site returns to State A (runs insert but don't execute) — no worse than before, and no site change to revert.

---

## 7. Safety notes (do not weaken)

- `SIM_MODE=true` is the only supported posture here (Invariant 10). Do **not** flip it to run live-fire — that's a separate, waiver-gated decision.
- `.env.moat` is git-ignored — never commit it. Rotate the Supabase service-role and Temporal keys if ever exposed.
- The two containers are **outbound-only** in the poller topology; don't publish the api port unless you deliberately move to the `NEXT_PUBLIC_ARMAGEDDON_API_BASE` path (§5), and if you do, front it with TLS + keep CORS locked to `https://armageddontest.icu` (`CORS_ALLOW_ORIGIN`).
