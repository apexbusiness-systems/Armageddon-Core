# MIGRATE Playbook

## Principle
Same intent, platform-native expression. Preserve behavior and tests.

## Steps
1) Inventory: components, screens, routes, state, APIs
2) Identify parity rules (nav/back, gestures, keyboard, safe areas)
3) Build shared tokens and a compatibility layer
4) Migrate vertical slices (1 flow end-to-end at a time)
5) Keep regression tests; compare metrics and UX

## Output
- Migration plan (slices)
- Risk list + mitigations
- Parity checklist
