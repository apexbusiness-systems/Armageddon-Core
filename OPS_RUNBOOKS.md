# ARMAGEDDON OPS RUNBOOKS [LEVEL 8]

> **CLASSIFICATION**: INTERNAL EYES ONLY
> **SEVERITY**: CRITICAL
> **VERSION**: 2.1.0 ("Kinetic Moat")
> **LAST UPDATED**: 2026-02-08

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
   The script automatically runs `verify_kinetic_moat.ts` (Bridge Check) and `npm run test:smoke` (Battery 01).
   If script exits with `✅ DEPLOYMENT COMPLETE`, no further action is needed.

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

Reflexively handled via `admin-tools` scripts (TBD).

### 4.2 PROVISION_SANDBOX

1. Edit `.env.moat` -> `SANDBOX_TENANT`.
2. Redeploy.

---

> **REMEMBER**: "Compliance is a checklist. Armageddon is a guarantee."
> **DO NOT** disable safety guards to "just make it work".
