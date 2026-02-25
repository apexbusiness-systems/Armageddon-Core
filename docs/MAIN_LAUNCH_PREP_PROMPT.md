# Armageddon Launch Prep Prompt (Integrated)

## DELIVERABLES (REQUIRED)
1) Repo Scope Map (architecture + services + packages + entrypoints + environments)
2) **PR Stabilization Ledger**
3) Launch Readiness Report (PASS/FAIL/BLOCKER per category, with evidence)
4) Feature E2E Verification Matrix (feature → test method → result → evidence)
5) Performance & Surge Readiness Results (load test plan + numbers + bottlenecks + fixes)
6) Security & Reliability Findings (deps, configs, auth, rate limits, failure modes)
7) Release Package (versioning, changelog, release notes, runbook updates)
8) Documentation Updates (dated + versioned) and a final “What changed” summary

## PHASE -1 — PR/Branch Stabilization (MANDATORY, BEFORE PHASE 0)
Objective: bring all currently-open PR branches to one definitive state:
- READY_TO_MERGE
- CLOSED_AS_BLOCKED
- SPLIT_AND_SALVAGED

Target PR queue:
- PR #72 — feat(compliance): implement phased DevSecOps gates and runbooks (phases 0–5)
- PR #69 — Implement Tier-Differentiated Logic for Battery 3 and Finalize ATSC Platform
- PR #58 — fix(pr-33): Resolve build errors and code smells
- PR #33 — Feat/hybrid cloud moat

Per PR workflow:
1. Capture facts (base, head SHA, changed areas, failing checks, log excerpts)
2. Sync and eliminate conflicts (rebase preferred)
3. Reproduce locally from CI config/scripts (format/lint → typecheck → unit → integration → build → e2e)
4. Patch minimally by root cause category
5. Re-run exact failing steps and update PR description with tests + rollback notes
6. If entangled, split into small mergeable stabilization pieces and scoped follow-ups

Non-negotiables:
- No guessing CI failures; cite failing job names and logs
- No disabling tests without deterministic equivalent replacement
- No mega-commits; one scoped fix set per failing check
- Max 2 fix→retest cycles per PR, then block with evidence

Required artifact:
- PR Stabilization Ledger table:
  PR | Title | Primary Failure | Repro Steps | Fix Commits | Status | Evidence

Integration order (default):
1) PR #58 (build/CI stabilization)
2) PR #72 (compliance gates/runbooks)
3) PR #69 (feature logic)
4) PR #33 (infra/architecture)

## PHASE 0 — Repo Recon + Baseline
- Enumerate repository structure and build/test systems
- Read README/docs/manifests/CI/deploy/runbook assets
- Capture baseline versioning (tags/changelog), entrypoints, environments
- Produce repo scope map before making functional fixes

## PHASES 1–7
- Phase 1: Build/Test baseline
- Phase 2: Feature inventory + E2E verification
- Phase 3: Reliability/failure-modes hardening
- Phase 4: Performance/surge readiness
- Phase 5: Security/supply-chain checks
- Phase 6: CI/CD + release hardening
- Phase 7: Docs/versioning/release notes/final launch checklist
