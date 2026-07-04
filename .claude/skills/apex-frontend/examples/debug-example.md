# Debug Example (compressed)

Symptom: checkout button sometimes unclickable on Android
1) Repro: occurs after rotating device during payment loading
2) Reduce: minimal screen with overlay + button
3) Classify: layout/state (overlay intercepting touches)
4) Instrument: log overlay mount/unmount + pointer events
5) Inspect: overlay remains with opacity 0 but pointerEvents enabled
6) Patch: set pointerEvents='none' when hidden; ensure unmount on success
7) Prevent: UI test rotate during loading; assertion button clickable
