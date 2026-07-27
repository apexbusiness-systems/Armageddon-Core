# ARMAGEDDON AGENT GUARDRAILS — CLAUDE.md

**Canonical version**: 2026-07-22
**Last reviewed**: 2026-07-22
**Authority**: This file is the frozen canonical state reference. It supersedes conversational memory. All agents and contributors must read this before modifying any file listed here.

---

## Non-negotiable rules (applies to every agent, every session)

1. **Read this file before touching `intake-handler.ts`, any test under `armageddon-site/tests/`, or any file listed in the "Protected modules" section.**
2. **Never remove safety controls.** Rate limits, injection guards, CORS locks, auth checks, circuit breakers, and `SIM_MODE` enforcement must never be disabled to make a test pass or simplify a deployment.
3. **Never commit secrets.** `.env.moat` and any populated secret file must remain uncommitted. `.env.moat.example` is the only committed environment template.
4. **Run required checks before every push:**
   ```bash
   npm ci
   npm run lint
   npm run typecheck
   npm run test
   npm run build
   ```
5. **Never promote unverified live-runtime state in docs.** Use `UNVERIFIED` for any claim that requires a running environment to confirm.
6. **Use npm from the repository root.** Do not introduce Bun/Yarn/pnpm unless `package.json` is changed in the same patch.

---

## Protected modules — security invariants

### `armageddon-site/src/intake-handler.ts`

This file is the Cloudflare Worker that handles all edge API traffic. Its security properties are load-bearing and must not regress.

**Invariant 1 — Input type guard (line ~670)**
```typescript
// CORRECT: only guards non-string types
if (typeof text !== 'string') return { blocked: true, reason: 'Invalid input.', code: 'INVALID_TYPE' };
```
**WRONG pattern (DO NOT restore):**
```typescript
if (!text || typeof text !== 'string') ...  // falsy check swallows empty string, returns INVALID_TYPE instead of EMPTY
```
An empty string `""` must reach the `trimmed.length === 0` check and return `code: 'EMPTY'`, not `INVALID_TYPE`.

**Invariant 2 — Base64 blob pattern (INJECTION_PATTERNS array, line ~642)**
```typescript
// CORRECT: exact-count quantifiers ({10} not {10,}) — no backtracking possible;
// first class is pure alphanum, disjoint from the [+/] separator
/[A-Za-z0-9]{10}[+/][A-Za-z0-9+/]{10}/,
```
**WRONG patterns (DO NOT restore any of these):**
```typescript
/[A-Za-z0-9+/]{40,}={0,2}/,              // too broad — matches UUIDs and long plain tokens
/[A-Za-z0-9+/]{10,}[+/][A-Za-z0-9+/]{10,}={0,2}/,  // overlapping first class → backtracking (Sonar S5852)
/[A-Za-z0-9]{10,}[+/][A-Za-z0-9+/]{10,}={0,2}/,    // greedy {10,} backtracks O(n) per position → O(n²)
```
Both character classes must use exact `{10}` counts (not `{10,}`) so the engine never needs to try different match lengths. The first class must also be `[A-Za-z0-9]` (no `+` or `/`) so it is disjoint from the mandatory `[+/]` separator.

**Invariant 3 — Named exports for testability**
The following must remain exported (named exports alongside `export default intakeWorker`):
- `INJECTION_PATTERNS`
- `detectEmojiPayload`
- `validateSupportInput`
- `checkSupportRateLimit`

Removing these exports breaks the test suite (`tests/unit/worker-support-chat-security.test.ts`).

**Invariant 4 — CORS is origin-locked**
`handleSupportChat` sets `Access-Control-Allow-Origin` to `https://${canonicalHost}`. Do not change this to `*`.

**Invariant 7 — `DEFAULT_CANONICAL_HOST` must be `armageddontest.icu`**
```typescript
// CORRECT:
const DEFAULT_CANONICAL_HOST = 'armageddontest.icu';
```
**WRONG (DO NOT restore):**
```typescript
const DEFAULT_CANONICAL_HOST = 'armageddon.icu';  // stale domain — all routes and CORS will break
```
This constant seeds the CORS header, the rate-limit KV key prefix, and the intake response origin. Using the stale domain breaks every security boundary that is origin-locked.

**Invariant 12 — No fabricated organization identities (added 2026-07-06)**
`handleMeOrganizations` (and the reference route `src/app/api/me/organizations/route.ts`) must resolve real `organization_members` rows for every user, including the admin account. A hard-coded fake membership with a non-UUID organization id previously caused every `POST /api/run` insert to fail (Postgres uuid parse → opaque 500 "Failed to create run record"). Admin privilege is a tier override in `handleGatekeeper`/`evaluateRunAccess`, never identity fabrication. `parseRunInput` also validates `organizationId` as a UUID (400, not 500). Regression shield: `tests/unit/worker-run-integrity.test.ts`.

**Invariant 13 — `/api/attestation/pubkey` is served by the edge worker (added 2026-07-06)**
The Next.js attestation route is unreachable on the static-export deployment; `handleAttestationPubkey` in `intake-handler.ts` is the production surface. Its WebCrypto derivation must stay formula-identical to `packages/shared/src/attestation-key.ts` (same PKCS#8 prefix, keyId = first 16 hex of sha256(raw pubkey)). Fail-closed on missing/malformed `ARMAGEDDON_ATTESTATION_SEED` (503) — never synthesize a key.

**Invariant 14 — UI surfaces never hard-code prices (added 2026-07-06)**
`src/lib/pricing.ts` is the single source of truth for plan names, prices, and cadences. Components (e.g. `SettingsModal.tsx`) must render from `PLANS`/`PLAN_ORDER`. Regression shield: `tests/unit/pricing-display-consistency.test.ts`. SEO/GEO discoverability assets (`public/robots.txt`, `public/sitemap.xml`, `public/llms.txt`, `public/og-image.png`, layout JSON-LD) are load-bearing and shielded by `tests/unit/seo-discoverability.test.ts` — update them together with page/positioning changes.

**Invariant 15 — Marketing claims must match shipped behavior (added 2026-07-06)**
Quantitative claims rendered on the marketing site must equal the values the code actually uses. `SIM_STATISTICAL_ITERATIONS` (=10000) in `intake-handler.ts` is the single source for the "Simulation tier runs 10,000 statistical iterations" claim and must match the figure in every `src/i18n/dictionaries/*` entry. The homepage leaderboard (`LeaderboardWidget.tsx`) renders a static `TOP_AGENTS` sample and must NOT be labeled "LIVE" — it is labeled "SAMPLE" until wired to a real aggregated endpoint over `armageddon_runs`. Regression shield: `tests/unit/marketing-claim-integrity.test.ts`. We ship validated, evidenced claims — not aspirational ones.

**Invariant 5 — History truncation**
Only the last 8 messages are forwarded to Anthropic. Do not increase this limit without a security review.

**Invariant 6 — Rate limit graceful degradation**
Rate limiting is skipped when `env.RATE_LIMIT_KV` is not bound. This is intentional to allow staging deployments without KV. Do not change it to fail-closed without operator agreement.

> **Corrected 2026-07-22** (was: "Known production gap (confirmed 2026-06-24)"): `armageddon-site/wrangler.jsonc` has carried a real `RATE_LIMIT_KV` namespace ID (not the `REPLACE_WITH_KV_NAMESPACE_ID` placeholder) since 2026-07-05 — the repository-config blocker described below is resolved. Whether that namespace is bound and reachable in the live Cloudflare dashboard is UNVERIFIED without a direct Cloudflare API/dashboard check (not attempted this session — only Render's API was available). Runbook 5.2 (`ATLAS_RATE_LIMIT_KV_UNBOUND`) in `OPS_RUNBOOKS.md` still applies if an operator finds the binding actually missing.

---

### `armageddon-site/tests/unit/worker-support-chat-security.test.ts`

This test file is the regression shield for the security layer. All 43 tests must pass at all times.

**Do not weaken tests** to pass a broken implementation — fix the implementation instead.

Key behavioural contracts verified by this test file:
- Empty string → `code: 'EMPTY'` (not `INVALID_TYPE`)
- Plain 40-char alphanumeric string → NOT blocked by injection patterns
- Base64 strings with `+` or `/` → blocked
- Per-minute rate limit exhaustion → `allowed: false, retryAfter: 60`
- Per-hour rate limit exhaustion → `allowed: false, retryAfter: 3600`

---

### `packages/core/src/api-server.ts` — OmniPort connector (`handleOmniPort*`)

This is the Node process that actually serves `/api/omniport/{execute,live-fire,control,waiver,telemetry}` in production. The Next.js routes at `armageddon-site/src/app/api/omniport/*/route.ts` are the reference implementation but are **not reachable** in the static-export Cloudflare deployment — this file is where the connector must actually run.

**Invariant 8 — `enforceOmniPortLiveFireGuard` is private and non-bypassable.**
Mirrors the identical invariant already documented in `live-fire/route.ts`. It must remain private to `handleOmniPortLiveFire`, must never be replaced by a generic safety-guard call (that would throw on `SIM_MODE=false`, which live-fire requires), and no other handler in this file may use it to start a workflow with `sim_mode: false`.

**Invariant 9 — the OmniPort auth/crypto primitives live in `packages/shared/src/omniport.ts`, not duplicated per-workspace.**
`armageddon-site/src/lib/omniport.ts` and `packages/core/src/api-server.ts` both import `validateSSRF`, `verifyOmniPortBearerToken`, `verifyWaiverToken`, `deriveRunSeed`, and `resolveOmniPortTaskQueue` from `@armageddon/shared/omniport`. Do not re-implement these locally in either workspace — a second copy is exactly how the SSRF allowlist or waiver signature check could silently diverge between the two surfaces.

**Invariant 10 — `SIM_MODE=true` is a required process boot-time confirmation, not a per-run simulate-only switch. Real live-fire execution is real, and already reachable via the waiver-gated OmniPort live-fire endpoint (corrected 2026-07-22).**
`packages/core/src/worker.ts` calls `safetyGuard.enforce('WorkerStartup')` (see Non-negotiable rule 2 above and `packages/core/src/core/safety.ts`), which `process.exit(1)`s at boot unless `SIM_MODE==='true'`. This gate is independent of whether any individual dispatched run is simulated or real: a run with `tier: 'CERTIFIED'` **and** a real `targetModel` set makes that run's battery activities call a genuine LLM adversary (`AdversarialEngine` → `createAdversarialConfig`), inside the same `SIM_MODE=true`-gated worker process — `SIM_MODE` confirms the process is running in an authorized Armageddon deployment; it does not force every run inside it to simulate.
A prior version of this invariant claimed "the worker ... cannot run in a live-fire configuration today," which was an incorrect inference from the boot gate and is now known to be false: it was empirically confirmed via two real OmniPort live-fire dispatches against `armageddon-exec-api` (waiver-gated `POST /api/omniport/live-fire`) — battery durations of ~19–23s, consistent with real multi-turn LLM round trips, versus ~3s for a genuinely simulated run of the same batteries.
Until 2026-07-22, `targetModel` was never set on any OmniPort execute/live-fire dispatch (production `api-server.ts` or the Next.js reference routes), and `AdversarialEngine`'s constructor silently fell back to the fake `SimulationProvider` whenever `tier==='CERTIFIED'` had no `targetModel` — meaning every such run executed simulated attacks while its telemetry still said `engine: 'LIVE_FIRE'` (that tag was set from `tier` alone, decoupled from what adapter was actually constructed). Fixed: `AdversarialEngine` now throws instead of silently degrading (matching the pre-existing `'http-target'` refusal), and both live-fire dispatch paths now set `targetModel`. `handleOmniPortExecute` (no waiver gate, always `sim_mode: true`) was separately corrected to request `tier: 'FREE'` rather than a hardcoded `'CERTIFIED'` it could never truthfully deliver on.
**Do not weaken, bypass, or special-case the `SIM_MODE` boot gate itself** — it remains a required, non-bypassable process-level confirmation, unchanged by the above. Who may reach the waiver-gated live-fire endpoint, and under what commercial/legal terms, is a separate question, still enforced by `enforceOmniPortLiveFireGuard` + a signed, time-boxed waiver token — nothing about that authorization boundary changed.

**Invariant 11 — Administrative overrides require exact matching.**
The `ADMIN_EMAIL` verification logic (e.g., in `/api/run` or `intake-handler.ts`) MUST use exact, case-sensitive equality (`===`). The use of `.includes()`, `indexOf()`, or open regex for identity/authorization checks is strictly prohibited to prevent arbitrary domain registration bypasses.

---

## Infrastructure provisioning (operator responsibility — not a code defect)

Before the support-chat endpoint is live in production the operator must provision:

1. **Create the KV namespace:**
   ```bash
   npx wrangler kv namespace create RATE_LIMIT_KV
   ```
   Paste the returned `id` into `armageddon-site/wrangler.jsonc` replacing `REPLACE_WITH_KV_NAMESPACE_ID`.

2. **Store the Anthropic API key as a Wrangler secret:**
   ```bash
   npx wrangler secret put ANTHROPIC_API_KEY
   ```

3. **Verify the placeholder is not deployed to production:**
   The string `REPLACE_WITH_KV_NAMESPACE_ID` in `wrangler.jsonc` is a deployment blocker — a deployment with this placeholder will bind to a non-existent KV namespace and rate limiting will degrade gracefully (skipped). The Anthropic key is the hard requirement; without it the endpoint returns `503 NOT_CONFIGURED`.

Before the OmniPort connector (`/api/omniport/*` on `packages/core/src/api-server.ts`) is live for any operator:

1. **Set `OMNIPORT_ENABLED=true`** for that deployment only. It defaults unset (routes return `503 OMNIPORT_DISABLED`) everywhere today — this is the safe default and must stay that way until an operator explicitly opts in.
2. **Provision `OMNIPORT_API_KEY`, `OMNIPORT_WEBHOOK_SECRET`, `OMNIPORT_LIVE_FIRE_SECRET`** — coordinate with the APEX-OmniHub platform; these are shared secrets, not generated by this repo.
3. **Provision a per-operator Temporal task queue.** Set `OMNIPORT_TASK_QUEUE_PREFIX` (or accept the `armageddon-moat` default) and point that operator's `TEMPORAL_TASK_QUEUE` in `.env.moat` at `${prefix}-<organizationId>` (see `docker-compose.moat.cloud.yml`). If connecting to Temporal Cloud rather than a local `temporal` service, also set `TEMPORAL_API_KEY` (both `packages/core/src/worker.ts` and `api-server.ts` use it for TLS + API-key auth when present).
4. **`packages/core/src/worker.ts` still refuses to start unless `SIM_MODE=true`** (Invariant 10 above) — that boot gate is unrelated to and does not need to be reconsidered for this provisioning. It confirms the process is running in an authorized deployment; it does not prevent an individual `tier: 'CERTIFIED'` run (with `targetModel` set) from executing real live-fire once these secrets are provisioned and a waiver is accepted.

---

## Documentation maintenance rules

When any of the following change, update **all** of these docs in the same commit:

| What changed | Docs to update |
| --- | --- |
| New API endpoint in `intake-handler.ts` | `docs/CLOUDFLARE_DEPLOYMENT.md`, `PRODUCTION_STATUS.md`, `feature_registry.md`, `OPS_RUNBOOKS.md` |
| New KV binding or secret | `wrangler.jsonc` comments, `docs/CLOUDFLARE_DEPLOYMENT.md`, this file (provisioning section) |
| New test file | `docs/DOCUMENTATION_AUDIT_2026-05-15.md` or a newer audit doc |
| Security invariant added/changed | This file (Protected modules section) |
| New page in `armageddon-site/src/app/` | `feature_registry.md`, `docs/README.md` if it is a canonical surface |

---

## Anti-drift checklist for agents

Before ending any session that touches this repo, verify:

- [ ] `npm run test` passes with zero failures
- [ ] `npm run typecheck` exits 0
- [ ] `npm run lint` exits 0
- [ ] No secret values have been committed
- [ ] The `REPLACE_WITH_KV_NAMESPACE_ID` placeholder has not been replaced with a real ID in a committed file (the real ID goes in 