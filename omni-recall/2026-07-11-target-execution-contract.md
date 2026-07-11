---
date: 2026-07-11
status: verified-against-repository
---

# 2026-07-11 — Target Execution Contract Repair

## Context
A review rejected the Render stability change because the self-serve web execution path could claim a run started against the operator-selected target while the Cloudflare edge `/api/run` path persisted only tier/model/battery metadata. The pending Supabase dispatcher therefore started Temporal workflows without `targetEndpoint`.

## Durable correction
- `/api/run` edge parsing must preserve a validated `targetEndpoint` into `armageddon_runs.config`.
- The Node pending-run dispatcher must forward `config.targetEndpoint` into `ArmageddonLevel7Workflow` args.
- The direct Node `/api/run` path must apply the same persistence/forwarding contract.
- `start.sh` watchdog logic must not place a nonzero `wait -n` directly under `set -e`; capture the status under `set +e`, kill the sibling process, and exit with the captured code.
- Cloudflare workflow YAML should be parser-validated after edits; an over-indented env key made `.github/workflows/deploy-cloudflare.yml` unloadable.

## Verification commands used
- `npm run typecheck:core && npm run typecheck:site`
- `npm --prefix armageddon-site run test -- --run tests/unit/worker-run-integrity.test.ts tests/unit/api-run-target-endpoint.test.ts`
- `python - <<'PY' ... yaml.safe_load(...) ... PY`
- local bash reproduction of `wait -n` nonzero exit handling under `set +e`
