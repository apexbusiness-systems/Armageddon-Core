# Docker

## Contents
- Dockerfile patterns
- Multi-stage builds
- Compose
- Security
- Common errors
- Verify

## Dockerfile patterns

- **Order layers from least to most frequently changing.** Dependency install before source copy, so an edit to app code doesn't invalidate the (slow) dependency-install layer:

```dockerfile
FROM node:22-slim AS base
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev          # changes rarely -> cached most of the time
COPY . .                        # changes every commit -> stays last
```

- **Always ship a `.dockerignore`** (node_modules, .git, .env, build artifacts) — without it, build context upload can be huge and secrets can leak into layers.
- **Pin base image tags** (`node:22.4-slim`, not `node:latest`) so a rebuild six months from now doesn't silently pull a different major version. Consider digest pinning (`@sha256:...`) for anything security-sensitive.

## Multi-stage builds

Use a build stage with full toolchain, then copy only the artifact into a minimal runtime stage — this keeps the shipped image small and reduces attack surface:

```dockerfile
FROM golang:1.23 AS build
WORKDIR /src
COPY . .
RUN CGO_ENABLED=0 go build -o /app ./cmd/server

FROM gcr.io/distroless/static-debian12
COPY --from=build /app /app
USER nonroot:nonroot
ENTRYPOINT ["/app"]
```

Distroless/`scratch` final stages have no shell — great for security, but means no `docker exec sh` for debugging. Keep a debug-tagged build (with a shell, e.g. `-debug` distroless variant) for troubleshooting production issues.

## Compose

- `docker compose` (the CLI plugin, not the legacy standalone `docker-compose`) reads `compose.yaml`. Use `depends_on` with `condition: service_healthy` (not just startup order) when one service must wait for another to actually be ready, not merely started:

```yaml
services:
  api:
    build: .
    depends_on:
      redis:
        condition: service_healthy
  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      retries: 5
```

- Named volumes for anything that must survive `compose down` (`docker compose down -v` is the destructive variant — confirm before recommending it).
- `environment:` values in compose files are visible via `docker inspect` — use `env_file` pointed at a gitignored file for secrets in local dev, and your platform's actual secret manager in any deployed environment.

## Security

- Run as a non-root `USER` in the final image — the Dockerfile examples above already do this; it's not optional for anything internet-facing.
- Don't bake secrets into image layers (`ARG`/`ENV` with a credential is retrievable from any layer forever, even if a later layer overwrites it). Use build secrets (`RUN --mount=type=secret`) or runtime injection instead.
- Scan images before shipping (`docker scout cves <image>` or an equivalent scanner) — base images accumulate CVEs even when your own code hasn't changed.

## Common errors

| Error | Likely cause | Fix |
|---|---|---|
| `permission denied` on a mounted volume file | Container user UID doesn't match host file ownership | Match UID (`--user $(id -u):$(id -g)` for dev, or `USER` matching the volume owner) |
| Build works locally, fails in CI with same Dockerfile | Different `--platform` (arm64 dev machine vs amd64 CI) or stale local cache masking a real break | Build with explicit `--platform linux/amd64` locally to match CI, or clear cache (`docker build --no-cache`) to confirm it's not a cache artifact |
| Layer cache never hits, every build reinstalls deps | `COPY . .` placed before the dependency-install `RUN` | Reorder per the Dockerfile pattern above — copy only manifest files before install |
| Container exits immediately, no error in logs | `CMD`/`ENTRYPOINT` process exited (e.g. process backgrounded itself, PID 1 exited) | Run interactively with `docker run -it --entrypoint sh <image>` to inspect; ensure the main process stays foregrounded |
| `Error response from daemon: conflict... container name already in use` | A stopped container still holds the name | `docker rm <name>` or `docker run --rm` to auto-clean on exit |

## Verify

```bash
docker build -t <image>:test .
docker run --rm <image>:test <your-healthcheck-or-smoke-cmd>
docker compose config          # validates compose.yaml without starting anything
```
