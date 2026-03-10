# PR Triage Decision Record (Open PRs Snapshot)

## Scope
This triage uses the provided open-PR snapshot and repository evidence available in this workspace.

Open PRs observed in snapshot:
- #78 `feat: harden Kinetic Moat for production Linux deployment`
- #72 `feat(compliance): implement phased DevSecOps gates and runbooks (phases 0–5)`
- #69 `Implement Tier-Differentiated Logic for Battery 3 and Finalize ATSC Platform`
- #33 `Feat/hybrid cloud moat`

## Evidence Considered
1. Repository already contains moat deployment and hardening-oriented assets (`docker-compose.moat.yml`, `DEPLOYMENT.md`, moat env template, runbooks).
2. Compliance/runbook artifacts are present (`docs/compliance/SONAR_GATE_POLICY.md`, `OPS_RUNBOOKS.md`, readiness and launch docs).
3. Prior audit artifact exists specifically for PR 33 (`docs/audits/pr-33-hybrid-cloud-moat-audit.md`), implying older work has already been evaluated and likely superseded.
4. New zip-delivered assets exist in root (`omni-test-universal-v3.zip`, `omnidev-v2.zip`) which are process/tooling aids, not necessarily mergeable feature branches.

## Decision Matrix

### #78 — **FIX & MERGE (Priority 1)**
**Decision**: Keep open, repair failing checks, merge.

**Rationale**
- Kinetic moat hardening aligns directly with current production architecture and security posture.
- It has highest operational impact on deployment reliability and containment integrity.
- Current repo direction indicates moat is first-class and active.

**Required fix-before-merge gates**
- Lint/type/build green across workspaces.
- Deterministic deployment verification for Linux path.
- Regression pass for certification flow and runbook links.

### #72 — **FIX & MERGE (Priority 2)**
**Decision**: Keep open, resolve breakages, merge after #78.

**Rationale**
- Phased DevSecOps gates and runbooks are foundational for compliance evidence and release safety.
- Repository already includes compliance docs; consolidating this PR likely reduces drift between docs and enforcement.

**Required fix-before-merge gates**
- No contradictory policy docs.
- CI quality gates wired and passing.
- Clear runbook ownership and execution sequence.

### #69 — **CLOSE & DELETE BRANCH**
**Decision**: Do not merge in current form; close PR and delete stale branch.

**Rationale**
- Scope appears broad/ambiguous (“Tier-Differentiated Logic” + “Finalize ATSC Platform”) and not clearly traceable to current core repo baseline.
- High risk of mixed concerns and hidden regressions without a narrow acceptance contract.

**Follow-up path**
- Re-open as scoped replacement PR(s): one PR per battery logic surface with deterministic tests.

### #33 — **CLOSE & DELETE BRANCH**
**Decision**: Close as superseded and delete branch.

**Rationale**
- Existing audit doc for PR 33 indicates prior review cycle; current moat direction has advanced beyond legacy hybrid-cloud framing.
- Avoid duplicate architecture tracks competing with moat-first production posture.

## Merge Order
1. #78 (stability/security first)
2. #72 (governance/compliance second)
3. Close #69 and #33 as superseded/over-broad.

## Operational Note
Because this workspace has no remote git metadata for PR diffs, final branch-level merge should be executed only after direct diff validation in GitHub UI and CI reruns for each candidate PR.
