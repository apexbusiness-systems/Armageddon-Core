# JULES-ARMAGEDDON-PLAN.md

## Phase 0: Reconnaissance & Gap Analysis

**Objective:** Verify existing components and identify gaps for Armageddon Test Suite Certification (ATSC).

**Findings:**
- [SKIP] `bin/armageddon.ts`: Implemented (run, verify, certify commands).
- [SKIP] `src/core/safety.ts`: Implemented (`SafetyGuard`, `assertNoProductionMatch`).
- [SKIP] `src/temporal/activities.ts`:
  - Battery 1 (Chaos Stress): Implemented (`runStressTest`).
  - Battery 5 (Full Unit): Implemented (`npm run test`).
  - Battery 6 (Unsafe Gate): Implemented (`runBattery6_UnsafeGate`).
  - Battery 9 (Integration Handshake): Implemented (`runBattery9_IntegrationHandshake`).
  - Batteries 10-13 (Level 7): Implemented via `runGenericAdversarialBattery`.
- [SKIP] `src/core/evidence-generator.ts`: Implemented (implied by usage).
- [IMPL] `BatteryConfig`: Missing `seed` property for deterministic execution across all batteries.
- [IMPL] Battery 2, 3, 4, 7, 8: Stubbed in `activities.ts`.
- [IMPL] `armageddon-site`: Basic structure exists, missing `/dry-run` and `/docs`.

## Phase 1: Core Batteries Implementation

**Objective:** Implement missing core batteries (2, 3, 4, 7, 8) with deterministic execution.

**Tasks:**
1. [IMPL] **Dependencies**: Install `playwright` in `armageddon-core` for Battery 7.
2. [IMPL] **Configuration**: Add `seed: number` to `BatteryConfig` in `src/temporal/activities.ts` and propagate from `bin/armageddon.ts`.
3. [IMPL] **Battery 2 (Chaos Engine Unit)**: Implement `runBattery2_ChaosEngine` to test idempotency and deduplication using seeded RNG.
4. [IMPL] **Battery 3 (Prompt Injection)**: Implement `runBattery3_PromptInjection` using `INJECTION_PATTERNS` from `src/temporal/prompts.ts`.
5. [IMPL] **Battery 4 (Security & Auth E2E)**: Implement `runBattery4_SecurityAuth` to simulate CSRF/XSS attacks.
6. [IMPL] **Battery 7 (Playwright E2E)**: Create `tests/e2e/battery-7.spec.ts` and update `runBattery7_PlaywrightE2E` to execute it.
7. [IMPL] **Battery 8 (Asset Smoke)**: Implement `runBattery8_AssetSmoke` to fetch assets from `targetEndpoint`.

**Dependency Graph:**
`Install Dependencies` -> `Update Configuration` -> `Implement Batteries 2-8`

## Phase 2: Level 7 "God Mode" Refinement

**Objective:** Ensure Level 7 batteries (10-13) are deterministic and correctly integrated.

**Tasks:**
1. [VERIFY] **Workflow**: Review `ArmageddonLevel7Workflow` in `src/temporal/workflows.ts` to ensure it passes `seed` to activities.
2. [VERIFY] **Adversarial Engine**: Ensure `runGenericAdversarialBattery` uses `seed` for `SimulationAdapter` / `LiveFireAdapter` initialization.

**Dependency Graph:**
`Update Configuration` -> `Verify Workflow` -> `Verify Adversarial Engine`

## Phase 3: GTM Website Implementation

**Objective:** meaningful GTM website for armageddon.icu (mapped to `armageddon-site`).

**Tasks:**
1. [IMPL] **Homepage**: Update `armageddon-site/src/app/page.tsx` with Hero, How It Works, Tiers, Legal Footer.
2. [IMPL] **Dry Run**: Create `armageddon-site/src/app/dry-run/page.tsx` and `api/armageddon/dry-run/route.ts` for interactive simulation.
3. [IMPL] **Docs**: Create `armageddon-site/src/app/docs/batteries/page.tsx` for battery deep dives.

**Dependency Graph:**
`Homepage` -> `Dry Run` -> `Docs`

## Phase 4: Validation & Reporting

**Objective:** Validate the implementation against all constraints.

**Tasks:**
1. [VALIDATE] **Determinism**: Run `armageddon run --seed=42` twice, compare `report.json`.
2. [VALIDATE] **Concurrency**: Check logs for overlapping timestamps.
3. [VALIDATE] **Safety Gate**: Run `armageddon run --mode=destructive` without flags (expect fail/block).
4. [VALIDATE] **Level 7**: Check escape rates and telemetry.
5. [REPORT] Generate `JULES-VALIDATION.md`.
