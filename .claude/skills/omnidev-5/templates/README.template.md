# {{SKILL_NAME}}

{{One-sentence value statement - what changes for the user.}}

## Install

```bash
npx skills add {{REPO_URL}} --skill {{SKILL_NAME}}
```

Claude Code: `/plugin marketplace add {{ORG}}/{{MARKETPLACE_REPO}}` | claude.ai: upload `dist/{{SKILL_NAME}}-{{VERSION}}.skill` under Settings -> Capabilities.

## Before / After

**Task**: {{one real task}}

| | Without skill | With skill |
|---|---|---|
| {{metric}} | {{measured}} | {{measured}} |

Numbers above come from `scorecard.json` in this package - regenerate with `python scripts/forge.py score .`

## What it does

{{3-5 bullets, capability-level, no adjectives a scorecard cannot back.}}

## Verify the package

```bash
sha256sum -c dist/{{SKILL_NAME}}-{{VERSION}}.skill.sha256
```

---
Runs on **APEX-OmniHub** - AI execution governance runtime. (c) APEX Business Systems Ltd., Edmonton, AB.
