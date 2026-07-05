# ARMAGEDDON OPS RUNBOOKS [LEVEL 8]

> **CLASSIFICATION**: INTERNAL EYES ONLY
> **SEVERITY**: CRITICAL
> **VERSION**: 2.3.0 ("URL migration + RATE_LIMIT_KV status" update)
> **LAST REVIEWED**: 2026-06-25

---

## 🚨 SEV-1: CRITICAL INCIDENTS

### 1.1 SYSTEM_LOCKDOWN_TRIGGERED

**Trigger**: `SystemLockdownError` thrown in Temporal workflow.
**Impact**: All certification runs blocked.
**Diagnosis**:

1. Check Worker logs for `LOCKDOWN: SIM_MODE is not set to "true"` or `SANDBOX_TENANT is not defined`.
2. Verify environment variables in the Moat container.

**Remediation**:

```powershell
# 1. Verify ENV vars on worker
docker exec armageddon-worker-moat printenv | findstr SIM_MODE
# MUST output: SIM_MODE=true

# 2. If missing, fix .env.moat and REDEPLOY
# Edit .env.moat -> .\scripts\deploy_moat.ps1
```

### 1.2 CONTAINMENT_BREACH_DETECTED

**Trigger**: Real database access detected outside `SANDBOX_TENANT`.
**Impact**: Potential data corruption in prod.
**Protocol**:

1. **KILL SWITCH**: Immediately execute the suppression script.

   ```powershell
   .\scripts\kill_moat.ps1
   ```

   _(Legacy: `kubectl scale` is deprecated for Moat deployments)_

2. **REVOKE ACCESS**: Rotate Supabase `service_role` key immediately.
3. **AUDIT**: Query `armageddon_events` for any `breach` type events.

---

## 🛠 SEV-2: MAINTENANCE & DEPLOYMENT

### 2.1 DEPLOYING_CORE_UPDATE (Proprietary Moat)

**Context**: Updating `armageddon-core` engine logic.
**Procedure**:

1. **Commit**: Ensure all changes are committed (deployment script uses git hash).
2. **Execute Protocol**:
   ```powershell
   .\scripts\deploy_moat.ps1
   ```
3. **Verification**:
   The script runs the Moat bridge verification path. After deployment, run the root verification gates when code changed:
   ```powershell
   npm run lint
   npm run typecheck
   npm run test
   npm run build
   ```
   If script exits with `✅ DEPLOYMENT COMPLETE` and verification gates pass, no further action is needed.

### 2.2 ROTATING_KEYS (Supabase/Stripe)

**Frequency**: Quarterly or post-incident.
**Procedure**:

1. Generate new keys in Supabase/Stripe Dashboard.
2. Update `.env.moat` locally.
3. Execute `.\scripts\deploy_moat.ps1` to rotate the running containers.
4. Verify `checkRunEligibility` passes.

---

## 🔍 DEBUGGING & TRIAGE

### 3.1 HIGH_ESCAPE_RATE (>1%)

**Symptom**: Too many organizations failing certification inappropriately.
**Investigation**:

1. Check `simulateAttack` probability in `activities.ts`. Default `0.0001`.
2. check logs: `docker logs --tail 100 armageddon-worker-moat`

### 3.2 STUCK_WORKFLOWS

**Symptom**: Runs stuck in `running` state > 10 mins.
**Remediation**:

1. Check Temporal UI (http://localhost:8080).
2. Terminate workflow via CLI (inside container) or UI.
   ```powershell
   docker exec armageddon-temporal-moat tctl workflow terminate --workflow_id <id>
   ```

---

## 📋 ONBOARDING (OPS)

### 4.1 ADD_CERTIFIED_ORG

Handled by validated operator runbooks and repository scripts only; no `admin-tools` automation is defined in this repository as of 2026-05-15.

### 4.2 PROVISION_SANDBOX

1. Edit `.env.moat` -> `SANDBOX_TENANT`.
2. Redeploy.

### 4.3 PROVISION_ADMIN_EMAIL

**Context**: Setting the `ADMIN_EMAIL` authorizes a specific account to bypass standard organizational access checks and run simulated or live-fire tests.
**Protocol**:
1. Edit `.env.moat` (or production environment secrets) to set `ADMIN_EMAIL` to the exact email address of the authorized operator.
2. Note: Substrings or wildcard domains are strictly prohibited by architecture invariant. The email must be an exact, case-sensitive match.
3. Redeploy the core services or Cloudflare Pages environment variables.

---

---

## 🤖 SEV-3: ATLAS SUPPORT CHAT

### 5.1 ATLAS_SUPPORT_NOT_CONFIGURED (503 on every request)

**Symptom**: `/api/support-chat` returns `{"error":true,"code":"NOT_CONFIGURED","message":"Support agent temporarily unavailable."}`.
**Cause**: `ANTHROPIC_API_KEY` Wrangler secret is not set.
**Fix**:
```bash
npx wrangler secret put ANTHROPIC_API_KEY
```
Re-deploy the Worker after setting the secret.

### 5.2 ATLAS_RATE_LIMIT_KV_UNBOUND (rate limiting silently skipped)

**Symptom**: Rate limits are not being enforced (confirmed by log absence of `RATE_LIMIT_KV`-related errors).
**Cause**: KV namespace has not been provisioned or `wrangler.jsonc` still contains `REPLACE_WITH_KV_NAMESPACE_ID`.

> **ACTIVE AS OF 2026-06-24**: Confirmed via Cloudflare dashboard — production `armageddon-core` Worker only shows `ASSETS` binding. `RATE_LIMIT_KV` is not bound. This runbook is currently applicable.

**Fix**:
1. Create the namespace: `npx wrangler kv namespace create RATE_LIMIT_KV`
2. Paste the returned `id` into `armageddon-site/wrangler.jsonc` `kv_namespaces[0].id`.
3. Re-deploy.
4. **Mandatory Dashboard Check**: An operator with real Cloudflare dashboard access must verify the binding under the production worker's bindings panel and update `PRODUCTION_STATUS.md`.

**Note**: Rate limiting skipped gracefully — the endpoint remains functional, just unprotected by server-side rate limits. Client-side rate limits (5/min, 30/hr) remain active in the UI.

### 5.3 ATLAS_ANTHROPIC_UPSTREAM_ERROR (502 responses)

**Symptom**: `/api/support-chat` returns `{"error":true,"code":"API_UPSTREAM_ERROR"}`.
**Cause**: Anthropic API returned a non-2xx response (overload, quota exceeded, invalid key).
**Diagnosis**:
1. Check Cloudflare Worker logs for `Anthropic API error: <status>`.
2. Status 429 → API quota exceeded; status 401 → invalid API key.
**Fix**:
- Quota: wait for reset or upgrade Anthropic plan.
- Invalid key: rotate via `npx wrangler secret put ANTHROPIC_API_KEY`.

### 5.4 ATLAS_SECURITY_BLOCK_SPIKE

**Trigger**: Unusual volume of `SECURITY_BLOCK ip=... code=INJECTION_DETECTED` in Worker logs.
**Impact**: Potential coordinated injection attack attempt.
**Protocol**:
1. Check log frequency: `wrangler tail --filter "SECURITY_BLOCK"`.
2. If a single IP dominates, consider temporarily blocking it at the Cloudflare WAF level.
3. Do NOT weaken injection patterns in `INJECTION_PATTERNS` to reduce log noise — investigate root cause.
4. Invariants are documented in `CLAUDE.md`. Do not modify them without a signed-off security review.

---

> **REMEMBER**: "Compliance is a checklist. Armageddon is a guarantee."
> **DO NOT** disable safety guards to "just make it work".
