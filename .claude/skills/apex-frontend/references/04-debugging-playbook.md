# DEBUG Playbook

## Deterministic protocol
1) Reproduce (exact steps + environment)
2) Reduce (minimal case)
3) Classify (layout/state/render/data/platform/tooling)
4) Instrument (logs around boundaries: input→state→render→effect)
5) Inspect (UI tree, computed constraints/styles, state snapshots, traces)
6) Patch (root cause)
7) Prevent (regression test + guardrail + monitor)

## Root cause heuristics
- Layout: conflicting constraints, unbounded content, wrong measure pass
- State: stale closures, race conditions, non-idempotent effects
- Data: cache invalidation, pagination bugs, schema drift
- Platform: lifecycle, safe areas, keyboard, permissions
