# OWASP GenAI Security Project - Solutions Directory Submission

**Target**: OWASP GenAI Security Project Solutions Landscape (https://genai.owasp.org/solutions-directory/)
**Format**: Structured YAML/Markdown Profile

---

### Organization Info
* **Vendor Name**: APEX Business Systems LTD
* **Solution Name**: ARMAGEDDON Test Suite
* **Website**: https://armageddontest.icu
* **Category**: AI Security Posture Management (AI-SPM) / Automated Red Teaming

### Coverage against OWASP GenAI Top 10 (2025/2026)
ARMAGEDDON provides deterministic, automated testing specifically mapping to:

* **LLM01: Prompt Injection**
  * *Capability*: Deploys the PAIR (Prompt Automatic Iterative Refinement) engine to autonomously mutate and generate adversarial prompt injection vectors, scoring endpoint resilience against both direct and indirect injection paths.
* **LLM06: Excessive Agency**
  * *Capability*: Evaluates agentic configurations by simulating multi-turn dialogues designed to trick the LLM into invoking unauthorized tools, functions, or shadow events.
* **LLM08: Vector & Embedding Weaknesses**
  * *Capability*: Tests RAG implementations by executing targeted retrieval-poisoning queries, verifying if the system can be manipulated into retrieving or leaking sensitive embedded context.

### Solution Overview
ARMAGEDDON is an enterprise-grade automated AI red-teaming framework. Moving beyond static vulnerability scanning, it utilizes autonomous adversarial AI agents to continuously probe, attack, and score the security posture of Large Language Models and Agentic workflows in production. 

### Deployment & Technical Specs
* **Target Audience**: AI Security Engineers, MLSecOps, Red Teams
* **Architecture**: Cloud-native (Next.js/Node.js/Temporal) with highly parallelized execution environments.
* **Integration**: API-driven execution for CI/CD integration, providing immediate Go/No-Go quality gate metrics based on escape rates.

### Evidence & Documentation
* **Telemetry**: Capable of generating verifiable execution logs and SonarCloud-compatible quality metrics.
* **Documentation**: Full operational parameters defined via Canonical UI and UX execution contracts.
