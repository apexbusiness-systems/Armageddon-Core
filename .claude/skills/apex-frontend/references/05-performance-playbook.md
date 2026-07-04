# PERF Playbook

## Non-negotiable sequence
Budget → Measure → Bottleneck → Fix hot path → Re-measure

## Common wins
- Lists: virtualization, stable keys, memoize row, windowing
- Images: resize, lazy-load, cache, avoid huge decode on main thread
- Rendering: reduce re-renders, avoid layout thrash, flatten overdraw
- Networking: paginate, compress, prefetch, debounce
- Animations: prefer compositor-friendly transforms; respect reduced motion

## Output
- Budget table
- Profiling evidence
- Before/after metrics
