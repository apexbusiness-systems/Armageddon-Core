# ═══════════════════════════════════════════════════════════════════════════
# ARMAGEDDON WORKER — DOCKERFILE (KINETIC ENGINE)
# APEX-KINETIC Upgrade: Node.js + Python Hybrid for Real Adversarial Testing
# DATE: 2026-02-06
# ═══════════════════════════════════════════════════════════════════════════

FROM node:20-bullseye-slim

# Install Python and system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    procps \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create Python virtual environment at /opt/venv
ENV VIRTUAL_ENV=/opt/venv
RUN python3 -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

WORKDIR /app

# Install Python dependencies first (for layer caching)
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Install Node.js dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy TypeScript config and source
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm run build && ls -la dist

# Copy Python scripts for kinetic execution
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
