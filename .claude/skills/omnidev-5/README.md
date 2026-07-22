# omnidev-5

Command references, config patterns, and failure diagnostics for **Terraform, Docker, Redis, Upstash, and Render** — the five tools most APEX deploy/cache/infra tasks touch. Built for Claude Code and other Agent-Skills-compatible runtimes with file and shell access.

## Install (Claude Code)

Unzip into your skills directory (or `/plugin marketplace add` if distributed via a marketplace repo), or point Claude Code at the folder directly:

```bash
unzip omnidev-5.zip -d ~/.claude/skills/
```

## What's inside

| File | Covers |
|---|---|
| `SKILL.md` | Routing logic — which reference file to open for a given task |
| `references/terraform.md` | State, modules, workspaces, plan/apply, common provider errors |
| `references/docker.md` | Dockerfile patterns, multi-stage builds, Compose, security, common errors |
| `references/redis.md` | Data structures, persistence, eviction, cache/lock/rate-limit patterns, pitfalls |
| `references/upstash.md` | REST vs TCP, SDKs, full product lineup (Redis/QStash/Vector/Workflow/Search/Realtime/Box) |
| `references/render.md` | Blueprint (render.yaml) spec incl. Key Value, official Terraform provider, CLI, common errors |
| `references/integration-patterns.md` | How the five compose — system-of-record choices, cache-layer selection, Docker→Render paths |
| `evals/trigger-eval.json` | 12 should-trigger / 8 should-not-trigger queries used to validate the skill's description |

## Before/after (one real example)

**Task**: "our render Blueprint sync keeps failing on the keyvalue service, missing ipAllowList i think"

- **Without this skill**: a model working from general training data is likely to reach for the old `redis` service type and miss that Render's current Blueprint spec requires an explicit `ipAllowList` specifically for Key Value services (a validation rule that doesn't apply to web services, where it defaults to allow-all) — because this is a provider-specific spec detail, not a general Redis or IaC fact.
- **With this skill**: `references/render.md` states the `ipAllowList`-required rule for `type: keyvalue` directly, with a working example, so the fix is immediate and correct on the first pass.

## Verification

Every reference file ends with its own `## Verify` section — run the one matching the task (`terraform plan`, `docker build && docker run`, `redis-cli PING`, an Upstash REST `ping` curl, `render blueprints validate`) before considering the task done.

## Scope note

Provider schemas, product lineups, and IaC specs (Terraform provider versions, Upstash's product list, Render's Blueprint fields) all move faster than any static reference can track perfectly. This skill states what was current and verified at time of writing and explicitly flags where to re-check official docs rather than asserting stale details with false confidence.

## Replaces

None — first release.
