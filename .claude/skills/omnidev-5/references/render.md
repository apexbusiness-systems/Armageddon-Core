# Render

## Contents
- Blueprint (render.yaml) essentials
- Key Value (Render's managed Redis-compatible store)
- Docker image deploys
- Terraform provider (official)
- CLI
- Common errors
- Verify

## Blueprint (render.yaml) essentials

A Blueprint is a `render.yaml` file at the repo root that defines services, databases, and env groups as code. Render syncs it on push and reconciles drift — but syncing never deletes a resource you remove from the file, and deleting a Blueprint-managed resource in the Dashboard doesn't stick (Render recreates it on the next sync). Treat the file, not the Dashboard, as the source of truth once a resource is Blueprint-managed.

```yaml
previews:
  generation: automatic         # enable PR preview environments

services:
  - type: web
    name: api
    runtime: node                # or: docker, python, go, ruby, image, static
    plan: starter
    region: oregon                # oregon | ohio | virginia | frankfurt | singapore — immutable after create
    buildCommand: npm ci && npm run build
    startCommand: npm start
    preDeployCommand: npm run migrate   # runs after build, before start — put migrations here
    envVars:
      - key: DATABASE_URL
        fromDatabase: { name: pg-main, property: connectionString }
      - key: REDIS_URL
        fromService: { name: cache, type: keyvalue, property: connectionString }
      - key: API_SECRET
        sync: false               # prompted in Dashboard, never stored in the file

databases:
  - name: pg-main
    plan: starter

envVarGroups:
  - name: shared-config
    envVars:
      - key: LOG_LEVEL
        value: info
```

Key points that are easy to get wrong:
- **`databases:` is Postgres-only.** Every other datastore (including Key Value) lives under `services:`.
- **Secrets never go in the file** — `sync: false` for anything sensitive; Render prompts for the value once, in the Dashboard, on first Blueprint sync.
- **`region` is immutable** post-creation — pick deliberately, especially relative to where your Upstash/database region is, to avoid cross-region latency.
- **Cross-references** use `fromDatabase` (Postgres) or `fromService` (everything else), always naming the target's `type` alongside its `name`.

## Key Value (Render's managed Redis-compatible store)

Render's Redis-compatible offering is now called **Key Value** in the Blueprint spec (`type: keyvalue`; `redis` is a deprecated alias that still works but shouldn't be used in new configs). It requires an explicit `ipAllowList` — omitting it is a validation error for this service type specifically (unlike web services, where an absent `ipAllowList` just means "allow all"):

```yaml
services:
  - type: keyvalue
    name: cache
    plan: starter
    ipAllowList:
      - source: 0.0.0.0/0        # explicit "allow all" — set narrower for anything holding real data
        description: allow all
    maxmemoryPolicy: allkeys-lru # allkeys-lru (default) | volatile-lru | allkeys-random | volatile-random | volatile-ttl | noeviction
```

This is a managed Redis-protocol-compatible service on Render's infrastructure — it is not Upstash and not self-hosted Redis; see `redis.md` and `upstash.md` for those. Choose based on where the rest of your stack already lives: same-Render-region Key Value gets you private-network latency to other Render services; Upstash gets you REST access from edge runtimes Render doesn't run in.

## Docker image deploys

Two paths: build from a `Dockerfile` in your repo (`runtime: docker`), or deploy a prebuilt image (`runtime: image`, with an `image:` block pointing at a registry). The `image` path still requires the `render.yaml` to live in a Git repo (even a minimal one containing just the Blueprint file) — Blueprints are always Git-backed, only the *service's* source differs.

## Terraform provider (official)

Render publishes an official provider (`render-oss/render` on the Terraform Registry) for managing Render resources alongside the rest of your infrastructure — useful when Render services need to be provisioned in the same `apply` as, e.g., DNS or an Upstash database via its own provider.

```hcl
terraform {
  required_providers {
    render = {
      source  = "render-oss/render"
      version = "~> 1.8"
    }
  }
}

provider "render" {
  # api_key / owner_id via RENDER_API_KEY / RENDER_OWNER_ID env vars, or set explicitly
}

resource "render_web_service" "api" {
  name   = "api"
  # see registry docs for the full schema — resource shape has changed across major versions
}
```

Resources include `render_web_service`, `render_static_site`, `render_private_service`, `render_background_worker`, `render_cron_job`, `render_postgres`, `render_keyvalue` (current) / `render_redis` (legacy), `render_env_group`, `render_project`, `render_registry_credential`, `render_webhook`, `render_log_stream`, `render_metrics_stream`, `render_notification_setting`. Check the exact attribute schema in the Registry docs before writing HCL from memory — it's a young, actively-changing provider (early access as of mid-2024, versioned releases since).

Don't run both a Blueprint and Terraform against the same resource — pick one system of record per resource, same principle as any dual-IaC-tool conflict.

## CLI

```bash
render whoami -o json                  # confirm auth
render blueprints validate             # validate render.yaml before pushing
```

## Common errors

| Error | Likely cause | Fix |
|---|---|---|
| Blueprint sync fails, `ipAllowList` required | `keyvalue`/`redis` service missing `ipAllowList` | Add it explicitly — this field is mandatory for Key Value even when web services would default to "allow all" |
| New resources created with unexpected suffixes | Generated Blueprint name collided with existing resources of the same name | Expected behavior — Render appends a suffix to avoid clobbering; rename intentionally if you meant to adopt the existing resource instead |
| Env var value not updating after Blueprint sync | Variable has `sync: false` | By design — `sync: false` values are set once via Dashboard and untouched by later syncs; update manually |
| Deleted resource reappears | Deleted in Dashboard but still present in `render.yaml` | Remove it from the Blueprint file first, then delete — or expect Render to recreate it on next sync |
| Preview environment missing a secret the main service has | `sync: false` vars aren't copied to preview environments | Share via an env var group instead, per Render's preview-environment docs |

## Verify

```bash
render blueprints validate
terraform plan   # if Render resources are Terraform-managed
```
