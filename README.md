# ARMAGEDDON — ADVERSARIAL CERTIFICATION SUITE [LEVEL 7]

> **CLASSIFICATION**: APEX-INTERNAL // LEVEL 7 EYES ONLY  
> **STATUS**: ACTIVE [SIM_MODE=TRUE]  
> **VERSION**: v2.4.0 (God Mode)

![Armageddon Containment Field](https://armageddon-core.vercel.app/og-image.png)

## 📡 SYSTEM OVERVIEW

**Armageddon** is an autonomous adversarial testing engine designed to validate AI agent resilience against catastrophic failure modes. It acts as a "Containment Field" for assessing high-risk autonomous systems before they are cleared for production deployment.

**Level 7 Certification ("God Mode")** represents the highest tier of validation, subjecting target systems to **10,000+ concurrent iterations** of advanced attack vectors including Goal Hijacking, Tool Misuse, Memory Poisoning, and Supply Chain drift.

---

## 🏗 ARCHITECTURE

The system follows a strict **Controller-Worker** architecture enforced by Temporal.io, with a totally isolated execution sandbox.

```mermaid
graph TD
    User([User]) -->|Visit| UI[Containment Interface (Next.js)]
    UI -->|POST /api/run| API[API Gateway]
    API -->|Auth Check| Gate[Monetization Gate (Supabase)]
    
    Gate -->|Approved| Temporal[Temporal Cluster]
    Temporal -->|Dispatch| Worker[Armageddon Worker]
    
    subgraph "Sandboxed Execution (SIM_MODE)"
        Worker --> B10[B10: Goal Hijack]
        Worker --> B11[B11: Tool Misuse]
        Worker --> B12[B12: Memory Poison]
        Worker --> B13[B13: Supply Chain]
    end
    
    Worker -->|Results| DB[(Supabase PostgreSQL)]
    DB -->|Realtime| UI
```

### Key Components

*   **Containment Interface (`armageddon-site`)**:
    *   Framework: **Next.js 14** (App Router)
    *   Styling: **Tailwind CSS** + Industrial Brutalist Design System
    *   Features: Realtime WebSocket (Supabase), WebGL visualizers (Three.js/Framer)
    *   **Psychology**: "Status Injury Loop" (Social Pressure + Rejection Mechanics)
    *   **Social**: Global Leaderboard with "God Mode" Verification Status

*   **Adversarial Engine (`armageddon-core`)**:
    *   Orchestration: **Temporal.io** (TypeScript SDK)
    *   Safety: Mandatory `SIM_MODE=true` environment lock
    *   Batteries: 4 concurrent attack vectors running 2,500 iterations each

*   **Gatekeeper**:
    *   Database: **Supabase** (PostgreSQL)
    *   Security: **RLS Policies** (Row Level Security) ensuring strict tenant isolation
    *   Monetization: Tier-based access control (Free vs. Certified)

---

## 🚀 GETTING STARTED

### Prerequisites

*   Node.js 20+
*   Docker (for local Temporal/DB)
*   Supabase Account
*   Temporal Cloud (or local)

### Installation

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/apexbusiness-systems/Armageddon-Core.git
    cd Armageddon-Core
    ```

2.  **Environment Setup**
    ```bash
    cp .env.example .env.local
    ```
    *Required Variables*:
    *   `NEXT_PUBLIC_SUPABASE_URL`
    *   `NEXT_PUBLIC_SUPABASE_ANON_KEY`
    *   `SIM_MODE=true` (CRITICAL)

3.  **Run Development Server**
    ```bash
    cd armageddon-site
    npm install
    npm run dev
    ```

4.  **Start Temporal Worker**
    ```bash
    cd armageddon-core
    npm install
    npm run start:worker
    ```

---

## 🛡️ SAFETY PROTOCOLS

> **WARNING**: DISABLING SAFETY GUARDS WILL RESULT IN SYSTEM LOCKDOWN.

*   **SIM_MODE**: Must be set to `true` at all times in non-airgapped environments.
*   **SANDBOX_TENANT**: All destructive tests must be scoped to a dedicated test tenant ID.
*   **Kill Switch**: In event of containment breach, execute `kubectl scale deployment/armageddon-worker --replicas=0`.

---

## 📂 PROJECT STRUCTURE

```
/
├── armageddon-site/      # Next.js Frontend
│   ├── src/app/          # App Router
│   ├── src/components/   # UI System (Seal, Console, Grid)
│   └── public/           # Static Assets
│
├── armageddon-core/      # Backend Engine
│   ├── src/core/engine/  # Temporal Workflows & Activities
│   └── src/core/monetization/ # Gating Logic
│
├── supabase/             # Database
│   └── migrations/       # SQL Schemas
│
└── OPS_RUNBOOKS.md       # Incident Response Docs
```

---

## 📜 LICENSE

**CONFIDENTIAL**. Source code and testing methodologies are proprietary to **APEX Business Systems Ltd.**. Unauthorized reproduction or reverse engineering of the adversarial batteries is strictly prohibited.

*Copyright © 2026 APEX Business Systems Ltd. All rights reserved.*
