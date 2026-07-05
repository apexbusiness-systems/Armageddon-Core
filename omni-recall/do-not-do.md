# Do Not Do

1. **NEVER** bypass auth checks using `.includes()` or other substring matching logic.
2. **NEVER** log, print, or commit secrets.
3. **NEVER** weaken security tests (e.g., base64 regex constraints, SSRF rules) to pass broken implementations.
4. **NEVER** invent file paths, test results, or "done" claims without machine-verifiable evidence.
