# Feature Registry — ARMAGEDDON Test Suite

**Docs version**: 2026.05.17<br>
**Last updated**: 2026-05-17<br>
**Scope**: Armageddon Level 7 certification engine surfaces verified against `armageddon-core/src/temporal/activities.ts`, `armageddon-core/src/temporal/workflows.ts`, `armageddon-core/src/core/attestation.ts`, and `packages/shared/src/gate.ts`.

## Domain: Cryptographic Attestation (NEW)

- **Feature:** Tamper-Evident Certification Receipts
  - **Location:** `armageddon-core/src/core/attestation.ts`, `armageddon-core/src/core/evidence-generator.ts`
  - **Scope:** Ed25519 detached signatures + RFC 6962 SHA-256 Merkle audit tree over every battery result and run metadata; embedded in `report.json`, `certificate.txt`, `report.md`, `manifest.json`; emitted as standalone `attestation.json` + executable zero-dependency `verify.mjs`.
  - **Status:** Implemented and validated end-to-end. Compliance alignment: EU AI Act Article 12 (Aug 2026), CAP-SRP v1.0, RFC 6962, NIST AI RMF.

- **Feature:** Attestation Public-Key Endpoint
  - **Location:** `armageddon-site/src/app/api/attestation/pubkey/route.ts`, `armageddon-site/src/lib/attestation-pubkey.ts`
  - **Scope:** `GET /api/attestation/pubkey` (Node runtime, 24h immutable cache) publishes the Ed25519 verification key derived from `ARMAGEDDON_ATTESTATION_SEED`. Fails closed with HTTP 503 when no seed is configured.
  - **Status:** Implemented and live-tested.

- **Feature:** Attestation Status Badge (UI)
  - **Location:** `armageddon-site/src/components/AttestationBadge.tsx`
  - **Scope:** Surfaces `OFFLINE_VERIFY` / `EPHEMERAL_KEY` / `KEY_UNAVAILABLE` in the Destruction Console header. Powers the cryptographic-evidence narrative in the exported JSON bundle.
  - **Status:** Implemented and validated via jsdom unit tests.

## Certification Execution Defaults

| Surface | Verified state |
| --- | --- |
| Default certification subset | `B10`, `B11`, `B12`, `B13`, `B14` |
| Temporal workflow default | `ArmageddonLevel7Workflow` defaults to `B10` through `B14` when no battery selection is provided. |
| UI display grid | `packages/shared/src/batteries.ts` exports thirteen presentation batteries with IDs `01` through `13`. |
| Battery activity coverage | Temporal activities expose handlers for `B1` through `B14`. |

## Domain: Chaos & Stress

- **Feature:** Battery 1 — Chaos Stress
  - **Location:** `armageddon-core/src/temporal/activities.ts` → `runBattery1_ChaosStress`
  - **Scope:** Stress test execution against the configured target endpoint.
  - **Status:** Implemented activity.

- **Feature:** Battery 2 — Chaos Engine
  - **Location:** `armageddon-core/src/temporal/activities.ts` → `runBattery2_ChaosEngine`
  - **Scope:** Deterministic chaos-engine and safety simulation checks.
  - **Status:** Implemented activity.

## Domain: Security & Defense

- **Feature:** Battery 3 — Prompt Injection
  - **Location:** `armageddon-core/src/temporal/activities.ts` → `runBattery3_PromptInjection`
  - **Scope:** Prompt-injection pattern simulation and detection scoring.
  - **Status:** Implemented activity.

- **Feature:** Battery 4 — Security & Auth
  - **Location:** `armageddon-core/src/temporal/activities.ts` → `runBattery4_SecurityAuth`
  - **Scope:** CSRF, XSS, session fixation, and brute-force rate-limit checks.
  - **Status:** Implemented activity.

- **Feature:** Battery 10 — Goal Hijack
  - **Location:** `armageddon-core/src/temporal/activities.ts` → `runBattery10_GoalHijack`
  - **Scope:** Goal-hijack adversarial vectors through the shared adversarial battery runner.
  - **Status:** Implemented activity and included in default certification subset.

- **Feature:** Battery 11 — Tool Misuse
  - **Location:** `armageddon-core/src/temporal/activities.ts` → `runBattery11_ToolMisuse`
  - **Scope:** Tool misuse and privilege-escalation adversarial vectors.
  - **Status:** Implemented activity and included in default certification subset.

- **Feature:** Battery 12 — Memory Poison
  - **Location:** `armageddon-core/src/temporal/activities.ts` → `runBattery12_MemoryPoison`
  - **Scope:** Memory poisoning adversarial vectors.
  - **Status:** Implemented activity and included in default certification subset.

- **Feature:** Battery 13 — Supply Chain
  - **Location:** `armageddon-core/src/temporal/activities.ts` → `runBattery13_SupplyChain`
  - **Scope:** Supply-chain adversarial vectors.
  - **Status:** Implemented activity and included in default certification subset.

- **Feature:** Battery 14 — Indirect Injection
  - **Location:** `armageddon-core/src/temporal/activities.ts` → `runBattery14_IndirectInjection`; `armageddon-core/src/core/engine/activities.ts` → `runBattery14IndirectInjection`
  - **Scope:** Indirect-injection adversarial checks through the core engine activity implementation.
  - **Status:** Implemented activity and included in default certification subset.

## Domain: Code Quality & Infrastructure

- **Feature:** Battery 5 — Full Unit / Module
  - **Location:** `armageddon-core/src/temporal/activities.ts` → `runBattery5_FullUnit`
  - **Scope:** Isolated npm/Vitest execution with sanitized environment handling.
  - **Status:** Implemented activity.

- **Feature:** Battery 6 — Unsafe Gate
  - **Location:** `armageddon-core/src/temporal/activities.ts` → `runBattery6_UnsafeGate`
  - **Scope:** Verifies unsafe environment lockdown by intentionally clearing required safety environment variables and expecting `SystemLockdownError`.
  - **Status:** Implemented activity.

- **Feature:** Battery 7 — Playwright E2E
  - **Location:** `armageddon-core/src/temporal/activities.ts` → `runBattery7_PlaywrightE2E`
  - **Scope:** Executes Playwright against `config.targetEndpoint` when a target endpoint is provided.
  - **Status:** Implemented activity with runtime dependency on reachable target endpoint and Playwright availability.

- **Feature:** Battery 8 — Asset Smoke
  - **Location:** `armageddon-core/src/temporal/activities.ts` → `runBattery8_AssetSmoke`
  - **Scope:** Checks core static assets against local targets and uses deterministic simulation for non-local targets.
  - **Status:** Implemented activity.

- **Feature:** Battery 9 — Integration Handshake
  - **Location:** `armageddon-core/src/temporal/activities.ts` → `runBattery9_IntegrationHandshake`
  - **Scope:** Validates Temporal activity execution context and Supabase `armageddon_events` access when credentials are present.
  - **Status:** Implemented activity with runtime dependency on Supabase credentials for database proof.
