#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# IMPERATIVE KILL SWITCH — Linux Canonical
# Protocol SEV-1.2: Containment Breach Response
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

COMPOSE_FILE="docker-compose.moat.yml"

log() { printf '[%s] %s\n' "$(date '+%H:%M:%S')" "$1"; }

log "🚨 ACTIVATING KILL SWITCH..."

# Parse flags
REMOVE_VOLUMES=false
for arg in "$@"; do
    case "$arg" in
        --volumes|-v) REMOVE_VOLUMES=true ;;
        *) log "⚠️  Unknown flag: $arg (ignored)" ;;
    esac
done

# Shutdown: --volumes removes named volumes (postgres_data) for full wipe
if [ "$REMOVE_VOLUMES" = true ]; then
    log "🗑️  Full wipe requested — removing containers AND volumes."
    docker compose -f "$COMPOSE_FILE" down --volumes --remove-orphans
else
    log "📦 Removing containers only (volumes preserved)."
    docker compose -f "$COMPOSE_FILE" down --remove-orphans
fi

# Verify no Moat containers remain
remaining=$(docker ps -a --filter "name=armageddon-" --filter "name=-moat" --format "{{.Names}}" 2>/dev/null || true)
if [ -n "$remaining" ]; then
    log "⚠️  Residual containers detected, force-removing: $remaining"
    echo "$remaining" | xargs -r docker rm -f
fi

log "✅ CONTAINMENT SECURED. All services terminated."
log "   Timestamp: $(date)"
