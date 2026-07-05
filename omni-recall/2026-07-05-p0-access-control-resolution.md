# P0 Access Control Resolution (2026-07-05)

## Overview
A critical authorization bypass was identified and resolved on 2026-07-05. The `ADMIN_EMAIL` verification logic previously utilized `.includes()` substring matching (e.g. `.includes('apex')`), allowing attackers to register arbitrary emails like `attacker+apex@gmail.com` to gain `CERTIFIED` tier access and bypass organization membership checks.

## Impacted Surfaces
1. `armageddon-site/src/app/api/run/route.ts`
2. `armageddon-site/src/app/api/gatekeeper/route.ts`
3. `armageddon-site/src/intake-handler.ts`

## Resolution
The substring matching logic was entirely removed. Administrative overrides now strictly require an exact, case-sensitive match against the `ADMIN_EMAIL` environment variable.

### Associated Fixes
- **SSRF Validation**: `targetEndpoint` is now strictly validated against `validateSSRF` before being accepted by the primary runner route.
- **Rate-Limiting Precedence**: Organization rate limits in `/api/run` were moved to execute *after* authorization and membership verification to prevent unauthenticated actors from exhausting an organization's quota.

## Architectural Invariant Established
**NEVER use substring matching (`.includes()`, `indexOf()`, `.match()` with partial regex) for authorization, entitlement, or identity checks. All identity comparisons MUST be exact matches.**
