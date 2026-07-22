# Integration patterns

## Contents
- Choosing a system of record for infra
- Docker -> Render
- Cache/queue layer: Redis vs Upstash vs Render Key Value
- Terraform + Render together
- Verify

## Choosing a system of record for infra

Pick exactly one of {Render Blueprint, Terraform, manual Dashboard changes} as the system of record per resource. Mixing them on the same resource is the single most common source of "it worked yesterday" drift across this stack — see `terraform.md` (drift) and `render.md` (Blueprint sync behavior) for the mechanics of why each tool assumes it alone owns the resource.

- **Render Blueprint alone**: simplest, good default for teams fully on Render.
- **Terraform (with the official Render provider) alone**: better when Render services are a subset of broader infra (DNS, other clouds, Upstash) that's already Terraform-managed — one `plan`/`apply` across everything.
- **Both, split by resource**: acceptable if genuinely partitioned (e.g. Terraform owns networking/DNS, Blueprint owns app services) — never both managing the same named resource.

## Docker -> Render

Build with a standard multi-stage `Dockerfile` (see `docker.md`), then either:
1. Point Render at the repo with `runtime: docker` and let Render build it, or
2. Push to a registry and reference it with `runtime: image` in `render.yaml`.

Path 2 gives you a reproducible artifact promoted across environments (build once, deploy the same digest to staging then prod) rather than rebuilding per environment — preferred when build reproducibility matters more than Render-side build simplicity.

## Cache/queue layer: Redis vs Upstash vs Render Key Value

| Need | Reach for | Why |
|---|---|---|
| App runs as long-lived server(s), all in one place | Self-hosted Redis or Render Key Value in the same region | Lowest latency, native protocol, no per-request billing |
| App has edge/serverless functions (Workers, edge middleware) that need cache/rate-limit access | Upstash Redis (REST) | Only option here that works without a persistent TCP connection |
| Background job / webhook delivery from a serverless function | Upstash QStash | Built-in retries/DLQ without running a worker process |
| Mixed: server-side app on Render + edge functions elsewhere needing the same cache | Upstash, called from both — don't run two separate caches that need to stay in sync | Single source of truth reachable from every runtime in play |

Don't default to "just use Redis" without checking whether any part of the request path is edge/serverless — that's the deciding factor, not preference.

## Terraform + Render together

When Render resources are Terraform-managed (via `render-oss/render`), keep Render-specific values (region, plan) in Terraform variables rather than hardcoding, so the same module can stand up staging/prod with different sizing:

```hcl
variable "region" { default = "oregon" }
variable "plan"   { default = "starter" }

resource "render_web_service" "api" {
  name   = "api-${terraform.workspace}"
  # ... region = var.region, plan = var.plan per current provider schema
}
```

If Upstash also has a Terraform provider in play for the same stack, wire the Upstash resource's connection details into the Render service's env vars via Terraform interpolation rather than pasting them manually — keeps rotation/rebuilds consistent instead of drifting between the two consoles.

## Verify

No single command spans all five tools — verify each layer with its own reference file's `## Verify` section, then confirm the whole path end-to-end with a real request through the deployed service.
