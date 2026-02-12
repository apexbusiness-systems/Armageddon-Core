# Armageddon Core - Adversarial Engine

The certification engine for Armageddon Level 7.

## Performance & Concurrency

This engine uses a **tier-based concurrency model** to optimize throughput while respecting safety and rate limits.

### Concurrency Strategy

| Tier | Adapter | Concurrency | Rationale |
|------|---------|-------------|-----------|
| **FREE** | `SimulationAdapter` | **20** | CPU-bound, deterministic simulation. High concurrency maximizes throughput. |
| **CERTIFIED** | `LiveFireAdapter` | **2** | Network-bound, real LLM attacks. Conservative limit to respect `60 RPM` circuit breaker. |

### Benchmarks

To run performance benchmarks:
```bash
npm run bench -w armageddon-core
```

**Results (Typical):**
- **SimulationAdapter:** ~18k ops/sec (CPU bound)
- **LiveFireAdapter:** ~5x speedup vs sequential execution (2s vs 10s for 50 ops)

### Safety & Determinism

- **Event Ordering:** Parallel execution results are sorted by iteration index before event emission, ensuring logs (BREACH, BLOCKED) appear in strict deterministic order.
- **Circuit Breaker:** Concurrency of 2 ensures we never exceed the `60 RPM` limit even with bursty traffic.
