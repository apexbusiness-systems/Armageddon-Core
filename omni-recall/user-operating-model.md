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
