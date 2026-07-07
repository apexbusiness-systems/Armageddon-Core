# Armageddon Documentation Hub

**Docs version**: 2026.07.07<br>
**Last reviewed**: 2026-07-07<br>
**Primary package manager**: npm<br>
**Runtime baseline**: Node.js 22 in CI, Node.js >=20 for workspaces

This hub is the canonical entry point for onboarding engineers and agents. If a document conflicts with this hub or root `package.json`, trust `package.json` and update the stale document in the same change.

## Start here

| Need | Canonical document | Purpose |
| --- | --- | --- |
| Install and run locally | [`docs/QUICKSTART.md`](./QUICKSTART.md) | Verified local setup, worker start, tests, and build commands. |
| Understand repo rules | [`../AGENTS.md`](../AGENTS.md) | Agent and contributor guardrails that prevent drift. |
| Security invariants and frozen state | [`../CLAUDE.md`](../CLAUDE.md) | Frozen canonical state, security invariants for `intake-handler.ts`, and anti-regression guardrails. Read before modifying any protected module. |
| Deploy Cloudflare edge | [`docs/CLOUDFLARE_DEPLOYMENT.md`](./CLOUDFLARE_DEPLOYMENT.md) | Static Cloudflare edge deployment path including ATLAS support-chat KV and secret provisioning. |
| Deploy local Moat | [`../DEPLOYMENT.md`](../DEPLOYMENT.md) | Local Docker/Temporal Moat protocol. |
| Operate incidents | [`../OPS_RUNBOOKS.md`](../OPS_RUNBOOKS.md) | SEV response, key rotation, stuck workflow triage, and support-chat operational playbook. |
| Security policy | [`../SECURITY.md`](../SECURITY.md) | Vulnerability reporting and security expectations. |
| Authorized use | [`../ACCEPTABLE_USE.md`](../ACCEPTABLE_USE.md) | Permitted and prohibited use boundaries. |
| Current release posture | [`../PRODUCTION_STATUS.md`](../PRODUCTION_STATUS.md) | Repository-verified production-readiness snapshot. |
| Sonar quality gate | [`docs/compliance/SONAR_GATE_POLICY.md`](./compliance/SONAR_GATE_POLICY.md) | Duplication and quality-gate expectations. |
| Documentation audit | [`docs/DOCUMENTATION_AUDIT_2026-05-15.md`](./DOCUMENTATION_AUDIT_2026-05-15.md) | Inventory of reviewed Markdown, text, HTML, README, runbook, status, audit, and map documents. |
| Local worker credential blocker | [`docs/audits/LOCAL_WORKER_CREDENTIALS_REQUIRED_2026-07-04.md`](./audits/LOCAL_WORKER_CREDENTIALS_REQUIRED_2026-07-04.md) | File-based blocker for cloud-connected Docker Desktop worker deployment credentials and host-side inventory prerequisites. |
| Deploy the execution engine (api-server + worker) | [`../RUNBOOK_EXECUTION_ENGINE_2026-07-06.md`](../RUNBOOK_EXECUTION_ENGINE_2026-07-06.md) | Full runbook for deploying the two Node processes that drain `pending` runs (fixes "stuck at EXECUTING 0/13"). |
| Turnkey executor deploy (~15 min) | [`docs/EXECUTOR_DEPLOY_TURNKEY.md`](./EXECUTOR_DEPLOY_TURNKEY.md) | Copy-paste path from the 0/13 stall to executing runs, leading with the Temporal-topology trap in `.env.moat.example` vs `docker-compose.exec.yml`. |
| Execution-path verification evidence | [`docs/EXECUTION_ENGINE_VERIFICATION_2026-07-07.md`](./EXECUTION_ENGINE_VERIFICATION_2026-07-07.md) | Proof the certification pipeline code path completes start→certification; establishes the 0/13 stall as a deployment gap, not a code defect. |
| Live UI/UX execution contract | [`docs/COWORK_UI_UX_EXECUTION_CONTRACT.md`](./COWORK_UI_UX_EXECUTION_CONTRACT.md) | Journey-by-journey live validation contract for the production site (Cowork execution). |
| Release gate 2026-07-06 | [`../RELEASE_GATE_2026-07-06.md`](../RELEASE_GATE_2026-07-06.md) | Audit behind PR #184: /api/run 500 root cause, attestation edge endpoint, claim-integrity and SEO shields (CLAUDE.md Invariants 12–15). |
| Durable agent memory | [`../omni-recall/start-here.md`](../omni-recall/start-here.md) | Omni-Recall entry point: continuity, correction memory, and durable operating preferences. |

## Verified root commands

Run commands from the repository root unless a document explicitly says otherwise.

```bash
npm ci
npm run lint
npm run typecheck
npm run test
npm run test:e2e:local
npm run build
npm run docs:check
```

Workspace-specific commands:

```bash
npm run worker -w armageddon-core
npm run dev -w armageddon-site
npm run build:cloudflare -w armageddon-site
npm run certify:staging-e2e
```

## Repository map

| Path | Role | Notes |
| --- | --- | --- |
| `packages/core/` | Temporal worker and adversarial engine | TypeScript source, provider adapters, simulation, Python bridge integration, tests. |
| `armageddon-site/` | Next.js public/control-plane UI | App routes, components, API routes, static Cloudflare export config. |
| `packages/shared/` | Shared constants/types | Built by root `postinstall`; exports battery display metadata and gate defaults. |
| `scripts/` | Operational automation | Audit, route integrity, Cloudflare deploy, Moat deploy/kill/verify scripts. |
| `.github/workflows/` | CI/CD gates | CI, production-readiness, SonarCloud, secret scanning, Cloudflare deploy. |
| `docs/` | Canonical, supporting, and historical documentation | Use this hub before adding new root-level docs. |
| `supabase/migrations/` | Database schema changes | SQL migrations for Armageddon run, event, auth, and rate-limit persistence. |
| `docker-compose.moat.yml` | Local Moat runtime | Current local Temporal/Postgres/worker containment stack. |
| `docker-compose.yml` | Local development support runtime | Developer Temporal/Postgres/worker stack. |

## Documentation lifecycle

| Status | Meaning | Required action |
| --- | --- | --- |
| Canonical | Current operating truth | Keep linked from this hub and update with code changes. |
| Supporting | Useful background, setup, design, or product context | Keep accurate enough to avoid contradicting canonical docs. |
| Historical record | Past audit, launch, readiness, benchmark, or incident snapshot | Do not rewrite factual history; add superseding links when needed. |
| External/generic agent reference | Skill or methodology content not specific to current package scripts | Do not promote sample commands as repository commands unless verified. |
| Generated artifact | Tool output or captured result | Remove from source control unless intentionally tracked and reviewed. |
| Deleted stale artifact | Proven irrelevant to current source of truth | Record deletion in the latest documentation audit. |

## Active cleanup decisions from 2026-05-15

- Removed obsolete Render blueprint files because the repository no longer uses Render as an active deployment path.
- Removed generated test-output and push-log artifacts from tracked source.
- Kept historical audit/readiness records when they contain dated evidence.
- Converted current status language to repository-verifiable posture instead of unverifiable live runtime claims.

## Anti-drift requirements for agents

- Verify commands against `package.json` before documenting them.
- Run `npm run docs:check` after editing docs to catch stale commands and conversational drift.
- Verify workflow names against `.github/workflows/` before citing CI gates.
- Prefer absolute dates over relative language such as "today" or "right now".
- Keep deployment docs explicit about target: Cloudflare static edge vs local Moat vs historical provider references.
- Mark unknown remote/CI/runtime state as `UNVERIFIED` instead of assuming success.
- Do not edit the frozen public marketing surfaces outside [`docs/CANONICAL_UI_CONTRACT.md`](./CANONICAL_UI_CONTRACT.md); changes must update the matching assertion in `armageddon-site/tests/unit/canonical-ui-freeze.test.ts` and the contract together.


## 2026-06-30 app-workspace UX guardrails

- Authenticated visits to `/` must route client-side to `/console`; public visitors keep the frozen landing/marketing page.
- `/console` is an operator workspace only: target summary, guided run setup, test configuration, initiate action, terminal output, and telemetry/evidence surfaces. It must not render public marketing sections such as `The 13 Batteries`, certification sales content, or footer conversion CTAs.
- Guardrail tests added on 2026-06-30 cover root auth routing, console workspace separation, guided readiness remediation, onboarding helper copy, and evidence-signing unavailable copy.
