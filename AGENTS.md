# ARMAGEDDON Agent Operating Instructions

**Scope**: Entire repository.<br>
**Docs version**: 2026.09.28<br>
**Last reviewed**: 2026-09-28

## Non-negotiable workflow

1. Read `CLAUDE.md` **then** `docs/README.md` before making repo-wide changes. `CLAUDE.md` contains frozen security invariants that take priority over conversational context.
2. Use `npm` from the repository root. Do not introduce Bun/Yarn/pnpm commands unless `package.json` is changed in the same patch.
3. Never log, print, commit, or copy secrets. Committed environment templates carry key names only: `.env.moat.example` (Moat) and `armageddon-site/.env.example` (site, incl. `E2E_ADMIN_*`). Never commit a document that quotes a secret (CLAUDE.md Invariant 18).
4. Keep production code changes small and verified. If a change touches more than three runtime modules, document the migration and rollback path in the PR body.
5. Do not remove safety controls (`SIM_MODE`, circuit breakers, rate limits, auth checks, secret scanning, or deployment gates — including the CI revenue gate) to make a test pass.
6. Merging to `main` deploys production (`.github/workflows/deploy-cloudflare.yml`); pull requests never deploy (CLAUDE.md Invariant 16). Agents never merge — the owner does.
7. Treat generated outputs (`.next/`, `dist/`, coverage, service-worker builds, TypeScript build info) as disposable unless the file is intentionally tracked and reviewed.
8. Do not alter the frozen public marketing surfaces (header pricing entry, footer CTA, pricing cards) outside their contract. The canonical state is documented in [`docs/CANONICAL_UI_CONTRACT.md`](docs/CANONICAL_UI_CONTRACT.md) and enforced by `armageddon-site/tests/unit/canonical-ui-freeze.test.ts`. If a product decision changes a surface, update the matching assertion and the contract in the same patch — never delete an assertion to make CI pass.

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
