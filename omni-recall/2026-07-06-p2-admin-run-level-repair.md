# P2 Admin Access + Run-Level Repair (2026-07-06)

## Summary
- Certified run execution in `DestructionConsole` is capped at `level: 7`; display clearance in `AuthHeader` remains allowed to show Level 8.
- Component regressions verify Supabase bearer tokens are forwarded to `/api/gatekeeper` from authenticated UI surfaces.
- Console regression verifies a certified gatekeeper response submits `/api/run` with `level: 7` and not `8`.

## Security Notes
- Server-side `/api/gatekeeper` authentication and exact admin email matching were not changed.
- `/api/run` accepted levels were not expanded.
- SIM_MODE, live-fire, OmniPort, rate-limit, CORS, SSRF, and auth guard behavior were not modified.
