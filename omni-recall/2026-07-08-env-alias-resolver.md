---
version: 1.0.0
last_audited: 2026-07-08
status: verified
---

# Env Alias Resolver Update

Implemented shared Supabase/Admin environment alias resolution on 2026-07-08.

## Durable facts

- Canonical `SUPABASE_*` env names remain supported.
- `ARMAGEDDON_DB_URL`, `ARMAGEDDON_DB_ANON_KEY`, and `ARMAGEDDON_DB_SERVICE_ROLE_KEY` are accepted fallbacks for dashboards that reject `SUPABASE_*` names.
- `ADMIN_EMAIL` remains canonical; `ARMAGEDDON_ADMIN_EMAIL` is only an optional exact-match fallback.
- `ARMAGEDDON_ATTESTATION_SEED` is unchanged.
- Supabase clients remain lazily constructed; do not move them back to module scope.
