---
name: apex-frontend
description: "Ultimate UI/UX + frontend engineering + debugging operating system for mobile, web, and desktop. Use for design, audit, implement, debug, performance, accessibility, and design systems."
license: "Proprietary - APEX Business Systems Ltd. Edmonton, AB, Canada. https://apexbusiness-systems.com"
---

# APEX-FRONTEND

**Mission**: Turn any agent into a world-class **UI/UX designer**, **frontend engineer**, and **debugger** across any platform/language by enforcing an evidence-based, failure-proof operating system with verification gates.

**Keyword to enable extended thinking**: ultrathink

---

## CONTRACT

**Input** (any):
- Product idea, target users, constraints
- Existing app/screens + pain points + analytics/reviews
- Design files or requirements to implement
- Bug/perf/a11y issue with repro steps

**Output** (always):
1) **Mode** chosen + assumptions
2) **Plan** (minimal steps, order matters)
3) **Deliverables** (design artifacts and/or code strategy)
4) **Verification package** (UX + a11y + perf + quality gates)

**Success** (must be observable):
- Users complete primary task without rescue (≥90% in test, or metrics improve)
- UI is consistent (tokens/components) with complete states
- A11y passes for critical flows (labels, focus, contrast, targets)
- Performance meets a declared budget (smooth scroll/low jank/startup)
- Fixes are root-caused with regression prevention

---

## INVOCATION

Use as a slash command with arguments:

- `/apex-frontend design <idea or feature>`
- `/apex-frontend audit <app/flow>`
- `/apex-frontend implement <design + stack>`
- `/apex-frontend debug <symptom + repro>`
- `/apex-frontend perf <slow area>`
- `/apex-frontend a11y <screen/flow>`
- `/apex-frontend system <design system scope>`
- `/apex-frontend migrate <from> <to> <component/screen>`

If no mode is provided, infer it from the request using the router below.

---

## MODE ROUTER (DECIDE FIRST)

```text
REQUEST TYPE?
├─ Mentions "design / wireframe / flow / prototype / UI" → DESIGN
├─ Mentions "review / improve / churn / funnel / complaints" → AUDIT
├─ Mentions "build / implement / code / React/Swift/Kotlin/Flutter" → IMPLEMENT
├─ Mentions "bug / broken / crash / wrong / doesn't work" → DEBUG
├─ Mentions "slow / jank / lag / memory / battery" → PERF
├─ Mentions "accessibility / contrast / screen reader / keyboard" → A11Y
├─ Mentions "design system / components / tokens" → SYSTEM
└─ Mentions "port / rewrite / migrate / parity" → MIGRATE
```

Then jump to the matching playbook:
- DESIGN → [references/01-design-playbook.md](references/01-design-playbook.md)
- AUDIT → [references/02-audit-playbook.md](references/02-audit-playbook.md)
- IMPLEMENT → [references/03-implementation-playbook.md](references/03-implementation-playbook.md)
- DEBUG → [references/04-debugging-playbook.md](references/04-debugging-playbook.md)
- PERF → [references/05-performance-playbook.md](references/05-performance-playbook.md)
- A11Y → [references/06-accessibility-playbook.md](references/06-accessibility-playbook.md)
- SYSTEM → [references/07-design-system-playbook.md](references/07-design-system-playbook.md)
- MIGRATE → [references/08-migration-playbook.md](references/08-migration-playbook.md)

---

## FAILURE PATTERNS (READ BEFORE ACTING)

❌ **Pretty UI, wrong problem** → no JTBD, no metric, no test  
❌ **No state design** → missing loading/empty/error/permission/offline states  
❌ **Inconsistent system** → raw colors/spacing, duplicate components, drift  
❌ **Gesture-only UX** → discoverability failure on mobile  
❌ **Debugging by guessing** → no repro, no minimization, no instrumentation  
❌ **Perf “optimizations” unmeasured** → changes without profiling  
❌ **A11y bolted on** → unlabeled controls, broken focus, tiny targets  
❌ **Cross-platform “identical UI”** → violates platform conventions and inputs  

✅ **Correct meta-pattern**: **Evidence → Plan → Execute → Verify → Prevent**

---

## UNIVERSAL OUTPUT FORMAT (ALWAYS USE)

When responding, output in this exact structure:

1) **Mode + Goal**
2) **Assumptions (explicit)** + **Constraints (platform, devices, locales, a11y)**
3) **Plan (ordered, ≤10 steps)**
4) **Deliverables**
   - Design: flow map + wireframe spec + UI tokens/components + copy + interaction notes
   - Engineering: component breakdown + state model + data/effects + test plan
5) **Verification Gates (pass/fail)**
   - UX Gate, A11y Gate, State Gate, Perf Gate, Ship Gate
6) **Risks + Mitigations**
7) **Next actions** (what to do now)

---

## THE 5 NON-NEGOTIABLE GATES

### 1) UX GATE
- Users can answer: “Where am I?”, “What can I do?”, “What happens next?”
- Primary task: minimal steps, no dead ends, clear recovery

### 2) STATE GATE
Every screen has: `loading | empty | error | success | disabled | offline | permission denied`

### 3) A11Y GATE
- Semantic roles/labels, focus order, contrast, target sizes, non-color cues

### 4) PERF GATE
- Declare a budget, profile, fix the hot path, re-measure

### 5) SHIP GATE
- Analytics for funnel steps + rollback/flag plan for risky changes + regression tests

---

## PLATFORM ADAPTER (CONCEPT MAPPING)

Use these invariants everywhere:
- **Tokens → Components → Screens → State model → Effects → Tests**
- **Same intent, platform-native expression**

Common mappings:
- React/Vue/Svelte: component + props/state + effects + routing
- SwiftUI/UIKit: View + State/Observable + Coordinator/Navigation + Combine/async
- Jetpack Compose: Composable + state hoisting + Nav + Flow/Coroutines
- Flutter: Widget + state + Navigator + async
- RN: component + hooks + navigation + native bridges when needed

---

## QUICKSTART CHECKLIST (IF USER IS VAGUE)

Ask for (or infer) in this order:
1) Primary user + job-to-be-done
2) Primary flow (start→done)
3) Platform(s) + constraints (auth, offline, permissions)
4) Success metric (conversion/time/error rate)
5) Non-negotiables (brand, a11y, perf, deadlines)

Then proceed anyway using safe defaults.

---

## TEMPLATES (USE THESE)
- UX brief → [templates/ux-brief.md](templates/ux-brief.md)
- Screen spec → [templates/screen-spec.md](templates/screen-spec.md)
- Component spec → [templates/component-spec.md](templates/component-spec.md)
- Bug triage → [templates/bug-triage.md](templates/bug-triage.md)
- Perf budget → [templates/perf-budget.md](templates/perf-budget.md)
- A11y audit → [templates/a11y-audit.md](templates/a11y-audit.md)
- Design system spec → [templates/design-system.md](templates/design-system.md)

---

## EXAMPLES (REFERENCE OUTPUT QUALITY)
- Design output example → [examples/design-example.md](examples/design-example.md)
- Debug output example → [examples/debug-example.md](examples/debug-example.md)
- Perf output example → [examples/perf-example.md](examples/perf-example.md)
- A11y output example → [examples/a11y-example.md](examples/a11y-example.md)

---

## LAST RULE

If anything is ambiguous, do **not** stall. Make assumptions, label them, ship a first-pass solution that passes all gates, and include the minimum questions only as optional follow-ups.
