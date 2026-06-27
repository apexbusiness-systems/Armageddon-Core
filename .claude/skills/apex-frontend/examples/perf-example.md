# Perf Example (compressed)

Issue: feed scroll janks on mid-range devices
Budget: <5% frame drops
Measure: profiling shows heavy re-render on each scroll tick
Fixes: memoize row, stable keys, virtualization window, image resize+cache
Re-measure: frame drops reduced from 18% → 3%
