# ARMAGEDDON — Claude Cowork Live UI/UX Execution Contract

**Version:** 1.0 · **Date:** 2026-07-07
**Target under test (production):** `https://armageddontest.icu`
**Audience:** an autonomous Claude Cowork agent with a headless/headful browser (Playwright + Chromium are pre-provisioned).
**Grounded in:** `armageddon-site/src/app/**`, `src/components/DestructionConsole.tsx`, `src/lib/{codebase-target,pricing,runtime-api}.ts`, `intake-handler.ts`, `packages/core/src/{api-server,worker,temporal}`.

This is an **execution contract**, not a suggestion list. Every journey below has explicit preconditions, actions with real selectors/URLs, an **observable expected outcome**, required **evidence**, and a binary **pass/fail gate**. Execute them in order. Emit the machine-readable result block in §12.

---

## 0. Prime directives (read before touching anything)

1. **Test only authorized surfaces.** The only production origin in scope is `https://armageddontest.icu` and its own API. Do **not** point runs, fuzzers, or load at any third-party host. The in-app "target endpoint" for a run must be a system the operator owns or has authorized (default demo: `https://example.com` / `https://apexomnihub.icu` sandbox). Never aim adversarial batteries at someone else's production.
2. **Never enable live-fire.** `SIM_MODE=true` is the only supported production posture. Do not attempt to flip `sim_mode:false`, hit `/api/omniport/live-fire` with real waivers, or otherwise coax real-fire execution. If a flow requires it, mark the journey **BLOCKED (out of scope)** — that is a pass for the contract, a fail for anyone who bypasses it.
3. **Respect safety controls as assertions, not obstacles.** Rate limits, CORS locks, auth 401s, injection blocks, and the "backend not connected" degradation are **features to verify**, never things to defeat. A safeguard firing correctly is a PASS.
4. **No secrets in evidence.** Screenshots/HAR/logs must not capture bearer tokens, Supabase keys, or passwords. Redact `Authorization` headers in captured HAR. Credentials come from env vars (§2), never inline.
5. **Idempotent & clean.** Every run you start writes a real `armageddon_runs` row. Tag them (§11) and do not spam: one run per journey execution unless a retry is required.
6. **Honesty over green.** If the live backend is not wired into the deployment, the correct result is the **honest-degradation copy**, not a fabricated certificate. Assert the truthful state (§ J6-A vs J6-B). Reporting a pass that didn't happen is a contract violation.

---

## 1. Detecting which deployment state you are in (do this FIRST)

The site ships in one of two states. Detect it before running journeys, because the expected outcomes branch on it.

| Probe | State A — **Edge-only (no executor)** | State B — **Executor connected** |
|---|---|---|
| `GET https://armageddontest.icu/api/attestation/pubkey` | may be `200` (edge worker serves it) | `200` with `keyId` |
| Home console "STEP 2" panel copy | shows **"BACKEND NOT CONNECTED"** / "REQUEST ACCESS" if `NEXT_PUBLIC_ARMAGEDDON_API_BASE` unset | shows tier lock or unlocked batteries |
| Start a run (J6) | run inserts, console **hangs at `EXECUTING 0/13`** (no worker) | console advances past `0/13`, streams telemetry, reaches a verdict |

**How to record it:** run J6 once; if the console never leaves `EXECUTING 0/13` within the J6 timeout **and** no `armageddon_events` stream, you are in **State A** → execute **J6-A** expectations. If it advances, you are in **State B** → **J6-B**. Report the detected state in §12 `deployment_state`.

> Root cause of State A (for your report, not for you to "fix" from the browser): the static Cloudflare edge worker inserts a `pending` run but cannot start a Temporal workflow. The Node **api-server** (dispatcher/poller) + **worker** must be deployed and the site rebuilt with `NEXT_PUBLIC_ARMAGEDDON_API_BASE` pointing at them. See `RUNBOOK_EXECUTION_ENGINE_2026-07-06.md`.

---

## 2. Environment & personas (inputs)

Provide these as environment variables to Cowork — never inline in scripts or evidence.

```
BASE_URL=https://armageddontest.icu
# Persona A — anonymous: no creds
# Persona B — free_dry signed-in user
COWORK_FREE_EMAIL=...        COWORK_FREE_PASSWORD=...
# Persona C — verified/certified user (can customize batteries)
COWORK_CERT_EMAIL=...        COWORK_CERT_PASSWORD=...
# Persona D — admin override (tier=certified via handleGatekeeper; email match is EXACT)
COWORK_ADMIN_EMAIL=...       COWORK_ADMIN_PASSWORD=...
# Authorized run target (a system YOU own; default sandbox below)
COWORK_TARGET_URL=https://example.com
```

Personas map to the readiness/tier gates:

| Persona | Signed in | Org membership | Tier | Can customize batteries | Expected run access |
|---|---|---|---|---|---|
| A anonymous | ✗ | ✗ | — | ✗ | run blocked at "Signed in" |
| B free_dry | ✓ | ✓ | `free_dry` | ✗ (locked) | default B10–B13 only |
| C certified | ✓ | ✓ | `certified`/`verified` | ✓ | custom batteries + full run |
| D admin | ✓ | override | `certified` (ADMIN_OVERRIDE) | ✓ | full run |

---

## 3. Selector & route contract (authoritative — do not guess)

**Pages:** `/` (home console), `/console`, `/onboarding`, `/pricing`, `/privacy`, `/support`, `/auth/callback`.

**Stable selectors (from source):**

| Element | Selector |
|---|---|
| Login button | `getByRole('button', { name: 'LOGIN' })` |
| Logout button | `getByRole('button', { name: 'LOGOUT' })` or `[LOGOUT]` link |
| Auth email input | `input#auth-email` |
| Auth password input | `input#auth-password` |
| Auth submit | `button[type="submit"]` (within AuthModal) |
| Battery buttons | `getByRole('button', { name: /B1[0-3]/ })` |
| Initiate run | `getByRole('button', { name: /INITIATE SEQUENCE/ })` |
| Running state label | button text `EXECUTING {n}/13` |
| Re-initiate | `getByRole('button', { name: /REINITIATE SEQUENCE/ })` |
| Export evidence | `getByRole('button', { name: /EXPORT JSON EVIDENCE/ })` |
| Threat matrix header | text `SECURE SECTORS: {n}/64` |
| Leaderboard label | text `SAMPLE` (must NOT read "LIVE" — Invariant 15) |
| Support input | `[aria-label="Support message"]` |
| Support escalation panel | `[aria-label="Escalation email draft"]` |

**localStorage keys (to seed target config without walking onboarding UI):**

```js
// armageddon:onboarding-draft  (DRAFT_KEY)
localStorage.setItem('armageddon:onboarding-draft', JSON.stringify({
  targetSystemName: 'Cowork Authorized Target',
  targetUrl: 'https://example.com',
  environment: 'staging',
  authorizationConfirmed: true
}));
// armageddon:codebase-target  (CODEBASE_TARGET_KEY)
localStorage.setItem('armageddon:codebase-target', JSON.stringify({
  kind: 'endpoint', endpointUrl: 'https://example.com',
  label: 'Cowork Authorized Target', status: 'ready'
}));
```

---

## 4. API endpoint contract (drive directly, in parallel with UI)

Hit these with `fetch`/HAR alongside the UI journeys. Auth = `Authorization: Bearer <supabase access_token>` obtained after login (read from the Supabase session in the page, do not fabricate).

| Endpoint | Method | Auth | Expected (happy) | Negative assertions |
|---|---|---|---|---|
| `/api/attestation/pubkey` | GET | none | `200 {spec, algorithm, keyId, publicKey}` **or** `503` if seed unset (fail-closed — both acceptable, never a synthesized key) | — |
| `/api/me/organizations` | GET | required | `200 {active:{organization_id}}` for member; `404` for no-org | `401` without token |
| `/api/gatekeeper` | POST | optional | `200 {eligible, tier, reason}`; admin → `tier:'certified', reason:'ADMIN_OVERRIDE'` | anon → `free_dry` |
| `/api/run` | POST | required | `200 {success:true, runId, workflowId}` | `401` no token; `403` non-member/ineligible; `400` bad `organizationId` (must be UUID — not 500); `405` non-POST |
| `/api/run?runId=<id>` | GET | required | `200` run row | `400` missing runId |
| `/api/omniport/health` | GET | per config | `200` if enabled, `503 OMNIPORT_DISABLED` by default (safe default) | must not `200` a live-fire route while disabled |

**CORS assertion:** responses carry `Access-Control-Allow-Origin: https://armageddontest.icu` (origin-locked, never `*`) with `Vary: Origin`. Verify on at least one API response.

---

## 5. Evidence capture (required for every journey)

For each journey produce: (a) a full-page screenshot at the terminal state, (b) the browser console log (assert **zero uncaught errors** unless the journey expects one), (c) a HAR with `Authorization` redacted, (d) the observed values named in the gate. Store under `cowork-evidence/<journey-id>/`. Name the run rows per §11.

---

## 6. J1 — Home / marketing load & Core Web Vitals

- **Precondition:** Persona A. Fresh context, cold cache.
- **Actions:** `goto BASE_URL`. Wait for the LCP hero (`img[alt="ARMAGEDDON LEVEL 8"]`). Read nav (PRICING/SUPPORT/PRIVACY/SETTINGS). Capture LCP, CLS, INP via `PerformanceObserver`.
- **Expected:** page renders; hero visible; nav links resolve (200) for `/pricing`, `/support`, `/privacy`; LCP < 2.5s, CLS < 0.1 on a warm run; leaderboard labeled **SAMPLE** (never LIVE).
- **Gate:** PASS iff hero + all nav routes 200 + leaderboard reads "SAMPLE" + no console errors.

## 7. J2 — Pricing integrity

- **Precondition:** Persona A. `goto /pricing`.
- **Expected (must equal `src/lib/pricing.ts` `PLANS`/`PLAN_ORDER`, Invariant 14) — all six tiers:**
  | Plan | Price | Cadence |
  |---|---|---|
  | Self-Serve Dry Run | Free | — |
  | Pro | CAD $29 | /month |
  | Team | CAD $79 | /month |
  | Verified Evidence Review | CAD $499 | one-time |
  | Certified Release Gate | **CAD $1,499** | one-time |
  | Enterprise Assurance | **from CAD $4,999** | /year |
  No hard-coded price drift; every rendered figure must come from `pricing.ts`.
- **Iteration claim (Invariant 15):** the "10,000 statistical iterations" claim lives in the i18n/marketing copy (`src/i18n/dictionaries/*`), **not** on the pricing page — assert it wherever it renders (home/marketing), and that it equals `SIM_STATISTICAL_ITERATIONS`. Its absence from `/pricing` is expected, not a failure.
- **Gate:** PASS iff every rendered price/cadence matches the six-row table; the iteration claim is checked only on the surface that renders it.

## 8. J3 — Onboarding → target configuration → authorization

- **Precondition:** Persona B (or seed localStorage per §3 then reload).
- **Actions:** `goto /onboarding`. Enter target system name + `COWORK_TARGET_URL`, choose environment, **confirm authorization** checkbox. Save.
- **Expected — two distinct checks:**
  - **(safety, required)** an invalid URL (e.g. `ftp://x`) must **not** persist a bad target: no `armageddon:codebase-target` is written/locked with a non-http(s) value; any prior valid target is retained. A reject-and-revert with no unsafe state is a PASS on this check.
  - **(UX feedback, sub-check)** the invalid value should surface the inline message "Enter an http(s) target endpoint…" rather than being silently discarded. If the value reverts with no visible feedback (observed 2026-07-07), record this as a **soft-fail (UX)**, not a safety fail.
  - valid `http(s)` accepted; draft persisted to `armageddon:onboarding-draft` with `authorizationConfirmed:true`; `armageddon:codebase-target.status === 'ready'`.
- **Gate:** PASS iff no unsafe target is ever locked AND valid input persists both localStorage keys. Missing inline error on invalid input → PASS-with-soft-fail (UX), flagged separately.

## 9. J4 — Authentication (login / session / logout)

- **Precondition:** Persona B creds.
- **Actions:** click `LOGIN` → fill `#auth-email` / `#auth-password` → submit. Then reload. Then `LOGOUT`.
- **Expected:** on success the `LOGOUT` control appears within 5s and the user handle renders; a Supabase session exists (access_token present); after logout the `LOGIN` control returns and protected calls 401. Bad password → visible auth error, no session.
- **Gate:** PASS iff login yields a session + LOGOUT visible, and logout clears it.

## 10. J5 — Console readiness checklist (all seven items)

- **Precondition:** run for each persona A/B/C.
- **Expected item states** (`buildReadinessItems`): `signed-in`, `target`, `authorization`, `organization`, `backend`, `battery-access`, `evidence-signing`. For each persona, assert which are ready vs blocked and that the CTA/copy is honest:
  - Persona A: `signed-in` blocked with "Sign in" CTA → `/onboarding`.
  - Persona B no target: `target` blocked → `/onboarding#target-config`.
  - No org: `organization` blocked, copy names the real cause ("No organization_members row…"), **not** a fake membership (Invariant 12).
  - `backend` item truthfully reflects State A vs B ("backend not connected" vs connected).
  - `evidence-signing` optional; blocked ⇒ says signed artifacts unavailable (not a hard stop).
- **Gate:** PASS iff every item's ready/blocked state and CTA match the persona and the copy is honest (no fabricated readiness).

## 11. J6 — **THE CORE FLOW:** start → execute → certification/verdict → export

This is the journey the stuck `EXECUTING 0/13` screen fails. It has two accepted terminal outcomes depending on §1 state.

- **Precondition:** Persona C (or B for default batteries). Target ready + authorization confirmed + signed in + org membership. Tag the run: set `targetSystemName` to `COWORK_RUN_TAG = cowork-e2e-<UTC-timestamp>`.
- **Actions:** open home console. (Persona C) select/deselect batteries B10–B13 and assert they are enabled; (Persona B) assert they are locked with honest tier copy. Click `INITIATE SEQUENCE`.
- **Observe the terminal state, up to 180s:**

  **J6-A · State A (edge-only, expected today):**
  - Console prints `LEVEL n SEQUENCE INITIATED` → `Connecting to Temporal workflow engine...` → `Workflow started against <target>: <runId>` → `Subscribing to real-time event stream...` then **stalls at `EXECUTING 0/13`**.
  - **Expected/PASS:** the run row exists (`GET /api/run?runId` → `status:'pending'`), **and** the UI does not fabricate a certificate, **and** the honest cause is reportable. This is a **PASS for the contract** (truthful degradation) but you MUST flag `deployment_state:"edge-only"` and `core_flow_functional:false` so the operator deploys the executor. Do **not** report certification.

  **J6-B · State B (executor connected, target end-state):**
  - Console advances **past `0/13`**; `armageddon_events` stream in (BATTERY_STARTED/COMPLETED per battery); threat matrix `SECURE SECTORS` increments; the run row goes `pending → running → {passed|failed}`.
  - On `passed`: terminal lines show `X/Y BATTERIES PASSED | ESCAPE RATE: …%` and `VERDICT: EVIDENCE GENERATED | SUBMIT FOR REVIEW`; status pill → certified; `EXPORT JSON EVIDENCE` appears.
  - On `failed`: `VERDICT: BREACH EVIDENCE RECORDED | REVIEW REQUIRED` — a **legitimate** outcome (simulation breach), not a bug.
  - **Expected/PASS:** UI leaves `0/13`, streams ≥1 event per selected battery, reaches a terminal verdict, and `EXPORT JSON EVIDENCE` downloads a JSON whose `runId`/`terminalStatus` match the run row and whose `certifiable` is true **iff** status is `passed`. Export must be **blocked** if `organizationId` is a demo/placeholder.
- **Gate:** State A → PASS on truthful stall + no fake cert. State B → PASS iff UI advances past 0/13, telemetry streams, a terminal verdict renders, and exported evidence is consistent + honestly gated. Any fabricated certificate = **FAIL**.

> Verification cross-check (already proven in-repo): the real `ArmageddonLevel7Workflow` executes B10–B13, emits BATTERY_STARTED/COMPLETED per battery, and finalizes the run row (`packages/core` e2e). State B in production must reproduce exactly this stream.

## 12. J7 — Support chat (safety controls are the test)

- **Precondition:** Persona A on `/support`.
- **Actions & expected:**
  1. Send a normal message via `[aria-label="Support message"]` → assistant replies or, if unconfigured, a clean `503 NOT_CONFIGURED` surface (no crash).
  2. Send an **empty** string → treated as `EMPTY` (not `INVALID_TYPE`); UI rejects gracefully.
  3. Send an injection-style payload (e.g. a base64 blob containing `+`/`/`) → **blocked** by the injection guard, not forwarded.
  4. Exceed the per-minute limit (rapid sends) → `retryAfter: 60` style throttle **iff** `RATE_LIMIT_KV` is bound; if unbound, throttling is gracefully skipped (known gap) — assert no error either way.
  5. Trigger escalation → `[aria-label="Escalation email draft"]` panel opens with copy/mail actions.
- **Gate:** PASS iff normal path works or degrades cleanly, empty/injection are handled per contract, and escalation renders. A blocked injection is a PASS.

## 13. J8 — Attestation & evidence verifiability

- **Actions:** `GET /api/attestation/pubkey`. If `200`, record `keyId`; cross-check it equals the `keyId` embedded in a J6-B exported evidence attestation. If `503`, assert fail-closed (no synthesized key) and that J5 `evidence-signing` shows unavailable.
- **Gate:** PASS iff pubkey is either a stable key that matches exported evidence, or an honest `503`.

## 14. J9 — Privacy, accessibility, responsive, theme

- **Actions:** `/privacy` renders legal copy. Run an a11y pass (axe) on `/`, `/pricing`, `/support`: assert no critical violations (focusable CTAs, labelled inputs, contrast). Test viewports 375px / 768px / 1440px: **no horizontal body scroll**; wide panels scroll internally. Toggle light/dark: both themes legible.
- **Gate:** PASS iff no critical a11y violations, no body-level horizontal overflow, both themes render.

## 15. J10 — Negative & security matrix (drive the API)

Assert each safeguard fires:
- `/api/run` without token → `401`; non-member → `403`; malformed `organizationId` → `400` (never opaque `500`, Invariant 12); non-POST → `405`.
- Gatekeeper for anon → `free_dry` (no privilege leak); admin override requires **exact** email match (Invariant 11) — a look-alike email must NOT get certified.
- CORS `Access-Control-Allow-Origin` is the canonical host, never `*` (Invariant 4).
- `/api/omniport/*` default `503 OMNIPORT_DISABLED`; live-fire never executes.
- **Gate:** PASS iff every safeguard returns its documented status. A safeguard *not* firing = FAIL.

---

## 16. Result contract (emit exactly this at the end)

```json
{
  "contract": "COWORK_UI_UX_EXECUTION_CONTRACT@1.0",
  "base_url": "https://armageddontest.icu",
  "run_at": "<UTC ISO8601>",
  "deployment_state": "edge-only | executor-connected",
  "core_flow_functional": true,
  "journeys": [
    { "id": "J1", "name": "home/CWV", "result": "PASS|FAIL|BLOCKED", "evidence": "cowork-evidence/J1/", "notes": "" }
    /* … J2..J10, one object each … */
  ],
  "run_rows_created": ["<runId>"],
  "safeguards_verified": ["auth-401","member-403","uuid-400","method-405","cors-lock","omniport-disabled","injection-block","admin-exact-match"],
  "blocking_gaps": [
    "e.g. deployment_state=edge-only: executor (api-server+worker) not deployed; core run flow stalls at 0/13 — see RUNBOOK_EXECUTION_ENGINE_2026-07-06.md"
  ],
  "verdict": "GREEN|AMBER|RED"
}
```

**Verdict rule:** `GREEN` = all in-scope journeys PASS **and** `core_flow_functional:true` (State B start→verdict). `AMBER` = all safeguards/UI PASS but `deployment_state:edge-only` (truthful stall, executor not deployed). `RED` = any safeguard failed, any fabricated certificate, any uncaught error in a happy path, or a UI/pricing/claim integrity mismatch.

---

## 17. Escalation & known gaps (report, don't paper over)

- **Executor not deployed (State A):** the single highest-priority gap. UI + APIs can be fully green while the core run flow still stalls at `0/13`. This is `AMBER`, and the fix is operational: deploy the Node api-server + Temporal worker and set `NEXT_PUBLIC_ARMAGEDDON_API_BASE` (`RUNBOOK_EXECUTION_ENGINE_2026-07-06.md`, `docker-compose.exec.yml`).
- **`RATE_LIMIT_KV` unbound:** support-chat rate limiting degrades gracefully (skipped). Assert no error; note the gap.
- **Live-fire:** permanently out of scope for this contract. `SIM_MODE=true` only.
- **Do not "fix" State A from the browser.** Report it; the remedy is a deployment, not a UI action.
