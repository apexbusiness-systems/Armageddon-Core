---
date: 2026-07-22
baseline_commit: f3a6835b62d34de3d3d5e3605657743b714a3518
status: verified-against-repository
---

# Armageddon-Core — Canonical State Snapshot (2026-07-22 baseline)

This is a point-in-time, evidence-backed snapshot of what this repository actually
does, as verified against `main` at the commit above. For session-by-session
history and durable corrections, see `omni-recall/` (start there — `omni-recall/start-here.md`).
This file exists to answer "what is this repo, right now" without replaying that history.

## What ships

Two coordinated surfaces, both real, both deployed:

1. **`armageddon-site/`** — Next.js app, static-exported to Cloudflare Workers Assets.
   The only dynamic backend reachable at the edge is the Cloudflare Worker
   `armageddon-site/src/intake-handler.ts`: `/api/run`, `/api/gatekeeper`,
   `/api/me/organizations`, `/api/attestation/pubkey`, `/api/leaderboard`,
   `/api/omniport/*`, support chat.
2. **`packages/core/`** — Node.js Temporal worker (`worker.ts`) + API server
   (`api-server.ts`) that actually executes adversarial batteries. Runs locally via
   the Docker "Moat" (`docker-compose.moat.yml`, Level 8) or against a hosted
   deployment talking to Temporal Cloud (production: `armageddon-exec-api` on Render).

`packages/shared/` is the source of truth for the 8 certification levels
(`src/levels.ts`), battery manifest (`src/batteries.ts`), and OmniPort
auth/crypto primitives (`src/omniport.ts` — imported by both workspaces above,
never duplicated).

## Certification levels (source of truth: `packages/shared/src/levels.ts`)

Levels 1–6 run a simulated adversary. **Level 7 ("God Mode")** drives a real
LLM adversary (PAIR attack loop: attacker/target/judge, `packages/core/src/core/adversarial.ts`)
across 5 batteries (B10 Goal Hijack, B11 Tool Misuse, B12 Memory Poison, B13
Supply Chain, B14 Indirect Injection). **Level 8 ("Kinetic Moat")** is Level 7
executed air-gapped in local Docker with a tamper-evident signed receipt —
`environment: 'MOAT'` is required, and the OmniPort waiver payload itself caps
`runLevel` at 7, so Level 8 is only reachable via the physical local Moat
deployment, never via any cloud-dispatched path (including OmniPort).

## Real live-fire execution: confirmed working, with a fixed defect

`packages/core/src/worker.ts` refuses to boot (`process.exit(1)`) unless
`SIM_MODE=true` — a process-level, non-bypassable confirmation that the process
is running in an authorized deployment. This is **independent** of whether an
individual dispatched run is real or simulated: a run with `tier: 'CERTIFIED'`
and a real `targetModel` set makes that run's battery activities call a genuine
LLM adversary, inside the same `SIM_MODE=true`-gated process.

**Defect found and fixed 2026-07-22** (PR #211): every OmniPort dispatch path
(`handleOmniPortExecute`, `handleOmniPortLiveFire`, and both Next.js reference
routes) omitted `targetModel`. `AdversarialEngine`'s constructor silently
degraded to the fake `SimulationProvider` whenever `tier === 'CERTIFIED'` had no
`targetModel`, while the surrounding telemetry still tagged the battery
`engine: 'LIVE_FIRE'` (that tag was set from `tier` alone). A run could clear as
CERTIFIED without ever reaching a real model. Fixed:
- `AdversarialEngine` now throws instead of silently degrading (matching the
  pre-existing `'http-target'` refusal precedent).
- `handleOmniPortLiveFire` (the waiver-gated real endpoint) now sets
  `targetModel: 'claude-sonnet-4-6'`.
- `handleOmniPortExecute` (no waiver gate, always `sim_mode: true`) now requests
  `tier: 'FREE'` instead of a hardcoded `'CERTIFIED'` it could never truthfully
  deliver on.

**Verified twice post-fix** with real OmniPort live-fire dispatches against
`armageddon-exec-api` (production), targeting `apex-orchestrator-api-staging.onrender.com`:
a 2-battery run and a full 5-battery God Mode run, both `CERTIFIED`, both with
battery durations of ~19–24s (consistent with real multi-turn LLM round trips —
a genuinely simulated run of the same batteries completes in ~3s). Real,
Ed25519-signed certificates were generated from this real telemetry via
`EvidenceGenerator` and matched the live production attestation public key
(`GET /api/attestation/pubkey`, keyId `37557e9ef2e85246`).

## Certification evidence pipeline

`EvidenceGenerator` (`packages/core/src/core/evidence-generator.ts`) produces
three artifacts from one run: a JSON report, a Markdown technical report
(Executive Summary, Tamper-Evident Attestation, Battery Results table,
per-battery Methodology, Detailed Findings — the last states plainly that
nothing was flagged on a clean pass rather than emitting a blank section), and
a one-page PDF certificate rendered onto `certs/pdf-certificate.pdf`. Every
dynamic field on the PDF is a masked-and-redrawn patch over the template's
demo values; the "CERTIFICATION SUMMARY" box names the build under test when
`targetSystemName` was captured (falls back to generic wording, never
fabricates a name). Verdict is three-state: `FAILED` (did not clean-pass),
`VALIDATED` (clean pass under simulation — a real positive, not a live-fire
certification), `CERTIFIED` (clean pass under real live-fire).

Known cosmetic limitation: the circular seal graphic on the PDF is decorative,
textured template art with baked-in demo text ("LEVEL 8", "13/13 BATTERIES
PASSED") that does not update per-run — the flat data panels below it carry
the accurate per-run figures.

## Leaderboard (`/api/leaderboard`, `LeaderboardWidget.tsx`)

Anonymized by construction (never selects `organization_id`; derives a short
`OP-XXXXXX` codename from the run id) and honestly gated: only claims `live:
true` on a successful, non-empty query, otherwise renders the static `SAMPLE`
board. Shows the human-readable build name (`config.targetSystemName`) when
captured. Pools the best 50 completed runs and dedupes to one entry per named
build (keeping only its best result) so a build tested repeatedly can't occupy
multiple leaderboard slots.

## Quality gate, as of this baseline

`npm ci && npm run lint && npm run typecheck && npm run test && npm run build`
— all green, 479 tests (`packages/core` + `armageddon-site`). SonarCloud
quality gate passing, 0 open findings. `npm run docs:check` (docs-drift +
level-integrity) green. No TODO/FIXME markers in source. Zero open GitHub
issues.

**Known housekeeping debt (not a code defect):** 12 open pull requests on
`main` (#33, #69, #72, #78, #97, #103–#109) predate this baseline by months
(oldest: 2026-02-08) and target base commits far behind current `main` —
almost certainly stale/superseded automation-generated PRs (Jules/Codex).
Left open pending an explicit operator decision; not touched by this session.

## Infrastructure state (production, as deployed)

- `armageddon-exec-api` (Render, `packages/core/Dockerfile.api`): the real
  production deployment. Runs both the API server and the Temporal worker in
  one container (`packages/core/start.sh`). `SIM_MODE=true`,
  `OMNIPORT_ENABLED=true`, real `ANTHROPIC_API_KEY` and `OMNIPORT_LIVE_FIRE_SECRET`
  configured.
- OmniHub staging pair (`apex-orchestrator-api-staging`,
  `apex-orchestrator-worker-staging` on Render): a separate Python orchestrator
  (`apexbusiness-systems/APEX-OmniHub`), used here only as the live-fire
  **attack target** (`targetUrl`), not as an Armageddon dispatch/execution
  surface — it has no Armageddon workflow/battery code registered.
- Isolated Supabase project provisioned for OmniHub staging
  (`hkcqbzrinklawvaulznf`), all 108 migrations applied, verified reachable only
  via the Supabase Management API's HTTPS SQL endpoint (this sandbox has no
  outbound Postgres TCP).
