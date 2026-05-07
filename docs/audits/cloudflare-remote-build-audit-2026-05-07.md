# Cloudflare Remote Build Audit — 2026-05-07

## Scope

Audit the current branch against `https://github.com/apexbusiness-systems/Armageddon-Core.git` to determine whether the newest remote build already contains Cloudflare deployment infrastructure or whether the Cloudflare static-edge patch duplicates existing work.

## Remote pull status

- `git fetch origin --prune` could not complete in this container because outbound GitHub access is blocked by the environment proxy (`CONNECT tunnel failed, response 403`).
- A direct fetch with proxy variables cleared also failed because direct egress to `github.com:443` is unavailable.
- Remote inspection therefore used GitHub web/raw reads for public `main`, plus local git ancestry checks against the current PR base.

## Findings

### 1. Remote `main` is not already Cloudflare-deployed by repository artifacts

Remote `main` exposes a Cloudflare UI/status string in `armageddon-site/src/app/layout.tsx` (`CLOUDFLARE_EDGE_READY`), but that is presentation/status copy only. It is not a deploy path.

Remote `main` does **not** expose these Cloudflare deployment artifacts through raw GitHub reads:

- `armageddon-site/wrangler.jsonc`
- `docs/CLOUDFLARE_DEPLOYMENT.md`
- `scripts/deploy_cloudflare_static.mjs`
- `build:cloudflare` / `deploy:cloudflare` package scripts
- `CLOUDFLARE_STATIC_EXPORT` handling in `armageddon-site/next.config.mjs`

### 2. Remote `main` still carries Vercel production reliance in docs/UI/package metadata

Remote raw reads show:

- `armageddon-site/src/components/Footer.tsx` still renders `POWERED BY VERCEL` and `DEPLOYED TO VERCEL PROD // US-EAST`.
- `docs/READINESS_ASSESSMENT.md` still references `armageddon-core.vercel.app`, says the frontend is not deployed to Vercel, and lists `Deploy frontend to Vercel` in the MVD checklist.
- `armageddon-site/src/lib/rate-limit.ts` still uses Vercel as the serverless example.
- The GitHub repository sidebar still advertises `armageddon-core.vercel.app` as the project website, which is outside repo-file control.

### 3. Local PR base already removed `vercel.json`

The current PR base (`HEAD^`) does not contain `vercel.json`, `armageddon-site/wrangler.jsonc`, `docs/CLOUDFLARE_DEPLOYMENT.md`, or `scripts/deploy_cloudflare_static.mjs`.

That means the previous Cloudflare patch did not duplicate local deploy config files. It added the first tracked Cloudflare deployment artifacts on this branch.

### 4. Current Cloudflare patch overlaps only with existing Cloudflare branding/status copy

The only pre-existing Cloudflare signal found before the patch was the layout status indicator text `CLOUDFLARE_EDGE_READY`. The previous patch's footer copy (`DEPLOYED TO CLOUDFLARE EDGE // GLOBAL`) aligns with this, but it is presentation copy and not deployment infrastructure.

### 5. Legacy Vercel CI check mitigation

A root `vercel.json` is required temporarily as a repo-side kill switch because the external Vercel GitHub App check is still attached to the pull request and reports `Account is blocked`. The config disables all automatic deployments and makes any fallback ignored-build path exit successfully.

## Duplication assessment

| Area | Already present on remote/base? | Previous patch duplicate? | Decision |
| --- | --- | --- | --- |
| `CLOUDFLARE_EDGE_READY` UI status | Yes | Partial copy alignment only | Keep; not infra duplication |
| Wrangler/static assets config | No | No | Keep |
| Static export toggle | No | No | Keep |
| Cloudflare deploy script | No | No | Keep, but requires real Cloudflare API egress to validate |
| Cloudflare deployment docs | No | No | Keep |
| Vercel footer/readiness references | Yes | Patch removes/deprecates | Keep removal |
| `vercel.json` | Not in PR base; raw remote read returned 404 | Reintroduced only as a CI kill switch | Keep until the external GitHub App check is removed |

## Conclusion

The newest remotely visible build is **not proven to be deployed to Cloudflare by repository deployment artifacts**. It contains Cloudflare-themed status text, but lacks Cloudflare build/deploy configuration. The previous patch therefore does **not** duplicate an existing Cloudflare deployment path; it introduces one.

## Follow-up required outside this container

1. Re-run `git fetch origin --prune` from a network that can reach GitHub.
2. Re-run the Cloudflare deployment command from a network that can reach `api.cloudflare.com`.
3. Update the GitHub repository website/sidebar URL away from `armageddon-core.vercel.app` in repository settings; this cannot be changed by repo-file edits.
