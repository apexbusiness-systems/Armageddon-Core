---
name: {{SKILL_NAME}}
description: {{What it does - 1 sentence, third person}}. Use when {{concrete trigger contexts - be slightly pushy, models under-trigger}}. Does not cover {{nearest adjacent task this skill should NOT claim}}.
license: Proprietary - APEX Business Systems Ltd.
---

# {{SKILL_NAME}}

**Input**: {{type, format, where it comes from}}
**Output**: {{format + exact location}}
**Success**: {{command or check that proves it worked}}
**Fails when**: {{the 2-3 realistic ways this goes wrong}}

## Workflow

{{Imperative steps. Explain why each step matters. Decision tree only at real branch points:}}

```
{{condition}}?
+- yes -> {{action / script}}
+- no  -> {{action / fallback}}
```

## Verification

Run this before declaring done - an unchecked output is an unverified claim:

```bash
{{verification command}}
```

## Failure handling

{{Place each check NEXT TO the operation that can fail, with the recovery action.}}

## References

- `references/{{file}}.md` - {{read when ...}}
