# Security Policy

**Docs version**: 2026.05.15<br>
**Last reviewed**: 2026-05-15<br>
**Scope**: Security expectations for the Armageddon repository and Moat runtime

## Supported Versions

| Version line | Supported |
| --- | --- |
| 2.x | Yes |
| 1.x | No |

## Vulnerability Reporting

Report vulnerabilities through the private APEX security reporting channel for this repository. Do not open public issues for vulnerabilities, do not paste secrets into tickets, and do not include exploit payloads that target systems outside the authorized test scope.

## Disclosure Policy

APEX follows coordinated disclosure for confirmed vulnerabilities. Public disclosure requires written approval from the repository owner after remediation or an approved disclosure window.

## Response SLA

- Acknowledge actionable vulnerability reports within 72 hours.
- Triage confirmed vulnerabilities by severity before remediation planning.
- Resolve confirmed critical and high-severity issues before production release approval.
- Resolve other confirmed issues within the remediation window approved by engineering and security leadership.

## Repository Security Requirements

- Keep `.env.moat.example` as the only committed Moat environment template.
- Never commit populated `.env.moat`, Supabase service-role keys, OAuth client secrets, provider API keys, or Cloudflare tokens.
- Do not remove `SIM_MODE`, circuit breakers, rate limits, auth checks, secret scanning, or deployment gates to make tests pass.
- Run the root validation gates before release: `npm ci`, `npm run docs:check`, `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
