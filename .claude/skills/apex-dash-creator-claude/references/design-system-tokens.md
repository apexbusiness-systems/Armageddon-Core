# APEX DASHBOARD DESIGN SYSTEM TOKENS
## Complete Color, Typography, Spacing, Component Reference

---

## COLOR SYSTEM

### Semantic Tokens (use in all dashboards)
```css
:root {
  /* Status / Semantic */
  --color-success:    #22C55E;  /* green-500  — positive, up, good */
  --color-warning:    #F59E0B;  /* amber-500  — caution, neutral change */
  --color-error:      #EF4444;  /* red-500    — negative, down, bad */
  --color-info:       #3B82F6;  /* blue-500   — informational, neutral */
  --color-neutral:    #6B7280;  /* gray-500   — no change, inactive */

  /* Surface */
  --surface-primary:   #FFFFFF;
  --surface-secondary: #F9FAFB;  /* gray-50 */
  --surface-elevated:  #FFFFFF;
  --surface-overlay:   rgba(0,0,0,0.4);

  /* Text */
  --text-primary:   #111827;  /* gray-900 */
  --text-secondary: #6B7280;  /* gray-500 */
  --text-muted:     #9CA3AF;  /* gray-400 */
  --text-inverse:   #FFFFFF;

  /* Border */
  --border-primary:   #E5E7EB;  /* gray-200 */
  --border-secondary: #F3F4F6;  /* gray-100 */
  --border-focus:     #3B82F6;  /* blue-500 */
}

.dark {
  --surface-primary:   #0F172A;  /* slate-900 */
  --surface-secondary: #1E293B;  /* slate-800 */
  --surface-elevated:  #1E293B;
  --text-primary:   #F1F5F9;  /* slate-100 */
  --text-secondary: #94A3B8;  /* slate-400 */
  --text-muted:     #64748B;  /* slate-500 */
  --border-primary:   #334155;  /* slate-700 */
  --border-secondary: #1E293B;  /* slate-800 */
}
```

### Chart Color Palettes

**Okabe-Ito (Colorblind-Safe Categorical — RECOMMENDED):**
```
#E69F00  (orange)
#56B4E9  (sky blue)
#009E73  (green)
#F0E442  (yellow)
#0072B2  (blue)
#D55E00  (vermillion)
#CC79A7  (pink)
#000000  (black — use sparingly)
```

**Sequential (single metric, light to dark):**
```
5-step blue:  #EFF6FF → #BFDBFE → #60A5FA → #2563EB → #1E3A8A
5-step green: #F0FDF4 → #BBF7D0 → #4ADE80 → #16A34A → #14532D
```

**Diverging (above/below zero):**
```
Negative → Neutral → Positive
#EF4444  → #F3F4F6 → #22C55E  (red-neutral-green)
#2563EB  → #F3F4F6 → #D97706  (blue-neutral-amber — colorblind safe)
```

---

## TYPOGRAPHY SCALE

```css
/* Dashboard Type System */
.metric-value {
  font-size: clamp(32px, 4vw, 48px);
  font-weight: 700;
  font-variant-numeric: tabular-nums;  /* MANDATORY for numbers */
  letter-spacing: -0.02em;
}

.metric-delta {
  font-size: 14px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.section-label {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-secondary);
}

.chart-label {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-secondary);
}

.chart-value {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.caption {
  font-size: 11px;
  font-weight: 300;
  color: var(--text-muted);
}
```

---

## SPACING SYSTEM

```
Base unit: 4px (0.25rem)

Spacing scale:
  xs:  4px   (0.25rem)  — icon gaps, tight inline
  sm:  8px   (0.5rem)   — card internal spacing
  md:  16px  (1rem)     — card padding, component gaps
  lg:  24px  (1.5rem)   — section gaps
  xl:  32px  (2rem)     — major section separations
  2xl: 48px  (3rem)     — page-level margins

Chart margins (Recharts):
  top: 8px | right: 16px | bottom: 32px | left: 48px

Grid gutters:
  Desktop: 24px
  Tablet:  16px
  Mobile:  12px
```

---

## COMPONENT SPECIFICATIONS

### Loading State (Skeleton)
```tsx
// ALWAYS use skeleton, NEVER spinner for data loading
function ChartSkeleton({ height = 300 }) {
  return (
    <div className="animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-1/3 mb-4" />  {/* title */}
      <div className={`bg-gray-100 rounded`} style={{ height }} />
    </div>
  )
}

function KPICardSkeleton() {
  return (
    <div className="animate-pulse p-4 border rounded-lg">
      <div className="h-3 bg-gray-200 rounded w-1/2 mb-3" />
      <div className="h-8 bg-gray-200 rounded w-3/4 mb-2" />
      <div className="h-3 bg-gray-100 rounded w-1/3" />
    </div>
  )
}
```

### Error State
```tsx
function ChartError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-6">
      <AlertCircle className="w-8 h-8 text-red-400" />
      <p className="text-sm text-gray-600">Failed to load data</p>
      <p className="text-xs text-gray-400">{error.message}</p>
      <button
        onClick={onRetry}
        className="text-sm text-blue-600 hover:underline"
      >
        Retry
      </button>
    </div>
  )
}
```

### Empty State
```tsx
function ChartEmpty({ message = "No data for selected period" }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2 text-center p-6">
      <BarChart2 className="w-8 h-8 text-gray-300" />
      <p className="text-sm text-gray-500">{message}</p>
      <p className="text-xs text-gray-400">Try adjusting your filters</p>
    </div>
  )
}
```

### Last Refresh Indicator
```tsx
function RefreshIndicator({ lastUpdated, isLoading }: { lastUpdated: Date; isLoading: boolean }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-400">
      {isLoading
        ? <Loader2 className="w-3 h-3 animate-spin" />
        : <CheckCircle2 className="w-3 h-3 text-green-400" />
      }
      <span>Updated {format(lastUpdated, 'HH:mm:ss')}</span>
    </div>
  )
}
```

---

## ANIMATION GUIDELINES

```
Principle: Animate meaning, not decoration

✓ Data transitions: 300ms ease-out (chart updates)
✓ Skeleton shimmer: 1.5s ease-in-out infinite
✓ Tooltip appear: 100ms fade-in
✓ Filter panel slide: 200ms ease-out
✗ Chart mount animation: DISABLE if data > 1000 points
✗ All animation: DISABLE if prefers-reduced-motion

CSS:
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

*APEX-DASH-CREATOR Design System Tokens v2.0 — APEX Business Systems Ltd. © 2026*
