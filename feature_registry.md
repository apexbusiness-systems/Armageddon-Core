# Feature Registry - ARMAGEDDON Test Suite

**Last Updated:** 2026-01-25
**Scope:** Armageddon Level 7 Certification Engine

## Domain: Chaos & Stress
- **Feature:** Battery 1 - Chaos Stress
  - **Location:** `src/temporal/activities.ts` -> `runBattery1_ChaosStress`
  - **Scope:** Simulation of network failures, timeouts, auth churn.
  - **Status:** ✅ Optimized Simulation
  - **Notes:** Uses `SeedableRNG` for deterministic replay.

- **Feature:** Battery 2 - Chaos Engine
  - **Location:** `src/temporal/activities.ts` -> `runBattery2_ChaosEngine`
  - **Scope:** Simulation of idempotency, dedupe, guardrails.
  - **Status:** ✅ Optimized Simulation
  - **Notes:** Uses `SeedableRNG`.

## Domain: Security & Defense
- **Feature:** Battery 3 - Prompt Injection
  - **Location:** `src/temporal/activities.ts` -> `runBattery3_PromptInjection`
  - **Scope:** Simulation of prompt injection patterns.
  - **Status:** ✅ Stable Simulation
  - **Notes:** Iterates through `INJECTION_PATTERNS`.

- **Feature:** Battery 4 - Security & Auth
  - **Location:** `src/temporal/activities.ts` -> `runBattery4_SecurityAuth`
  - **Scope:** Simulation of CSRF and auth failures.
  - **Status:** ✅ Stable Simulation
  - **Notes:** Hardcoded success paths.

- **Feature:** Battery 10 - Goal Hijack
  - **Location:** `src/temporal/activities.ts` -> `runBattery10_GoalHijack`
  - **Scope:** Simulation of PAIR/Tree-of-Attacks.
  - **Status:** ✅ Optimized Simulation
  - **Notes:** Uses `SeedableRNG` for mutation logic.

- **Feature:** Battery 11 - Tool Misuse
  - **Location:** `src/temporal/activities.ts` -> `runBattery11_ToolMisuse`
  - **Scope:** Simulation of privilege escalation (SQL/API).
  - **Status:** ✅ Stable Simulation
  - **Notes:** Contains mock detection logic for SQL injection.

- **Feature:** Battery 12 - Memory Poison
  - **Location:** `src/temporal/activities.ts` -> `runBattery12_MemoryPoison`
  - **Scope:** Simulation of Vector DB corruption.
  - **Status:** ✅ Stable Simulation

- **Feature:** Battery 13 - Supply Chain
  - **Location:** `src/temporal/activities.ts` -> `runBattery13_SupplyChain`
  - **Scope:** Simulation of dependency injection.
  - **Status:** ✅ Stable Simulation

## Domain: Code Quality & Infrastructure
- **Feature:** Battery 5 - Full Unit / Module
  - **Location:** `src/temporal/activities.ts` -> `runBattery5_FullUnit`
  - **Scope:** Unit testing of core engine logic (`safety.ts`, `reporter.ts`).
  - **Status:** ✅ REAL EXECUTION
  - **Notes:** Executes `npm test` (Vitest) via child process. Returns actual test results.

- **Feature:** Battery 6 - Unsafe Gate
  - **Location:** `src/temporal/activities.ts` -> `runBattery6_UnsafeGate`
  - **Scope:** Verification of Sandbox Enforcement.
  - **Status:** ✅ Stable Simulation
  - **Notes:** Correctly simulates blocked state when in SIM_MODE.

- **Feature:** Battery 7 - Playwright E2E
  - **Location:** `src/temporal/activities.ts` -> `runBattery7_PlaywrightE2E`
  - **Scope:** Browser automation.
  - **Status:** ⏸️ Infrastructure Dependent
  - **Notes:** Requires running server. Stubs in place.

- **Feature:** Battery 8 - Asset Smoke
  - **Location:** `src/temporal/activities.ts` -> `runBattery8_AssetSmoke`
  - **Scope:** Static asset validation.
  - **Status:** ⚠️ Placeholder

- **Feature:** Battery 9 - Integration
  - **Location:** `src/temporal/activities.ts` -> `runBattery9_IntegrationHandshake`
  - **Scope:** OAuth/Webhook simulation.
  - **Status:** ⚠️ Placeholder
