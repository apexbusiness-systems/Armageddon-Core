---
name: universal-user-shoes-validation
description: Validates any product surface — UI screen, API, CLI, agent or chat flow, dashboard, or document — the way a real first-time user would experience it, then issues a GO, NO-GO, or BLOCKED decision backed by evidence. Use when asked to audit, certify, harden, rescue, release-gate, or "test like a user" a feature, screen, endpoint, modal, or flow, or to write a go/no-go report. Does not cover isolated unit-level code review with no user-facing surface.
license: Proprietary - APEX Business Systems Ltd.
---

# universal-user-shoes-validation

**Input**: a product surface — a URL, repo path, API spec, CLI command, agent transcript, or document — plus its claimed purpose.
**Output**: a GO / NO-GO / BLOCKED decision with an evidence matrix, written to chat or to an evidence pack.
**Success**: every visible action is proven working, honestly gated, or explicitly blocked; no claim ships without evidence.
**Fails when**: the surface is judged by reading code instead of using it, "quality" is reduced to compiling/typechecking, or a decision ships without evidence.

## Operating Standard

Validate every product as a first-time user would, not as a compiler. A surface passes only when that user can tell what it is for, what action to take, what happened, and — if blocked — why. This applies identically to a button, an endpoint, a CLI flag, an agent's reply, or a paragraph of documentation.

Never trade product clarity or experience quality for code reduction. Simplify backend logic, contracts, routing, and tests freely; never flatten a premium UI, strip a meaningful error message, or erase domain-specific context just to make a diff smaller.

## Load References

- `references/domain-playbooks.md` — first, to classify the surface's domain and find its entry point, prerequisites, and quality axis.
- `references/validation-rubric.md` — when making the GO / NO-GO / BLOCKED call.
- `references/report-templates.md` — when producing audit reports, evidence matrices, or implementation handoff prompts.

Use `scripts/create_validation_pack.py` to scaffold a repeatable evidence folder for any scope or domain.

## Workflow

### 1. Classify the surface, then establish its truth

```
What is being validated?
+- UI (web/mobile/desktop)    -> entry point = the screen/route a user opens
+- API / backend endpoint     -> entry point = the request a client sends
+- CLI / script / dev tool    -> entry point = the command and its flags
+- Agent / chat / voice flow  -> entry point = the user's first message
+- Dashboard / data surface   -> entry point = the view on load
+- Document / content / page  -> entry point = the heading a reader sees first
```

Then, regardless of domain, answer:
1. What does this surface claim to do?
2. What would a user expect immediately after the primary entry point?
3. What is the real job it has to do?
4. What systems, data, or prerequisites does it depend on?
5. What should happen, visibly, when those prerequisites are missing?

If docs, code, tests, and runtime behavior disagree, declare the drift before proposing any fix.

### 2. Test in the user's shoes

For every surface in scope:
- enter it from the same entry point a real user would use, not a debug shortcut;
- read labels, copy, or output as if seeing them for the first time;
- exercise the primary action and every secondary action;
- record, per action: works / honestly gated / fails;
- check whether it still feels like the same product as everything around it;
- capture domain-appropriate evidence (see Evidence Rules) whenever direct access is available.

A surface that renders or responds but serves no logical user purpose is NO-GO.

### 3. Preserve quality

Reject any change that:
- makes the surface flatter, more generic, or strips meaningful context;
- breaks the product's established visual or verbal language;
- replaces a meaningful custom surface with a bare default;
- hides broken functionality behind a cleaner-looking wrapper.

Approve a quality-affecting change only when before/after evidence proves the result is equal-or-better in quality and clearer in function.

### 4. Harden interaction behavior

Every visible action must be exactly one of:
- working and verified;
- locally handled and verified;
- disabled or gated with honest, specific copy;
- explicitly unavailable because a named prerequisite is missing.

Unsupported actions must never fire a call that returns a generic failure. Never let raw internal identifiers, stack traces, fake success states, silent no-ops, or misleading labels reach the user.

### 5. Produce a decision

GO only when user-shoes testing, tests, and evidence all pass. NO-GO when the surface is misleading, broken, degraded, or untestable as claimed. BLOCKED only when a named external condition prevents validation — state the exact blocker and the next executable action.

## Evidence Rules

Collect whatever the domain makes available:
- UI: before screenshot, opened-surface screenshot, post-action screenshot;
- API/CLI: the exact request/command and the exact response/output;
- Agent flow: the verbatim transcript of the exchange;
- Document: the rendered output as a reader would see it;
- every domain: the system call made (if any) and the user-visible result.

Never include secrets, tokens, cookies, session IDs, API keys, passwords, or other credentials in any evidence artifact, regardless of domain.

## Output Rules

Lead with the decision. Separate confirmed facts, observed runtime behavior, source-code evidence, assumptions, blockers, and next executable actions. A handoff prompt for an implementation agent always names: the mission, the non-negotiables, surfaces to inspect, exact behavior to implement, tests to add, evidence required, and the GO/NO-GO rule that will judge the result.

## References

- `references/domain-playbooks.md` — per-domain entry points, prerequisites, quality axis, and drift patterns.
- `references/validation-rubric.md` — decision scale, hard caps, quality-preservation gate.
- `references/report-templates.md` — evidence matrices, GO/NO-GO report, handoff prompt skeleton.
