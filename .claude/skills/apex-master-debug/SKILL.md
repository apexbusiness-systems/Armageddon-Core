---
name: apex-master-debug
description: "APEX-MASTER-DEBUG: Omnipotent, Omniscient, Predictive Debugging Intelligence. 20x one-pass-debug. Gives any agent instant debugging mastery, surgical fix capability, and proactive bug prediction before failures occur. Triggers: debug, fix bug, error, crash, exception, stack trace, failing test, broken code, not working, troubleshoot, diagnose, investigate, predict bugs, proactive review, code audit, pre-release check, refactor risk, performance issue, memory leak, race condition, silent failure, regression. Produces: single surgical fix with 100% certainty, proactive threat map, permanent regression shield."
license: "Proprietary - APEX Business Systems Ltd. Edmonton, AB, Canada."
---

# APEX-MASTER-DEBUG v1.0 — Claude Native Edition

> **"Omniscient agents don't debug. They PREVENT. And when they must fix — ONE pass, ONE change, DONE."**

---

## CONTRACT

```
Input  → Bug report | error | stack trace | code review request | "it doesn't work"
           | proactive scan request | pre-release audit | performance complaint
Output → Surgical str_replace fix with zero guessing + proactive threat map
Success → Bug fixed in ONE str_replace. All tests pass. Regression impossible.
Fails  → Pre-flight not 100% green | root cause unproven | multiple simultaneous changes
```

---

## CLAUDE TOOL PROTOCOL

```
TOOL SELECTION RULES (Claude-native):
├─ Reading files/dirs    → view tool (ALWAYS before editing)
├─ Evidence gathering    → bash_tool (logs, git diff, test runs)
├─ Applying fixes        → str_replace tool (ONE call per fix)
├─ Creating new files    → create_file tool (tests, docs)
├─ Running tests         → bash_tool (validate after every change)
└─ NEVER edit without    → reading file first via view tool

MANDATORY PRE-EDIT SEQUENCE:
1. view [file]           → See current state
2. bash_tool [tests]     → Baseline: what passes now
3. (phases 1–6)          → Full protocol
4. str_replace           → ONE surgical change
5. bash_tool [tests]     → Validate: all tests pass
6. create_file [test]    → Regression shield
```

---

## MODE ROUTER

```
What is your situation?
├─ "I have a live bug / error / crash"     → REACTIVE MODE  (Phases 1–8)
├─ "Review this code before I ship"        → PREDICTIVE MODE (Phases P1–P5)
├─ "Something is slow / degraded"          → PERFORMANCE MODE (Phases X1–X4)
└─ "Full system audit"                     → OMEGA SCAN (all modes, parallel)
```

---

# ═══ REACTIVE MODE ═══

## PHASE 1: SCOPE LOCK ⟨2 min⟩

```
□ What EXACTLY is broken? (One sentence. No "and".)
□ What is the EXPECTED behavior?
□ What is the ACTUAL behavior?
□ When did it LAST work? (commit hash / timestamp / "never")
□ What CHANGED since it last worked?

ALL 5 answered? → Phase 2 | ANY missing? → STOP. Get answers.
```

---

## PHASE 2: CONTEXT HARVEST ⟨Claude tool sequence⟩

```bash
# Claude executes this sequence:

# 1. View the failing file
view [failing_file_path]

# 2. Get full error / stack trace
bash_tool: cat [log_file] | tail -200
# OR reproduce: bash_tool: [run_command] 2>&1

# 3. Get recent changes
bash_tool: git log --oneline -20
bash_tool: git diff HEAD~1

# 4. Run existing tests to establish baseline
bash_tool: [test_command] 2>&1

# 5. Inspect runtime state
bash_tool: [add strategic logging if needed, re-run]
```

**Evidence Sufficiency Gate**:
```
Without guessing:
├─ Exact line that fails?           NO → bash_tool: add print/log, re-run
├─ Exact value that causes failure? NO → bash_tool: inspect state
├─ Exact condition that triggers it?NO → bash_tool: test edge cases
└─ ALL YES → Phase 3
```

---

## PHASE 3: TEMPORAL ROOT CAUSE ANALYSIS

**Step 3A — Causal Chain (work backward)**:
```
Symptom at [Layer N]
↑ caused by → [Layer N-1]: view [file], bash_tool [trace]
↑ caused by → [Layer N-2]: view [file], bash_tool [trace]
↑ ... until IMMUTABLE ROOT found
```

**Step 3B — Deduction Matrix**:
```
H1: [obvious surface cause]
  For: [...] | Against: [...] | Verdict: ✓ | ✗ | ?

H2: [upstream / feeding cause]
  For: [...] | Against: [...] | Verdict: ✓ | ✗ | ?

H3: [environmental / config cause]
  For: [...] | Against: [...] | Verdict: ✓ | ✗ | ?

[Generate H4, H5 as needed for complex bugs]
```

**Certainty Gate**:
```
⛔ BLOCKED UNTIL:
□ ONE hypothesis remains with overwhelming evidence
□ All others eliminated with evidence
□ Predict EXACTLY which str_replace will fix this
□ Can explain to colleague in ≤30 seconds
```

---

## PHASE 4: BLAST RADIUS MAPPING

```bash
# Claude executes:
bash_tool: grep -r "[function_name|component|class]" --include="*.{ext}" .
bash_tool: [test_command] --list  # See all tests that touch this area
view [related_files]              # Read every affected file
```

```
CLASSIFICATION:
├─ CONTAINED   (≤1 component) → Proceed
├─ MODERATE    (2–5)          → Document all, proceed carefully
├─ WIDESPREAD  (6+)           → STOP, escalate, coordinate
└─ SYSTEMIC    (architecture) → Cannot fix locally, re-architect
```

---

## PHASE 5: MENTAL SIMULATION (4 Passes)

```
PASS 1 — FORWARD: Apply fix mentally → trace all execution paths → correct outcome?
PASS 2 — BACKWARD: Desired outcome → what must be true → are assumptions valid?
PASS 3 — EDGE CASES: null | empty | max size | concurrent | out-of-order | IO fail
PASS 4 — REGRESSION: Does fix break any existing test? Change any caller contract?

Confidence must be 100% before Phase 6.
```

---

## PHASE 6: PRE-FLIGHT GATE

```
⛔ str_replace IS BLOCKED UNTIL ALL 10 ARE GREEN:
□ Scope locked (no drift)
□ ALL evidence collected via tools (no assumptions)
□ Root cause PROVEN (not theorized)
□ ALL other hypotheses ELIMINATED with evidence
□ Blast radius mapped via grep/view
□ Simulation: all 4 passes complete and passed
□ Edge cases: all checked
□ Fix is MINIMAL (smallest str_replace that resolves root)
□ Fix is SURGICAL (touches only root cause location)
□ Rollback plan exists (previous view saved, git available)

ALL GREEN? → Phase 7 | ANY RED? → Return to appropriate phase.
```

---

## PHASE 7: SURGICAL EXECUTION

```bash
# STEP 1: Write regression test FIRST (TDD)
create_file: [test_file_path]
# Content: test that reproduces the bug (currently fails)

# STEP 2: Verify test fails (proves it tests the right thing)
bash_tool: [test_command] [new_test_name]
# Expected: FAIL

# STEP 3: Apply ONE surgical fix
str_replace:
  path: [exact_file_path]
  old_str: [exact current code — must be unique in file]
  new_str: |
    // FIX: [issue description]
    // ROOT CAUSE: [one sentence — proven WHY]
    // CHANGE: [what this does differently]
    [minimal corrected code]

# STEP 4: Verify test now passes
bash_tool: [test_command] [new_test_name]
# Expected: PASS

# STEP 5: Verify nothing else broke
bash_tool: [full_test_suite_command]
# Expected: ALL PASS
```

---

## PHASE 8: CLOSURE & REGRESSION SHIELD

```bash
# Confirm regression test is committed
bash_tool: git add [test_file] [fixed_file]
bash_tool: git commit -m "fix: [root_cause_summary] — regression test added"

# Search for same pattern elsewhere
bash_tool: grep -r "[pattern_that_caused_bug]" --include="*.{ext}" .

# Document closure
create_file: docs/bug-reports/[YYYY-MM-DD]-[bug-slug].md
```

**Closure Template**:
```
ROOT CAUSE:      [one sentence]
FIX:             [file:line — what str_replace changed]
REGRESSION TEST: [test path + test name]
PATTERN RISK:    [none | low — where else this pattern exists]
PREVENTION:      [one-line note on avoiding this class of bug]
```

---

# ═══ PREDICTIVE MODE — Claude Native ═══

## PHASE P1: AUTOMATED THREAT SCAN

```bash
# Claude runs these scans:

# Null/undefined checks missing
bash_tool: grep -n "\.value\|\.data\|\.result" [src_dir] | grep -v "?"

# Empty catch blocks
bash_tool: grep -n "catch.*{}" [src_dir] --include="*.{ext}" -r

# Magic numbers
bash_tool: grep -rn "[0-9]\{4,\}" [src_dir] --include="*.{ext}"

# Async without await
bash_tool: grep -n "async.*=>" [src_dir] -r | head -50

# TODO / FIXME / HACK markers
bash_tool: grep -rn "TODO\|FIXME\|HACK\|XXX" [src_dir]

# Hardcoded secrets / URLs
bash_tool: grep -rn "http://\|password\|secret\|api_key" [src_dir] \
  --include="*.{ext}" | grep -v ".env\|test"
```

---

## PHASE P2: PATTERN RECOGNITION

```bash
# Complexity analysis (functions > 50 lines = risk)
bash_tool: awk '/^[[:space:]]*(function|def|fn |async )/{start=NR} \
  {if(start && NR-start>50) print FILENAME ":" start}' [files]

# N+1 query detection
bash_tool: grep -n "for\|forEach\|map" [src_dir] -r -A 3 | grep -i "query\|fetch\|find"

# View each flagged file for deep analysis
view [flagged_file]
```

| Risk Score ≥ 30 | → Generate fix via phases 5–7, apply proactively |
| Risk Score 15–29 | → Document in tech debt |
| Risk Score < 15 | → Track, no immediate action |

---

## PHASE P3–P5: RISK SCORE + PROACTIVE FIX + REPORT

```
Risk Score = SEVERITY(1-4) × LIKELIHOOD(1-4) × BLAST_RADIUS(1-4)
≥ 30 → Fix before ship (generate str_replace + test now)
15–29 → Fix this sprint
< 15 → Backlog

create_file: docs/threat-map-[YYYY-MM-DD].md
[Full threat inventory with scores, locations, and generated fixes]
```

---

# ═══ PERFORMANCE MODE — Claude Native ═══

```bash
# X1: BASELINE
bash_tool: [benchmark_command] 2>&1 | tee baseline.txt

# X2: PROFILE
bash_tool: [profiler_command] — identify top consumer
view [identified_bottleneck_file]

# X3: FIX (same surgical rules — ONE str_replace)
str_replace: [targeted optimization only]
bash_tool: [benchmark_command] 2>&1 | tee after.txt
bash_tool: diff baseline.txt after.txt

# X4: CLOSURE
bash_tool: git commit -m "perf: [bottleneck] — [X]% improvement"
create_file: [performance_regression_test]
```

---

## ANTI-PATTERNS

| Anti-Pattern | Action |
|---|---|
| "Let me try this" | Return to Phase 3. NO exceptions. |
| "It might be..." | Return to Phase 2. Collect evidence with bash_tool. |
| Multiple str_replace calls for one bug | One change. Re-read Phase 7. |
| Skipping view before str_replace | MANDATORY. Always view first. |
| Test suite not run after fix | MANDATORY. Always validate. |

---

## DOMAIN MATRIX

| Domain | Phase 2 Claude Tools | Phase 3 Focus |
|---|---|---|
| **Frontend** | `bash_tool: npm test`, `view [component]` | State, async, render |
| **Backend** | `bash_tool: logs`, `view [controller]` | Request lifecycle, auth |
| **Database** | `bash_tool: EXPLAIN ANALYZE`, `view [schema]` | Indexes, joins, N+1 |
| **Infra** | `bash_tool: systemctl`, `view [config]` | Resources, permissions |
| **ML/AI** | `bash_tool: python [eval]`, `view [model]` | Data pipeline, shapes |

---

## INSTALLATION (Claude Capabilities)

```bash
# Copy to Claude's skills directory
cp -r apex-master-debug-claude/ /mnt/skills/user/apex-master-debug/

# Verify
ls /mnt/skills/user/apex-master-debug/SKILL.md

# Activate in Claude — triggers automatically on any debug request
# Manual: "Apply apex-master-debug protocol"
```

---

## QUICK-REFERENCE CARD

```
REACTIVE:    P1 Scope → P2 Evidence (tools) → P3 RCA → P4 Blast Radius
             → P5 Simulation → P6 Pre-Flight → P7 str_replace → P8 Closure

PREDICTIVE:  PP1 Scan (bash) → PP2 Patterns (grep/view) → PP3 Risk Score
             → PP4 Proactive Fix → PP5 Threat Report

LAWS:        view BEFORE str_replace | bash_tool tests AFTER str_replace
             ONE str_replace per bug | PROVE before TOUCH | PREDICT before FIX
```

---

**APEX-MASTER-DEBUG v1.0.0 — Claude Native Edition**
**Supersedes**: one-pass-debug (all versions)
**Compatibility**: Claude Sonnet 4, Opus 4, Haiku 4.5 — all Claude models
**License**: Proprietary — APEX Business Systems Ltd. Edmonton, AB, Canada.
**Copyright © 2026 All Rights Reserved**
