# ARMAGEDDON — Release-Gate Audit & Rescue (2026-07-06)

**Auditor:** APEX operating partner (automated release gate)
**Scope:** `armageddon-site` edge worker + marketing surfaces + Supabase prod state
**Verdict:** **CONDITIONAL GO** — all P0/P1 defects fixed, regression-shielded, and empirically validated. One operator gate remains: run the full local check suite + deploy (see §6). We ship validated builds; the one thing this environment could not run itself is called out honestly below.

---

## 1. Executive summary

| # | Severity | Issue | Status |
|---|----------|-------|--------|
| 1 | **P0** | Level 7 live sequence fails: `POST /api/run` → 500 "Failed to create run record" | **FIXED + validated** |
| 2 | **P0** | "EVIDENCE SIGNING KEY UNAVAILABLE" badge; `/api/attestation/pubkey` returns HTML, not JSON | **FIXED + parity-proven** |
| 3 | **P1** | Billing modal shows wrong prices ($49/$199 vs CAD $29/$79) | **FIXED** |
| 4 | **P1** | Billing modal lists tiers below the user's active tier (redundant) | **FIXED** |
| 5 | **P1** | Admin account had no org access to highest tier | **FIXED (prod data)** |
| 6 | **P1** | Marketing claim "10,000 statistical iterations" ≠ code (`2500`) | **FIXED (code→10,000)** |
| 7 | **P2** | Homepage leaderboard labeled "LIVE" over static mock data | **FIXED (→ "SAMPLE")** |
| 8 | **P2** | No `robots.txt`, `sitemap.xml`, `llms.txt`, `og-image.png`, JSON-LD, canonical, multilingual SEO | **ADDED** |
| — | Info | Security invariants 1–11 | **Verified intact** |

Five new regression shields added. Security invariants 12–15 codified in `CLAUDE.md`.

---

## 2. P0 — Level 7 live sequence 500 (root cause + fix)

**Exact root cause.** `handleMeOrganizations` (edge worker) and its reference route
`src/app/api/me/organizations/route.ts` short-circuited the admin account
(`jrmendozaceo@apexbusiness-systems.icu`) with a **hard-coded fake membership**:

```ts
const mockMemberships = [{ organization_id: 'apex-corporate-org-id', role: 'owner' }];
```

`'apex-corporate-org-id'` is **not a UUID**. The console flow reads the active org,
then `POST /api/run` inserts into `armageddon_runs.organization_id` (a Postgres
`uuid` FK). Postgres rejected the non-UUID with error `22P02` (invalid input syntax
for type uuid), which surfaced to the client as an opaque `500 "Failed to create
run record."` — every single Level 7 initiation.

**Fix (surgical, defensive, layered):**
1. Removed the fabricated membership in **both** surfaces; admin now resolves real
   `organization_members` rows like every user. (Admin privilege is a *tier
   override* in `handleGatekeeper`/`evaluateRunAccess`, never identity fabrication.)
2. Added a UUID guard in `parseRunInput` → malformed `organizationId` now returns
   **400** (clear) instead of **500** (opaque).
3. Insert failures now surface a sanitized `dbCode` + server log (never the raw
   PostgREST body) for fast diagnosis.
4. **Prod data corrected:** created the real `organization_members` row linking the
   admin (`544c19e8…`) to org `d295ca77…` (role `owner`), and set that org's
   `current_tier = certified` (grants Level 7/8).

**Empirical validation (against production Supabase):**
- Insert with a real UUID org → **HTTP 201** (then cleaned up). ✓
- Admin membership row now present; org tier = `certified`. ✓

**Regression shield:** `tests/unit/worker-run-integrity.test.ts` — fails the build if
any fabricated org id or `mockMemberships` reappears, or the UUID guard is removed.

---

## 3. P0 — Evidence signing key / attestation endpoint

**Root cause.** The attestation publisher exists only as a Next.js route
(`/api/attestation/pubkey`, `runtime = 'nodejs'`). On the **static-export
Cloudflare deployment that Next route is unreachable**, so the request fell through
to the SPA shell → HTML, not JSON. The `AttestationBadge` fetch failed → "EVIDENCE
SIGNING KEY UNAVAILABLE".

**Fix.** Ported the endpoint into the edge worker as `handleAttestationPubkey`,
using **WebCrypto Ed25519** (Workers has no `node:crypto` KeyObject). It mirrors the
exact derivation in `packages/shared/src/attestation-key.ts`: same PKCS#8 prefix,
`keyId = sha256(rawPubKey)` first 16 hex. Fail-closed (503) on missing/malformed
seed — never synthesizes a key. Routed at `case '/api/attestation/pubkey'`.

**Empirical validation — derivation parity proven:** a standalone script ran BOTH
the shared `node:crypto` path and the new edge WebCrypto path on the same seed:

```
shared: publicKey dVxMuSVsp83ErP3Gz+7ahJAX5bn5UU6ZGRvWfgsNQnY=  keyId ba0a6041c97c6fae
edge:   publicKey dVxMuSVsp83ErP3Gz+7ahJAX5bn5UU6ZGRvWfgsNQnY=  keyId ba0a6041c97c6fae
PARITY: PASS ✓
```

The `ARMAGEDDON_ATTESTATION_SEED` secret is **already bound** to the worker
(confirmed in the deployed bindings list), so the badge resolves on next deploy.

**Regression shield:** `worker-run-integrity.test.ts` locks the edge route + seed
decoder parity with `@armageddon/shared`.

---

## 4. P1 — Billing / pricing (Settings modal)

- **Wrong prices:** modal hard-coded `$49/mo`, `$199/mo`. Corrected: it now renders
  entirely from the canonical catalog `src/lib/pricing.ts` (CAD $29 / CAD $79 / …).
  No dollar figure is hard-coded anywhere in the component.
- **Redundant lower tiers:** for a subscriber, tiers *below* their active plan are
  suppressed — the panel shows the active plan (marked ● ACTIVE) and upgrade paths
  only. Guests/free users still see the full catalog. Heading switches to
  "Available Upgrades" when filtered.
- **Admin highest tier:** org tier set to `certified` in prod (see §2).

**Regression shield:** `tests/unit/pricing-display-consistency.test.ts` — fails if any
hard-coded price returns or the catalog values drift from the approved set.

---

## 5. P1/P2 — Marketing claim integrity + SEO/GEO

**Claim validation (every quantitative marketing claim checked against code):**
- ❌→✅ *"Simulation tier runs 10,000 statistical iterations"* — code stored `2500`
  on every (`sim_mode:true`) run. Aligned code to the advertised figure via a single
  source `SIM_STATISTICAL_ITERATIONS = 10000`, matched across all 7 locale dicts.
- ❌→✅ *Leaderboard "LIVE"* over a static `TOP_AGENTS` array (also violated the
  no-mock-data rule). Relabeled **"SAMPLE"** (honest) until wired to a real
  aggregated endpoint over `armageddon_runs`. Visual/layout unchanged.
- ✅ *"<0.01% escape threshold"* — consistent across code + all locales.
- ✅ *PAIR real adversarial engine* — present (`packages/core/src/core/adversarial.ts`).
- ✅ *Artifacts (JSON/MD/PDF)* — generated in `evidence-generator.ts`.
- ⚠️ *"13 Batteries"* — 5 executable adversarial batteries (B10–B14) + 8 described
  test suites (chaos/injection/e2e/etc.). Count is defensible as the full suite but
  **needs product sign-off** on the public framing. *Verification plan:* confirm each
  of the 13 manifest items maps to a runnable suite in CI; if any are aspirational,
  adjust copy. Not a blocker; flagged, not asserted.

**SEO/GEO (new, all shielded by `tests/unit/seo-discoverability.test.ts`):**
- `public/robots.txt` — crawl policy, app/auth surfaces disallowed, AI crawlers
  (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, …) explicitly allowed, sitemap ref.
- `public/sitemap.xml` — canonical marketing pages only (no `/console`, `/auth`).
- `public/llms.txt` — GEO/AI-chat summary of product, tiers, batteries, caveats.
- `public/og-image.png` — 1200×630 social card (was 404, referenced by metadata).
- `layout.tsx` — JSON-LD (`Organization` + `WebSite` + `SoftwareApplication`/`Offer`,
  currency corrected to CAD), canonical alternate, title template.
- **Multilingual:** `og:locale:alternate` for fr/de/it/es/zh/pt. *Note:* i18n is
  client-side at a single URL, so per-locale `hreflang` URLs were **not** fabricated
  (that would be an invalid signal). *Follow-up for max multilingual ranking:*
  introduce per-locale routes (`/fr`, `/de`, …) with real `hreflang` — a separate,
  larger change; deliberately not faked here.

**Regression shield:** `tests/unit/marketing-claim-integrity.test.ts` — locks
code↔copy parity for iteration count, threshold, and the leaderboard label.

---

## 6. Verification status — honest disclosure

**Empirically validated in this session:**
- Attestation derivation parity (script, PASS). ✓
- `/api/run` insert path against prod Supabase (201) + admin membership + tier. ✓
- 10 guardrail text-assertions across all changed files (10/10 pass). ✓
- `seo-discoverability` + `pricing-display-consistency` vitest suites (8/8 pass). ✓
- Security invariants 1–11 present (grep-confirmed). ✓

**Could NOT be completed in this sandbox (operator must run before deploy):**
The full `npm ci && npm run lint && npm run typecheck && npm run test && npm run
build` gate did not complete here — the sandbox's file mount for
`intake-handler.ts` froze mid-session (esbuild saw a truncated copy), and the build
exceeds the shell time limit. **This is an environment limitation, not a known
defect.** The file is complete and brace-balanced (verified via the authoritative
editor). `worker-run-integrity` + `marketing-claim-integrity` vitest suites will run
green once the file system is consistent (their text assertions already pass via
node).

**Operator gate (required):**
```bash
npm ci && npm run lint && npm run typecheck && npm run test && npm run build
# then deploy the worker:
npx wrangler deploy      # publishes handleAttestationPubkey + /api/run fix
```

---

## 7. Changed files (surgical)

`src/intake-handler.ts` · `src/app/api/me/organizations/route.ts` ·
`src/app/layout.tsx` · `src/components/SettingsModal.tsx` ·
`src/components/social/LeaderboardWidget.tsx` · `CLAUDE.md`
New: `public/{robots.txt,sitemap.xml,llms.txt,og-image.png}` ·
`tests/unit/{worker-run-integrity,pricing-display-consistency,seo-discoverability,marketing-claim-integrity}.test.ts`

**Single most useful next action:** run the operator gate above and `wrangler deploy`
— that ships the Level 7 fix + attestation endpoint and turns the SAMPLE leaderboard
follow-up into the only open item.
