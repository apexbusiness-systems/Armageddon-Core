#!/bin/bash
# ARMAGEDDON Unified Start Script
# Starts both the API server and Temporal worker in a single container
# The API server handles HTTP; the worker polls Temporal for battery execution
#
# Either process dying now kills the container (fail loud, not silent).
# Previously the worker ran backgrounded under `set -e`, which does NOT
# trip on a background job's exit code -- a worker crash (e.g. the
# SANDBOX_TENANT SystemLockdownError seen in production on 2026-07-09) was
# completely invisible: the API server kept serving, Docker's HEALTHCHECK
# only probes the API's :8081/health, and Render showed the deploy as live
# indefinitely while zero workers polled the Temporal task queue.
set -e

echo "[start.sh] Starting ARMAGEDDON execution engine..."

echo "[start.sh] Launching Temporal worker..."
node_modules/.bin/tsx packages/core/src/worker.ts &
WORKER_PID=$!
echo "[start.sh] Worker PID: $WORKER_PID"

echo "[start.sh] Launching API server..."
node_modules/.bin/tsx packages/core/src/api-server.ts &
API_PID=$!
echo "[start.sh] API PID: $API_PID"

# Graceful shutdown: forward SIGTERM/INT to both processes
trap 'echo "[start.sh] Signal received, shutting down..."; kill $WORKER_PID $API_PID 2>/dev/null; exit 0' TERM INT

# Watchdog: if EITHER process exits (crash or otherwise), tear down the
# other and exit non-zero so Render's own restart/alerting can see the
# failure instead of it being masked forever behind a healthy API server.
wait -n "$WORKER_PID" "$API_PID"
EXIT_CODE=$?
echo "[start.sh] A process exited (code $EXIT_CODE) -- worker or API died. Shutting down container."
kill "$WORKER_PID" "$API_PID" 2>/dev/null
exit "$EXIT_CODE"
