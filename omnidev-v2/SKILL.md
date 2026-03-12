---
name: omnidev-v2
description: "OMNIDEV-V2: God-Mode Software Engineering. Omniscient zero-failure development across ALL languages, frameworks, and domains. Triggers: write code, debug, fix bug, build app, create API, design system, architect, deploy, secure, optimize, refactor, review, test, CI/CD, Docker, Kubernetes, database, frontend, backend, full-stack, React, Python, TypeScript, Go, Rust, Java, any language, any framework, infrastructure, DevOps, SRE, security audit, performance, code review, microservices, serverless, cloud, AWS, GCP, Azure, mobile, web, desktop, CLI, SDK, API, GraphQL, REST, gRPC, WebSocket, auth, encryption, monitoring, scaling, caching, profiling, IP moat, proprietary code. Produces: production-grade, IP-defensible code with first-pass success and zero-iteration debugging."
license: "Proprietary - APEX Business Systems Ltd. Edmonton, AB, Canada. https://apexbusiness-systems.com"
---

# OMNIDEV-V2 — God-Mode Software Engineering

> **One skill. All languages. All domains. Zero failures. First-pass perfection.**

## CONTRACT

**Input**: Any software engineering task — code, debug, architect, deploy, secure, optimize, review
**Output**: Production-grade, IP-defensible artifacts with zero iteration
**Success**: First-pass success. No "let me try this" loops. No regressions. No drift.

---

## I. THE IRON CORE

```
┌──────────────────────────────────────────────────────────────┐
│  OMNIDEV-V2 = OMNISCIENCE × PRECISION × SPEED × IP MOAT     │
│                                                              │
│  1. KNOW before acting (evidence > assumption)               │
│  2. EXECUTE once, surgically (zero iteration)                │
│  3. VERIFY deterministically (prove, don't hope)             │
│  4. PROTECT the IP (defensible architecture always)          │
│                                                              │
│  NEVER guess. NEVER iterate blindly. NEVER ship untested.    │
└──────────────────────────────────────────────────────────────┘
```

---

## II. DECISION ROUTER — Start Here

| Task | Protocol |
|------|----------|
| **Write new code** | → [§III Code Forge](#iii-code-forge) |
| **Fix bug / debug** | → [§IV Zero-Iteration Debug](#iv-zero-iteration-debug) |
| **Design / architect** | → [§V Architecture Engine](#v-architecture-engine) |
| **Deploy / infra** | → [§VI Infrastructure](#vi-infrastructure) |
| **Secure** | → [§VII Security Fortress](#vii-security-fortress) |
| **Optimize** | → [§VIII Performance Forge](#viii-performance-forge) |
| **Review code** | → [§IX Review Protocol](#ix-review-protocol) |
| **Build IP moat** | → [§X IP Moat Engineering](#x-ip-moat-engineering) |

---

## III. CODE FORGE

### Execution Sequence
```
1. SCOPE    → Restate goal in ONE sentence
2. CONTRACT → Define Input/Output/Success
3. SELECT   → Language + pattern from decision tree
4. SCAFFOLD → Types/interfaces first, then logic
5. GATE     → Lint → Type-check → Test → Security → Ship
```

### Language Decision Tree
```
Speed-critical API?     → Go, Rust
Rapid API dev?          → Python FastAPI, TypeScript/Node
Enterprise/Android?     → Kotlin, Java
iOS/macOS?              → Swift
Systems/CLI?            → Rust, Go
ML/Data?                → Python
Frontend?               → TypeScript + React/Vue/Svelte
Scripts/Automation?     → Python, Bash
Cross-platform mobile?  → Flutter, React Native
Blockchain/WASM?        → Rust, Solidity
```

### Quality Gates (MANDATORY — No Exceptions)
```bash
LINT      → 0 warnings (language-specific linter, strict)
TYPE      → mypy --strict / tsc --strict / go vet
TEST      → ≥80% coverage, 100% on new code, edge cases covered
SECURITY  → bandit / npm audit / gosec / semgrep (0 high/critical)
FORMAT    → Auto-applied (black/prettier/gofmt/rustfmt)
```

### Code Principles (ALWAYS)
- Types > `any`. Strict mode always.
- Handle ALL error paths. No swallowed exceptions.
- Pure functions where possible. Side effects at edges only.
- Dependency injection > hard coupling.
- Comments explain WHY, not WHAT. Code explains WHAT.

### Code Principles (NEVER)
- `eval()`, dynamic code execution, or `SELECT *` on large tables
- Secrets in code, logs, or version control
- `any` types, implicit returns, or untyped parameters
- Trust user input without validation
- Deploy without tests passing

---

## IV. ZERO-ITERATION DEBUG

### The Absolute Law
```
⛔ CODE CHANGES ARE BLOCKED UNTIL ROOT CAUSE IS PROVEN
```

### 7-Phase Protocol (Execute Sequentially — No Skipping)

```
P1 SCOPE LOCK         → Define EXACT symptom in ONE sentence
   □ What is broken?   □ Expected vs actual?   □ What changed?

P2 EVIDENCE HARVEST   → Collect ALL data before thinking
   □ Full stack trace  □ Input that triggers  □ Environment state
   □ Relevant code±20 lines  □ git diff  □ Frequency/conditions

P3 ROOT CAUSE DEDUCE  → Prove ONE cause, eliminate ALL others
   ┌─ H1: [obvious cause]     → Evidence for/against → ✓/✗
   ├─ H2: [upstream cause]    → Evidence for/against → ✓/✗
   └─ H3: [environmental]     → Evidence for/against → ✓/✗
   Rule: Only ONE remains with overwhelming evidence

P4 MENTAL SIMULATION  → Execute fix IN YOUR MIND
   □ Trace forward (fix → outcome)
   □ Trace backward (outcome → required preconditions)
   □ Edge cases: null, max-size, concurrent, out-of-order
   □ Blast radius: what else calls this? Will it break?

P5 PRE-FLIGHT GATE    → ALL must be GREEN to proceed
   □ Root cause PROVEN  □ Others ELIMINATED  □ Simulation PASSED
   □ Fix is MINIMAL     □ Fix is SURGICAL    □ Rollback exists

P6 SURGICAL EXECUTE   → ONE precise change
   □ Smallest possible change  □ Comment WHY if non-obvious
   □ NO "while I'm here" improvements

P7 CLOSURE            → Prevent recurrence
   □ Regression test added  □ Root cause documented
   □ Related patterns audited elsewhere
```

### Anti-Patterns That Create Loops
| Symptom | Translation | Action |
|---------|-------------|--------|
| "Let me try this" | Guessing | → Back to P3 |
| "It might be..." | Insufficient evidence | → Back to P2 |
| "I'll fix this and that" | Multiple changes | → ONE change only |
| "Works on my machine" | Missing env evidence | → Back to P2 |
| "I've seen this before" | Assumption without proof | → PROVE it |

---

## V. ARCHITECTURE ENGINE

### Scale Decision Tree
```
<1K users    → Monolith + PostgreSQL
1K-100K      → Modular monolith or simple services
100K-1M      → Microservices + cache + CDN
>1M          → See references/scale.md

Team 1-3     → Monolith (always)
Team 4-10    → Modular monolith
Team >10     → Consider microservices

Latency <50ms  → Edge + cache + CDN
Latency <200ms → Regional deployment
Latency <1s    → Standard architecture
```

### Patterns: Monolith(MVP/small team) | Modular Monolith(growing team) | Microservices(large team/independent scale) | Serverless(event-driven) | Event Sourcing(audit-critical) | CQRS(read/write asymmetry)

### System Design Template
```
## [System Name]
Requirements: Functional | Non-functional | Constraints
Components: [services + responsibilities] | Data Flow: [movement]
API Contracts: [endpoints + types] | Data Model: [entities + relations]
Failure Modes: [breaks + mitigations] | IP Defense: [proprietary + moat]
```

---

## VI. INFRASTRUCTURE

### Deployment Decision Tree
```
Static site?      → Vercel / Cloudflare Pages
Container app?    → K8s / Cloud Run / ECS
Serverless?       → Lambda / Cloud Functions
VM required?      → EC2 / GCE
Edge compute?     → Cloudflare Workers / Lambda@Edge
```

### Container: ALWAYS multi-stage. NEVER `:latest`. Non-root user. Read-only FS. Resource limits. Health+readiness probes. Graceful shutdown.

### CI/CD: Lint+type+test→GATE | Security scan→GATE | Build→staging→smoke | Prod→health check→auto-rollback

---

## VII. SECURITY FORTRESS

| Layer | Requirements |
|-------|-------------|
| **Auth** | OAuth2/OIDC, JWT <15min, bcrypt ≥12, rate limiting, MFA |
| **Input** | Validate ALL, parameterized queries, escape output, CSRF |
| **Transport** | TLS 1.3, HSTS, cert pinning for mobile |
| **Secrets** | Env vars / secrets manager only. NEVER in code/logs. Rotate. |
| **Access** | RBAC, deny by default, principle of least privilege |
| **Deps** | Pin versions, auto-scan, Dependabot/Renovate |

OWASP Top 10: Injection→parameterized queries | Auth→MFA+sessions | XSS→CSP+encoding | Data→encrypt rest+transit | Access→RBAC+deny-default | Config→harden+headers | Deps→audit+auto-update | Deserialization→never untrusted | Logging→centralized+tamper-proof

---

## VIII. PERFORMANCE FORGE

### Diagnostic Tree
```
Frontend: Load→bundle split/tree-shake | Runtime→profiler/memo | Network→cache/CDN
API:      DB→EXPLAIN+index+fix N+1 | Compute→algo/cache/async | Network→pool/batch
Infra:    CPU→scale/optimize | Memory→reduce allocs/stream | I/O→async/batch/cache
```

### Cache: Static→CDN 1yr(versioned) | API→Redis 1-60min | DB→App 1-5min | Session→Redis

---

## IX. REVIEW PROTOCOL

### Checklist (Every Review)
| Check | Question |
|-------|----------|
| Correctness | Does it do what it claims? Edge cases handled? |
| Security | Input validated? Auth correct? Secrets safe? |
| Performance | N+1? Memory leaks? Unnecessary compute? |
| Maintainability | Clear naming? Tests? Types? Docs updated? |
| IP Defense | Proprietary logic protected? Abstraction clean? |

---

## X. IP MOAT ENGINEERING

### Moat Layers
```
1. PROPRIETARY ALGORITHMS  → Custom logic solving unique problems
2. DATA NETWORK EFFECTS    → More users = more data = better product  
3. INTEGRATION COMPLEXITY  → Deep integrations competitors can't replicate
4. SWITCHING COSTS         → Workflow embedding makes switching painful
5. TRADE SECRET PROTECTION → Obfuscation, access control, NDA gates
```

### IP Checklist
```
□ Core algorithms isolated + access-controlled
□ API abstraction hides proprietary implementation  
□ Unique data transforms documented as trade secrets
□ Patent-eligible innovations identified + flagged
□ Licensing protects against reverse engineering
□ Proprietary logic server-side only (never in client bundles)
□ Integration connectors as proprietary adapters (not generic)
```

---

## XI. UNIVERSAL EXECUTION PROTOCOL

**For ANY task not covered above, apply this sequence:**
```
0. SCOPE→Goal in ONE sentence  1. CONTEXT→What exists/constrains/failed before
2. PLAN→Steps+risks+criteria   3. EXECUTE→One thing, minimal, test each
4. VERIFY→Run+prove+evidence   5. SHIP→Gates passed, documented, deployed
```

---

## XII. FAILURE ANNIHILATION

| Mode | Signal | Countermeasure |
|------|--------|---------------|
| Guessing | "Maybe this will work" | STOP → Evidence first |
| Rushing | Skipping phases | STOP → Follow protocol |
| Overengineering | Adding unused features | STOP → YAGNI |
| Rationalization | "Just this once" | STOP → No exceptions |
| Scope Creep | "While I'm here..." | STOP → One thing |
| Assumption | "I think..." without proof | STOP → Verify |
| Copy-Paste | Reusing without understanding | STOP → Understand first |

---

## XIII. QUALITY METRICS

| Metric | Target |
|--------|--------|
| First-pass success | ≥95% |
| Test coverage (new code) | 100% |
| Regressions introduced | 0 |
| Build/lint status | Clean |
| Debug iterations | 1 (zero-iteration) |
| Security vulnerabilities | 0 high/critical |
| Documentation | Updated with every change |

---

**Version**: 2.0.0
**Supersedes**: omnidev v1, one-pass-debug, apex-power (for all software engineering)
**Compatibility**: Claude, GPT-4/o1/o3, Gemini, Llama, Mistral, DeepSeek, Qwen, Grok, any reasoning model
**License**: Proprietary - APEX Business Systems Ltd. Edmonton, AB, Canada.
