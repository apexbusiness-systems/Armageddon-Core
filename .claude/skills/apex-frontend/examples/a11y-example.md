# A11y Example (compressed)

Issue: modal not reachable via keyboard + SR reads unlabeled icons
Fix: role=dialog, focus trap, aria-labelledby, icon buttons get labels
Verify: tab order correct, escape closes, SR announces title and controls
