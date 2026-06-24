# ARMAGEDDON Agent Operating Instructions

**Scope**: Entire repository.<br>
**Docs version**: 2026.06.24<br>
**Last reviewed**: 2026-06-24

## Non-negotiable workflow

1. Read `CLAUDE.md` **then** `docs/README.md` before making repo-wide changes. `CLAUDE.md` contains frozen security invariants that take priority over conversational context.
2. Use `npm` from the repository root. Do not introduce Bun/Yarn/pnpm commands unless `package.json` is changed in the same patch.
3. Never log, print, commit, or copy secrets. Use `.env.moat.example` as the only committed environment template.
4. Keep production code changes small and verified. If a change touches more than three runtime modules, document the migration and rollback path in the PR body.
5. Do not remove safety controls (`SIM_MODE`, circuit breakers, rate limits, auth checks, secret scanning, or deployment gates) to make a test pass.
6. Treat generated outputs (`.next/`, `dist/`, coverage, service-worker builds, TypeScript build info) as disposable unless the file is intentionally tracked and reviewed.

## Required local checks for code changes

```bash
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
```

For duplication/Sonar remediation work, also run:

```bash
npx --yes jscpd --min-lines 5 --min-tokens 50 --reporters console --mode strict packages/core/src armageddon-site/src
```

## Documentation rules

- Update dates using ISO format: `YYYY-MM-DD`.
- Add a `Last reviewed` or `Last updated` line to new operational documents.
- If a document is historical, mark it `Historical record` instead of rewriting history.
- Prefer updating `docs/README.md` and `docs/DOCUMENTATION_AUDIT_2026-05-15.md` when adding, moving, or deprecating docs.
- Do not create conversational docs that ask the reader to report back; write executable, verifiable steps.
