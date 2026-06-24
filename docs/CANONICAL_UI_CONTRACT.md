# Canonical UI Contract — Public Marketing Surfaces

**Status**: Canonical<br>
**Last reviewed**: 2026-06-24<br>
**Enforced by**: `armageddon-site/tests/unit/canonical-ui-freeze.test.ts` (runs in CI via `npm run test -w armageddon-site`)<br>
**Review gate**: [`.github/CODEOWNERS`](../.github/CODEOWNERS)

This document freezes the agreed state of the public marketing surfaces (site
header, footer, and pricing page). It exists to stop drift, regression, and
unattended/rogue agent edits from silently changing conversion-critical UI.

**Changing any invariant below requires updating the matching assertion in the
guardrail test AND this document in the same change.** Never delete an assertion
to make CI pass — that is the exact failure mode this contract prevents.

## Frozen invariants

### Header — pricing entry point
- A persistent, visible `PRICING` nav link points to `/pricing`.
- The link renders for every visitor, independent of auth state — it sits
  outside the logged-in/logged-out branch in `AuthHeader.tsx`.
- The pricing entry point is **not** wired to the SIGN UP / LOGIN auth CTAs.

### Footer — conversion CTA
- The footer CTA (`GET CERTIFIED` / `START TESTING`) routes **only** to
  `/intake`, regardless of auth state. No other destination is permitted in the
  CTA handler.
- The `EDGE BY · CLOUDFLARE / LOCAL MOAT` deployment badge block is removed.
- The `CLOUDFLARE EDGE READY // LOCAL MOAT BACKED` deployment indicator is kept
  and centered (`justify-center`).

### Pricing page — cards
- Every card uses the `.pricing-card` contrast panel class (dark translucent
  panel that contrasts with `--void`, still on-brand).
- Every card CTA uses the `btn-primary` industrial-control style.
- Button uniformity comes from font sizing, **not** taller buttons — no
  `min-h-[…]` height pinning on the CTA. Long labels shrink text, not buttons.
- The onboarding/payment disclaimer line is always reserved (toggled with
  `invisible`) so all six cards stay vertically aligned.

### Pricing card CSS (`globals.css`)
- `.pricing-card` paints above the `.fire-glow` fixed mask via `z-index: 2`.
- The burning-flame hover/select effect is the `@keyframes pricing-flame`
  box-shadow animation applied on `.pricing-card:hover` / `:focus-within`.
- `.btn-secondary` is defined with the same physical footprint as `.btn-primary`.

### Pricing data + checkout routing
- Exactly six plans, published order: `self-serve`, `pro`, `team`, `verified`,
  `certified`, `enterprise`.
- The enterprise tier routes to `/intake?tier=enterprise` (scope review).

## North star — Industrial Physical Controls

All CTA buttons follow the `btn-primary` / `btn-secondary` industrial-control
styling, **except** the header auth buttons (SIGN UP / LOGIN / LOGOUT) and the
footer GET STARTED-family CTA, which keep their existing treatments. Buttons in
the same section of the same page must be uniform in size and position; if a
label is too long, reduce the text size or reflow it — never grow the button.

## How the guardrail fails a regression

`canonical-ui-freeze.test.ts` reads the source of the canonical files and
asserts each invariant above. An edit that, for example, re-points the footer
CTA away from `/intake`, drops the `/pricing` header link, removes the flame
animation, or re-introduces the `EDGE BY` badge will fail CI. Source-text
assertions are used deliberately because these components pull in framer-motion,
`next/navigation`, and Supabase auth, which are awkward to render headlessly.
