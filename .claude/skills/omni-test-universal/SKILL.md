---
name: omni-test-universal
description: Vendor-agnostic, AI-agnostic omniscient software testing intelligence protocol. Works with Claude, GPT-4, Gemini, Llama, Mistral, Cursor, Copilot, or any human QA team. Covers all 24 software test types: unit, integration, E2E, API contract, performance, stress, security SAST/DAST, fuzz, snapshot, accessibility, visual regression, mutation, consumer-driven contract, smoke, chaos/resilience, data integrity, AI/LLM behavioral, mobile, CLI, smart contract, compliance, observability, and synthetic monitoring. No framework, language, or cloud lock-in. Includes universal test pyramid, CI/CD pipeline design, selector strategy, anti-patterns, coverage targets, and AI prompting templates for any model.
version: 3.0
license: MIT
---

# ⚡ OMNI-TEST UNIVERSAL v3.0
## Vendor-Agnostic Software Testing Intelligence Protocol
### Works with: Claude · GPT-4 · Gemini · Llama · Mistral · Any AI · Any Human QA Team

---

## 🌐 WHAT THIS IS

**OMNI-TEST UNIVERSAL** is a complete, tool-agnostic, AI-agnostic software testing intelligence protocol. It defines *how to think about testing*, *what to test*, *how to test it*, and *how to validate quality* — without being tied to any specific AI model, testing framework, language, or vendor.

**Import this into:**
- Any AI assistant's system prompt or custom instructions
- Any QA team's testing handbook
- Any engineering organization's quality standards doc
- Any CI/CD platform's quality gate definitions
- `.cursorrules`, `copilot-instructions.md`, or any LLM-powered coding assistant

---

## 🧭 CORE PHILOSOPHY — The 7 Laws of Omniscient Testing

**LAW 1 — Test the behavior, not the implementation.**
Tests describe what the system does for users, not how the code is structured. Tests that break when you rename a variable are waste.

**LAW 2 — Every test must be able to fail.**
A test that can never fail is not a test — it's a liability. Run mutation testing regularly to confirm your tests actually catch bugs.

**LAW 3 — Tests are first-class citizens.**
Test code gets the same code review, documentation, and refactoring attention as production code. Test debt compounds faster than product debt.

**LAW 4 — Isolate what you control, mock what you don't.**
Unit tests mock all I/O. Integration tests use real dependencies in isolated environments. Production tests observe but never mutate.

**LAW 5 — Fast feedback is a competitive advantage.**
Unit tests: <100ms each. Integration tests: <5s each. E2E tests: <60s per flow. Anything slower gets parallelized or promoted to a separate pipeline.

**LAW 6 — Shift left AND shift right.**
Shift left: catch bugs before production. Shift right: monitor production continuously to catch what slipped through.

**LAW 7 — Security, accessibility, and performance are requirements, not options.**
They go in the same pipeline as functional tests, not a separate "someday" backlog.

---

## ⚙️ UNIVERSAL PRE-TEST PROTOCOL

**Run before starting ANY testing engagement:**

```
PHASE 1: UNDERSTAND THE SYSTEM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Q1:  SUT Type:
     [ ] Web App  [ ] Mobile App  [ ] REST/GraphQL API
     [ ] CLI Tool  [ ] Desktop App  [ ] Microservice
     [ ] Data Pipeline  [ ] AI/ML System  [ ] Smart Contract
     [ ] Embedded/IoT  [ ] Library/SDK

Q2:  Technology stack: Language ___  Framework ___  DB ___  Infra ___

Q3:  Scale: Concurrent users ___  Requests/sec ___  Data volume ___

PHASE 2: DEFINE WHAT CANNOT BREAK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Q4:  Top 5 business invariants (rules that MUST always be true):
     1. _____________________________________________
     2. _____________________________________________
     3. _____________________________________________
     4. _____________________________________________
     5. _____________________________________________

Q5:  Known failure modes and past incidents: ___________

Q6:  Data states: valid, invalid, boundary, null, overflow cases: ___

PHASE 3: MAP THE RISK LANDSCAPE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Q7:  Risk profile:
     [ ] Financial (payments, billing, pricing)
     [ ] Security (auth, PII, sensitive data)
     [ ] Data integrity (corruption, loss, inconsistency)
     [ ] Compliance (GDPR, HIPAA, SOC2, PCI-DSS)
     [ ] UX/reputation (visible to end users)
     [ ] Infrastructure (uptime, recovery, failover)

Q8:  External dependencies: APIs ___ DBs ___ Queues ___ 3rd-party ___

PHASE 4: SCOPE THE EFFORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Q9:  Test types required (see matrix below)
Q10: Coverage targets: Unit ___% Integration ___% 
Q11: Tooling already in place: ___________________
Q12: Timeline and team capacity: _________________
```

---

## 📊 THE UNIVERSAL 24-TYPE TEST MATRIX

### TIER 1 — FUNCTIONAL (Always Required)

**1. UNIT TESTS**
- **Purpose:** Verify individual functions, methods, classes in isolation — zero I/O, zero network
- **Standard:** AAA (Arrange-Act-Assert). One behavior per test. No side effects.
- **Target:** 80%+ line coverage on all business logic
- **Speed:** < 100ms per test
- **Tools:** pytest (Python) · Jest/Vitest (JS) · JUnit 5 (Java) · go test (Go) · RSpec (Ruby) · xUnit (C#)

**2. INTEGRATION TESTS**
- **Purpose:** Verify components wire together correctly with real dependencies
- **Standard:** Use real ephemeral DBs/services via Docker. Reset state between tests.
- **Pattern:** Seed → Act → Assert → Teardown
- **Speed:** < 5s per test

**3. END-TO-END (E2E) TESTS**
- **Purpose:** Verify complete user journeys from UI to database and back
- **Scope:** Top 5-10 critical user flows only (not exhaustive)
- **Standard:** Page Object Model. Role-based selectors. No hardcoded waits.
- **Tools:** Playwright (web) · Appium/Maestro (mobile) · custom (API)

**4. API CONTRACT TESTS**
- **Purpose:** Verify API schema, behavior, and backward compatibility
- **Standard:** Consumer-Driven Contract (CDC) with Pact or OpenAPI schema validation
- **Tools:** Pact · Schemathesis · Dredd · Postman/Newman

**5. SMOKE TESTS**
- **Purpose:** Confirm the system is alive after every deployment
- **Standard:** 3-5 critical paths only. Must complete in < 2 minutes. Block deploy on failure.
- **Trigger:** Automatically on every deployment to any environment

---

### TIER 2 — NON-FUNCTIONAL (Required Before Launch)

**6. PERFORMANCE / LOAD TESTS**
- **Purpose:** Verify system meets latency and throughput targets under expected load
- **SLO baselines:** p50 < 200ms · p95 < 500ms · p99 < 1000ms · error rate < 0.1%
- **Pattern:** Baseline → Ramp → Steady State → Spike → Recovery
- **Tools:** k6 · Locust · Artillery · JMeter · Gatling

**7. STRESS TESTS**
- **Purpose:** Find the breaking point. Understand failure mode under extreme load.
- **Goal:** System degrades gracefully (returns errors) rather than corrupting data

**8. SECURITY — SAST (Static Analysis)**
- **Purpose:** Find vulnerabilities in code without running it
- **Must check:** Injection, hardcoded secrets, insecure deps, weak crypto
- **Tools:** Semgrep · Snyk · Bandit (Python) · ESLint-security (JS) · CodeQL
- **Trigger:** Every PR

**9. SECURITY — DAST (Dynamic Analysis)**
- **Purpose:** Find vulnerabilities by attacking the running system
- **Must check:** OWASP Top 10 (SQLi, XSS, IDOR, CSRF, broken auth)
- **Tools:** OWASP ZAP · Burp Suite · Nuclei
- **Trigger:** Staging gate before every production release

**10. ACCESSIBILITY (a11y)**
- **Purpose:** WCAG 2.1 AA compliance — legally required in many jurisdictions
- **Must check:** Color contrast, keyboard nav, screen reader, focus management
- **Target:** Zero critical/serious violations
- **Tools:** axe-core · Pa11y · Lighthouse

**11. VISUAL REGRESSION**
- **Purpose:** Detect unintended visual changes to UI
- **Standard:** Screenshot baseline comparison with pixel-diff threshold
- **Tools:** Playwright screenshots · Percy · Chromatic · Applitools

---

### TIER 3 — ADVANCED QUALITY (Production-Grade Systems)

**12. FUZZ TESTING**
- **Purpose:** Feed random/malformed/adversarial inputs to find crashes
- **Invariant:** No input should ever cause a 500 or data corruption
- **Tools:** Hypothesis (Python) · fast-check (JS) · libFuzzer · AFL++

**13. MUTATION TESTING**
- **Purpose:** Verify tests actually catch real bugs via artificial mutations
- **Target mutation score:** > 70% (80%+ for critical modules)
- **Tools:** Stryker (JS/TS) · mutmut (Python) · PITest (Java)

**14. CONSUMER-DRIVEN CONTRACT TESTS**
- **Purpose:** Safely evolve APIs across team boundaries
- **Standard:** Consumer defines expected behavior; provider verifies it
- **Tools:** Pact (multi-language) · Spring Cloud Contract (Java)

**15. CHAOS / RESILIENCE TESTS**
- **Experiments:** Kill instances → Inject latency → Fill disk → Inject DB errors
- **Tools:** Chaos Toolkit · Chaos Mesh · Gremlin · AWS FIS

**16. DATA INTEGRITY TESTS**
- **Purpose:** Verify DB state is consistent after all operations
- **Tools:** Great Expectations (Python) · dbt tests · custom SQL assertions

**17. AI/LLM BEHAVIORAL TESTS**
- **Must check:** Relevancy · Faithfulness · Safety · Consistency · Latency
- **Tools:** DeepEval · Promptfoo · Braintrust · RAGAS

**18. MOBILE NATIVE TESTS**
- **Tools:** Detox (React Native) · XCUITest (iOS) · Espresso (Android) · Maestro

**19. CLI TESTS**
- **Standard:** Test every flag, every error condition, stdin/stdout, exit codes
- **Pattern:** subprocess execution + output assertion + exit code check

**20. SMART CONTRACT TESTS**
- **Must check:** Invariants, access control, reentrancy, integer overflow
- **Tools:** Hardhat/Foundry (Solidity) · Brownie/Ape (Python)

**21. COMPLIANCE TESTS**
- **Covers:** GDPR (deletion, consent) · HIPAA (audit, encryption) · PCI-DSS

**22. OBSERVABILITY TESTS**
- **Purpose:** Logs, metrics, traces emit correctly and completely
- **Tools:** Custom assertions + OpenTelemetry + metric endpoint checks

**23. SYNTHETIC MONITORING**
- **Purpose:** Continuously verify production SLOs 24/7
- **Pattern:** Scheduled E2E subset every 1-5 minutes against production
- **Tools:** Checkly · Playwright (cron) · Datadog Synthetics

**24. AUDIT TRAIL TESTS**
- **Purpose:** Tamper-proof audit logs for regulated actions
- **Must check:** Who/what/when/outcome logged · logs immutable

---

## 🏗️ THE UNIVERSAL TEST PYRAMID

```
                    ▲
                   / \
                  / E2E \          ← 5-10% | Slowest | Most confidence
                 /  (10)  \          Playwright, Appium, Maestro
                /───────────\
               /             \
              /  Integration   \   ← 20-30% | Medium speed
             /    (20-30)       \    Real DBs, real APIs, Docker
            /─────────────────────\
           /                       \
          /      Unit Tests          \ ← 60-70% | Fastest | Most granular
         /       (60-70+)             \  Pure logic, business rules
        /─────────────────────────────────\

ALWAYS RUNNING (below the pyramid):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Security SAST      → Every commit
  Dependency scan    → Every commit
  Smoke tests        → Every deployment
  Synthetic monitor  → Every 1-5 min in production
```

---

## 🔄 UNIVERSAL CI/CD PIPELINE DESIGN

```
STAGE 1: PRE-COMMIT (<30s, developer machine)
  [ ] Linting + formatting
  [ ] Type checking
  [ ] Unit tests (affected files only)
  [ ] Secret detection

STAGE 2: PULL REQUEST (<5min, CI server)
  [ ] Full unit test suite + coverage gate
  [ ] Integration tests
  [ ] Security SAST scan
  [ ] Dependency vulnerability scan
  [ ] Visual regression (UI changes only)
  [ ] a11y tests (UI changes only)

STAGE 3: STAGING DEPLOY (<15min, post-merge)
  [ ] Smoke tests
  [ ] Full E2E suite
  [ ] API contract tests
  [ ] Security DAST scan
  [ ] Performance baseline check

STAGE 4: PRODUCTION GATE (<5min, before traffic shift)
  [ ] Smoke tests against production canary
  [ ] SLO assertions

STAGE 5: POST-DEPLOY (always running)
  [ ] Synthetic monitoring (every 1-5 minutes)
  [ ] Alert on SLO breach
  [ ] Chaos experiments (scheduled, non-peak hours)
  [ ] Weekly: mutation testing, load testing, full security scan
```

---

## ✍️ UNIVERSAL TEST WRITING STANDARDS

### Naming Convention
```
PATTERN: [Given context]_[when action]_[then expected outcome]

✅ GOOD:
  test_order_creation_fails_when_product_is_out_of_stock
  should_return_401_when_jwt_token_is_expired
  displays_error_message_when_form_submitted_without_email

❌ BAD:
  test_order_1 | test_login_function | checkPayment
```

### AAA Pattern
```
ARRANGE:  Set up the world — objects, data, mocks
ACT:      Execute exactly ONE behavior
ASSERT:   Verify exactly ONE expected outcome

Rules:
- One behavior per test
- Minimum one assertion per test
- Must run in any order (no shared mutable state)
```

### F.I.R.S.T. Principles
```
FAST:            Tests run in milliseconds
ISOLATED:        No dependency on other tests or shared state
REPEATABLE:      Same result every time, in any environment
SELF-VALIDATING: Binary pass/fail — no manual inspection
TIMELY:          Written alongside (or before) production code
```

---

## 🎯 INTELLIGENT SELECTOR STRATEGY (UI Testing)

```
PRIORITY 1: Semantic role + accessible name
  getByRole('button', { name: 'Submit Order' })
  → Survives redesigns; validates accessibility simultaneously

PRIORITY 2: Form label
  getByLabel('Email address')
  → Tied to UX, not implementation

PRIORITY 3: Visible text
  getByText('Order Confirmed')
  → Survives structural changes

PRIORITY 4: Explicit test ID
  getByTestId('checkout-submit-btn')  [data-testid attribute]
  → Stable but requires code change

PRIORITY 5: Stable CSS ID
  locator('#checkout-form')
  → Only if ID is semantic and stable

❌ NEVER USE:
  nth-child(3)         → Breaks when order changes
  Auto-generated IDs   → Change on every build
  XPath               → Brittle and unreadable
  Pixel coordinates   → Break on resolution change
```

---

## ⚠️ THE 10 MOST DANGEROUS TEST ANTI-PATTERNS

| Anti-Pattern | Why It's Lethal | Fix |
|-------------|----------------|-----|
| Test that can't fail | False confidence | Run mutation testing to verify |
| Shared mutable state | Tests interfere | Isolate + reset in fixture |
| Hardcoded sleep | Flaky everywhere | Event-driven waits only |
| Testing implementation | Breaks on refactor | Assert behavior, not internals |
| No assertions | Passes anything | Minimum 1 assertion per test |
| God test (200+ lines) | Hard to debug | Split into focused tests |
| Magic numbers | Unclear intent | Name your constants |
| Ignored/skipped tests | Dead code, false safety | Fix or delete immediately |
| Order-dependent tests | Unpredictable parallel | Each test sets up own state |
| Testing the framework | Wasted effort | Only test YOUR code |

---

## 📐 COVERAGE TARGETS BY CRITICALITY

| Criticality | Unit | Integration | E2E | Mutation Score |
|------------|------|-------------|-----|----------------|
| 🔴 Critical (payments, auth, medical) | 90%+ | 80%+ | All flows | 80%+ |
| 🟡 High (core product features) | 80%+ | 70%+ | Critical flows | 70%+ |
| 🟢 Standard (internal tools, admin) | 70%+ | 60%+ | Happy paths | 60%+ |
| 🔵 Experimental (prototypes) | 50%+ | Key paths | None | N/A |

---

## 🤖 UNIVERSAL AI PROMPTING TEMPLATE

Use with Claude, GPT-4, Gemini, or any AI:

```
CONTEXT:
System type: [web app / API / mobile / CLI / data pipeline / AI system]
Language/Framework: [e.g., Python/FastAPI, TypeScript/Next.js]
Component to test: [paste code or description]

REQUIRED TEST TYPES:
- Unit tests covering: [list specific scenarios]
- Integration tests for: [specify boundaries]
- [Other types from the 24-type matrix above]

CONSTRAINTS:
- Test framework: [pytest / Jest / other]
- Must be runnable without modification
- No placeholders or TODOs

QUALITY REQUIREMENTS:
- AAA pattern
- Descriptive test names (Given/When/Then format)
- Happy path + 2+ edge cases + 1+ failure mode
- Coverage target: [X]%
- Include CI snippet

OUTPUT FORMAT:
1. Complete, runnable test file(s)
2. Setup/dependency instructions
3. CI integration snippet
4. List of remaining coverage gaps
```

---

## 📚 TOOL SELECTION MATRIX

| Need | Best Options | Selection Criteria |
|------|-------------|-------------------|
| Unit testing | pytest · Jest · JUnit · go test · RSpec | Match language ecosystem |
| E2E browser | Playwright · Cypress | Playwright for multi-browser + Python |
| Mobile E2E | Maestro · Detox · Appium | Maestro for simplicity; Appium for multi-platform |
| Load testing | k6 · Locust · Artillery | k6 for JS scripting; Locust for Python |
| Security SAST | Semgrep · Bandit · CodeQL | Semgrep for multi-language |
| Security DAST | OWASP ZAP · Burp | ZAP for automation; Burp for manual |
| Fuzzing | Hypothesis · fast-check | Match your language |
| Mutation | mutmut · Stryker · PITest | Match your language |
| a11y | axe-core · Pa11y | axe for programmatic; Pa11y for CI |
| Visual regression | Playwright · Percy · Chromatic | Playwright for self-hosted |
| Contract testing | Pact | Multi-language; industry standard |
| AI/LLM testing | DeepEval · Promptfoo | DeepEval for Python; Promptfoo for config |

---

## ✅ UNIVERSAL QUALITY CHECKLIST

```
COMPLETENESS
[ ] Happy path tested
[ ] All edge cases identified and tested
[ ] All failure modes tested (network, DB, invalid input)
[ ] Boundary conditions tested (empty, max, overflow, null)

QUALITY
[ ] Every test CAN fail (verified by manually breaking code)
[ ] Test names describe behavior under test
[ ] No hardcoded sleeps — event-driven waits only
[ ] No shared mutable state between tests
[ ] Symmetric setup and teardown

SECURITY & NON-FUNCTIONAL
[ ] Auth/authz tested (protected routes reject unauthenticated)
[ ] Input validation tested (no injection vulnerabilities)
[ ] Performance baseline established
[ ] Accessibility checked (if UI)

CI/CD INTEGRATION
[ ] Tests run in CI pipeline
[ ] Coverage gate enforced
[ ] Failure blocks deployment
[ ] Evidence collected on failure (screenshots, logs, traces)

MAINTAINABILITY
[ ] Test code reviewed as rigorously as production code
[ ] Zero flaky tests tolerated
[ ] Non-obvious setup documented
```

---

*OMNI-TEST UNIVERSAL v3.0 | Vendor-Agnostic | APEX-OmniHub Quality Standards*
*Compatible with: Any AI Model · Any Language · Any Framework · Any CI Platform*
