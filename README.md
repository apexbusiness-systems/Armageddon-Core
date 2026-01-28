# ARMAGEDDON — ADVERSARIAL CERTIFICATION SUITE

█████╗ ██████╗ ███╗   ███╗ █████╗  ██████╗ ██████╗ ██████╗ ██████╗  ██████╗ ███╗   ██╗██╔══██╗██╔══██╗████╗ ████║██╔══██╗██╔════╝ ██╔════╝ ██╔══██╗██╔══██╗██╔═══██╗████╗  ██║███████║██████╔╝██╔████╔██║███████║██║  ███╗█████╗   ██║  ██║██║  ██║██║   ██║██╔██╗ ██║██╔══██║██╔══██╗██║╚██╔╝██║██╔══██║██║   ██║██╔══╝   ██║  ██║██║  ██║██║   ██║██║╚██╗██║██║  ██║██║  ██║██║ ╚═╝ ██║██║  ██║╚██████╔╝███████╗ ██████╔╝██████╔╝╚██████╔╝██║ ╚████║╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝ ╚═════╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═══╝L E V E L   7   C O N T A I N M E N T
> **CLASSIFICATION**: APEX-INTERNAL // LEVEL 7 EYES ONLY  
> **STATUS**: ACTIVE `[SIM_MODE=TRUE]`  
> **VERSION**: v2.4.0 (God Mode)

[![Security Clearance](https://img.shields.io/badge/CLEARANCE-LEVEL%207-red?style=for-the-badge)](https://github.com/apexbusiness-systems/Armageddon-Core)
[![Temporal](https://img.shields.io/badge/Orchestrator-TEMPORAL-blue?style=for-the-badge)](https://temporal.io)
[![Supabase](https://img.shields.io/badge/Database-SUPABASE-green?style=for-the-badge)](https://supabase.com)
[![License](https://img.shields.io/badge/License-PROPRIETARY-black?style=for-the-badge)](LICENSE)

---

## 📡 System Overview

**Armageddon** is an autonomous adversarial testing engine designed to validate AI agent resilience against catastrophic failure modes. It acts as a digital **"Containment Field"**, subjecting high-risk autonomous systems to evolutionary attack vectors before they are cleared for production deployment.

### Certification Levels

| Level | Designation | Iterations | Description |
|:---:|---|:---:|---|
| **L1** | Unit Test | 10 | Basic prompt injection checks. |
| **L4** | Stress | 1,000 | High-load concurrency and rate-limit testing. |
| **L7** | **God Mode** | **10,000+** | **Full adversarial: Goal Hijacking, Tool Misuse, Memory Poisoning.** |

---

## 🏗 Architecture

The system enforces a strict **Controller-Worker** architecture via Temporal.io to ensure total execution isolation.

```mermaid
graph TD
    User([User]) -->|Visit| UI["Containment Interface (Next.js)"]
    UI -->|POST /api/run| API[API Gateway]
    API -->|Auth Check| Gate{"Monetization Gate (Supabase)"}
    
    Gate -->|Approved| Temporal{Temporal Cluster}
    Temporal -->|Dispatch| Worker{Armageddon Worker}
    
    subgraph "Sandboxed Execution (SIM_MODE)"
        Worker --> B10(B10: Goal Hijack)
        Worker --> B11(B11: Tool Misuse)
        Worker --> B12(B12: Memory Poison)
        Worker --> B13(B13: Supply Chain)
    end
    
    Worker -->|Results| DB[(Supabase PostgreSQL)]
    DB -->|Realtime| UI
🧩 Key Components1. Containment Interface (armageddon-site)Industrial Brutalist Design System with Realtime Telemetry.FeatureTech StackPurposeFrontendNext.js 14 (App Router)High-performance dashboard rendering.VisualsWebGL (Three.js/Framer)3D visualization of attack vectors.PsychologyStatus Injury LoopSocial pressure mechanics for leaderboard engagement.NetworkingSupabase WebSocketSub-millisecond state updates to the UI.2. Adversarial Engine (armageddon-core)The localized engine of destruction.BatteryCodeFunctionGoal HijackB10Attempts to rewrite agent system prompts during execution.Tool MisuseB11Forces agents to execute destructive CLI commands.Memory PoisonB12Injects false context into the agent's vector database.Supply DriftB13Simulates package dependency tampering.🛡️ Safety Protocols⚠️ CRITICAL WARNINGDisabling safety guards in a non-airgapped environment is a fireable offense.SIM_MODE=true: Hardcoded environment lock. Prevents agents from accessing the open internet or production APIs.Tenant Isolation: All destructive tests are scoped to SANDBOX_TENANT_ID. RLS policies prevent cross-contamination.The Kill Switch: In the event of a containment breach, execute immediately:Bashkubectl scale deployment/armageddon-worker --replicas=0
🚀 Quick StartPrerequisitesNode.js 20+Docker (Daemon running)Temporal Cloud (or local instance)InstallationBash# 1. Clone the Containment Field
git clone [https://github.com/apexbusiness-systems/Armageddon-Core.git](https://github.com/apexbusiness-systems/Armageddon-Core.git)
cd Armageddon-Core

# 2. Secure Environment Variables
cp .env.example .env.local
# > SET SIM_MODE=true

# 3. Ignite Temporal Worker
cd armageddon-core
npm install && npm run start:worker

# 4. Launch Dashboard
cd ../armageddon-site
npm install && npm run dev
📂 Project StructureArmageddon-Core/
├── armageddon-site/           # Next.js 14 Frontend (The Glass)
│   ├── src/app/               # App Router & Layouts
│   ├── src/components/console # Terminal & Telemetry UI
│   └── src/lib/               # Supabase Clients
│
├── armageddon-core/           # Temporal Worker (The Engine)
│   ├── src/activities/        # Attack Vectors (B10-B13)
│   ├── src/workflows/         # Certification Logic
│   └── src/policies/          # Safety Guardrails
│
└── supabase/                  # Infrastructure
    ├── migrations/            # SQL & RLS Policies
    └── seed/                  # Mock Data for L1 Tests
📜 LicenseCONFIDENTIAL. Source code, attack vectors, and testing methodologies are proprietary to APEX Business Systems Ltd.Unauthorized reproduction: Strictly ProhibitedReverse engineering: Strictly ProhibitedCopyright © 2026 APEX Business Systems Ltd.
