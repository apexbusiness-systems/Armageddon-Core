# Validation Rubric

## Contents
- Decision scale (GO / NO-GO / BLOCKED)
- User-shoes questions
- Hard caps
- Quality preservation gate

## Decision scale

### GO

Use GO only when all are true:
- the surface's purpose is clear from its own labels or output;
- the primary path works or is honestly gated;
- every visible action works, is locally handled, or shows a clear prerequisite message;
- no raw internal identifiers, stack traces, or fake placeholders reach the user;
- quality — visual, verbal, or functional — is preserved or improved;
- tests and collected evidence support the claim;
- no secrets or unsafe data are exposed.

### NO-GO

Use NO-GO if any are true:
- the entry point produces no visible or logical result;
- the surface serves no relevant user purpose;
- the user is routed to the wrong flow or response;
- an unsupported action fires a call that returns a generic failure;
- a stack trace, raw error code, or a `Failed to fetch`-class message reaches the user without context;
- raw internal identifiers leak into user-facing labels;
- a control, field, or section is blank or misleading;
- quality degrades versus the prior state;
- tests fail;
- required evidence is missing.

### BLOCKED

Use BLOCKED only when validation cannot complete because of a named external condition — an auth wall, an incomplete deployment, a missing environment, an unavailable test account, or an unauthorized connector. State the exact blocker and the next action that would unblock it.

## User-shoes questions

For each surface, answer:
1. What is this for?
2. What can I do here?
3. What happens when I take the primary action?
4. Did it work?
5. If it could not work, did the product clearly say why?
6. Does this feel like the same product as everything around it?
7. Would this survive being shown to a real customer right now?

## Hard caps

Apply these caps even when automated tests pass:
- entry point produces no visible result: max 60
- user routed to the wrong flow or response: max 65
- unsupported action returns a generic failure: max 70
- a generic network or stack-trace error reaches the user: max 75
- raw internal identifiers are visible to the user: max 80
- a blank or misleading control is present: max 75
- quality degrades versus the prior state: max 70
- a quality-affecting change ships without before/after evidence: max 85
- secrets or credentials are exposed: max 40

## Quality preservation gate

For every change that affects what a user sees, hears, or reads, require:
- a "before" capture;
- an "after" capture;
- a stated reason the user's value is preserved;
- a stated reason the product's established language — visual or verbal — is preserved;
- a pass/fail decision.

Reject any change that reduces domain-specific meaning, removes useful context, flattens a premium surface, or makes the result feel generic.
