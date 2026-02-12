# ADR 001: Parallel Battery Execution

## Status
Accepted

## Context
The `SimulationAdapter` (Free Tier) and `LiveFireAdapter` (Certified Tier) adversarial batteries were executed sequentially. This led to suboptimal performance, especially for network-bound operations in the `LiveFireAdapter` (200ms+ latency per request).

## Decision
We implemented a tier-based parallel execution model using manual chunking.

### Concurrency Limits
- **SimulationAdapter (FREE):** Concurrency = 20.
  - Reason: CPU-bound, deterministic simulation. High concurrency maximizes throughput without external rate limits.
- **LiveFireAdapter (CERTIFIED):** Concurrency = 2.
  - Reason: Network-bound, real LLM attacks. Conservative limit chosen to stay strictly under the `60 RPM` (1 RPS) circuit breaker limit defined in `armageddon-core`.

### Implementation Details
- **Manual Chunking:** Used a custom `executeWithConcurrency` helper instead of adding dependencies like `p-limit`.
- **Event Ordering:** Results are sorted by original iteration index before event emission to preserve deterministic log order (BREACH, BLOCKED events appear as if executed sequentially).
- **Progress Reporting:** `upsertProgress` is called during execution (fire-and-forget) to provide real-time feedback, while final consistency is ensured by the sorted results processing.

## Consequences
- **Positive:**
  - `LiveFireAdapter` performance improved by ~5x (2s vs 10s for 50 ops).
  - `SimulationAdapter` remains highly efficient (18k ops/sec).
  - No new dependencies added.
- **Negative:**
  - Slight increase in code complexity for result sorting and chunking.
  - `LiveFireAdapter` burstiness increased (2 requests at once), but mitigated by low concurrency limit.
