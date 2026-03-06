# Armageddon E2E User Story: Onboarding → Operation → Certification → Artifact Export

## Objective
Define a deterministic end-to-end workflow for a first-time operator to onboard into Armageddon, execute a full certification campaign through the UI/UX, receive certification, and print/download/export final artifacts with verifiable audit trace.

## Persona
- **Primary Actor**: Security Program Manager (SPM)
- **Secondary Actors**: QA Lead, Compliance Officer, DevOps Operator
- **System Actors**: Armageddon UI (`armageddon-site`), Core worker (`armageddon-core`), Temporal orchestration, Postgres persistence, certification artifact generator

## Preconditions
1. Deployment is healthy and reachable on configured host.
2. SIM mode enabled.
3. Workspace build completed for shared/core/site packages.
4. User has valid org access and scoped test permissions.

## Business Invariants (Must Never Break)
1. A certification run has one immutable run identifier.
2. Every critical action writes an audit event.
3. Final certification is generated only from completed mandatory batteries.
4. Exported artifact hash must match server-side recorded hash.
5. Re-running failed steps is idempotent and does not duplicate certification records.

## Primary Success Scenario

### Phase 1 — Onboarding & Access Provisioning
1. SPM opens onboarding route and authenticates.
2. UI presents organization profile setup (org name, compliance mode, risk profile).
3. User confirms acceptable use and simulation boundaries.
4. System validates profile input; rejects malformed values with actionable inline errors.
5. On submit, platform provisions:
   - workspace profile
   - default battery policy bundle
   - runbook and emergency controls visibility
6. User lands on readiness dashboard with system health cards and “Start Certification” CTA.

**Acceptance criteria**
- Onboarding completes in one guided flow.
- Validation errors are explicit and non-blocking to corrected submission.
- Readiness dashboard appears with healthy dependency status.

### Phase 2 — Certification Campaign Initialization
1. User clicks **Start Certification**.
2. UI opens campaign wizard:
   - select profile (standard/strict)
   - include attack battery sets
   - configure execution window
3. Summary page displays deterministic plan and estimated duration.
4. User confirms execution; system creates campaign run ID and queue entry.
5. Temporal workflow starts and progress stream appears in UI.

**Acceptance criteria**
- Run ID visible and copyable.
- Wizard confirmation cannot proceed with invalid settings.
- Campaign state transitions are observable (queued → running).

### Phase 3 — Live UI/UX Operation During Run
1. Operator watches live battery statuses: pending/running/pass/fail/retry.
2. Operator can inspect each battery details (inputs, outputs, reason codes).
3. If a non-fatal failure occurs, user triggers scoped retry from UI.
4. Retry is idempotent and linked to same campaign ID.
5. System highlights blockers and recommends next action.

**Acceptance criteria**
- No hard refresh required for status fidelity.
- Retry action cannot create duplicate battery records.
- Failure reasons are human-readable and machine-auditable.

### Phase 4 — Certification Resolution
1. When all mandatory batteries complete, workflow computes final verdict.
2. UI presents certification result panel:
   - certification level
   - score breakdown
   - failed/waived items
   - issuance timestamp
3. Operator reviews attestations and acknowledges result.
4. Platform mints immutable certification artifact package.

**Acceptance criteria**
- Certification unavailable until mandatory gates complete.
- Verdict computation reproducible for same run data.
- Artifact package references exact run ID and integrity hash.

### Phase 5 — Print / Download / Export Artifact
1. User selects one or more output modes:
   - **Print-ready PDF**
   - **JSON evidence bundle**
   - **CSV summary export**
2. UI shows artifact metadata (size, hash, generation time).
3. User downloads and validates hash in UI utility.
4. User optionally prints certificate from PDF view.
5. System logs export action to audit trail.

**Acceptance criteria**
- Download links are signed/scoped and expire safely.
- Printed output contains run ID + verification hash.
- Audit trail captures who exported what and when.

## Alternate/Exception Paths
- **A1: Onboarding validation failure** → remain on form, preserve inputs, show field-level remediation.
- **A2: Dependency degraded at campaign start** → block start, show health failure and remediation runbook link.
- **A3: Mid-run worker interruption** → campaign pauses/retries per policy, status reflects recovery.
- **A4: Artifact generation failure** → surface explicit error; allow re-generate without duplicating certification issuance.
- **A5: Export permission denied** → block export, show role requirements.

## E2E Test Matrix for This Story
1. Happy-path onboarding to certification export.
2. Invalid onboarding payload recovery.
3. Run initialization with invalid profile blocked.
4. Mid-run failure + retry idempotency.
5. Certification gate enforcement with missing mandatory battery.
6. Artifact hash parity between UI and server source.
7. Permission boundary on export controls.
8. Audit trail completeness for onboarding/start/retry/export.

## Exit Criteria
- All critical-path E2E checks pass.
- No P0/P1 defects on onboarding, run control, certification verdict, or artifact export.
- Certification artifact generated and hash-verified.
- Audit events present for every regulated action.
