# Feature Registry — ARMAGEDDON Test Suite

**Docs version**: 2026.07.07<br>
**Last updated**: 2026-07-07<br>
**Scope**: Armageddon Level 7 certification engine surfaces verified against `packages/core/src/temporal/activities.ts`, `packages/core/src/temporal/workflows.ts`, `packages/core/src/core/attestation.ts`, and `packages/shared/src/gate.ts`. Also covers Cloudflare edge surfaces in `armageddon-site/src/intake-handler.ts`, the standalone API runtime in `packages/core/src/api-server.ts`, and site pages in `armageddon-site/src/app/`.

## Domain: Release Gate & Execution Engine (NEW — PRs #181–#189, 2026-07-06/07)

- **Feature:** Attestation public-key endpoint on the edge worker
  - **Location:** `armageddon-site/src/intake-handler.ts` → `handleAttestationPubkey` (`/api/attestation/pubkey`)
  - **Scope:** WebCrypto Ed25519 derivation formula-identical to `packages/shared/src/attestation-key.ts`; fail-closed 503 without `ARMAGEDDON_ATTESTATION_SEED`. The Next.js route remains a static-export-unreachable reference implementation. Shielded by `tests/unit/api-attestation-pubkey.test.ts`. (CLAUDE.md Invariant 13.)
  - **Status:** Implemented (PR #184). Live behavior UNVERIFIED until the worker deploy is confirmed by the operator.

- **Feature:** Run-record integrity (no fabricated org identities)
  - **Location:** `armageddon-site/src/intake-handler.ts` → `handleMeOrganizations`, `parseRunInput`; reference route `src/app/api/me/organizations/route.ts`
  - **Scope:** Admin resolves real `organization_members` rows; `organizationId` UUID-validated (400, not 500); admin privilege is a tier override in the gatekeeper, never identity fabrication. Shielded by `tests/unit/worker-run-integrity.test.ts`. (CLAUDE.md Invariant 12.)
  - **Status:** Implemented (PR #184).

- **Feature:** Pricing single source of truth + marketing claim integrity
  - **Location:** `armageddon-site/src/lib/pricing.ts`; `SettingsModal.tsx`; `LeaderboardWidget.tsx`; `SIM_STATISTICAL_ITERATIONS` in `intake-handler.ts`
  - **Scope:** UI surfaces render from `PLANS`/`PLAN_ORDER`; iteration claim (10,000) matches code; static leaderboard labeled SAMPLE. Shielded by `pricing-display-consistency`, `marketing-claim-integrity`, and `seo-discoverability` tests. (CLAUDE.md Invariants 14–15.)
  - **Status:** Implemented (PR #184).

- **Feature:** Execution-engine deployment path (fixes "EXECUTING 0/13")
  - **Location:** `docker-compose.exec.yml`; `packages/core/src/api-server.ts` (pending-run dispatcher) + `packages/core/src/worker.ts`
  - **Scope:** The edge `/api/run` only inserts a `pending` row; these two Node processes drain it and stream progress. Runbook: `RUNBOOK_EXECUTION_ENGINE_2026-07-06.md`; turnkey guide: `docs/EXECUTOR_DEPLOY_TURNKEY.md`; code-path proof: `packages/core/tests/integration/certification-pipeline.test.ts`. api-server CORS locked to the site origin via `CORS_ALLOW_ORIGIN`.
  - **Status:** Committed deploy path (PRs #187–#189). Production deployment UNVERIFIED (operator action).

- **Feature:** Settings control panel + compliance navigation
  - **Location:** `armageddon-site/src/components/SettingsModal.tsx`; `AuthHeader.tsx`; `Footer.tsx`
  - **Scope:** Tabbed operator info/billing/FAQ modal; Support & Privacy links in header and footer; gatekeeper calls forward the Supabase bearer token; certified-tier client execution capped at Level 7.
  - **Status:** Implemented (PRs #181–#183).

- **Feature:** Onboarding target validation & auth-aware routing
  - **Location:** `armageddon-site/src/app/onboarding/page.tsx`
  - **Scope:** Authenticated operators editing target config route to `/console` instead of the pre-purchase intake (PR #186). Target endpoint URL is format-validated via `validateTargetEndpointUrl`, and an edited URL replaces the previously saved target instead of silently reverting (PR #190). Shielded by `tests/unit/app-onboarding-codebase-target.test.tsx`.
  - **Status:** PR #186 merged; PR #190 open at time of writing.

## Domain: Support & Privacy (NEW — PR #143)

- **Feature:** ATLAS Support-Chat Agent
  - **Location:** `armageddon-site/src/intake-handler.ts` → `handleSupportChat`; `armageddon-site/src/app/support/page.tsx`
  - **Scope:** `/api/support-chat` Cloudflare Worker endpoint. Multi-layer security: IP-based KV rate limiting (5/min, 30/hr), input validation, 40+ regex injection guards, emoji-payload detection, history truncation (last 8 messages). Proxies validated messages to Claude Haiku (claude-haiku-4-5-20251001) with an immutable ATLAS system prompt. CORS locked to canonical host. Client-side UI is an interactive terminal with client-side injection detection, escalation modal, and character counter.
  - **Infrastructure requirements:** `RATE_LIMIT_KV` namespace and `ANTHROPIC_API_KEY` Wrangler secret — see `docs/CLOUDFLARE_DEPLOYMENT.md`.
  - **Security invariants:** Documented and frozen in `CLAUDE.md`. Tests in `armageddon-site/tests/unit/worker-support-chat-security.test.ts`.
  - **Status:** Implemented. `RATE_LIMIT_KV` not yet bound in production (confirmed 2026-06-24 — see OPS runbook 5.2). `ANTHROPIC_API_KEY` provisioning also required. See `docs/CLOUDFLARE_DEPLOYMENT.md`.

- **Feature:** Privacy Policy Page
  - **Location:** `armageddon-site/src/app/privacy/page.tsx`
  - **Scope:** Static `/privacy` page. PIPEDA-compliant (Canadian jurisdiction, Edmonton AB). GDPR acknowledgment for EEA users. Documents third-party disclosures (GitHub, Cloudflare, Stripe, Anthropic, Supabase), data retention, and user rights.
  - **Status:** Implemented.

## Domain: Localization (NEW)

- **Feature:** Local i18n System
  - **Location:** `armageddon-site/src/i18n/` (types, locales, dictionaries, `I18nProvider`, `useT` hook); `armageddon-site/src/components/LanguageSelector.tsx`; `armageddon-site/src/components/AppProviders.tsx`
  - **Scope:** Typed, statically-bundled dictionaries for English, French, German, Italian, Spanish, Simplified Chinese (`zh-CN`), and Portuguese. Covers nav/footer/PWA/audio chrome, `/pricing`, `/onboarding`, `/support`, `/privacy` (chrome + section titles only; legal body stays English with a convenience-translation notice), and the home page (`BatteryGrid`, `CertificationSeal`, and the static UI chrome of `DestructionConsole` — the live terminal/simulation narrative stays English, consistent with evidence JSON keys staying English). No runtime third-party translation calls; all dictionaries ship at build time.
  - **Guardrail:** `armageddon-site/tests/unit/i18n-dictionaries.test.ts` enforces exact key parity across all seven locales and rejects empty-string leaf values.
  - **Status:** Implemented.

## Domain: Cryptographic Attestation (NEW)

- **Feature:** Tamper-Evident Certification Receipts
  - **Location:** `packages/core/src/core/attestation.ts`, `packages/core/src/core/evidence-generator.ts`
  - **Scope:** Ed25519 detached signatures + RFC 6962 SHA-256 Merkle audit tree over every battery result and run metadata; embedded in `report.json`, `certificate.txt`, `report.md`, `manifest.json`; emitted as standalone `attestation.json` + executable zero-dependency `verify.mjs`.
  - **Status:** Implemented and validated end-to-end. Compliance alignment: EU AI Act Article 12 (Aug 2026), CAP-SRP v1.0, RFC 6962, NIST AI RMF.

- **Feature:** Attestation Public-Key Endpoint
  - **Location:** `armageddon-site/src/app/api/attestation/pubkey/route.ts`, `armageddon-site/src/lib/attestation-pubkey.ts` (static-export-only reference implementation); `packages/core/src/api-server.ts` → `handleAttestationPubkey` (the implementation actually reachable in production, if that process is deployed).
  - **Scope:** `GET /api/attestation/pubkey` (Node runtime, 24h immutable cache) publishes the Ed25519 verification key derived from `ARMAGEDDON_ATTESTATION_SEED`. Fails closed with HTTP 503 when no seed is configured.
  - **Status:** **Corrected 2026-07-04.** Previously stated "Implemented and live-tested" — that was inaccurate. Live-verified via `curl` against `https://armageddontest.icu/api/attestation/pubkey`: returns HTTP 200 with the SPA HTML shell (identical to a nonexistent path), not JSON, not a 503. `intake-handler.ts` never routes this path. The Next.js route is unreachable in the static-export deployment; `packages/core/src/api-server.ts`'s implementation only works if that process is deployed and publicly reachable, which is UNVERIFIED (see `PRODUCTION_STATUS.md`).

- **Feature:** Attestation Status Badge (UI)
  - **Location:** `armageddon-site/src/components/AttestationBadge.tsx`
  - **Scope:** Surfaces `OFFLINE_VERIFY` / `Evidence signing key unavailable` in the Destruction Console header. Powers the cryptographic-evidence narrative in the exported JSON bundle.
  - **Status:** Implemented and validated via jsdom unit tests.

## Domain: OmniPort Connector — Level 8 / Kinetic Moat (NEW — scoping + plumbing)

- **Feature:** OmniPort inbound routes (execute / live-fire / control / waiver / telemetry)
  - **Location:** `armageddon-site/src/app/api/omniport/{execute,live-fire,control,waiver,telemetry}/route.ts` (reference implementation); `packages/core/src/api-server.ts` → `handleOmniPort*` (the process that actually serves these routes in production, since it — unlike the Cloudflare Worker in `intake-handler.ts` — has real Temporal gRPC access).
  - **Scope:** OmniHub-triggered sandboxed runs (`execute`), waiver-gated live-fire runs (`live-fire`), workflow control signals (`control`), waiver acceptance persistence (`waiver`), and telemetry pull (`telemetry`). Auth/crypto primitives (SSRF validation, bearer token check, waiver JWT verify/sign, per-operator task-queue resolution) live in `packages/shared/src/omniport.ts` — the single source both `armageddon-site` and `packages/core` import, so the two surfaces cannot drift.
  - **Per-operator task-queue separation:** `resolveOmniPortTaskQueue(organizationId)` in `packages/shared/src/omniport.ts` derives `${OMNIPORT_TASK_QUEUE_PREFIX:-armageddon-moat}-<organizationId>`, so each operator's Moat worker (`docker-compose.moat.cloud.yml`) only ever picks up its own organization's runs on the shared Temporal cluster.
  - **Status:** Code-complete and unit-tested for the pieces owned by this repo (field-name consistency between the OmniPort routes and the workflow config — `targetEndpoint`, not `targetUrl` — was fixed; the OmniPort routes were previously unreachable in both production backends and are now wired into `api-server.ts`). **UNVERIFIED / NOT LIVE**: no per-operator Temporal Cloud credentials are provisioned, `OMNIPORT_ENABLED` is not set in any deployed environment (stays `false`, the safe default), and this has not been exercised against a real Temporal Cloud cluster or a real APEX-OmniHub instance.
  - **Known blocker — do not treat "Moat-pulls" as functional yet:** `packages/core/src/worker.ts` calls `safetyGuard.enforce('WorkerStartup')` (`packages/core/src/core/safety.ts`), which is a protected invariant (see `CLAUDE.md`, "Never remove safety controls... SIM_MODE enforcement must never be disabled") — it hard `process.exit(1)`s at boot unless `SIM_MODE==='true'`. That means the worker process that actually executes battery activities cannot start in a live-fire (`SIM_MODE=false`) configuration today, independent of anything in the OmniPort connector. Enabling genuine non-simulated live-fire execution requires a separate, deliberate decision about how a live-fire-authorized worker boots safely — this PR does not make that decision or touch `safety.ts`.

<details>
<summary>Kinetic Moat cloud-connected mode</summary>

  - **Location:** `docker-compose.moat.cloud.yml` (new — worker-only, no bundled local Temporal); `docker-compose.moat.yml` (unchanged — fully local dev stack); `.env.moat.example` (documents the per-operator queue convention).
  - **Scope:** "Moat-pulls" custody model — an operator's worker connects outbound to a shared Temporal cluster and long-polls its own task queue; no inbound exposure needed on the operator's network. Requires the operator to provision a Temporal Cloud namespace/API key (or coordinate a queue name on a shared cluster) — this repo cannot do that provisioning.
  - **Status:** Compose file validated with `docker compose config`. Temporal Cloud API-key/TLS auth (`TEMPORAL_API_KEY`) added to both `packages/core/src/worker.ts` and `packages/core/src/api-server.ts` connection paths (backward-compatible no-op when unset). Not deployed or run against a real cluster.

</details>

## Certification Execution Defaults

| Surface | Verified state |
| --- | --- |
| Default certification subset | `B10`, `B11`, `B12`, `B13`, `B14` |
| Temporal workflow default | `ArmageddonLevel7Workflow` defaults to `B10` through `B14` when no battery selection is provided. |
| UI display grid | `packages/shared/src/batteries.ts` exports thirteen presentation batteries with IDs `01` through `13`. |
| Battery activity coverage | Temporal activities expose handlers for `B1` through `B14`. |

## Domain: Core Certification Engine

- **Feature:** PAIR Adversarial Engine & Iteration Caps
  - **Scope:** Defines the iteration boundaries and model selection for adversarial tests.
  - **Status:** Implemented. Simulated GOD MODE evaluates up to 10,000 iterations. CERTIFIED live-fire evaluations are cost-capped at 50 real-LLM vectors using `claude-sonnet-4-6`.

- **Feature:** Administrative Access Control
  - **Location:** `armageddon-site/src/app/api/run/route.ts`, `armageddon-site/src/app/api/gatekeeper/route.ts`, `armageddon-site/src/intake-handler.ts`
  - **Scope:** Administrator overrides for testing, tier access, and intake handling.
  - **Security invariants:** MUST use exact, case-sensitive match against `process.env.ADMIN_EMAIL`. The use of `.includes()` or any substring matching is strictly prohibited to prevent arbitrary domain registration bypasses.
  - **Status:** Implemented and enforced as of 2026-07-05.

## Domain: Chaos & Stress

- **Feature:** Battery 1 — Chaos Stress
  - **Location:** `packages/core/src/temporal/activities.ts` → `runBattery1_ChaosStress`
  - **Scope:** Stress test execution against the configured target endpoint.
  - **Status:** Implemented activity.

- **Feature:** Battery 2 — Chaos Engine
  - **Location:** `packages/core/src/temporal/activities.ts` → `runBattery2_ChaosEngine`
  - **Scope:** Deterministic chaos-engine and safety simulation checks.
  - **Status:** Implemented activity.

## Domain: Security & Defense

- **Feature:** Battery 3 — Prompt Injection
  - **Location:** `packages/core/src/temporal/activities.ts` → `runBattery3_PromptInjection`
  - **Scope:** Prompt-injection pattern simulation and detection scoring.
  - **Status:** Implemented activity.

- **Feature:** Battery 4 — Security & Auth
  - **Location:** `packages/core/src/temporal/activities.ts` → `runBattery4_SecurityAuth`
  - **Scope:** CSRF, XSS, session fixation, and brute-force rate-limit checks.
  - **Status:** Implemented activity.

- **Feature:** Battery 10 — Goal Hijack
  - **Location:** `packages/core/src/temporal/activities.ts` → `runBattery10_GoalHijack`
  - **Scope:** Goal-hijack adversarial vectors through the shared adversarial battery runner.
  - **Status:** Implemented activity and included in default certification subset.

- **Feature:** Battery 11 — Tool Misuse
  - **Location:** `packages/core/src/temporal/activities.ts` → `runBattery11_ToolMisuse`
  - **Scope:** Tool misuse and privilege-escalation adversarial vectors.
  - **Status:** Implemented activity and included in default certification subset.

- **Feature:** Battery 12 — Memory Poison
  - **Location:** `packages/core/src/temporal/activities.ts` → `runBattery12_MemoryPoison`
  - **Scope:** Memory poisoning adversarial vectors.
  - **Status:** Implemented activity and included in default certification subset.

- **Feature:** Battery 13 — Supply Chain
  - **Location:** `packages/core/src/temporal/activities.ts` → `runBattery13_SupplyChain`
  - **Scope:** Supply-chain adversarial vectors.
  - **Status:** Implemented activity and included in default certification subset.

- **Feature:** Battery 14 — Indirect Injection
  - **Location:** `packages/core/src/temporal/activities.ts` → `runBattery14_IndirectInjection`; `packages/core/src/core/engine/activities.ts` → `runBattery14IndirectInjection`
  - **Scope:** Indirect-injection adversarial checks through the core engine activity implementation.
  - **Status:** Implemented activity and included in default certification subset.

## Domain: Code Quality & Infrastructure

- **Feature:** Battery 5 — Full Unit / Module
  - **Location:** `packages/core/src/temporal/activities.ts` → `runBattery5_FullUnit`
  - **Scope:** Isolated npm/Vitest execution with sanitized environment handling.
  - **Status:** Implemented activity.

- **Feature:** Battery 6 — Unsafe Gate
  - **Location:** `packages/core/src/temporal/activities.ts` → `runBattery6_UnsafeGate`
  - **Scope:** Verifies unsafe environment lockdown by intentionally clearing required safety environment variables and expecting `SystemLockdownError`.
  - **Status:** Implemented activity.

- **Feature:** Battery 7 — Playwright E2E
  - **Location:** `packages/core/src/temporal/activities.ts` → `runBattery7_PlaywrightE2E`
  - **Scope:** Executes Playwright against `config.targetEndpoint` when a target endpoint is provided.
  - **Status:** Implemented activity with runtime dependency on reachable target endpoint and Playwright availability.

- **Feature:** Battery 8 — Asset Smoke
  - **Location:** `packages/core/src/temporal/activities.ts` → `runBattery8_AssetSmoke`
  - **Scope:** Checks core static assets against local targets and uses deterministic simulation for non-local targets.
  - **Status:** Implemented activity.

- **Feature:** Battery 9 — Integration Handshake
  - **Location:** `packages/core/src/temporal/activities.ts` → `runBattery9_IntegrationHandshake`
  - **Scope:** Validates Temporal activity execution context and Supabase `armageddon_events` access when credentials are present.
  - **Status:** Implemented activity with runtime dependency on Supabase credentials for database proof.
