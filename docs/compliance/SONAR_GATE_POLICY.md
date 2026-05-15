# SonarCloud Gate Policy

**Docs version**: 2026.05.15<br>
**Last reviewed**: 2026-05-15<br>
**Scope**: Quality-gate expectations for repository code health and duplication remediation

## Gate Targets

| Metric | Target | Enforcement status | Owner role | Review date |
| --- | --- | --- | --- | --- |
| Reliability Rating | A | Enforced in SonarCloud project settings | Engineering Lead | 2026-05-15 |
| Security Rating | A | Enforced in SonarCloud project settings | Engineering Lead | 2026-05-15 |
| Maintainability Rating | A | Enforced in SonarCloud project settings | Engineering Lead | 2026-05-15 |
| Coverage | Project threshold configured in SonarCloud | External gate; verify in SonarCloud before release | Engineering Lead | 2026-05-15 |
| Duplication | ≤3% target | External gate plus local `jscpd` remediation check | Engineering Lead | 2026-05-15 |

## Required Local Checks

Run the root gates for code changes:

```bash
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
```

For duplication/Sonar remediation work, also run:

```bash
npx --yes jscpd --min-lines 5 --min-tokens 50 --reporters console --mode strict armageddon-core/src armageddon-site/src
```

## Gate Lock Procedure

1. Lock Quality Gate settings in the SonarCloud project.
2. Disallow leak-period bypass for release branches.
3. Require Engineering Lead and security approval before lowering any quality target.
4. Record target changes in a dated audit or PR body.
