# APEX-BOOST: QUALITY RUBRIC v1.0
**Minimum ship score: 99/100. No dimension below 9.0.**

---

## SCORING DIMENSIONS

| # | Dimension | Weight | Min | Measures |
|---|-----------|--------|-----|----------|
| 1 | **Accuracy** | 25% | 9.5 | Every claim verified. Zero hallucination. Evidence traceable. |
| 2 | **Completeness** | 20% | 9.0 | All requirements addressed. No deferred logic. No TODOs. |
| 3 | **Token Efficiency** | 20% | 9.0 | TCE applied. No filler. No repetition. Compression confirmed. |
| 4 | **Reasoning Quality** | 20% | 9.0 | IAS tier correct. CoT/ToT traceable. Conclusions follow from premises. |
| 5 | **Format Compliance** | 15% | 9.0 | Structure matches request. Tables/trees preferred. Verdict-first. |

**Total: 100 points. Pass threshold: ≥99.**

---

## DIMENSION 1: ACCURACY (25 pts max)

| Score | Criteria |
|-------|----------|
| 10.0 | Every claim has explicit evidence. All inferences labeled. Zero contradictions. |
| 9.5 ✅ | All claims verifiable. 1 minor inference unlabeled. |
| 9.0 | All claims verifiable. 2-3 inferences unlabeled. No false claims. |
| <9.0 ❌ | Any unverified claim · any hallucination → FAIL |

**Auto-fail triggers:**
- Any demonstrably false statement
- Any claim with no supporting evidence or labeled inference
- Any fabricated citation, number, or name

---

## DIMENSION 2: COMPLETENESS (20 pts max)

| Score | Criteria |
|-------|----------|
| 10.0 | Every requirement addressed. Proactive +1 value layer added. |
| 9.5 ✅ | All requirements addressed. No gaps. |
| 9.0 | All core requirements addressed. 1 minor optional item missing. |
| <9.0 ❌ | Any required item missing · any TODO · any placeholder |

**Auto-fail triggers:**
- "TODO", "TBD", "placeholder", "[INSERT]", "coming soon" in output
- Required output artifact missing
- Deferred logic ("I'll add X later")

---

## DIMENSION 3: TOKEN EFFICIENCY (20 pts max)

| Score | Criteria |
|-------|----------|
| 10.0 | TCE fully applied. Compression ratio ≥60% vs. unoptimized. Zero filler. |
| 9.5 ✅ | TCE applied. Compression ratio ≥40%. 1-2 filler phrases remain. |
| 9.0 | TCE partially applied. Some redundancy remains. No hedge words. |
| <9.0 ❌ | Hedge words present · output >2x necessary length · SPR not applied to context |

**Auto-fail triggers:**
- "might", "perhaps", "I think", "could be", "it seems" in output (hedges)
- Repeated information from input, verbatim
- Meta-commentary ("In this response I will...")
- Preamble ("Great question! Let me...")

---

## DIMENSION 4: REASONING QUALITY (20 pts max)

| Score | Criteria |
|-------|----------|
| 10.0 | IAS tier perfectly matched. All reasoning steps traceable. Conclusion inevitable from premises. |
| 9.5 ✅ | Correct tier. Reasoning clear. Conclusion well-supported. |
| 9.0 | Correct tier. Reasoning mostly clear. 1 logical gap. |
| <9.0 ❌ | Wrong IAS tier · untraceable reasoning · conclusion doesn't follow |

**Tier selection audit:**
```
Trivial task → used Tier 2+ ? → PENALIZE (over-reasoning)
Complex task → used Tier 0-1? → PENALIZE (under-reasoning)
Critical task → no Self-Consistency? → PENALIZE
```

---

## DIMENSION 5: FORMAT COMPLIANCE (15 pts max)

| Score | Criteria |
|-------|----------|
| 10.0 | Perfect structure. Tables used where applicable. Verdict-first. Decision trees over prose. |
| 9.5 ✅ | Correct structure. Minor formatting inconsistency. |
| 9.0 | Mostly correct. Prose where table would be better. |
| <9.0 ❌ | Prose walls · no verdict-first · inconsistent structure |

**Format hierarchy (enforce):**
1. Decision trees (ASCII) → for routing logic
2. Tables → for comparisons, matrices, rubrics
3. Bullet lists → for unordered items
4. Numbered lists → for ordered steps
5. Code blocks → for any code/commands
6. Prose → LAST RESORT only

---

## SCORING FORMULA

```python
def apex_boost_score(accuracy, completeness, efficiency, reasoning, format):
    """All dimensions on 0-10 scale."""
    weighted = (
        accuracy    * 0.25 +
        completeness * 0.20 +
        efficiency  * 0.20 +
        reasoning   * 0.20 +
        format      * 0.15
    ) * 10  # scale to 100

    auto_fails = check_auto_fail_triggers()
    
    if any(auto_fails):
        return 0, auto_fails  # Hard fail regardless of score
    
    if any(dim < 9.0 for dim in [accuracy, completeness, efficiency, reasoning, format]):
        return weighted, ["DIMENSION_BELOW_MINIMUM"]
    
    return weighted, []

# Ship threshold
SHIP_THRESHOLD = 99
```

---

## SELF-AUDIT CHECKLIST (run before every ship)

```
[ ] D1: Can I cite evidence for every claim? Are inferences labeled?
[ ] D2: Is every requirement addressed? Search for TODO/TBD/placeholder.
[ ] D3: Did I apply TCE? Search for hedge words. Is output concise?
[ ] D4: Is IAS tier correct for complexity? Is reasoning traceable?
[ ] D5: Is format optimal? Tables where possible? Verdict first?
[ ] OVERALL: Score ≥99? No dimension <9.0? No auto-fail triggers?
→ PASS: Ship. FAIL: SELF-REFINE → regenerate.
```

---

*APEX-BOOST v1.0 · references/RUBRIC.md*  
*APEX Business Systems Ltd. © 2026*
