---
name: omnidev-5
description: Command references, config patterns, and failure diagnostics for Terraform, Docker, Redis, Upstash, and Render. Use when writing or debugging a Terraform module or state issue, a Dockerfile or Compose stack, Redis data structures/persistence, Upstash REST Redis or its Vector/QStash/Workflow products, or a Render Blueprint (render.yaml) or deploy. Does not cover Kubernetes, Pulumi/CDK, or non-Render/non-Upstash hosting.
license: Proprietary - APEX Business Systems Ltd.
---

# omnidev-5

**Input**: A task or error touching one or more of: Terraform, Docker, Redis, Upstash, Render.
**Output**: Working config/code (HCL, Dockerfile, compose.yaml, render.yaml, client code) plus the verification command that proves it's correct.
**Success**: The verification command in the relevant reference file exits 0 against the user's actual environment — never assume, always run it or ask the user to run it.
**Fails when**: (1) a claim is made about current pricing/limits without checking — those drift fast, say "verify at provider docs" instead; (2) a fix is proposed without checking the user's actual file first; (3) Redis vs Upstash Redis vs Render Key Value get conflated — they share a wire protocol but differ in ops model.

## Routing

```
Which tool is the task about?
+- Terraform (.tf, state, plan/apply, provider errors)      -> references/terraform.md
+- Docker (Dockerfile, build, compose, container runtime)    -> references/docker.md
+- Redis (self-hosted/ElastiCache/Cloud, data structures)    -> references/redis.md
+- Upstash (REST Redis, Vector, QStash, Workflow, Search)    -> references/upstash.md
+- Render (render.yaml Blueprint, service deploy, Key Value) -> references/render.md
+- Spans 2+ (e.g. "deploy Dockerized app to Render with
|  Terraform" or "cache layer: Upstash vs Render Key Value")  -> references/integration-patterns.md, then the
                                                                  individual reference files as needed
```

Read only the reference file(s) the task needs — each is self-contained with its own verification commands and failure table. Don't load all five for a single-tool question.

## Workflow

1. **Identify the tool(s) and the actual artifact.** If the user has an existing file (`.tf`, `Dockerfile`, `render.yaml`, client code), read it before proposing changes — don't draft from a blank assumption of their setup.
2. **Open the matching reference file(s)** per the routing tree above.
3. **Apply the smallest correct change.** These reference files favor minimal, idempotent diffs over rewrites — match that posture in the fix.
4. **State what you did not verify.** If you can't run `terraform plan`, `docker build`, a Redis client call, or `render blueprints validate` in this environment, say so explicitly and give the user the exact command to run themselves.
5. **Flag drift risk.** Terraform state, Docker base-image versions, and provider-managed resources (Render services, Upstash databases) all drift from what's in version control over time — call this out when relevant instead of assuming the repo reflects prod.

## Verification

Each reference file ends with its own `## Verify` section (e.g. `terraform validate && terraform plan`, `docker build . && docker run --rm <img> <healthcheck-cmd>`, `redis-cli PING`, `curl $UPSTASH_REDIS_REST_URL/ping -H "Authorization: Bearer $TOKEN"`, `render blueprints validate`). Run the one that matches the task before telling the user it's done.

## Failure handling

- **Provider/API details look stale**: Terraform provider schemas, Upstash's product lineup, and Render's Blueprint spec all change faster than model training data. If a field name, resource type, or command in a reference file looks like it might have changed, say so and point to the official docs rather than asserting confidently.
- **Ambiguous "Redis"**: ask (or infer from context) whether it's self-hosted/ElastiCache/Redis Cloud (`references/redis.md`), Upstash (`references/upstash.md`), or Render Key Value (`references/render.md#key-value`) — the operational model differs enough that generic Redis advice can be wrong for the other two.
- **No file to inspect yet**: if the user describes an error without pasting config, ask for the exact error text and the relevant file before proposing a fix — guessing wastes a turn.

## References

- `references/terraform.md` — state, modules, workspaces, plan/apply, common provider errors
- `references/docker.md` — Dockerfile patterns, multi-stage builds, Compose, security, common build/runtime errors
- `references/redis.md` — data structures, persistence, eviction, common patterns (cache, lock, rate limit), pitfalls
- `references/upstash.md` — REST vs TCP, SDKs, product lineup (Redis/QStash/Vector/Workflow/Search/Realtime/Box), edge patterns
- `references/render.md` — Blueprint (render.yaml) spec, service types incl. Key Value, Terraform provider, CLI, common errors
- `references/integration-patterns.md` — how these five compose (e.g. Terraform-managed Render + Upstash cache, Dockerized deploys)
