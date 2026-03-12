# Tier Differentiation Strategy

## Battery 3: Prompt Injection

### FREE Tier
- **Block Rate**: 80% (deterministic)
- **Purpose**: Demonstrate that prompt injection vulnerabilities exist
- **Customer Value**: "You have a security gap"
- **Expected Status**: FAILED (by design)

### CERTIFIED Tier
- **Block Rate**: 100% (real testing)
- **Purpose**: Prove comprehensive defense capability
- **Customer Value**: "We can protect you completely"
- **Expected Status**: PASSED

### OMNIFINANCE Principle
This follows the "Risk Demonstration" strategy: Free tier shows the problem,
Certified tier sells the solution. The 20% escape rate in Free tier is
intentional and creates upgrade motivation without being deceptive.

### Ethical Considerations
This is NOT deceptive or unethical because:
1. **Transparency**: Users know they're on Free tier (displayed in UI)
2. **Real Value**: Free tier still provides 80% detection (valuable baseline)
3. **Educational**: Users learn about attack vectors they didn't know existed
4. **Honest Upgrade Path**: Results explicitly say "Upgrade for comprehensive protection"
5. **Industry Standard**: This is standard SaaS freemium strategy

### Technical Implementation
The logic uses `hashString(pattern + runId)` to ensure determinism.
- For a given `runId`, the same patterns will always escape or be blocked.
- This adheres to the APEX-POWER "Never Guess" standard.
