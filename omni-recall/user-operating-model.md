# User Operating Model

## Multi-Agent Orchestration
Tasks are decomposed into parallel agent missions (e.g., Editor, Terminal, Browser agents).

## Verification Protocol
All completed work must be strictly verified before being declared complete:
- Git metadata and commit history.
- Unit and E2E test passes.
- Lint and typecheck exits with 0.
- Production build passes.
- A-grade maintained on SonarCloud.

## Standing Constraints (confirmed 2026-09-28)
- No new dependencies, vendors, SDKs or paid services unless explicitly approved (e.g. Stripe via raw `fetch` + WebCrypto, never the SDK).
- Surgical, minimal diffs; contain blast radius; no reformatting.
- Fix pre-existing defects found along the way (with a regression test) instead of leaving TODOs.
- Never fabricate runs, verdicts, certificates, payment status or entitlements; mark unproven live state UNVERIFIED.
- Never push to `main` or trigger a production deploy; the owner merges.
- Never commit a document that quotes a secret (redact first).
