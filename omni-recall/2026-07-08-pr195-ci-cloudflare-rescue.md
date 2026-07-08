---
date: 2026-07-08
status: verified-local
pr: 195
branch: claude/omnihub-armageddon-unblock-3dpmxn
---

# PR #195 CI + Cloudflare Deploy Rescue

## Summary

PR #195 failed core TypeScript because `packages/core/src/core/evidence-generator.ts` used `fileURLToPath(import.meta.url)` without importing `fileURLToPath` from `node:url`.

The Cloudflare assets-only/binding conflict was guarded by repository configuration validation: the intended production shape is `armageddon-site/wrangler.jsonc` with `main: "src/intake-handler.ts"`, `assets.directory: "./out"`, and no `assets.binding`.

## Local evidence

- `npm run typecheck` passed on 2026-07-08.
- `npm run build` passed on 2026-07-08.
- `npm run build:cloudflare -w armageddon-site` passed on 2026-07-08.
- `npx wrangler versions upload --config armageddon-site/wrangler.jsonc --dry-run` passed on 2026-07-08 and showed no `ASSETS` binding conflict.
- `npm run test` was blocked locally because the environment ran Node.js `v20.20.2`; one Supabase realtime integration test requires Node.js 22 native WebSocket support. Targeted core tests and site tests passed.

## Durable note

For future PRs touching `packages/core` under ESM (`packages/core/package.json` has `type: module`), keep runtime relative imports explicit with `.js` specifiers. Use:

```bash
rg --pcre2 "from ['\"]\.\.?/(?!.*\.js['\"]).*['\"]" packages/core/src -g '*.ts'
```

and expect zero matches unless a documented type-only convention explicitly allows otherwise.
