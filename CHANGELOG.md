# Changelog

All notable changes to this project will be documented in this file.

## [2.1.1] - 2026-02-11

### Fixed

- **Shared Package**: Removed invalid export of `./temporal` from `@armageddon/shared` (Fixes TS2307 build error).
- **Code Quality**: Resolved SonarQube code smells in `worker.ts` and `generate_certs.js` (switched to `node:fs` / `node:path`).
- **Docs**: Updated deployment and ops runbooks to reflect latest state.

## [2.1.0] - 2026-02-08

### Added

- **Hybrid Cloud Moat**: Initial release of the "Moat" infrastructure.
- **Kinetic Engine**: Node.js/Python hybrid execution context.
- **Safety Protocols**: "Kill Switch" and "Sim Mode" enforcement.
