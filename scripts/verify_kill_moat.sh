#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# KILL-SWITCH VERIFICATION — Full Lifecycle Test
# Deploys Moat → waits for health → kills → verifies shutdown
# Usage: scripts/verify_kill_moat.sh [--stress]
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

COMPOSE_FILE="docker-compose.moat.yml"
HEALTH_TIMEOUT=120
MOAT_CONTAINERS=("armageddon-worker-moat" "armageddon-postgres-moat" "armageddon-temporal-moat" "armageddon-temporal-ui-moat")

log() { printf '[%s] [VERIFY] %s\n' "$(date '+%H:%M:%S')" "$1"; }
die() { log "❌ FATAL: $1"; exit 1; }

STRESS_MODE=false
for arg in "$@"; do
    case "$arg" in
        --stress) STRESS_MODE=true ;;
    esac
done

# ─── PHASE 1: DEPLOY ────────────────────────────────────────────────────
log "🚀 Phase 1: Deploying Moat stack..."
docker compose -f "$COMPOSE_FILE" up -d --force-recreate

# ─── PHASE 2: WAIT FOR HEALTH ───────────────────────────────────────────
log "⏳ Phase 2: Waiting for services to become healthy..."
elapsed=0
while [ "$elapsed" -lt "$HEALTH_TIMEOUT" ]; do
    pg_healthy=$(docker inspect --format='{{.State.Health.Status}}' armageddon-postgres-moat 2>/dev/null || echo "missing")
    temporal_healthy=$(docker inspect --format='{{.State.Health.Status}}' armageddon-temporal-moat 2>/dev/null || echo "missing")

    if [ "$pg_healthy" = "healthy" ] && [ "$temporal_healthy" = "healthy" ]; then
        log "✅ Core services healthy (postgres=$pg_healthy, temporal=$temporal_healthy)"
        break
    fi

    sleep 5
    elapsed=$((elapsed + 5))
done

if [ "$elapsed" -ge "$HEALTH_TIMEOUT" ]; then
    die "Services did not become healthy within ${HEALTH_TIMEOUT}s"
fi

# ─── PHASE 3: OPTIONAL STRESS ───────────────────────────────────────────
if [ "$STRESS_MODE" = true ]; then
    log "🔥 Phase 3: Stress test — sending rapid requests to Temporal..."
    for i in $(seq 1 10); do
        docker exec armageddon-temporal-moat tctl --address localhost:7233 cluster health >/dev/null 2>&1 || true
    done
    log "   Stress cycle complete."
else
    log "⏭️  Phase 3: Stress test skipped (use --stress to enable)"
fi

# ─── PHASE 4: KILL ──────────────────────────────────────────────────────
log "🚨 Phase 4: Activating kill switch..."
bash scripts/kill_moat.sh --volumes

# ─── PHASE 5: VERIFY SHUTDOWN ───────────────────────────────────────────
log "🔍 Phase 5: Verifying complete shutdown..."
sleep 3  # Allow container removal to propagate

failures=0
for container in "${MOAT_CONTAINERS[@]}"; do
    status=$(docker ps -a --filter "name=$container" --format "{{.Names}}" 2>/dev/null || true)
    if [ -n "$status" ]; then
        log "❌ Container still exists: $container"
        failures=$((failures + 1))
    fi
done

if [ "$failures" -gt 0 ]; then
    die "$failures container(s) survived kill switch. Containment FAILED."
fi

# Verify volumes removed
vol_check=$(docker volume ls --filter "name=postgres_data" --format "{{.Name}}" 2>/dev/null || true)
if [ -n "$vol_check" ]; then
    log "⚠️  Volume postgres_data still exists (expected removal with --volumes)"
fi

log "══════════════════════════════════════════════════════════════════"
log "✅ KILL-SWITCH VERIFICATION PASSED"
log "   All containers terminated. Containment confirmed."
log "══════════════════════════════════════════════════════════════════"
