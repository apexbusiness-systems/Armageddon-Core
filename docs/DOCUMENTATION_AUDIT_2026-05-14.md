# Documentation Audit — 2026-05-14

**Docs version**: 2026.05.14<br>
**Audit date**: 2026-05-14<br>
**Scope**: Markdown, text, and HTML documents outside `node_modules/`, `.git/`, and generated dependency trees.<br>
**Rollback strategy**: This pass adds governance/index documents and corrects verified stale commands/dates. No broad deletion or bulk file moves were performed.

## Executive findings

1. Root onboarding had command drift: `README.md` referenced Bun, while the repo scripts and CI use npm.
2. `docs/QUICKSTART.md` referenced `npm run start:worker`, which is not defined. The verified workspace command is `npm run worker -w armageddon-core`.
3. Several root-level operational documents had stale review dates from February/March 2026. They now point readers to this audit and docs hub.
4. Historical audit and launch-prep documents contain valid dated snapshots. They should remain immutable except for superseding links.
5. Several root-level marketing/planning artifacts are useful but should be migrated under `docs/product/` or `docs/archive/` in a future dedicated docs-structure PR.
6. A new `npm run docs:check` gate now blocks known stale documentation commands in active docs.

## Canonical operating documents

| Document | Status | Action taken |
| --- | --- | --- |
| `README.md` | Canonical onboarding | Updated command guidance from Bun to npm and linked docs hub. |
| `AGENTS.md` | Canonical agent guardrails | Added root-scoped instructions for agents and contributors. |
| `docs/README.md` | Canonical docs hub | Added as the documentation entry point. |
| `docs/QUICKSTART.md` | Canonical local setup | Rewritten with verified npm scripts and non-conversational steps. |
| `DEPLOYMENT.md` | Canonical local Moat deployment | Updated review metadata and npm validation references. |
| `OPS_RUNBOOKS.md` | Canonical operations | Updated review metadata and removed unverifiable smoke-test command claim. |
| `PRODUCTION_STATUS.md` | Canonical status snapshot | Updated review metadata and corrected npm CI gate wording. |
| `LAUNCH_READINESS.md` | Canonical launch checklist snapshot | Updated review metadata and corrected npm gate wording. |
| `SECURITY.md` | Canonical security | No command drift found in this pass. |
| `ACCEPTABLE_USE.md` | Canonical usage policy | No command drift found in this pass. |
| `PRIVACY.md` | Canonical privacy | No command drift found in this pass. |
| `THIRD_PARTY_NOTICES.md` | Canonical notices | No command drift found in this pass. |
| `docs/compliance/SONAR_GATE_POLICY.md` | Canonical quality gate | Retained; duplication workflow verified with `jscpd`. |

## Supporting engineering docs

| Document | Status | Notes |
| --- | --- | --- |
| `armageddon-core/README.md` | Supporting | Engine-specific concurrency/performance notes. |
| `armageddon-core/docs/performance-optimizations.md` | Supporting | Historical implementation note; keep with core docs. |
| `docs/ADR-001-parallel-execution.md` | Supporting | Architecture decision record. |
| `docs/GITHUB_OAUTH_SETUP.md` | Supporting | Auth setup; verify callback URLs when auth changes. |
| `docs/WORKFLOW_GUIDE.md` | Supporting | Workflow behavior reference with sample payloads. |
| `docs/WORKFLOW_E2E_USER_STORY.md` | Supporting | Product/QA workflow narrative. |
| `docs/workflow_flowchart.html` | Supporting | Visual workflow artifact. |
| `feature_registry.md` | Supporting | Product/feature inventory. |
| `frontend-design.md` | Supporting | Design reference. |
| `verification_report.md` | Supporting | Historical verification notes; supersede with new dated report if needed. |
| `audit_log.md` | Supporting historical log | Do not rewrite past session entries. |

## Historical audit and launch records

| Document | Status | Notes |
| --- | --- | --- |
| `docs/audits/PR_TRIAGE_DECISION_2026-03-04.md` | Historical record | Keep immutable. |
| `docs/audits/cloudflare-remote-build-audit-2026-05-07.md` | Historical record | Keep immutable; useful for Cloudflare cutover context. |
| `docs/audits/pr-33-hybrid-cloud-moat-audit.md` | Historical record | Keep immutable. |
| `docs/deployment-cloudflare-local-audit.md` | Historical/supporting | Cloudflare/local audit context. |
| `docs/deployment-gate-run-2026-05-06.md` | Historical record | Gate run snapshot. |
| `docs/deployment-verification.md` | Historical/supporting | Deployment verification context. |
| `docs/launch-prep/2026-02-20-phase0-baseline.md` | Historical record | Already marks inaccessible CI/remote state as `UNVERIFIED`. |
| `docs/READINESS_ASSESSMENT.md` | Historical readiness record | Contains dated February 2026 deployment assumptions; do not use as current status. |
| `MIGRATION-SCRIPT-VERIFICATION.md` | Historical/supporting | Migration verification snapshot. |
| `OPTIMIZATION-VERIFICATION.md` | Historical/supporting | Optimization verification snapshot. |
| `optimization-report.md` | Historical/supporting | Optimization report. |
| `armageddon_suite_summary.md` | Historical/supporting | Suite summary. |

## Legacy candidates for future relocation

| Document | Recommended destination | Rationale |
| --- | --- | --- |
| `ARMAGEDDON TEST SUITE - Results.txt` | `docs/archive/results/` | Captured results should not sit at repo root. |
| `ARMAGEDDON Test Suite Certification.txt` | `docs/product/certification/` | Product/certification copy should be grouped. |
| `ARMAGEDDON Test Suite Marketing Plan.txt` | `docs/product/marketing/` | Marketing plan should be grouped outside root. |
| `apex-dev.md` | `docs/agents/` | Agent/development guidance. |
| `apex-power.md` | `docs/agents/` | Agent/development guidance. |
| `one-pass-debug.md` | `docs/agents/` | Debugging agent prompt/instructions. |
| `universal-debug-skill.md` | `docs/agents/` | Skill-like agent reference. |
| `web-art-generator.md` | `docs/agents/` or `docs/creative/` | Creative tooling reference. |
| `webapp-testing.md` | `docs/agents/` or `docs/testing/` | Testing agent reference. |
| `plan_step_complete.txt` | `docs/archive/agent-runs/` | Agent-run artifact. |
| `armageddon-core/test-output.txt` | `docs/archive/test-output/` or remove | Generated test output. |
| `armageddon-core/test-output-utf8.txt` | `docs/archive/test-output/` or remove | Generated test output. |

## Files intentionally not audited as docs

- `LICENSE.md`: legal source-of-truth; no operational commands.
- `SKILL.md` and `omni-test-universal-v3/omni-test-universal/SKILL.md`: skill definitions; update only when the skill contract changes.
- `armageddon-site/intake/index.html`: deployable/static intake artifact, not a governance doc.
- `armageddon-core/requirements.txt`: dependency manifest, not prose documentation.

## Follow-up backlog

1. Move legacy candidates into `docs/archive/`, `docs/agents/`, and `docs/product/` with link-preserving stubs or redirects.
2. Decide whether generated `test-output*.txt` files should be deleted or archived after confirming no external process consumes them.
3. Add owner metadata to canonical docs once the operational owner list is confirmed.
