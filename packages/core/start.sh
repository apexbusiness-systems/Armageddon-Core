#!/bin/sh
# ARMAGEDDON Unified Start Script
# Starts both the API server and Temporal worker in a single container
# The API server handles HTTP; the worker polls Temporal for battery execution

set -e

echo "[start.sh] Starting ARMAGEDDON execution engine..."

# Start the Temporal worker in the background
echo "[start.sh] Launching Temporal worker..."
node_modules/.bin/tsx packages/core/src/worker.ts &
WORKER_PID=$!
echo "[start.sh] Worker PID: $WORKER_PID"

# Graceful shutdown: forward SIGTERM to both processes
trap 'echo "[start.sh] SIGTERM received, shutting down..."; kill $WORKER_PID 2>/dev/null; exit 0' TERM INT

# Start the API server in the foreground (this is the process Render monitors)
echo "[start.sh] Launching API server..."
exec node_modules/.bin/tsx packages/core/src/api-server.ts
