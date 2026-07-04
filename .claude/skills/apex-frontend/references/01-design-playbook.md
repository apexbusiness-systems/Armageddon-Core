# DESIGN Playbook

## Failure-first
- Do not jump to UI before job + flow + states are defined.
- Do not ship a screen without recovery states and clear feedback.

## Execute (in order)
1) Define JTBD + success metric
2) Map primary flow (start→done) + alt flows (cancel, retry, undo)
3) Draft IA: nav model + key screens
4) Wireframe with thumb-first layout
5) Apply token system + components
6) Write UI copy (clear, actionable, error recovery)
7) Prototype micro-interactions (feedback, progress, undo)
8) Run 5-task usability test; fix top 3 frictions

## Deliverables checklist
- Flow map (happy + error + permission + offline)
- Screen specs
- Component list + tokens
- Copy deck
- Test script + results
