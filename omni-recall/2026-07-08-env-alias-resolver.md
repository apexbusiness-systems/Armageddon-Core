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

## Follow-up hardening (2026-07-08)

- The Cloudflare/local CI failure was caused by `@armageddon/shared` test mocks that did not include the newly imported `readAdminEmail`; affected API-run tests now mock the alias reader explicitly.
- `armageddon-site/src/intake-handler.ts` now has a local edge-compatible first-binding helper and shared auth helper so the env alias patch adds 0.00% duplication within the worker file.
- Core Supabase clients now use a central `createServerSupabaseClient` helper with an `undici` WebSocket transport so Node.js 20 can construct Supabase clients reliably even though native `globalThis.WebSocket` starts in Node.js 22.
