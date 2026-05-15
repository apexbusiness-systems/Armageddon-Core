# Privacy Statement

**Docs version**: 2026.05.15<br>
**Last reviewed**: 2026-05-15<br>
**Scope**: Repository test suites, local tooling, and Moat-oriented validation flows

This repository's automated test suites and local tooling are designed to run against simulated or operator-provided test data. Do not use production personally identifiable information in local tests, Moat validation, generated evidence bundles, screenshots, or logs.

## Data Handling Rules

- Use synthetic or sandbox data for local and CI validation.
- Do not commit populated environment files, credentials, screenshots containing private user data, or exported production records.
- Keep Supabase service-role credentials and OAuth secrets in approved secret stores only.
- Delete local generated artifacts that contain sensitive operational data unless retention is explicitly approved.
