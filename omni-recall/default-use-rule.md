# Default Use Rule

When evaluating logic or deciding how to implement new rules in ARMAGEDDON:
1. Prioritize strict isolation over convenience (e.g., SIM_MODE must remain intact).
2. Fail closed rather than open on any error.
3. Keep production code changes minimal and deterministic.
4. Do not alter canonical UI contracts without full team alignment.
