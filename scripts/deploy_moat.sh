#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# ARMAGEDDON "PROPRIETARY MOAT" DEPLOYMENT PROTOCOL — Linux Canonical
# SEV-2.1 Implementation | APEX Business Systems Ltd.
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

COMPOSE_FILE="docker-compose.moat.yml"
DOCKERFILE="armageddon-core/Dockerfile"
IMAGE_NAME="armageddon-worker"
WORKER_CONTAINER="armageddon-worker-moat"
HEALTH_TIMEOUT=120  # seconds to wait for worker healthcheck

log() { printf '[%s] %s\n' "$(date '+%H:%M:%S')" "$1"; }
die() { log "❌ FATAL: $1"; exit 1; }

# ─── 1. PRE-FLIGHT CHECKS ────────────────────────────────────────────────
log "🔐 Checking security posture..."
command -v docker >/dev/null 2>&1 || die "Docker CLI not found in PATH."
docker info >/dev/null 2>&1       || die "Docker daemon is not running."
[ -f ".env.moat" ]                || die ".env.moat NOT FOUND. Copy from .env.moat.example first."
[ -f "$COMPOSE_FILE" ]            || die "$COMPOSE_FILE not found in repo root."
[ -f "$DOCKERFILE" ]              || die "$DOCKERFILE not found."

# ─── 2. VERSIONING ───────────────────────────────────────────────────────
GIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "nogit")
TIMESTAMP=$(date '+%Y%m%d-%H%M')
VERSION="${TIMESTAMP}-${GIT_HASH}"
export MOAT_VERSION="$VERSION"
log "🏷️  Target Version: $VERSION"

# ─── 3. BUILD (Kinetic Engine) ───────────────────────────────────────────
log "🏗️  Building Kinetic Moat..."
docker build -t "${IMAGE_NAME}:${VERSION}" -f "$DOCKERFILE" .
docker tag "${IMAGE_NAME}:${VERSION}" "${IMAGE_NAME}:latest"

# ─── 4. DEPLOY (Zero Drift Recreate) ────────────────────────────────────
log "🚀 Deploying to Local Moat..."
docker compose -f "$COMPOSE_FILE" up -d --force-recreate

# ─── 5. HEALTHCHECK WAIT ────────────────────────────────────────────────
log "⏳ Waiting for worker healthcheck (timeout: ${HEALTH_TIMEOUT}s)..."
elapsed=0
while [ "$elapsed" -lt "$HEALTH_TIMEOUT" ]; do
    status=$(docker inspect --format='{{.State.Health.Status}}' "$WORKER_CONTAINER" 2>/dev/null || echo "missing")
    case "$status" in
        healthy)
            log "✅ Worker is healthy."
            break
            ;;
        unhealthy)
            die "Worker reported unhealthy. Check logs: docker logs $WORKER_CONTAINER"
            ;;
        *)
            sleep 5
            elapsed=$((elapsed + 5))
            ;;
    esac
done

if [ "$elapsed" -ge "$HEALTH_TIMEOUT" ]; then
    die "Worker did not become healthy within ${HEALTH_TIMEOUT}s. Last status: $status"
fi

# ─── 6. SMOKE TEST ──────────────────────────────────────────────────────
log "🔥 Smoke test — container states:"
docker compose -f "$COMPOSE_FILE" ps --format "table {{.Name}}\t{{.Status}}"

log "✅ DEPLOYMENT COMPLETE. Moat Active."
log "   Version: $VERSION"
