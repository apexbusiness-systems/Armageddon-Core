---
date: 2026-07-22
status: verified-against-repository
---

# 2026-07-22 — Real Live-Fire Certification, Critical Sim-Downgrade Fix, Baseline

## Context
Continuation of the same-day onboarding→certification validation session
(see `2026-07-22-onboarding-certification-e2e-validation.md`). That entry's
durable correction refused to fabricate a Level 7/8 certificate without real
staging credentials or live-fire execution. Both conditions were since met
legitimately: a genuinely separate OmniHub staging Supabase project and two
new Render services were provisioned this session, and real OmniPort
live-fire dispatches were executed against them.

## What was found and fixed (PR #211 — merged)
While verifying a "successful" real live-fire run for evidence, discovered
`AdversarialEngine` (`packages/core/src/core/adversarial.ts`) silently fell
back to the fake `SimulationProvider` whenever `tier === 'CERTIFIED'` had no
`targetModel` — and **every** OmniPort dispatch path omitted `targetModel`,
so the first "real" run actually executed simulated attacks while telemetry
still said `engine: 'LIVE_FIRE'`. Caught via timing analysis (2.7–3.4s total
for what should be dozens of real LLM round trips is simulation-speed, not
network speed), not by trusting the label. Fixed: `AdversarialEngine` now
throws instead of silently degrading; both OmniPort dispatch paths (and their
Next.js reference routes) now set/require the right tier+targetModel pairing.
Added `packages/core/tests/core/adversarial.test.ts` — this branch had zero
test coverage before, which is how the gap went unnoticed.

**Re-verified post-fix** with two real dispatches (2-battery, then full
5-battery God Mode) against `armageddon-exec-api` → `apex-orchestrator-api-staging.onrender.com`:
both `CERTIFIED`, battery durations ~19–24s each, confirming genuine LLM
round trips this time. Real signed certificates delivered to the user.

## Other fixes this session
- `resolveOmniPortTaskQueue` defaulted to a per-org Temporal queue even
  without `OMNIPORT_TASK_QUEUE_PREFIX` set, so every OmniPort dispatch against
  the shared production deployment was silently orphaned forever (confirmed:
  the first test dispatch was the only `liveFire:true` row that had ever
  existed in the DB). Made per-org isolation an explicit opt-in.
- Leaderboard (`/api/leaderboard`) now shows the human-readable build name
  and dedupes multiple runs of the same build to just the best one.
- Certificate PDF's "CERTIFICATION SUMMARY" box mask extended above its own
  header/divider, erasing the divider and clipping the title on every
  generated certificate. Fixed the mask bounds.
- Certificate Markdown's "Detailed Findings" section was blank on any clean
  pass (only populated for failures/breaches) — added a Methodology section
  covering every battery regardless of outcome, and an explicit
  nothing-was-flagged statement.
- Full SonarCloud backlog cleared (Dockerfiles, workflows, SQL migration,
  cognitive-complexity findings, npx supply-chain pinning) across several PRs
  this session (#209, #211, and a direct-to-main commit from a parallel
  session).

## Durable correction — supersedes the 2026-07-22 (earlier) "no fabricated
certificates" note
That refusal was correct for the conditions at the time (no staging
credentials, no live-fire path). It does not mean fabrication is now
acceptable — the opposite: this session's real certificates required (a) a
genuinely separate, credentialed staging deployment, and (b) fixing a real
defect that would otherwise have kept silently mislabeling simulated runs as
CERTIFIED. **Never trust the `engine: 'LIVE_FIRE'` telemetry tag alone as
proof of real execution** — it is set from `tier` alone and is exactly the
kind of self-reported flag that was wrong here. Cross-check with independent
signal (battery duration, real API cost/token counts if available) before
treating a run as genuinely live-fire, the same way this bug was actually caught.

## Baseline
`main` @ `f3a6835` tagged as this session's verified baseline (see repo tags).
Full quality gate green (479 tests, lint/typecheck/build/docs:check),
SonarCloud gate passing, zero open issues. 12 open PRs (#33 onward, all
pre-dating this baseline by months) are known stale housekeeping debt, left
for an explicit operator decision — not a defect in `main` itself.
