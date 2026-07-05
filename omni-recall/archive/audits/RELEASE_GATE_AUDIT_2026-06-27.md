# ARMAGEDDON Test Suite — Release Gate Audit

> **Date**: 2026-06-27
> **Branch audited**: `claude/release-gate-audit-5c05kl` (head of `main` line)
> **Scope**: Full top-to-bottom release-gate audit — build gates, security invariants, deep code/security review, live E2E certification proof, onboarding/auth data-layer probe, market/competitor gap analysis, and UI/UX browser validation with visual evidence.
> **Method**: Clean `npm ci`; all CI-parity gates run; agent swarm for parallel deep review; Chromium/Playwright for UI; live Supabase probe with operator-provided credentials.

---

## 0. Verdict — CONDITIONAL GO

The **engineering quality bar is met**: all five release gates are green from a clean install, the supply chain is clean (0 high/critical), the security invariants in the protected Worker are intact, and the cryptographic certification core works end-to-end including tamper detection. This is a genuinely well-built codebase.

**It is NOT yet clear to ship to public production** because of a small set of **integrity / honesty** issues that matter disproportionately for a product whose entire value proposition is *certification and trust*. None are hard bugs; they are claims-vs-reality gaps and a few hardening items. They are listed as **P0 blockers** below and are fixable quickly.

| Dimension | Status |
| --- | --- |
| Build / test / lint / typecheck / docs gates | ✅ PASS (all 5, exit 0) |
| Dependency/supply-chain audit | ✅ PASS (0 high/critical) |
| Protected security invariants (`intake-handler.ts`) | ✅ PASS (all 7 intact) |
| Certification + attestation E2E (sign → Merkle → offline verify → tamper) | ✅ PASS (live-run) |
| Onboarding/auth data layer (Supabase) | ✅ PASS (reachable, schema present) |
| Temporal run-dispatch E2E (Phases 2–3) | ⚠️ UNVERIFIED (no Docker daemon in audit env) |
| Marketing claims vs implementation | ❌ FAIL — drift (see P0-1) |
| UI/UX | ⚠️ PARTIAL — 4/7 routes clean, home/console/support have defects |
| Production secrets provisioning | ⚠️ PARTIAL — `ANTHROPIC_API_KEY` unset (support chat = 503) |

---

## 1. Release gate results (CI-parity, clean `npm ci`)

| Gate | Command | Result |
| --- | --- | --- |
| Lint | `npm run lint` | ✅ exit 0 (eslint `--max-warnings=0`, all 3 workspaces) |
| Typecheck | `npm run typecheck` | ✅ exit 0 (shared + core + site) |
| Docs drift | `npm run docs:check` | ✅ exit 0 |
| Test | `npm run test` | ✅ **279 passed** (core 133/133, site 146/146) |
| Build | `npm run build` | ✅ exit 0 (Next build, all routes compiled) |
| Audit (core, high) | `npm audit --workspace armageddon-core --audit-level=high` | ✅ 0 vulnerabilities |
| Audit (custom) | `node scripts/audit-check.js` | ✅ clean (site + core) |

CI workflows present and reasonable: `ci.yml`, `deploy-cloudflare.yml`, `production-readiness.yml`, `secret-scanning.yml` (TruffleHog verified + gitleaks), `sonarcloud.yml`, `ios.yml`.

---

## 2. Security invariants — protected module `intake-handler.ts`

All 7 CLAUDE.md invariants **verified intact**:

1. ✅ Input type guard is `typeof text !== 'string'` (empty string reaches `EMPTY`, not `INVALID_TYPE`) — line 691.
2. ✅ Base64 injection regex uses exact-count `{10}` disjoint classes (no backtracking) — line 663.
3. ✅ Named exports present: `INJECTION_PATTERNS`, `detectEmojiPayload`, `validateSupportInput`, `checkSupportRateLimit`.
4. ✅ CORS origin-locked to `https://${canonicalHost}` — line 836.
5. ✅ History truncated to last 8 messages (`slice(-8)`) — line 881.
6. ✅ Rate-limit graceful degradation when KV unbound — intact.
7. ✅ `DEFAULT_CANONICAL_HOST = 'armageddontest.icu'` — line 46.

43-test regression shield (`worker-support-chat-security.test.ts`) passes.

---

## 3. Deep security & code review (full report: `scratchpad/security-review.md`)

**Supply chain**: 0 vulnerabilities at high severity. Clean.

| Sev | ID | Finding | Fix |
| --- | --- | --- | --- |
| HIGH | H1 | `runBattery6_UnsafeGate` `delete`s `process.env.SIM_MODE`/`SANDBOX_TENANT` and resets the **shared singleton** `SafetyGuard` mid-run while B10–B14 execute concurrently (`Promise.allSettled` child workflows) → race can spuriously trip `SystemLockdownError` on a paid run AND briefly weakens the guard window. | Make B6 hermetic: construct a throwaway `SafetyGuard({simMode:false})` and assert it throws; never mutate global env / shared singleton. |
| MED | M1 | OmniPort routes authorize via one shared `OMNIPORT_API_KEY` with no per-org check → cross-tenant IDOR on `execute`/`telemetry`/`control` (live-fire IS org-bound — good). | Scope telemetry/control queries by `organization_id`; consider per-tenant keys/mTLS. *(Mitigated today: `OMNIPORT_ENABLED=false` by default.)* |
| MED | M2 | `/api/run` `targetEndpoint` stored & executed (B7/B8) with **no SSRF check** — OmniPort validates, primary route doesn't. | Reuse existing `validateSSRF()` in `/api/run` before insert/start. |
| MED | M3 | `SafetyGuard.validateTarget()` (prod-host guard) is **dead code** — zero call sites. | Call it in B7/B8 before dereferencing target. |
| MED | M4 | Org rate-limit bucket incremented **before auth** → unauthenticated attacker can exhaust a victim org's 5/min quota. | Move org-scoped limit to after `checkMembershipResponse`. |
| LOW | L1–L4 | gatekeeper picks `memberships[0]` arbitrarily; run GET returns `select('*')` (internal config leak); B14 default/allow-list mismatch; OmniPort read/control unmetered. | See full report. |

**Correctly hardened (balance)**: OmniPort kill-switch 503; timing-safe HMAC/JWT with ≤15-min waiver window; thorough SSRF helper; fail-closed Ed25519/Merkle attestation + pubkey 503; fail-closed DB rate limiter; service-role client refuses to run in browser.

---

## 4. E2E: Onboarding → Certification

The documented story (`docs/WORKFLOW_E2E_USER_STORY.md`) spans onboarding → run init → live operation → certification → signed export.

- **Phase 1 — Onboarding/auth data layer**: ✅ Live Supabase (`qhjqselqpkfqjfpuxykb`) reachable (HTTP 200); `organizations`, `organization_members`, `armageddon_events` tables present and queryable with the service-role key; 6 migrations applied. UI onboarding flow renders (see §6).
- **Phases 2–3 — Temporal run dispatch & live operation**: ⚠️ **UNVERIFIED in this environment** — the Docker *daemon* is not running in the audit sandbox (client binary only), so the Moat (Temporal + Postgres + worker) could not be stood up. Dispatch/tier-gating logic is covered by the 279 passing unit tests; a live run requires the operator runtime.
- **Phases 4–5 — Certification + signed artifact**: ✅ **VERIFIED LIVE** via `scripts/demo_attestation.ts`: a real report was generated through the production `EvidenceGenerator`, Ed25519-signed with an RFC-6962 Merkle root, then independently verified by the shipped zero-dependency `verify.mjs`. **All three tamper paths were correctly rejected**: `MERKLE_MISMATCH` (battery flipped), `SIGNATURE_INVALID` (forged sig), `KEY_MISMATCH` (wrong pinned key). This is the product's strongest, most defensible capability.

---

## 5. Market / competitor gap analysis (full report: `scratchpad/market-gap-analysis.md`)

2026 landscape: Confident AI/DeepTeam, General Analysis, Straiker Ascend AI, Lakera, Mindgard, HiddenLayer, SPLX, Enkrypt, Microsoft PyRIT, NVIDIA garak, Inspect, Promptfoo. Standards: OWASP LLM/Agentic Top-10, NIST AI RMF + AI Agent Standards Initiative, EU AI Act Art. 12, MITRE ATLAS.

**Genuine differentiator nobody else ships**: Ed25519 + RFC-6962 Merkle **tamper-evident signed receipts with an offline verifier**, plus an air-gapped "Moat" deployment and `SIM_MODE` safety lockdown — strong fit for gov/defense/regulated buyers and EU AI Act Art. 12 audit-log needs.

**Top gaps vs market**:
- **Feature**: only B10–B14 are true agentic attacks; no MCP/agent-graph discovery, no real RAG poisoning, no CI/CD release gate, no continuous/scheduled retest, no OWASP-ASI/MITRE-ATLAS/NIST finding tags.
- **Logic**: no target recon, no multi-stage attack chaining, no severity/remediation output, no find→fix→regress loop; "Certified" tier is human-analyst manual review, not an automated product loop.
- **UI/endpoints**: no persistent findings dashboard, no public SDK/CLI/GitHub Action, no standards-coverage matrix, **no public "verify a receipt" web page** (which would showcase the #1 differentiator).

**Positioning recommendation**: don't try to out-scan the scanners — lead as *"the notarized certification layer for agentic AI."*

---

## 6. UI/UX browser validation (full report: `scratchpad/uiux-report.md`; 18 screenshots)

All 7 routes returned HTTP 200, no 500s, no horizontal overflow at desktop (1440×900) or mobile (390×844).

- ✅ **Clean (4/7)**: `/pricing`, `/privacy`, `/onboarding`, `/auth/callback`.
- ❌ **`/` home & `/console`**: ~60–70% **dead black vertical void** below the content block (confirmed visually); missing `<h1>` landmark (a11y/SEO); `404 /grid-pattern.png` background asset.
- ❌ **`/support`**: floating `CLOUDFLARE_EDGE_READY` badge **overlaps** the "SUPPORT TERMINAL" title.
- ⚠️ **Global**: every page aborts `/audio/armageddon-anthem.mp3` (cosmetic).
- ✅ **Interactions work**: console `INITIATE SEQUENCE` degrades gracefully ("LIVE-FIRE BACKEND NOT CONNECTED"); support chat accepted normal + injection input with **no system-prompt leak** (live worker 404s in dev — guard verified by unit tests, not live here).

---

## 7. Documentation / governance drift (release hygiene)

1. **KV namespace drift (must reconcile)**: `wrangler.jsonc` now contains a **real** `RATE_LIMIT_KV` id (`92d1…f034`, committed in `96cbbbf`), but `CLAUDE.md` (canonical 2026-06-25), `PRODUCTION_STATUS.md`, `feature_registry.md`, and `OPS_RUNBOOKS.md` all still state KV is **unprovisioned** and the CLAUDE.md anti-drift checklist explicitly forbids committing a real id. Either update all four docs to "provisioned & bound" or move the id out of git per policy. (A KV namespace id is an identifier, not a secret — low risk — but the canonical docs are now self-contradictory.)
2. **14 open PRs**, almost all stale auto-generated bot PRs (Jules/Codex, Feb–May) against old base commits; `main` is ahead. Recommend triage/close — do not blind-merge.
3. **CSP missing**: PR #119 claimed a CSP was added; neither `next.config.mjs` nor `public/_headers` defines `Content-Security-Policy`. The other 5 headers (HSTS preload, X-Frame DENY, nosniff, Referrer-Policy, Permissions-Policy) ARE delivered in production via `public/_headers`.

---

## 8. P0 / P1 / P2 — path to ship

**P0 — blockers before public production:**
- P0-1 **Resolve marketing-vs-implementation drift**: UI (`BatteryGrid`), the support Worker prompt, and `api-server` advertise *"10,000 iterations"* and *"Tree-of-Attacks"*, but only `runPAIRAttack` is implemented (TAP is comments/labels). Default path is the deterministic `SimulationAdapter`; live-fire runs only on CERTIFIED tier. For a *certification* product this is a trust risk — either implement TAP + real live-fire, or soften the copy to match reality.
- P0-2 **Un-hardcode stale models**: provider allow-list pins 2024-era `claude-3-opus/sonnet/haiku-2024…` and `gpt-4-turbo`; default judge is `claude-3-haiku-20240307`. Move to current models + make model-agnostic/config-driven.
- P0-3 **Provision `ANTHROPIC_API_KEY`** (Wrangler secret) or the support chat returns `503 NOT_CONFIGURED` in prod. Set `ARMAGEDDON_ATTESTATION_SEED` so the pubkey endpoint is stable (else 503).
- P0-4 **Reconcile KV/CSP/docs drift** (§7).
- P0-5 **Fix H1** (B6 env-mutation race) — correctness of paid certification runs.

**P1 — soon after / same release if time:**
- M2/M3 (wire `validateSSRF`/`validateTarget` into `/api/run` + B7/B8), M4 (rate-limit ordering) — small, safe, strengthen safety.
- UI: fix home/console layout void, add `<h1>`, fix `/grid-pattern.png` 404 and support-header overlap.
- Stand up the Moat in a Docker-enabled env and run the full Phase 2–3 live E2E.
- Add a public **"verify a receipt"** page to showcase the Merkle/Ed25519 differentiator.

**P2 — roadmap (close market gaps):**
- TAP/Crescendo, CI/CD GitHub Action gate, MCP/RAG/memory/tool-graph attacks, standards-tagged findings (OWASP-ASI/MITRE-ATLAS/NIST), continuous Merkle-chained compliance ledger, findings dashboard.

---

## 9. Bottom line

The skeleton is excellent: clean gates, clean deps, intact security invariants, and a cryptographic attestation chain that actually works and is genuinely differentiated. The risk is **not** stability — it's **truth-in-advertising** for a product that sells trust. Close P0-1/P0-2 (claims ↔ implementation, current models), provision the two prod secrets, reconcile the docs, and fix the B6 race, and this is ready for a credible production launch.
