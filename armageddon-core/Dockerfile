# ═══════════════════════════════════════════════════════════════════════════
# ARMAGEDDON WORKER — DOCKERFILE (SINGLE STAGE / SLIM)
# Switched to node:20-slim (Debian) to resolve ERR_DLOPEN_FAILED (glibc)
# ═══════════════════════════════════════════════════════════════════════════

FROM node:20-slim

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Build (running user's perfected tsc command from package.json)
RUN npm run build

# Verify build output exists (debug)
RUN ls -la dist

# Security: Run as non-root user (Debian syntax)
RUN groupadd -g 1001 armageddon && \
    useradd -u 1001 -g armageddon -s /bin/bash -m worker
USER worker

# Health check
# Note: pgrep is in procps package, usually not in slim by default check.
# We will use simple node check or install procps.
# For now, minimal check or rely on orchestration.
# Installing procps adds weight. We can check if /proc exists?
# Or just exit 0 for now to verify boot.

# Start worker (compiled JS)
CMD ["node", "dist/worker.js"]
