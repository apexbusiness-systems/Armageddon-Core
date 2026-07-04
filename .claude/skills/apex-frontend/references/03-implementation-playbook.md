# IMPLEMENT Playbook

## Architecture invariant
Tokens → Components → Screens → State model → Effects → Tests

## Steps
1) Extract tokens (spacing, type, colors, motion) and forbid raw values
2) Build components with full state coverage
3) Implement screen composition (no business logic in view)
4) State model: single source of truth; define transitions
5) Data layer: caching, retries, optimistic UI where safe
6) Tests: state reducer/view model + 1 UI test for happy path
7) QA: a11y + perf smoke

## Deliverables
- Component breakdown
- State diagram or transition table
- Test list + minimal regression suite
