# SonarCloud Gate Policy

| Metric               | Target     | Status           | Set By | Review Date |
|----------------------|------------|------------------|--------|-------------|
| Reliability Rating   | A          | Enforced via UI  | [ROLE] | [DATE]      |
| Security Rating      | A          | Enforced via UI  | [ROLE] | [DATE]      |
| Maintainability      | A          | Enforced via UI  | [ROLE] | [DATE]      |
| Coverage             | ≥80%       | THRESHOLD_UNSET  | [ROLE] | [DATE]      |
| Duplication          | ≤3%        | THRESHOLD_UNSET  | [ROLE] | [DATE]      |

## Gate Lock Procedure

Lock Quality Gate in SonarCloud project settings.
Disallow 'leak period' bypass. Any change to gate targets
requires Privacy Officer + Engineering Lead sign-off.
