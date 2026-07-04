# Report Templates

## Contents
- Surface validation matrix
- Action validation matrix
- Quality change review
- GO / NO-GO report
- Implementation handoff prompt skeleton

## Surface validation matrix

```markdown
| Surface | Intended purpose | User action | Expected behavior | Actual behavior | Works or gated honestly? | Quality preserved? | Evidence | Result |
|---|---|---|---|---|---|---|---|---|
```

## Action validation matrix

```markdown
| Surface | Action | Expected | Actual | System call made? | User-visible result | Decision |
|---|---|---|---|---:|---|---|
```

## Quality change review

```markdown
## Quality Change Review

Surface:
Proposed change:
Before evidence:
After evidence:
User value preserved:
Design/experience unity preserved or improved:
Decision: APPROVE / REJECT
Reason:
```

## GO / NO-GO report

```text
USER-SHOES VALIDATION REPORT

Decision: GO / NO-GO / BLOCKED

Scope:
Domain (UI / API / CLI / agent / dashboard / document / process):
Environment:
Commit / PR / deploy / version:
Auth or access state:

Confirmed product truth:
- ...

Surfaces validated:
| Surface | Purpose clear? | Functioning? | Relevant? | Logical user path? | Quality preserved? | Result |
|---|---:|---:|---:|---:|---:|---|

Actions validated:
| Surface | Action | Expected | Actual | System call? | Final user-visible result |
|---|---|---|---|---:|---|

Quality review:
- degradation observed:
- before/after evidence:

Tests:
- typecheck / lint / contract check:
- unit / integration:
- build:
- direct evidence collection (browser / CLI / transcript / etc.):

Security:
- secrets exposed:
- destructive action taken:
- unsafe auth/credential evidence:

Remaining blockers:
- ...

Next executable action:
- ...
```

## Implementation handoff prompt skeleton

```text
MISSION:
[precise rescue/fix/certification objective]

CONFIRMED PRODUCT TRUTH:
[product truth and drift patterns to reject]

NON-NEGOTIABLES:
- no secrets
- no quality degradation
- no fake success
- no unsupported system calls

SURFACES TO INSPECT:
- ...

IMPLEMENTATION:
- ...

TESTS:
- ...

EVIDENCE TO COLLECT:
- ...

GO / NO-GO RULES:
- ...
```
