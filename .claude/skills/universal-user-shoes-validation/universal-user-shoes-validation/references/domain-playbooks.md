# Domain Playbooks

## Contents
- Domain table: entry point, user expectation, prerequisites, quality axis, evidence, drift pattern
- Extending to non-digital deliverables

Use this file to classify a surface before testing it. Pick the closest domain row; if a surface spans two domains (e.g. a CLI that calls an API), validate each layer against its own row.

## Domain table

| Domain | Entry point | User expects | Prerequisites to check | Quality axis | Evidence | Common drift pattern |
|---|---|---|---|---|---|---|
| UI — web/mobile/desktop | the screen/route opened the way a user opens it (nav, link, deep link) | the screen does what its label or icon promises | auth state, feature flags, required data fetch | visual and interaction unity with the rest of the product | before/after screenshots, click-through | a redesign that flattens the surface or drops module-specific meaning |
| API / backend endpoint | the exact request a real client sends (method, path, auth, body) | a documented, predictable response shape and status code | auth scope, rate limits, required headers/params | contract stability and error-message clarity | the request and response pair, with status code | a breaking schema or status-code change shipped without a version bump |
| CLI / script / dev tool | the command as typed, including realistic flags, in a cold environment | clear output, a non-zero exit code on failure, a useful `--help` | required env vars, installed dependencies, working directory | specific, actionable error text over a stack dump | the exact command plus captured stdout/stderr/exit code | a silently swallowed flag, or a generic traceback replacing a clear error |
| Agent / chat / voice flow | the user's first message, with no prior context primed | the agent stays in scope, asks before destructive actions, and explains any block | tool/connector availability and the agent's auth to those tools | the agent never fabricates a tool result or an unverifiable fact | the verbatim transcript, including tool calls and their results | a hallucinated tool result, or a broken handoff between turns |
| Dashboard / data surface | the view as it loads cold, before any filter is touched | the numbers shown are live and labeled accurately, not silently mocked | data source freshness, loading/error/empty states | accuracy of what is claimed to be "live" versus placeholder | a screenshot plus the data source actually queried | mock or demo data still wired into a surface presented as production |
| Document / content / page | the heading and first paragraph a reader sees | the claim matches what the product or process actually does today | last-verified date, the source of truth it should match | the words match current reality, not a past release | the rendered text plus a side-by-side against real behavior | a claim that no longer matches the shipped product |
| Business process / internal SOP | the first step a person performing the task would actually take | the step works against the current system, not a prior version | the system/tool versions the SOP assumes | the SOP still matches the live system end to end | a literal run-through against the current system | an SOP describing a control or flow that has since moved or been removed |

## Extending to non-digital deliverables

The same five questions in `SKILL.md` §1 — claimed purpose, user expectation, real job, prerequisites, honest failure behavior — apply to non-digital surfaces such as packaging, print collateral, or a physical unboxing flow. Evidence becomes a photograph, a physical walkthrough note, or a recipient's account in place of a screenshot. The GO / NO-GO / BLOCKED logic in `validation-rubric.md` is unchanged; only the evidence medium differs.
