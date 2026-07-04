# universal-user-shoes-validation

Validates any product surface — UI, API, CLI, agent flow, dashboard, or document — the way a real first-time user would, then renders an evidence-backed GO / NO-GO / BLOCKED decision instead of a "looks fine to me."

## Install

```bash
# claude.ai — Settings -> Capabilities -> Upload skill
# upload dist/universal-user-shoes-validation-1.0.0.skill

# Claude Code (manual, always works)
cp -r universal-user-shoes-validation ~/.claude/skills/
# or, project-scoped:
cp -r universal-user-shoes-validation .claude/skills/

# skills.sh ecosystem (once published to your own repo)
npx skills add <your-repo-url> --skill universal-user-shoes-validation
```

## Before / After

**Task**: ship a redesigned feature without quietly breaking it or flattening its design.

| | Without this skill | With this skill |
|---|---|---|
| Validation method | Code review — assumes correctness if it compiles | First-time-user walkthrough of the live entry point; every action proven or honestly gated |
| Quality regression | Caught after launch, if at all | Caught pre-merge via a mandatory before/after evidence gate |
| Decision artifact | A verbal opinion | A written GO / NO-GO / BLOCKED report with an evidence matrix |
| Domain coverage | Whatever the reviewer happens to know | UI, API, CLI, agent flow, dashboard, document, and process — one shared rubric |

Package metrics below are measured, sourced from `scorecard.json` (regenerate with `python scripts/forge.py score .`):

| Metric | Value |
|---|---|
| Rubric score | 100/100 |
| Lint failures / warnings | 0 / 0 |
| Always-loaded cost (name + description) | ~121 est. tokens |
| SKILL.md body (loaded on trigger) | ~1,398 est. tokens (budget: 2,500) |
| SKILL.md length | 106 lines (budget: 200) |
| Reference depth (loaded only on demand) | domain-playbooks.md ~941 · validation-rubric.md ~715 · report-templates.md ~534 est. tokens |
| Trigger eval coverage | 10 should-trigger / 10 should-not-trigger, validated |

## What it does

- Classifies any surface — UI, API, CLI, agent/chat flow, dashboard, document, or internal process — and identifies its real entry point and prerequisites before judging it.
- Tests from the same entry point a real user would use, and records whether every visible action works, is honestly gated, or fails.
- Gates quality-affecting changes behind a before/after evidence requirement so redesigns cannot quietly flatten or generify a product.
- Produces a GO / NO-GO / BLOCKED decision with a full evidence matrix, plus an implementation handoff prompt when work remains.
- Ships a script to scaffold a repeatable, domain-tagged evidence pack for any validation scope.

## Verify the package

```bash
sha256sum -c dist/universal-user-shoes-validation-1.0.0.skill.sha256
```

---
An APEX Business Systems Ltd. skill engineering release — vendor-agnostic, built to the open Agent Skills format. (c) APEX Business Systems Ltd., Edmonton, AB, Canada.
