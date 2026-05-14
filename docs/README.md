# Armageddon Documentation Hub

**Docs version**: 2026.05.14<br>
**Last reviewed**: 2026-05-14<br>
**Primary package manager**: npm<br>
**Runtime baseline**: Node.js 22 in CI, Node.js >=20 for workspaces

This hub is the canonical entry point for onboarding engineers and agents. If a document conflicts with this hub or root `package.json`, trust `package.json` and update the stale document in the same change.

## Start here

| Need | Canonical document | Purpose |
| --- | --- | --- |
| Install and run locally | [`docs/QUICKSTART.md`](./QUICKSTART.md) | Verified local setup, worker start, tests, and build commands. |
| Understand repo rules | [`../AGENTS.md`](../AGENTS.md) | Agent and contributor guardrails that prevent drift. |
| Deploy Cloudflare edge | [`docs/CLOUDFLARE_DEPLOYMENT.md`](./CLOUDFLARE_DEPLOYMENT.md) | Cloudflare Workers deployment path for the public site. |
| Deploy local Moat | [`../DEPLOYMENT.md`](../DEPLOYMENT.md) | Local Docker/Temporal Moat protocol. |
| Operate incidents | [`../OPS_RUNBOOKS.md`](../OPS_RUNBOOKS.md) | SEV response, key rotation, stuck workflow triage. |
| Security policy | [`../SECURITY.md`](../SECURITY.md) | Vulnerability reporting and security expectations. |
| Authorized use | [`../ACCEPTABLE_USE.md`](../ACCEPTABLE_USE.md) | Permitted and prohibited use boundaries. |
| Sonar quality gate | [`docs/compliance/SONAR_GATE_POLICY.md`](./compliance/SONAR_GATE_POLICY.md) | Duplication and quality-gate expectations. |
| Documentation audit | [`docs/DOCUMENTATION_AUDIT_2026-05-14.md`](./DOCUMENTATION_AUDIT_2026-05-14.md) | Inventory of every reviewed markdown/text/html document. |

## Verified root commands

Run commands from the repository root unless a document explicitly says otherwise.

```bash
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
npm run docs:check
```

Workspace-specific commands:

```bash
npm run worker -w armageddon-core
npm run dev -w armageddon-site
npm run build:cloudflare -w armageddon-site
```

## Repository map

| Path | Role | Notes |
| --- | --- | --- |
| `armageddon-core/` | Temporal worker and adversarial engine | TypeScript source, provider adapters, simulation, tests. |
| `armageddon-site/` | Next.js public/control-plane UI | App routes, components, API routes, Cloudflare export config. |
| `packages/shared/` | Shared constants/types | Built by root `postinstall`. |
| `scripts/` | Operational automation | Audit, route integrity, Cloudflare deploy, Moat scripts. |
| `.github/workflows/` | CI/CD gates | Build/test, production-readiness, SonarCloud, secret scanning, Cloudflare deploy. |
| `docs/` | Canonical and historical documentation | Use this hub before adding new root-level docs. |

## Documentation lifecycle

| Status | Meaning | Required action |
| --- | --- | --- |
| Canonical | Current operating truth | Keep linked from this hub and update with code changes. |
| Supporting | Useful background or design context | Keep accurate enough to avoid contradicting canonical docs. |
| Historical record | Past audit, launch, or incident snapshot | Do not rewrite factual history; add superseding links when needed. |
| Legacy candidate | Valuable content but wrong location or stale commands | Migrate or archive in a dedicated cleanup PR. |
| Generated artifact | Tool output or captured result | Regenerate from source instead of hand-editing when possible. |

## Anti-drift requirements for agents

- Verify commands against `package.json` before documenting them.
- Run `npm run docs:check` after editing docs to catch stale commands and conversational drift.
- Verify workflow names against `.github/workflows/` before citing CI gates.
- Prefer absolute dates over relative language such as "today" or "right now".
- Keep deployment docs explicit about target: Cloudflare edge vs local Moat vs historical Render/Vercel references.
- Mark unknown remote/CI state as `UNVERIFIED` instead of assuming success.
