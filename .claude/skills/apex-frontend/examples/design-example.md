# Design Example (compressed)

1) Mode + Goal: DESIGN — create onboarding for a habit-tracker
2) Assumptions: iOS+Android, new users, email auth
3) Plan: JTBD → flow → wireframes → UI → prototype → test
4) Deliverables:
- Flow: Welcome → Value prop → Permissions (optional) → Create habit → Schedule → Done
- States: offline retry, invalid email, duplicate habit, permission denied
- UI notes: primary CTA bottom, progressive disclosure, undo
5) Gates:
- UX: pass (5/5 tasks)
- A11y: labels/targets pass
- Perf: list virtualization planned
6) Risks: permission scare → make optional
