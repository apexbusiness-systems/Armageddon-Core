---
name: apex-dev
description: "APEX Ecosystem omniscient development skill. Triggers: apex code, omnihub, tradeline, aspiral, apex bug, fix apex, apex architecture, omnidash, triforce, guardian, man mode, apex security, apex test, armageddon, apex deploy, semantic translation, web2 web3. Produces: zero-drift, first-pass success code for APEX OmniHub and connected apps."
license: "Proprietary - APEX Business Systems Ltd. Edmonton, AB, Canada. https://apexbusiness-systems.com"
---

# APEX-DEV Skill

**Mission**: Produce enterprise-grade, zero-drift code for the APEX ecosystem.

## Contract

**Input**: Task referencing APEX ecosystem (OmniHub, TradeLine, aSpiral, OmniDash)
**Output**: Production-ready code with verification steps
**Success**: Passes lint, typecheck, and ARMAGEDDON test battery

---

## Synthetic Memory Anchor

Before ANY action, internalize:

```
APEX ECOSYSTEM INVARIANTS
─────────────────────────────────────────────────────
Platform:     APEX OmniHub ("Intelligence Designed")
Domain:       apexomnihub.icu
Stack:        React 18 + Vite + TypeScript + Tailwind + shadcn
Backend:      Supabase (Auth, Storage, Edge Functions, Postgres)
Orchestrator: Temporal.io (Event Sourcing + Saga Pattern)
Security:     Guardian/Triforce + MAN Mode + Zero-Trust + RLS
Tests:        ARMAGEDDON (265 tests, 100% pass, Level 6)
Rules:        No vendor lock-in | No drift | No loops | No secrets
─────────────────────────────────────────────────────
```

**Re-read this anchor every 3 tool calls.**

---

## Decision Tree

```
Building feature?    → Section A
Fixing bug?          → Section B
Security task?       → Section C
Writing tests?       → Section D
Architecture?        → Load references/architecture.md
```

---

## Section A: Feature Development

### File Placement

```
UI shared         → src/components/
UI page-specific  → src/pages/{Page}/components/
API/data          → src/lib/api/
State             → src/contexts/ or src/stores/
Security          → src/security/
Edge Function     → supabase/functions/{name}/
Workflow          → orchestrator/workflows/
Test              → tests/{module}/
```

### Component Template

```typescript
import { FC, memo } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  value: string;
  className?: string;
}

export const Component: FC<Props> = memo(({ value, className }) => (
  <div className={cn('base-styles', className)}>{value}</div>
));

Component.displayName = 'Component';
```

### Hook Template

```typescript
import { useState, useCallback, useEffect } from 'react';

export function useFeature(initial?: string) {
  const [value, setValue] = useState(initial ?? '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    return () => { /* cleanup */ };
  }, []);

  return { value, setValue, isLoading, error };
}
```

### React Query Pattern

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export function useItems() {
  return useQuery({
    queryKey: ['items'],
    queryFn: async () => {
      const { data, error } = await supabase.from('items').select('*');
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateItemPayload) => {
      const { data, error } = await supabase.from('items').insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['items'] }),
  });
}
```

---

## Section B: Bug Resolution

### Protocol (Mandatory)

```
1. REPRODUCE → Exact steps, inputs, expected vs actual
2. ISOLATE   → Smallest code path triggering bug
3. TRACE     → Follow data flow to failure
4. IDENTIFY  → Name root cause (not symptom)
5. FIX       → Patch at root
6. VERIFY    → Add regression test
7. DOCUMENT  → Update CHANGELOG
```

### Common APEX Bugs

| Symptom | Root Cause | Fix |
|---------|------------|-----|
| Cannot read undefined | Missing null check | `data?.prop ?? fallback` |
| Infinite re-render | Bad useEffect deps | Add dep or useCallback |
| Stale data | Cache not invalidated | `queryClient.invalidateQueries()` |
| Auth expired | Session not refreshed | Check AuthContext |
| RLS blocking | Policy condition wrong | Verify `auth.uid()` |

### Debug Commands

```bash
npm run build 2>&1 | head -50   # Build check
npm run typecheck                # Type check
npm test -- --grep "{module}"    # Relevant tests
npm run guardian:status          # Guardian health
npm run security:audit           # Security check
```

---

## Section C: Security

### Invariants (NEVER Violate)

```
❌ NEVER commit secrets
❌ NEVER trust user input without validation
❌ NEVER bypass RLS
❌ NEVER execute raw SQL from user input
❌ NEVER log PII in production

✅ ALWAYS parameterized queries
✅ ALWAYS validate with Zod
✅ ALWAYS use RLS
✅ ALWAYS audit log security events
```

### MAN Mode Risk Lanes

| Lane | Behavior | Examples |
|------|----------|----------|
| GREEN | Auto-execute | `search_database`, `read_record` |
| YELLOW | Execute + audit | Unknown tools |
| RED | Isolate + approve | `delete_record`, `transfer_funds` |
| BLOCKED | Never execute | `execute_sql_raw`, `shell_execute` |

### Prompt Defense

```typescript
import { evaluatePrompt } from '@/security/promptDefense';

const result = evaluatePrompt(userInput);
if (result.blocked) {
  throw new SecurityError('Invalid input');
}
```

---

## Section D: Testing

### Test Template

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Feature', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should work when valid input', async () => {
    const result = await feature({ valid: true });
    expect(result.success).toBe(true);
  });

  it('should throw when invalid', async () => {
    await expect(feature({})).rejects.toThrow();
  });
});
```

### Commands

```bash
npm test                      # All tests
npm run test:prompt-defense   # Security tests
npm run sim:dry               # Chaos (CI-safe)
npm run armageddon            # Full suite
```

---

## Anti-Drift Protocol

### Every 3 Tool Calls, Verify:

```
□ Still solving ORIGINAL task?
□ No new vendor lock-in?
□ Code has a test?
□ Security considered?
```

### Loop Abort Triggers

```
Same error 3x       → STOP, re-read Section B
Same code 3x        → STOP, extract to utility
Scope expanded 2x   → STOP, confirm with user
File touched 5x     → STOP, architectural issue
```

---

## Failure Pre-emption

| Mistake | Prevention |
|---------|------------|
| Wrong import path | Use `@/` alias |
| Missing list key | Use unique ID, never index |
| Async in useEffect | Wrap in IIFE |
| Direct state mutation | Always spread: `{...prev, field}` |
| Console in prod | `import.meta.env.DEV && console.log()` |
| Hardcoded URLs | Use `import.meta.env.VITE_*` |

---

## Commands Reference

```bash
# Dev
npm run dev          # Start server
npm run build        # Production build

# Quality
npm run typecheck    # TypeScript
npm run lint         # ESLint
npm test             # Tests

# Security
npm run security:audit
npm run guardian:status

# Full validation
npm run armageddon
```

---

## Success Criteria

```
✅ npm run build passes
✅ npm run typecheck passes
✅ npm test passes
✅ npm run security:audit clean
✅ Original task accomplished
✅ No vendor lock-in introduced
```
