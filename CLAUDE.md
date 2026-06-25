# ARMAGEDDON AGENT GUARDRAILS — CLAUDE.md

**Canonical version**: 2026-06-25
**Last reviewed**: 2026-06-25
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
// CORRECT: first group is pure alphanum (no + or /), making it disjoint from the separator
// — eliminates catastrophic backtracking; still requires a + or / to distinguish base64
/[A-Za-z0-9]{10,}[+/][A-Za-z0-9+/]{10,}={0,2}/,
```
**WRONG patterns (DO NOT restore either):**
```typescript
/[A-Za-z0-9+/]{40,}={0,2}/,         // too broad — matches UUIDs and long plain tokens
/[A-Za-z0-9+/]{10,}[+/][A-Za-z0-9+/]{10,}={0,2}/,  // first class overlaps separator → backtracking (Sonar S5852)
```
The first character class must be `[A-Za-z0-9]` (no `+` or `/`) so there is no ambiguity between it and the mandatory `[+/]` separator — the regex engine cannot backtrack between the two.

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

**Invariant 5 — History truncation**
Only the last 8 messages are forwarded to Anthropic. Do not increase this limit without a security review.

**Invariant 6 — Rate limit graceful degradation**
Rate limiting is skipped when `env.RATE_LIMIT_KV` is not bound. This is intentional to allow staging deployments without KV. Do not change it to fail-closed without operator agreement.

> **Known production gap (confirmed 2026-06-24):** The `RATE_LIMIT_KV` binding is **not yet provisioned** in the Cloudflare dashboard — only the `ASSETS` binding is present. Rate limiting is currently being skipped gracefully. Runbook 5.2 (`ATLAS_RATE_LIMIT_KV_UNBOUND`) in `OPS_RUNBOOKS.md` applies. The operator must create the namespace and update `wrangler.jsonc` before rate limiting becomes active.

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
- [ ] The `REPLACE_WITH_KV_NAMESPACE_ID` placeholder has not been replaced with a real ID in a committed file (the real ID goes in Wrangler dashboard or a gitignored `.env`)
- [ ] `docs/README.md` still accurately lists all canonical documents
- [ ] This file (`CLAUDE.md`) was updated if any invariant changed

---

## Canonical docs index (quick reference)

| Need | Document |
| --- | --- |
| Agent/contributor guardrails | `AGENTS.md` |
| Security layer invariants (this file) | `CLAUDE.md` |
| Documentation hub | `docs/README.md` |
| Cloudflare deployment | `docs/CLOUDFLARE_DEPLOYMENT.md` |
| Local Moat deployment | `DEPLOYMENT.md` |
| Incident runbooks | `OPS_RUNBOOKS.md` |
| Production release posture | `PRODUCTION_STATUS.md` |
| Feature inventory | `feature_registry.md` |
| Privacy policy | `PRIVACY.md` |
| Security policy | `SECURITY.md` |
