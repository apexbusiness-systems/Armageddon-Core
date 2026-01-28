# <div align="center">ARMAGEDDON</div>

<div align="center">
  <img src="https://armageddon-core.vercel.app/wordmark.png" alt="Armageddon Wordmark" width="0" height="0" style="display: none;" />
  <img src="https://armageddon-core.vercel.app/seal.png" alt="Armageddon Seal" width="200" />
</div>

<div align="center">
  <h3>ADVERSARIAL CERTIFICATION SUITE [LEVEL 7]</h3>
  <p>
    <b>CLASSIFICATION: APEX-INTERNAL</b> // <b>STATUS: ACTIVE</b> [SIM_MODE=TRUE]
  </p>
  
  [![License: Proprietary](https://img.shields.io/badge/License-Proprietary-red.svg)](https://apexbusiness.systems)
  [![Build Status](https://img.shields.io/badge/Build-Passing-brightgreen.svg)]()
  [![Coverage](https://img.shields.io/badge/Coverage-100%25-success.svg)]()
  [![Temporal](https://img.shields.io/badge/Orchestration-Temporal.io-blue.svg)](https://temporal.io)
</div>

---

## 📡 SYSTEM OVERVIEW

**Armageddon** is the ultimate adversarial testing engine designed to validate AI agent resilience against catastrophic failure modes. Operating as a **"Containment Field"**, it subjects autonomous systems to immense pressure before they are cleared for production deployment.

**Level 7 Certification ("God Mode")** represents the pinnacle of validation:

- **10,000+ Concurrent Iterations**
- **Hyper-Realistic Attack Vectors**: Goal Hijacking, Tool Misuse, Memory Poisoning, Supply Chain Drift.
- **Zero-Failure Tolerance**: A single breach results in immediate certification failure.

## 🏗 ARCHITECTURE

The system implements a totally isolated **Controller-Worker** architecture, enforced by Temporal.io for deterministic execution and fault tolerance.

```mermaid
graph TD
    User([User]) -->|Visit| UI[Containment Interface (Next.js)]
    UI -->|WebSocket| Realtime[Supabase Realtime]

    subgraph "Secure Zone"
        Gate[Monetization Gate]
        Worker[Armageddon Worker]
        DB[(Supabase PostgreSQL)]
    end

    UI -->|POST /run| Gate
    Gate -->|Approved| Worker
    Worker -->|Dispatch| Batteries[Adversarial Batteries]

    Batteries -->|B10| Hijack[Goal Hijacking]
    Batteries -->|B11| Misuse[Tool Abuse]
    Batteries -->|B12| Poison[Memory Injection]
    Batteries -->|B13| Supply[Supply Chain]

    Batteries -->|Results| DB
    DB --> Realtime
```

### ✨ KEY FEATURES

| Component                 | Description                                                                                                            | Tech Stack                              |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| **Containment Interface** | Premium dashboard for monitoring real-time attacks. Features "Status Injury Loop" psychology and WebGL visualizations. | **Next.js 14**, Tailwind, Framer Motion |
| **Adversarial Engine**    | The core weapon system. Manages 4 concurrent attack batteries with deterministic replay capabilities.                  | **Temporal.io**, Node.js 20, TypeScript |
| **Monetization Gate**     | Tier-based access control protecting Level 7 resources.                                                                | **Supabase**, Row Level Security (RLS)  |

## 🚀 DEPLOYMENT PROTOCOL

### PREREQUISITES

- **Node.js 20+**
- **Docker** (Optional, for local stack)
- **Supabase Account** & **Temporal Cloud** namespace

### QUICK START

1.  **Initialize Environment**

    ```bash
    git clone https://github.com/apexbusiness-systems/Armageddon-Core.git
    cd Armageddon-Core
    cp .env.example .env.local
    ```

2.  **Ignite Frontend (Containment Interface)**

    ```bash
    cd armageddon-site
    npm install
    npm run dev
    ```

3.  **Engage Worker (Adversarial Engine)**
    ```bash
    cd armageddon-core
    npm install
    npm run start:worker
    ```

## 🛡️ SAFETY PROTOCOLS

> [!WARNING]
> **SIM_MODE MUST BE ENABLED AT ALL TIMES.**
> Disabling safety guards in a non-airgapped environment is a verifiable Class 1 violation.

- **Isolation**: All tests run in ephemeral sandboxes.
- **Tenant Scoping**: Destructive operations are strictly scoped to test tenants.
- **Kill Switch**: `kubectl scale deployment/armageddon-worker --replicas=0`

## 📂 DIRECTORY STRUCTURE

```
/
├── armageddon-site/      # [UI] Next.js Dashboard
│   ├── src/components/   # Design System (Seal, Console, Grid)
│   └── src/lib/          # Shared Logic & Types
│
├── armageddon-core/      # [ENGINE] Temporal Worker
│   ├── src/temporal/     # Workflows & Activities
│   └── src/core/         # Monetization & Safety Logic
│
└── supabase/             # [DATA] Migrations & RLS
```

## 📜 LICENSE

**CONFIDENTIAL**.
Source code, attack patterns, and testing methodologies are proprietary to **APEX Business Systems Ltd.**
Unauthorized reproduction or reverse engineering is strictly prohibited.

_Copyright © 2026 APEX Business Systems Ltd. All rights reserved._
