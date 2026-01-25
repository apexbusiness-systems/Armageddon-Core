# ARMAGEDDON OPS RUNBOOKS [LEVEL 7]
> **CLASSIFICATION**: INTERNAL EYES ONLY
> **SEVERITY**: CRITICAL
> **LAST UPDATED**: 2026-01-25

---

## 🚨 SEV-1: CRITICAL INCIDENTS

### 1.1 SYSTEM_LOCKDOWN_TRIGGERED
**Trigger**: `SystemLockdownError` thrown in Temporal workflow.
**Impact**: All certification runs blocked.
**Diagnosis**:
1. Check Worker logs for `LOCKDOWN: SIM_MODE is not set to "true"` or `SANDBOX_TENANT is not defined`.
2. Verify environment variables in Temporal Cloud / Worker container.

**Remediation**:
```bash
# 1. Verify ENV vars on worker fleet
printenv | grep SIM_MODE
# MUST output: SIM_MODE=true

# 2. If missing, redeploy workers with correct config
kubectl set env deployment/armageddon-worker SIM_MODE=true SANDBOX_TENANT=armageddon-test-01

# 3. Restart stuck workflows (using tctl or Temporal UI)
tctl workflow reset --workflow_id <id> --reason "Config Fixed"
```

### 1.2 CONTAINMENT_BREACH_DETECTED
**Trigger**: Real database access detected outside `SANDBOX_TENANT`.
**Impact**: Potential data corruption in prod.
**Protocol**:
1. **KILL SWITCH**: Immediately stop all Temporal Workers.
   ```bash
   kubectl scale deployment/armageddon-worker --replicas=0
   ```
2. **REVOKE ACCESS**: Rotate Supabase `service_role` key immediately.
3. **AUDIT**: Query `armageddon_events` for any `breach` type events with invalid tenant timestamps.

---

## 🛠 SEV-2: MAINTENANCE & DEPLOYMENT

### 2.1 DEPLOYING_CORE_UPDATE (Temporal Workers)
**Context**: Updating `armageddon-core` engine logic.
**Procedure**:
1. **Versioning**: Ensure `taskQueue` matches version if breaking changes (e.g., `armageddon-level7-v2`).
2. **Drain**: Stop accepting new runs (API toggle).
3. **Deploy**:
   ```bash
   # Build & Push
   docker build -t armageddon-worker:latest .
   kubectl rollout restart deployment/armageddon-worker
   ```
4. **Verification**: Run `npm run test:smoke` (executes Battery 01 only).

### 2.2 ROTATING_KEYS (Supabase/Stripe)
**Frequency**: Quarterly or post-incident.
**Procedure**:
1. Generate new keys in Supabase/Stripe Dashboard.
2. Update Vercel Env Vars (`SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`).
3. Update Worker Env Vars.
4. Redeploy both Frontend and Workers.
5. Verify `checkRunEligibility` still passes for Certified orgs.

---

## 🔍 DEBUGGING & TRIAGE

### 3.1 HIGH_ESCAPE_RATE (>1%)
**Symptom**: Too many organizations failing certification inappropriately.
**Investigation**:
1. Check `simulateAttack` probability in `activities.ts`. Default should be `0.0001`.
2. Analyze `armageddon_events` for specific battery failures using SQL:
   ```sql
   SELECT battery_id, count(*) as failures 
   FROM armageddon_events 
   WHERE event_type = 'breach' 
   AND created_at > NOW() - INTERVAL '1 hour'
   GROUP BY battery_id;
   ```

### 3.2 STUCK_WORKFLOWS
**Symptom**: Runs stuck in `running` state > 10 mins.
**Remediation**:
1. Check Temporal UI for `ActivityTaskTimedOut`.
2. Inspect `batteries_executed` array in `armageddon_runs`.
3. Terminate workflow if non-recoverable:
   ```bash
   tctl workflow terminate --workflow_id <id> --reason "Stuck > 10m"
   ```
4. Update `armageddon_runs` status to `failed` manually if needed.

---

## 📋 ONBOARDING (OPS)

### 4.1 ADD_CERTIFIED_ORG (Manual Override)
If Stripe integration fails or for VIP/Internal testing.
```sql
UPDATE organizations 
SET current_tier = 'certified' 
WHERE slug = 'target-org-slug';
```

### 4.2 PROVISION_SANDBOX
New tenants need a clean sandbox ID.
1. Add `SANDBOX_TENANT_ID` to Worker config.
2. Verify isolation:
   ```bash
   npm run check-isolation --tenant=<id>
   ```

---

> **REMEMBER**: "Compliance is a checklist. Armageddon is a guarantee."
> **DO NOT** disable safety guards to "just make it work".
