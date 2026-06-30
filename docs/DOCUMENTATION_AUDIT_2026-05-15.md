# Documentation Audit — 2026-05-15

**Docs version**: 2026.05.15<br>
**Audit date**: 2026-05-15<br>
**Last reviewed**: 2026-05-15<br>
**Scope**: Tracked Markdown, text, HTML, README, runbook, status, audit, and map-style documents outside `node_modules/`, `.git/`, and generated dependency trees.<br>
**Evidence baseline**: root `package.json`, workspace `package.json` files, `.github/workflows/`, Docker Compose files, `packages/core/src/`, `armageddon-site/src/`, `packages/shared/src/`, and `scripts/`.

## Executive findings

1. Root validation is npm-only and is defined by root `package.json`: `npm ci`, `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
2. The current repository has three npm workspaces: `armageddon-core`, `armageddon-site`, and `packages/*`.
3. The active deploy surfaces are local Docker Moat (`docker-compose.moat.yml`, `scripts/deploy_moat.*`, `scripts/kill_moat.*`) and static Cloudflare export/deploy (`armageddon-site/wrangler.jsonc`, `docs/CLOUDFLARE_DEPLOYMENT.md`, `scripts/deploy_cloudflare_static.mjs`).
4. Render blueprint files were confirmed as obsolete because the repository records a Moat/Cloudflare deployment posture and no root script or workflow consumes `render.yaml`; `render.yaml` and the duplicate `renderyaml` file were removed in this cleanup.
5. Generated or agent-run artifacts were confirmed irrelevant to source-of-truth documentation and removed: `ARMAGEDDON TEST SUITE - Results.txt`, `packages/core/test-output.txt`, `packages/core/test-output-utf8.txt`, `plan_step_complete.txt`, and stale push logs.
6. `PRODUCTION_STATUS.md` previously described live runtime health that cannot be proven from this checkout alone. It now reports repository-verified release posture and marks external runtime state as requiring fresh operator evidence.
7. Historical audit and launch records remain preserved when they contain dated evidence. They must not be used as current status without a newer verification run.

## Current repository map

| Path | Current role | Verification source |
| --- | --- | --- |
| `packages/core/` | Temporal worker, adversarial engine, provider adapters, Python bridge integration | `packages/core/package.json`, `packages/core/src/`, `packages/core/Dockerfile` |
| `armageddon-site/` | Next.js 14 site/control plane, API routes, static Cloudflare export target | `armageddon-site/package.json`, `armageddon-site/src/`, `armageddon-site/wrangler.jsonc` |
| `packages/shared/` | Shared TypeScript types, battery metadata, gate/tier constants | `packages/shared/package.json`, `packages/shared/src/` |
| `scripts/` | Docs drift, route integrity, Cloudflare deploy, Moat deploy/kill/verify automation | `scripts/*.mjs`, `scripts/*.sh`, `scripts/*.ps1`, `scripts/*.ts` |
| `.github/workflows/` | CI, production readiness, SonarCloud, secret scanning, Cloudflare deploy | `.github/workflows/*.yml` |
| `docs/` | Canonical docs, supporting docs, historical audit/readiness records | This audit plus `docs/README.md` |
| `supabase/migrations/` | Database schema migrations | `supabase/migrations/*.sql` |
| `docker-compose.moat.yml` | Current local Moat orchestration path | Compose file and deployment docs |
| `docker-compose.yml` | Local development/support Temporal/Postgres stack | Compose file |

## Canonical operating documents

| Document | Status after audit | Required maintenance rule |
| --- | --- | --- |
| `README.md` | Canonical repository overview | Keep npm gates and docs hub link aligned with root `package.json`. |
| `AGENTS.md` | Canonical agent/contributor guardrails | Update when workflow, required checks, or doc rules change. |
| `docs/README.md` | Canonical documentation hub | Update when documents are added, moved, archived, or deleted. |
| `docs/QUICKSTART.md` | Canonical local setup | Verify every command against package manifests before changing. |
| `DEPLOYMENT.md` | Canonical local Moat deployment protocol | Keep scoped to Docker Moat; do not mix with Cloudflare static edge deployment. |
| `docs/CLOUDFLARE_DEPLOYMENT.md` | Canonical static Cloudflare deployment protocol | Keep scoped to static site assets; do not claim Temporal worker execution on Cloudflare. |
| `OPS_RUNBOOKS.md` | Canonical incident operations | Keep incident steps executable and avoid unverifiable live-health claims. |
| `PRODUCTION_STATUS.md` | Canonical release posture snapshot | Refresh after each production-readiness audit with command evidence. |
| `LAUNCH_READINESS.md` | Historical launch checklist with canonical pointer | Preserve historical votes; use `PRODUCTION_STATUS.md` for current status. |
| `SECURITY.md` | Canonical security policy | Keep vulnerability reporting and safety posture current. |
| `ACCEPTABLE_USE.md` | Canonical authorized-use policy | Keep product/legal boundaries current. |
| `PRIVACY.md` | Canonical privacy policy | Keep data collection and retention language current. |
| `THIRD_PARTY_NOTICES.md` | Canonical notices | Update when dependencies or licenses materially change. |
| `docs/compliance/SONAR_GATE_POLICY.md` | Canonical quality gate policy | Run `jscpd` for duplication/Sonar remediation work. |

## Supporting engineering and product documents

| Document | Status after audit | Evidence / action |
| --- | --- | --- |
| `packages/core/README.md` | Supporting engine README | Benchmark command matches `packages/core/package.json`. |
| `packages/core/docs/performance-optimizations.md` | Supporting historical optimization note | Retained with core-specific context. |
| `docs/ADR-001-parallel-execution.md` | Supporting ADR | Retained as architecture context. |
| `docs/GITHUB_OAUTH_SETUP.md` | Supporting setup runbook | Refreshed metadata and command style. |
| `docs/WORKFLOW_GUIDE.md` | Supporting workflow reference | Retained; update when Temporal workflow payloads change. |
| `docs/WORKFLOW_E2E_USER_STORY.md` | Supporting QA/product narrative | Retained; update when user-facing flow changes. |
| `docs/workflow_flowchart.html` | Supporting visual workflow map | Retained as static visual artifact. |
| `feature_registry.md` | Supporting feature inventory | Needs future product-owner refresh before release-note use. |
| `frontend-design.md` | Supporting design reference | Retained as product/design source. |
| `docs/runbooks/privacy-breach.md` | Supporting privacy incident runbook | Refreshed metadata; legal obligations still require counsel review before use. |
| `docs/runbooks/security-incident.md` | Supporting security incident runbook | Refreshed metadata; use with `OPS_RUNBOOKS.md` during incidents. |
| `docs/MAIN_LAUNCH_PREP_PROMPT.md` | Supporting launch-prep instruction artifact | Retained as historical/instructional prompt; do not treat PR numbers as current without remote verification. |
| `LICENSE.md` | Canonical license notice | Retained and metadata refreshed. |
| `ARMAGEDDON Test Suite Certification.txt` | Supporting product playbook | Retained; no source-of-truth command claims were promoted. |
| `ARMAGEDDON Test Suite Marketing Plan.txt` | Supporting product/marketing plan | Retained; verify external market facts before external publication. |
| `verification_report.md` | Historical implementation verification | Metadata refreshed; do not treat as current test evidence. |
| `optimization-report.md` | Historical performance verification | Metadata refreshed; rerun benchmarks for current claims. |
| `MIGRATION-SCRIPT-VERIFICATION.md` | Historical migration verification | Metadata refreshed; rerun validation for current release evidence. |
| `OPTIMIZATION-VERIFICATION.md` | Historical optimization verification | Metadata refreshed; rerun benchmarks for current claims. |
| `armageddon_suite_summary.md` | Historical suite summary | Retained as dated product/engineering snapshot; current battery defaults are verified from source. |
| `audit_log.md` | Historical log | Retained; do not rewrite previous entries. |

## Historical audit, readiness, and launch records

| Document | Status after audit | Rule |
| --- | --- | --- |
| `docs/audits/PR_TRIAGE_DECISION_2026-03-04.md` | Historical record | Preserve. |
| `docs/audits/cloudflare-remote-build-audit-2026-05-07.md` | Historical record | Preserve as Cloudflare cutover evidence. |
| `docs/audits/pr-33-hybrid-cloud-moat-audit.md` | Historical record | Preserve. |
| `docs/deployment-cloudflare-local-audit.md` | Historical/supporting deployment audit | Updated only when superseding evidence exists. |
| `docs/deployment-gate-run-2026-05-06.md` | Historical gate run | Preserve; rerun gates for current approval. |
| `docs/deployment-verification.md` | Supporting gate procedure | Retain as procedure, not proof of current runtime. |
| `docs/launch-prep/2026-02-20-phase0-baseline.md` | Historical launch-prep baseline | Preserve; it intentionally records unavailable CI/remote state. |
| `docs/READINESS_ASSESSMENT.md` | Historical readiness assessment | Preserve as historical; current readiness is `PRODUCTION_STATUS.md`. |

## Agent, skill, and external workflow references

| Document | Status after audit | Rule |
| --- | --- | --- |
| `SKILL.md` | Supporting local skill definition | Retained because it is a tracked skill document. |
| `omni-test-universal-v3/omni-test-universal/SKILL.md` | Supporting imported skill definition | Retained; excluded from docs drift checks as external skill content. |
| `apex-dev.md` | Supporting APEX agent reference | Retained; do not promote its sample scripts as repository commands. |
| `apex-power.md` | Supporting APEX agent reference | Retained; do not promote its sample scripts as repository commands. |
| `one-pass-debug.md` | Supporting debug methodology | Retained as generic troubleshooting reference. |
| `universal-debug-skill.md` | Supporting debug skill reference | Retained as generic troubleshooting reference. |
| `web-art-generator.md` | Supporting creative tooling reference | Retained as generic creative reference. |
| `webapp-testing.md` | Supporting testing methodology | Retained as generic browser-testing reference. |
| `packages/core/requirements.txt` | Dependency manifest, not prose documentation | Retained because `packages/core/Dockerfile` installs it. |
| `armageddon-site/intake/index.html` | Static intake page artifact | Retained because it is copied/deployed by site scripts. |

## Deleted as stale or irrelevant

| Removed file | Evidence-based reason | Replacement/source of truth |
| --- | --- | --- |
| `ARMAGEDDON TEST SUITE - Results.txt` | Dated 2026-01-17 generated result snapshot with obsolete `v1.0` status and undefined script references. | Current evidence must come from fresh `npm run test` output. |
| `packages/core/test-output.txt` | Generated test output, not source documentation. | Fresh `npm --prefix armageddon-core run test` output. |
| `packages/core/test-output-utf8.txt` | Duplicate generated test output, not source documentation. | Fresh `npm --prefix armageddon-core run test` output. |
| `plan_step_complete.txt` | Agent-run artifact, not product or operational documentation. | Git history and PR body. |
| `render.yaml` | Deprecated Render blueprint; no root script/workflow consumes it and current deployment docs point to Moat/Cloudflare. | `docker-compose.moat.yml`, `docs/CLOUDFLARE_DEPLOYMENT.md`. |
| `renderyaml` | Extensionless duplicate of the deprecated Render blueprint. | None. |
| `push.log`, `push2.log`, `push3.log`, `push4.log` | Local git push transcripts, not documentation or source. | Git history. |

## Current battery-state evidence

| Surface | Verified state | Source |
| --- | --- | --- |
| UI/shared battery grid | Thirteen display batteries (`01` through `13`) are exported for presentation. | `packages/shared/src/batteries.ts` |
| Certification default battery subset | `DEFAULT_BATTERIES` is `B10` through `B14`. | `packages/shared/src/gate.ts` |
| Temporal workflow dispatch | `ArmageddonLevel7Workflow` accepts requested batteries and defaults to `B10` through `B14`. | `packages/core/src/temporal/workflows.ts` |
| Battery implementation boundary | Temporal activities expose B1-B14 handlers, including `B14_INDIRECT_INJECTION`. | `packages/core/src/temporal/activities.ts` |

## Required checks for this documentation cleanup

```bash
npm ci
npm run docs:check
npm run lint
npm run typecheck
npm run test
npm run build
```

The duplication/Sonar `jscpd` command is not required for this documentation cleanup because no runtime duplication remediation was performed.

## Addendum — 2026-06-24

The 2026-05-15 findings above are preserved as the historical baseline. This
addendum records documents and guardrails added after that audit; it does not
rewrite prior entries.

| Document / guardrail | Status | Maintenance rule |
| --- | --- | --- |
| `docs/CANONICAL_UI_CONTRACT.md` | Canonical | Freezes the public header/footer/pricing state. Update alongside the matching assertion when an invariant intentionally changes. |
| `armageddon-site/tests/unit/canonical-ui-freeze.test.ts` | Enforcement (CI) | Regression guardrail for the contract; runs via `npm run test -w armageddon-site`. Never delete an assertion to make CI pass. |
| `.github/CODEOWNERS` | Review gate | Requires `@apexbusiness-systems` review on the canonical surfaces and the guardrails. Binding once `main` branch protection requires Code Owner review. |

## Addendum — 2026-06-26

The 2026-05-15 audit remains a historical baseline. This addendum records the
security regression tests added for the 2026-06-26 OmniPort remediation package.

| Test file | Status | Maintenance rule |
| --- | --- | --- |
| `armageddon-site/tests/unit/api-omniport-waiver.test.ts` | Enforcement (CI) | Validates waiver acceptance rejects mismatched organization and user claims before inserting legal records. |
| `armageddon-site/tests/unit/omniport-ssrf.test.ts` | Enforcement (CI) | Validates OmniPort SSRF rejection for localhost/private/reserved IP targets and private DNS resolutions while allowing public HTTPS. |
| `armageddon-site/tests/unit/api-run-temporal-cleanup.test.ts` | Enforcement (CI) | Validates `/api/run` marks inserted rows failed when Temporal connection or workflow start fails. |
| `armageddon-site/tests/unit/api-omniport-execute-temporal-cleanup.test.ts` | Enforcement (CI) | Validates OmniPort execute marks inserted rows failed when Temporal connection fails. |

## Addendum — 2026-06-27

The 2026-05-15 audit remains a historical baseline. This addendum records the
codebase onboarding regression tests added for the first-run target-endpoint
intake flow. (The implementation that shipped records a single deployed
app / API / LLM-agent **endpoint URL**; the earlier "repository or zip archive"
framing was superseded before merge and is retained here only as history.)

| Test file | Status | Maintenance rule |
| --- | --- | --- |
| `armageddon-site/tests/unit/app-onboarding-codebase-target.test.tsx` | Enforcement (CI) | Validates onboarding target-endpoint validation and local target persistence that does not claim upload, ingestion, or analysis. |
| `armageddon-site/tests/unit/components/DestructionConsole-codebase-target.test.tsx` | Enforcement (CI) | Validates console target readiness summaries and run gating when no valid target endpoint or backend is configured. |
| `armageddon-site/tests/unit/api-run-target-endpoint.test.ts` | Enforcement (CI) | Proves a configured `targetEndpoint` is persisted into the run config and forwarded into the workflow input (no silent drop on the runtime path). |
| `armageddon-site/tests/unit/lib/codebase-target.test.ts` | Enforcement (CI) | Validates shared codebase target parsing, validation, summaries, and run-readiness gating. |

## Addendum — 2026-06-27 target readiness follow-up

The 2026-05-15 audit remains a historical baseline. This addendum records the
run-readiness UI tests and review-only SQL draft added after reconciling the
merged onboarding/i18n work.

| File | Status | Maintenance rule |
| --- | --- | --- |
| `armageddon-site/tests/unit/components/TargetConfigPanel.test.tsx` | Enforcement (CI) | Validates target-configuration empty/configured states and onboarding CTA routing. |
| `armageddon-site/tests/unit/components/RunReadinessChecklist.test.tsx` | Enforcement (CI) | Validates visible run-readiness blockers and all-ready state. |
| `docs/ops/sql/2026-06-27-org-unblock-review.sql` | Review-only operational draft | Must be reviewed and parameterized by an operator before execution; Codex must not execute it. |
| `armageddon-site/tests/unit/active-target-copy.test.ts` | Enforcement (CI) | Validates active target-configuration UI does not claim repository, zip upload, or code-analysis capabilities. |
