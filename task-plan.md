### ARTIFACT: Task Plan

**Mission:** Consolidate active PRs (#33, #69, #78) into a unified master branch, close obsolete PR #72, and deliver a 100/100 APEX Level, release-ready Armageddon Test Suite.

**Success Criteria:**

- Obsolete PR #72 is designated for closure.
- PRs #33, #69, and #78 are merged into a single branch `apex/master-fix-audit-v2`.
- All merge conflicts in `activities.ts`, `api/run/route.ts`, and frontend components are deterministically resolved.
- Typecheck (`tsc --noEmit`) passes with 0 errors.
- Linter (`npm run lint`) passes with 0 warnings.
- Test suite (`npm test`) yields exit code 0.
- Vercel/Next.js Build (`npm run build`) yields exit code 0.
- SonarCloud A-grade status maintained.

**Constraints:**

- NEVER touch code without validating the existing state first.
- NEVER skip standard quality gates or assume tests will pass.
- Format: Strict TypeScript, deterministic and idempotent script executions.

**Dependencies:**

- Node.js & npm (standard configured versions)
- Playwright, Vite/Jest testing frameworks.
- Next.js build system.

**Risk Assessment:**

- Merge conflicts across core temporal activities and run API routes could cause systemic failures if resolved incorrectly.
- Rollback plan: Hard reset the `apex/master-fix-audit-v2` branch to `main`, and merge PRs sequentially with discrete verification steps.

**Agent Strategy:**

- **Terminal Agent (Auto):** Initialize new branch, perform git merges, and execute validation scripts (`tsc`, `lint`, `build`, `test`).
- **Editor Agent:** Resolve Git conflicts surgically using the `multi_replace_file_content` or standard tools.
- **Review Policy:** Request Review prior to formulating the final `next-action.md` Handover artifact.
