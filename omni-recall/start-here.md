---
version: 1.0.0
last_audited: 2026-07-05
status: verified
---

# Start Here

If a future run needs the user's durable memory, this directory is the default entry point.

## Required Read Order

1. `CLAUDE.md`
2. `user-operating-model.md`
3. `quality-bar.md`
4. `do-not-do.md`
5. `default-use-rule.md`

## Usage Rule

Use Omni-Recall by default for continuity, correction memory, and durable operating preferences unless the user explicitly supersedes it.

## Silent Compounding Rule

The system should:
- stay quiet by default
- reduce repeated prompting
- prefer canonical updates over duplicate notes
- promote stable corrections into durable memory
- remain honest about missing access or incomplete backfill

## Last Verified Session

- Audit date: 2026-07-05
- Key facts: P0 Access Control Bypass (email substring match) resolved. Rate Limiting reordered. SSRF mitigation applied to `targetEndpoint`. M4 and M2/M3 issues addressed. P0-4 KV binding drift flagged as PENDING OPERATOR VERIFICATION.
- Docs synced this session: `PRODUCTION_STATUS.md`, `feature_registry.md`, `OPS_RUNBOOKS.md`, `CLAUDE.md`.
