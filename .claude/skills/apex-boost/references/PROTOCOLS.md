# APEX-BOOST: EXECUTION PROTOCOLS
**Loaded on-demand. Covers velocity modes, failure recovery, and domain-specific protocols.**

---

## 1. VELOCITY MODE SELECTION

**Choose BEFORE Phase 0:**

```
SPRINT MODE
├─ When: Deadline <4hrs · known solution path · low stakes
├─ Skip: Phase 1 formal skeleton · Tier 3-4 reasoning
├─ Run: CoT-Lite (Tier 1) minimum · TCE always · Verify Gate always
└─ Target: Output in 1 pass. No revision loops.

CRUISE MODE (default)
├─ When: Normal execution · medium stakes · standard tasks
├─ Run: Full IAS tier selection · Full 4-phase protocol · Full TCE
└─ Target: First-pass success ≥98%.

PRECISION MODE
├─ When: Production deploy · investor/legal · client-facing · $10K+ impact
├─ Run: Full protocol + Singularity Mode (dual-path + rollback)
├─ Extra: Self-Consistency (Tier 4) on ALL factual claims
└─ Target: Zero defects. Evidence chain on every decision.
```

---

## 2. SINGULARITY MODE (PRECISION ONLY)

**Activate for irreversible, high-stakes, or externally-visible outputs.**

```
1. HALT all assumptions — treat everything as unknown until verified
2. Evidence chain: every decision → traceable source
3. Dual-path: execute solution + simultaneously draft rollback
4. Edge case sweep: what could go wrong? build mitigations in
5. Peer-check simulation: argue against your own solution once
6. Output review: read it as the recipient. Does it land exactly right?
7. Postmortem template (3 lines post-ship):
   - What happened:
   - Root cause:
   - Prevention:
```

---

## 3. DOMAIN-SPECIFIC PROTOCOLS

### 3a. FORGE-EXPERT (Code · Debug · Deploy)
```
RED-GREEN-REFACTOR (TDD backbone):
├─ RED: ONE failing test → watch fail → understand why
├─ GREEN: Minimal code to pass → nothing extra
└─ REFACTOR: Clean. Tests stay green. Repeat.

Debug trace:
├─ Read full error → reproduce → trace data flow
├─ Find working reference → diff against broken
├─ ONE hypothesis → ONE minimal test
└─ 3 failed fixes → QUESTION THE ARCHITECTURE

SoT for code: Write function signatures + docstrings first → fill bodies
AlphaCode protocol: Generate 2-3 implementations → pick cleanest + testable
```

### 3b. MIND-EXPERT (Strategy · GTM · Planning)
```
UNDERSTAND → OPTIONS → VALIDATE → DOCUMENT → EXECUTE
├─ Goal in one sentence. Constraints listed.
├─ Exactly 2-3 approaches with trade-offs (no more, no fewer)
├─ Validate against constraints before choosing
└─ Break into atomic tasks. One at a time.

GTM frame: ICP → MESSAGE → CHANNEL → MOTION → METRIC
```

### 3c. SIGNAL-EXPERT (Creative · Brand · Copy)
```
BRIEF → INSIGHT → CONCEPT → EXECUTE → QA
├─ Brief: For whom? What action? What emotion?
├─ Insight: ONE true thing about this audience right now
├─ Concept: Idea that creates emotion AND drives action
├─ Execute: Draft → strip anything that doesn't serve goal
└─ QA: Stops scroll? Converts? Ships in one pass?
```

### 3d. DATA-EXPERT (Data · DB · Schema)
```
SCHEMA-FIRST → QUERY-SECOND → INDEX-LAST
├─ Define entities, relationships, constraints before any query
├─ Write query → EXPLAIN → check index usage
├─ Add indexes only after confirmed missing
└─ SPR-compress all context: use shorthand notation not prose
```

### 3e. REACT-EXPERT (Tool Use · APIs · Fetch)
```
THOUGHT → ACTION → OBSERVE → THOUGHT [loop]
├─ Never call a tool without a stated reason (Thought)
├─ Call ONE tool at a time
├─ Read full observation before next Thought
└─ Converge: final answer synthesized from observations only
```

### 3f. ORIGIN-EXPERT (Novel · Unknown · First Principles)
```
DECONSTRUCT → ATOMS → REBUILD
├─ Strip problem to irreducible components
├─ Question every assumption: "Is this ACTUALLY true?"
├─ Identify the ONE constraint everything depends on
├─ Build simplest possible solution from atoms up
└─ Test against reality immediately (no hypothetical shipping)
```

---

## 4. FAILURE RECOVERY MATRIX

| Failure Signal | Root Cause | Recovery Protocol |
|---|---|---|
| Same error 2+ times | Architecture flaw | HALT → ORIGIN-EXPERT → redesign |
| Output length >2x asked | TCE not applied | COMPRESS → reapply TCE |
| Hedging language in output | Uncertainty not resolved | STOP → gather evidence → remove hedge |
| Claim without evidence | Hallucination risk | DELETE claim or find proof |
| Scope drift mid-task | Phase 0 not locked | RESTART → Phase 0 re-lock |
| Loop detected (3+ attempts) | Approach invalid | HALT → alternate approach → ToT branch |
| Verify gate fails twice | Deep quality issue | Flag for human review → explain gap |
| Token budget exceeded | SPR not applied | SPR-compress history → retry |

---

## 5. MULTI-TURN CONTEXT MANAGEMENT

**Applies when conversation exceeds 10 turns.**

```
Turn 1-5:    Full context — no compression needed
Turn 6-10:   Compress turns 1-3 to SPR summaries
Turn 11-20:  Compress turns 1-8 to SPR · keep 9-10 full
Turn 21+:    Keep only: [current goal] + [last 3 turns full] + [SPR of prior]
```

**SPR compression of turn history:**
```
Turn N: [action taken] → [result] → [open items]
Example: "Turn 3: Designed auth schema → approved by user → pending: rate limit spec"
```

---

## 6. EXTENDED THINKING INTEGRATION (Claude 3.7+ / 4.x)

**Use extended thinking for Tier 3-4 tasks when available.**

```
When to activate extended thinking:
├─ Tier 3: ToT-Branch tasks (architecture, novel decisions)
├─ Tier 4: Self-Consistency tasks (critical factual + legal + audit)
└─ NEVER for Tier 0-1 (wastes budget)

Budget guidelines:
├─ Tier 3: 5,000-10,000 thinking tokens
├─ Tier 4: 10,000-20,000 thinking tokens
└─ Adjust based on observed quality vs. cost tradeoff
```

---

*APEX-BOOST v1.0 · references/PROTOCOLS.md*  
*APEX Business Systems Ltd. © 2026*
