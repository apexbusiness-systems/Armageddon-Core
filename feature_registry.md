# Feature Registry - ARMAGEDDON Test Suite

**Last Updated:** 2026-02-06  
**Version:** PLATINUM Standard  
**Scope:** Armageddon Level 7 Certification Engine  
**Standards:** APEX-DEV v1.0, APEX-POWER v1.0, WEBAPP-TESTING v1.0, OMNIFINANCE v1.0

---

## Core Architecture

### Tiered Adapter System (NEW)

| Adapter             | Tier      | Description                               |
| ------------------- | --------- | ----------------------------------------- |
| `SimulationAdapter` | FREE      | Deterministic, educational, upsell-driven |
| `LiveFireAdapter`   | CERTIFIED | Real LLM API calls with circuit breakers  |

### Utility Functions

| Function      | Purpose                                      |
| ------------- | -------------------------------------------- |
| `SeedableRNG` | Mulberry32 PRNG for reproducible simulation  |
| `hashString`  | FNV-1a hash for stable prompt→result mapping |

---

## Domain: Chaos & Stress

### Battery 1 - Chaos Stress

- **Location:** `src/temporal/activities.ts` → `runBattery1_ChaosStress`
- **Scope:** Simulation of network failures, timeouts, auth churn
- **Status:** ✅ PLATINUM (Tier-Aware)
- **Notes:** Uses `SeedableRNG`. Mode: `LOAD_TEST_ARTILLERY` (CERTIFIED) / `SIMULATED_SMOKE` (FREE)

### Battery 2 - Chaos Engine

- **Location:** `src/temporal/activities.ts` → `runBattery2_ChaosEngine`
- **Scope:** Simulation of idempotency, dedupe, guardrails
- **Status:** ✅ PLATINUM (Stub)
- **Notes:** Returns deterministic results with `dedupeHitRate: 0.95`

---

## Domain: Security & Defense

### Battery 3 - Prompt Injection

- **Location:** `src/temporal/activities.ts` → `runBattery3_PromptInjection`
- **Scope:** Simulation of prompt injection patterns
- **Status:** ✅ PLATINUM (Stub)
- **Notes:** Iterates through `INJECTION_PATTERNS`

### Battery 4 - Security & Auth

- **Location:** `src/temporal/activities.ts` → `runBattery4_SecurityAuth`
- **Scope:** Simulation of CSRF and auth failures
- **Status:** ✅ PLATINUM (Stub)
- **Notes:** Returns `csrfBlocked: true`

### Battery 10 - Goal Hijack

- **Location:** `src/temporal/activities.ts` → `runBattery10_GoalHijack`
- **Scope:** PAIR/Tree-of-Attacks adversarial testing
- **Status:** ✅ PLATINUM (Strategy Pattern)
- **Notes:** Uses `SimulationAdapter` (FREE) or `LiveFireAdapter` (CERTIFIED). OMNIFINANCE value-gating implemented.

### Battery 11 - Tool Misuse

- **Location:** `src/temporal/activities.ts` → `runBattery11_ToolMisuse`
- **Scope:** Simulation of privilege escalation (SQL/API)
- **Status:** ✅ PLATINUM (Stub)
- **Notes:** Uses `TOOL_ABUSE_VECTORS`

### Battery 12 - Memory Poison

- **Location:** `src/temporal/activities.ts` → `runBattery12_MemoryPoison`
- **Scope:** Simulation of Vector DB corruption
- **Status:** ✅ PLATINUM (Stub)

### Battery 13 - Supply Chain

- **Location:** `src/temporal/activities.ts` → `runBattery13_SupplyChain`
- **Scope:** Simulation of dependency injection
- **Status:** ✅ PLATINUM (Stub)

---

## Domain: Code Quality & Infrastructure

### Battery 5 - Full Unit / Module

- **Location:** `src/temporal/activities.ts` → `runBattery5_FullUnit`
- **Scope:** Unit testing of core engine logic
- **Status:** ✅ PLATINUM (REAL EXECUTION)
- **Notes:** Executes `npm test` via `exec`. CERTIFIED tier uses Docker container isolation. PATH sanitized per APEX-DEV.

### Battery 6 - Unsafe Gate

- **Location:** `src/temporal/activities.ts` → `runBattery6_UnsafeGate`
- **Scope:** Verification of Sandbox Enforcement
- **Status:** ✅ PLATINUM (Stub)
- **Notes:** Returns `gateEnforced: true`

### Battery 7 - Playwright E2E

- **Location:** `src/temporal/activities.ts` → `runBattery7_PlaywrightE2E`
- **Scope:** Browser automation with WEBAPP-TESTING compliance
- **Status:** ✅ PLATINUM (Config-Ready)
- **Notes:** `waitUntil: 'networkidle'` per webapp-testing.md. Stubbed for activity runtime.

### Battery 8 - Asset Smoke

- **Location:** `src/temporal/activities.ts` → `runBattery8_AssetSmoke`
- **Scope:** Static asset validation
- **Status:** ✅ PLATINUM (Stub)

### Battery 9 - Integration Handshake

- **Location:** `src/temporal/activities.ts` → `runBattery9_IntegrationHandshake`
- **Scope:** OAuth/Webhook simulation
- **Status:** ✅ PLATINUM (Stub)

---

## Type Exports

| Type               | Description                                                            |
| ------------------ | ---------------------------------------------------------------------- |
| `OrganizationTier` | `'FREE'` \| `'CERTIFIED'`                                              |
| `AdversarialModel` | `'sim-001'` \| `'gpt-4-turbo'` \| `'claude-3-opus'` \| `'llama-3-70b'` |
| `BatteryConfig`    | Run configuration with `tier` (required) and `targetModel` (optional)  |
| `BatteryResult`    | Standardized result interface                                          |
| `WorkflowState`    | Workflow execution state                                               |
| `ArmageddonReport` | Final certification report                                             |
