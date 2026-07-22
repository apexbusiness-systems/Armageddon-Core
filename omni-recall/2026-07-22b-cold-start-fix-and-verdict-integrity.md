---
date: 2026-07-22
status: verified-against-repository-and-live-deployment
---

# 2026-07-22 (session continuation) — Free-tier cold-start root-cause fix, verdict integrity, live deploy verification

## Context
Continuation of the same-day onboarding→certification E2E validation session (see `2026-07-22-onboarding-certification-e2e-validation.md`). The user supplied their own E2E credentials and a Render API key mid-session, which unblocked real production runs that earlier attempts couldn't complete (network egress had blocked Supabase/Temporal from the validation sandbox).

## What actually shipped (two merged PRs)

**PR #206** (merged to `main`):
- Root-caused the "stuck at pending" / "runs die mid-flight" production defect to a real architecture gap: the Cloudflare edge control plane and the Node execution plane (Render free-tier service) are decoupled, so creating a run generates no inbound HTTP to wake a sleeping executor, and Render's idle timer (watches inbound HTTP, not CPU) kills long runs mid-flight.
- Fixed with two zero-cost, zero-new-dependency mechanisms: **Wake-on-Enqueue** (`wakeExecutor` in `armageddon-site/src/intake-handler.ts` — fires one fire-and-forget wake to the executor the instant a run is enqueued) and **Active-Run Self-Sustain** (`startSelfSustainLoop` in `packages/core/src/api-server.ts` — self-pings `RENDER_EXTERNAL_URL` only while work is in flight).
- Fixed a real code defect: `runBattery14_IndirectInjection` was the only battery (of B10-B14) that never called the reporter, so it produced zero `armageddon_events` telemetry despite being marked executed/failed on the run record. Fixed with a regression test.
- Also shipped: SonarQube backlog cleanup (security hotspots + code smells), Docker `--ignore-scripts` hardening (verified safe via direct inspection of `@temporalio/core-bridge`'s package.json — no install script, ships prebuilt binaries), dependency pinning.

**PR #207** (merged to `main`, commit `e833cd5`):
- Fixed a genuine verdict-integrity defect the user caught by inspecting the delivered certificate: `EvidenceGenerator.computeVerdict()` (`packages/core/src/core/evidence-generator.ts`) was binary (`CERTIFIED | FAILED`), so a clean simulation-tier pass scoring 100/100 was labelled `FAILED` — internally contradictory and correctly rejected as unusable proof. Now three states: `FAILED` (did not clean-pass) / `VALIDATED` (clean pass under simulation, a true positive, never dressed up as live-fire) / `CERTIFIED` (clean pass under live-fire).
- Fixed three real PDF layout defects in `generateCertificatePdf()`, found by actually rendering a certificate and inspecting it pixel-by-pixel: an unlabelled orphan "N/A" row drawn into a template box that only has 4 labelled fields; body text duplicating the template's own baked-in Legal Disclaimer while colliding with the decorative footer bar; a redundant "SIMULATION TIER · SIMULATION" subtitle.

## Durable corrections for future sessions

1. **Do not assume Render is "removed."** `render.yaml` (root) is the real, live, auto-deploying-from-`main` execution engine (`armageddon-exec-api`). `PRODUCTION_STATUS.md`'s prior "Render deployment | Removed" row referred to an unrelated, earlier config and was stale — corrected this session with live API verification (deploy status, commit SHA match).
2. **Certificate "FAILED" does not mean the security test failed.** After this fix, `FAILED` means "did not clean-pass"; a clean pass under simulation is `VALIDATED`. Never conflate these when reading or presenting a certificate.
3. **A truthful `CERTIFIED` verdict is still architecturally impossible in this deployment** — `SIM_MODE=true` is required for the worker to boot at all (Invariant 10), which forces every run to simulation regardless of billing tier. This is intentional and must not be "fixed" by weakening that gate.
4. **When verifying a deploy landed, check all three platforms directly** (GitHub `main` HEAD, Render deploy API for the exact commit + `status:live`, Cloudflare's own `/deployment.json` `sourceCommit`) — don't infer from the merge event alone.
5. **The attestation pubkey endpoint works on the Render URL directly** (`https://armageddon-exec-api.onrender.com/api/attestation/pubkey`), confirmed live 2026-07-22, but is NOT proxied through the public marketing domain (`armageddontest.icu` still returns the static SPA shell for this path).

## Docs synced this session
`PRODUCTION_STATUS.md` (RATE_LIMIT_KV, Render deployment, OmniPort connector, attestation endpoint, and the P1 banner all corrected with live-verified evidence), `docs/audits/PRODUCTION_RUN_DISPATCH_STUCK_2026-07-22.md` (closed out with the merged-fix resolution), this omni-recall entry, `omni-recall/start-here.md`.

## Verification commands / evidence used
```bash
git log origin/main --oneline
curl -H "Authorization: Bearer $RENDER_AGENT_API_KEY" https://api.render.com/v1/services/<id>/deploys
curl https://armageddontest.icu/deployment.json
curl https://armageddon-exec-api.onrender.com/api/omniport/health
curl https://armageddon-exec-api.onrender.com/api/attestation/pubkey
```
Plus two real Level 7 certification runs against production with user-supplied credentials, one pre-deploy (caught the B14/verdict bugs) and one post-deploy (confirming the fixes live).
