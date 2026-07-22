# ═══════════════════════════════════════════════════════════════════════════
# ARMAGEDDON WORKER — DOCKERFILE (KINETIC ENGINE)
# APEX-KINETIC Upgrade: Node.js + Python Hybrid for Real Adversarial Testing
# DATE: 2026-02-06
# ═══════════════════════════════════════════════════════════════════════════

FROM node:22-bookworm-slim

# Install Python and system dependencies
# ca-certificates is required (not optional): this worker also runs against
# Temporal Cloud in docker-compose.moat.cloud.yml, where the native gRPC
# binding validates TLS via rustls-native-certs against /etc/ssl/certs --
# unlike fetch()/undici, which bundles its own CA store. Same root cause as
# the Dockerfile.api fix (2026-07-10): --no-install-recommends means curl
# alone does NOT pull this in on Debian.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    procps \
    python3 \
    python3-pip \
    python3-venv \
    && update-ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create Python virtual environment at /opt/venv
ENV VIRTUAL_ENV=/opt/venv
RUN python3 -m venv "$VIRTUAL_ENV"
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

WORKDIR /app

# Install Python dependencies first (for layer caching)
# requirements.lock.txt hash-pins the full resolved dependency closure
# (including transitive deps, generated under Python 3.9 to match this image)
# so the build never floats on an unpinned/re-published transitive version;
# --only-binary :all: refuses any source distribution, so no third-party
# setup.py ever executes during install. Regeneration steps are in the lock
# file's own header comment.
COPY packages/core/requirements.txt packages/core/requirements.lock.txt ./
RUN pip install --no-cache-dir --only-binary :all: --require-hashes -r requirements.lock.txt

# Copy workspace package (@armageddon/shared) required by armageddon-core
COPY packages/shared ./packages/shared

# Install Node.js dependencies
# Copy root package files for workspace resolution
COPY package.json package-lock.json ./
COPY packages/core/package*.json ./packages/core/
# --ignore-scripts blocks arbitrary lifecycle scripts from transitive deps
# (supply-chain hardening). Safe here: @temporalio/core-bridge (the only
# native-binding dep) has no install/postinstall script and ships prebuilt
# .node binaries per-platform in the package itself — verified directly
# against node_modules/@temporalio/core-bridge/package.json and its
# releases/<target>/index.node files. The two build RUN steps below already
# explicitly build @armageddon/shared and armageddon-core, so nothing here
# depends on postinstall running.
RUN npm ci --ignore-scripts --install-links

# Copy TypeScript config and source
COPY packages/core/tsconfig.json ./packages/core/
COPY packages/core/src ./packages/core/src
COPY packages/core/scripts/bundle-workflows.mjs ./packages/core/scripts/bundle-workflows.mjs

# Build shared package first, then armageddon-core; fail fast if either workspace cannot compile.
# Final step flattens dist to /app/dist for CMD.
RUN npm run build -w @armageddon/shared && \
    npm run build -w armageddon-core && \
    ls -la packages/core/dist && \
    npm run bundle:workflows -w armageddon-core && \
    npm prune --omit=dev --workspaces --include-workspace-root && \
    cp -r packages/core/dist ./dist

# Copy Python scripts for kinetic execution
# Scripts are at repository root, so we copy from ./scripts
COPY scripts ./scripts

# Security: Create non-root user
RUN groupadd -g 1001 armageddon && \
    useradd -u 1001 -g armageddon -s /bin/bash -m worker && \
    chown -R worker:armageddon /app

USER worker

# Environment for Python subprocess
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV KINETIC_MODE=true

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD pgrep -x node || exit 1

# Start worker (compiled JS)
CMD ["node", "dist/worker.js"]
