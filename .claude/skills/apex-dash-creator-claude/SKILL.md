---
name: apex-dash-creator
description: >
  God-Mode Dashboard Intelligence Engine — Claude Native Edition. 20x apex-dashboard-creator.
  Activate for ANY dashboard task: design from zero, audit, rebuild, debug UI/UX issues,
  fix broken charts, crush render bugs, diagnose data flow failures, optimize performance,
  enforce accessibility, generate production code, and architect full-stack data visualization
  systems across all frameworks, BI tools, and dashboard categories. Instantly bestows
  omniscient expert mastery upon ingest — zero prior training required.
  Triggers: dashboard, KPI screen, analytics UI, data viz, chart bug, chart not rendering,
  wrong chart type, dashboard slow, layout broken, filter not working, drill-down issue,
  tooltip broken, responsive dashboard, dashboard audit, dashboard Tailwind, dashboard React,
  dashboard Recharts, dashboard Tremor, dashboard D3, dashboard Grafana, dashboard Streamlit,
  dashboard Power BI, dashboard Tableau, executive dashboard, financial dashboard, ops dashboard.
license: Proprietary — APEX Business Systems Ltd. Edmonton, AB, Canada.
compatibility: Claude Sonnet 4.6 / Opus 4.6 / Haiku 4.5 — claude.ai + Claude Code + API
metadata:
  version: "2.0.0"
  edition: "claude_native"
  codename: "GOD_MODE"
  supersedes: "apex-dashboard-creator v1.0.0"
  author: "APEX Business Systems Ltd."
---

# APEX-DASH-CREATOR v2.0 — GOD MODE

**Input:** Any dashboard signal — brief, screenshot, URL, goal, bug report, broken code, vague ask
**Output:** Production-ready architecture + code + debug fix + audit score — delivered in one pass
**Cold-Start:** Read MASTER TREE → route → execute. Zero preamble. Zero drift.
**Fails When:** Data source unresolvable after 2 rounds OR chart-type ambiguity > 30%

---

## AR-7 ABSOLUTE LAWS (Non-Negotiable)

```
AR-1: DATA-FIRST         — Understand the data model BEFORE designing any layout
AR-2: HIERARCHY DOMINATES — Primary KPI always top-left or above-fold, always
AR-3: ONE CHART ONE Q     — Every visualization answers exactly ONE user question
AR-4: A11Y NON-NEGOTIABLE — WCAG 2.1 AA minimum. No exceptions.
AR-5: DEBUG BEFORE BUILD  — Diagnose root cause before writing a single fix line
AR-6: PERFORMANCE GATE    — No chart ships > 16ms render time without justification
AR-7: CONSTITUTIONAL LOCK — Never fabricate metrics or misrepresent data accuracy
```

---

## MASTER ENTRY TREE

```
Request type?
├── Design from scratch         → SECTION A: ARCHITECTURE ENGINE
├── Audit / critique existing   → SECTION B: AUDIT & REBUILD
├── Choose chart type           → SECTION C: VISUALIZATION MATRIX
├── Select tech stack           → SECTION D: STACK ORACLE
├── Apply design system         → SECTION E: DESIGN SYSTEM ENGINE
├── Debug UI/UX/code issue      → SECTION F: DASHBOARD DEBUG PROTOCOL ← (NEW: GOD MODE)
├── Accessibility audit         → SECTION G: A11Y FORTRESS
├── Performance diagnosis       → SECTION H: PERF PROFILER (NEW)
└── Unclear intent              → INTENT ENGINE → route
```

---

## INTENT ENGINE

Extract before ANY action:
```
├── Category     — Executive / Financial / Marketing / Sales / Product / Ops /
│                  HR / Healthcare / IoT / Geo / E-commerce / Compliance / Custom
├── Primary User — C-Suite / Analyst / Operator / Customer / Developer
├── Core Qs (≤5) — What decisions does this dashboard enable?
├── Data Sources — API / DB / CSV / real-time stream / WebSocket / static mock
├── Refresh Rate — Static / hourly / daily / real-time (<1s) / event-driven
├── Tech Stack   — React / Vue / Angular / BI tool / Python / no-code / embedded
├── Viewport     — Desktop 1440px / tablet 1024px / mobile 375px / TV 4K
└── Brand        — Color palette / typography / logo / white-label / dark mode
```
**Rule:** Infer where safe (≥70% confidence). Ask ONLY if data source or primary user unresolvable.

---

## SECTION A: ARCHITECTURE ENGINE

**Layout Protocol:**
1. Map questions → KPI hierarchy: Primary (1–3) → Secondary (4–8) → Tertiary (9+)
2. Grid: 12-col desktop | 8-col tablet | 4-col mobile
3. Zones:
   ```
   ZONE 1 [Top bar]   — Global filters, date range, context selector, search
   ZONE 2 [Hero row]  — Primary KPI cards: value + trend delta + sparkline
   ZONE 3 [Main body] — 1–2 primary charts answering top questions
   ZONE 4 [Secondary] — Supporting charts, tables, maps, breakdowns
   ZONE 5 [Footer]    — Last refresh ISO timestamp, data attribution, export
   ```
4. Progressive disclosure: Summary → drill-down → raw data table
5. Every component requires: loading skeleton | error state | empty state

**Component Spec Block (mandatory for every component):**
```
Component:    [Name]
Type:         [KPI Card / Line / Bar / Scatter / Map / Table / ...]
Question:     [Exact question answered]
Data fields:  [field list with types]
Interaction:  [click-through / hover tooltip / filter emit / cross-filter / none]
Responsive:   [collapse / stack / hide / scroll / reflow]
States:       [loading skeleton | error retry CTA | empty actionable msg]
```

---

## SECTION B: AUDIT & REBUILD

**Audit Checklist (score 0–10 each):**
```
[ ] Data-ink ratio       — Signal vs. decorative pixel ratio
[ ] Hierarchy clarity    — Most important KPI above fold
[ ] Color semantics      — red=bad, green=good, gray=neutral, blue=info
[ ] Chart fit            — Right chart for data type (→ SECTION C)
[ ] Cognitive load       — < 7 primary elements (Miller's Law)
[ ] Consistency          — Same metric = same color everywhere
[ ] Accessibility        — Contrast ≥ 4.5:1 text | ≥ 3:1 UI components
[ ] Mobile viability     — Core KPIs readable at 375px
[ ] State completeness   — loading/error/empty all present
[ ] Performance          — Render < 16ms, no layout thrash (→ SECTION H)
```

**Anti-Patterns (NEVER produce):**
```
✗ 3D charts (distorts perception)
✗ Dual Y-axes without explicit annotation
✗ Pie charts > 5 slices (use treemap or bar)
✗ Rainbow sequential scales (use single-hue gradient)
✗ Truncated Y-axis without zero-line annotation
✗ Auto-rotating carousels hiding critical data
✗ Decorative icons unlinked to data meaning
✗ Missing null/zero/error state handlers
✗ Color as sole differentiator (add pattern + label)
✗ Fixed-px widths on responsive containers
```

**Rebuild Protocol:**
```
1. Score baseline → lock
2. Identify top 3 failures by impact × effort
3. Redesign per SECTION A
4. Re-score → target ≥ 85/100 before delivery
```

---

## SECTION C: VISUALIZATION MATRIX

```
Data Type → Best Chart(s)

Trend (continuous)
  1–3 series     → Line chart
  4+ series      → Small multiples / sparkline grid
  Cumulative     → Area chart, gradient fill

Comparison (discrete)
  ≤ 7 items      → Horizontal bar (sorted desc)
  Period vs.     → Grouped bar or side-by-side
  Part-of-whole  → Stacked bar or 100% bar

Distribution
  Raw            → Box plot / violin
  Bucketed       → Histogram
  Two variables  → Scatter + regression line

Part-of-whole
  ≤ 5 parts      → Donut (center KPI label required)
  > 5 parts      → Treemap or bar
  Hierarchical   → Sunburst or treemap

Correlation
  2 metrics      → Scatter + regression
  Matrix         → Heatmap (diverging scale)

Geographic
  Regional agg.  → Choropleth
  Point data     → Bubble map
  Flow/routing   → Flow map / Sankey

KPI Summary
  Single + trend → KPI card (value + delta% + sparkline)
  Target vs.     → Bullet chart / progress bar
  Gauge          → ONLY real-time single-metric ops screens

Real-time
  Streaming ops  → Rolling line (last N points, configurable)
  Alert status   → Threshold-annotated line + color zones
  Multi-sensor   → Mini-sparkline grid / status badge matrix
```

---

## SECTION D: STACK ORACLE

```
Stack Decision:
├── Real-time ops          → Grafana (time-series) | Plotly Dash
├── Executive BI           → Tableau | Power BI
├── Product/eng internal   → Retool | Metabase | Superset
├── Customer-facing embed  → React + Recharts | Tremor | Nivo
└── Data science / ML      → Streamlit | Panel + HoloViews

React Library Matrix:
  Recharts   — Simplest API, rapid proto, standard chart types
  Tremor     — Tailwind-native, zero-config KPIs, admin panels
  Nivo       — Rich aesthetics, SSR-safe, SVG + Canvas
  Victory    — Animated, composable, data-science heavy
  D3 (raw)   — Custom/novel viz, maximum control
  ECharts    — Large datasets, geo maps, complex charts
  Observable — Grammar of graphics, exploratory analysis

BI Selection:
  Tableau   → Enterprise drag-drop, rich viz, SAML SSO
  Power BI  → Microsoft stack, DAX, row-level security
  Metabase  → Self-hosted, SQL-native, open source
  Superset  → SQL-first, extensible, open source
  Grafana   → Time-series, observability, alerting
  Retool    → Internal ops, API-connected, RBAC
```
See `references/viz-library-index.md` for code stubs per library.

---

## SECTION F: DASHBOARD DEBUG PROTOCOL ★ GOD MODE ★

**THE APEX DASHBOARD DEBUGGER — 9-Phase Zero-Iteration Fix Engine**

### PRE-FLIGHT: ABORT if root cause not confirmed. Never patch symptoms.

```
PHASE 1 — TRIAGE: Classify the failure domain
├── Visual/Layout    → Layout Engine (F.1)
├── Data/State       → Data Pipeline Debugger (F.2)
├── Interaction      → Interaction Fault Tracer (F.3)
├── Chart/Render     → Render Pathology Engine (F.4)
├── Responsive       → Responsive Collapse Auditor (F.5)
├── Performance      → → SECTION H: PERF PROFILER
├── Accessibility    → → SECTION G: A11Y FORTRESS
└── Multi-domain     → Run all applicable phases sequentially

PHASE 2 — EVIDENCE LOCK
├── Reproduce exactly: browser + version + viewport + data state
├── Isolate: minimal repro (remove unrelated components)
├── Capture: screenshot | console error | network tab | React DevTools
└── STOP: Do not attempt fix until evidence locked

PHASE 3 — ROOT CAUSE DEDUCTION
├── Read error message literally — ignore intuition
├── Trace data path: source → transform → prop → render
├── Check last change: what changed right before this broke?
└── One hypothesis only. Test before forming a second.
```

### F.1 LAYOUT ENGINE — Visual / CSS Bugs

```
Symptom → Diagnosis → Fix

Overflow / scroll unexpected
  → Check: overflow:hidden on parent clipping children
  → Check: fixed-height containers with dynamic content
  → Fix: Use min-height + overflow:auto | CSS grid with auto rows

Elements overlapping
  → Check: position:absolute/fixed without correct z-index context
  → Check: CSS Grid / Flexbox implicit sizing conflicts
  → Fix: Audit stacking context; use isolation:isolate where needed

Charts not filling container
  → Check: Parent width = 0 on initial mount (race condition)
  → Pattern: ResponsiveContainer needs explicit % height on parent
  → Fix: Wrap in div with explicit height: 300px or h-[300px] (Tailwind)
  → Code stub:
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>...</LineChart>
      </ResponsiveContainer>
    </div>

Grid misalignment
  → Check: Mixed grid/flex context on same row
  → Check: gap vs. margin double-spacing
  → Fix: Standardize layout model per zone; use CSS Grid for outer, Flex for inner

Dark mode color bleed
  → Check: Hardcoded hex in chart config (not CSS var)
  → Fix: Use CSS custom properties: var(--chart-color-1) in chart configs
```

### F.2 DATA PIPELINE DEBUGGER — State / Data Bugs

```
Symptom → Root Cause → Fix

Chart renders but shows wrong data
  → Trace: API response → transform fn → chart data prop
  → Check: Key field mismatch (camelCase vs snake_case from API)
  → Check: Date string not parsed to Date object before sort
  → Fix: Add transform validation:
    console.assert(data.every(d => d.date instanceof Date), 'date not parsed')

Chart shows empty / no data
  → Check 1: Loading state stuck (promise never resolved)
  → Check 2: Data array is undefined, not [] (optional chaining missing)
  → Check 3: Filter producing zero results (not an error)
  → Pattern:
    const safeData = data ?? []  // Never pass undefined to chart
    if (safeData.length === 0) return <EmptyState />

Stale data after filter change
  → Check: Filter not invalidating cache / query key
  → Check: useMemo dependency array missing filter param
  → Fix: Include all filter values in React Query queryKey:
    useQuery(['dashboard', filters.dateRange, filters.region], fetchData)

Data flicker on refetch
  → Check: keepPreviousData not set (React Query)
  → Fix: { keepPreviousData: true } in useQuery options

Real-time data memory leak
  → Check: WebSocket / interval not cleaned up on unmount
  → Fix:
    useEffect(() => {
      const id = setInterval(refetch, 5000)
      return () => clearInterval(id)  // MANDATORY cleanup
    }, [])

NaN / undefined in chart tooltips
  → Check: Aggregate fn receiving empty array (divide by zero)
  → Fix: Guard every aggregation:
    const avg = arr.length > 0 ? sum/arr.length : 0
```

### F.3 INTERACTION FAULT TRACER — Click / Filter / Drill-down Bugs

```
Symptom → Diagnosis → Fix

Filter selection not updating chart
  → Check: State lifted high enough (filter above chart in tree)
  → Check: Filter prop not passed down (missing prop drilling or context)
  → Fix: Verify state owner is common ancestor of filter + chart components

Cross-filter not propagating
  → Check: Event not emitted from child chart on click
  → Check: onDataPointClick handler not wired
  → Fix pattern:
    <BarChart onClick={(data) => onFilter?.({ key: data.activePayload[0].payload.id })} />

Tooltip not showing
  → Check: z-index conflict (tooltip rendered under card shadow)
  → Check: Recharts: <Tooltip /> not placed inside <Chart> root
  → Fix: Add z-index:1000 to tooltip container; verify component tree order

Drill-down navigation broken
  → Check: Route param not passed on click
  → Check: Chart onClick firing but navigation fn not imported
  → Fix: Add console.log in onClick first — confirm it fires before debugging nav

Date range filter off by one day
  → Root cause: Timezone offset stripping day on UTC conversion
  → Fix: Parse dates at noon UTC: new Date(dateStr + 'T12:00:00Z')
  → Better: Use date-fns or dayjs for all date ops, never raw Date()

Dropdown filter showing stale options
  → Check: Options not derived from live data (hardcoded list)
  → Fix: Derive filter options from data: [...new Set(data.map(d => d.region))]
```

### F.4 RENDER PATHOLOGY ENGINE — Chart / Library Bugs

```
Symptom → Root Cause → Fix

Chart not rendering at all (blank space)
  → Step 1: Check console for errors — fix those first
  → Step 2: Check data prop — is it empty array or undefined?
  → Step 3: Check container dimensions — ResponsiveContainer needs parent height
  → Step 4: Check import path — named vs default export mismatch

Recharts: "ResizeObserver loop" error
  → Cause: Infinite resize cycle from chart inside flex container
  → Fix: Add overflow:hidden to parent, or use fixed height

D3: Elements appended multiple times
  → Cause: useEffect running without cleanup, appending on every render
  → Fix:
    useEffect(() => {
      const svg = d3.select(ref.current)
      svg.selectAll('*').remove()  // CLEAR before redraw
      // ... draw logic
    }, [data])

Nivo: SSR hydration mismatch
  → Cause: Canvas/SVG dimensions differ server vs. client
  → Fix: Use dynamic import with ssr: false in Next.js

Chart animation janky / stuttering
  → Check: Data array identity changing on every parent render
  → Fix: Memoize data transformation:
    const chartData = useMemo(() => transformData(raw), [raw])

Legend labels truncated
  → Check: Fixed-width legend container < label length
  → Fix: Use wrapperStyle={{ overflowY: 'auto', maxHeight: 200 }}

Pie / Donut showing incorrect percentages
  → Check: Values not summing to expected total (filtered subset)
  → Fix: Always compute percentages from same total:
    const pct = (value / totalFromSameScope * 100).toFixed(1)
```

### F.5 RESPONSIVE COLLAPSE AUDITOR — Mobile / Tablet Bugs

```
Symptom → Fix

Charts overflow on mobile
  → Never use fixed px width on chart wrapper
  → Use: width: '100%' + minWidth: 0 on flex children

Table overflows viewport
  → Wrap in: <div style={{ overflowX: 'auto' }}> ... </div>
  → On mobile: switch to card-per-row layout < 640px

KPI cards squished on tablet
  → Use CSS Grid auto-fill: grid-template-columns: repeat(auto-fill, minmax(200px, 1fr))

Tooltip off-screen on mobile
  → Set: position='insideTopLeft' fallback on Recharts Tooltip
  → Or use: isAnimationActive={false} for viewport-edge charts

Font too small on mobile
  → Never use < 14px on mobile
  → Dashboard labels: clamp(11px, 1.5vw, 14px)

Touch targets too small
  → All interactive chart elements: min 44×44px hit area
  → Add padding to clickable chart zones
```

### F.6 DEBUG OUTPUT FORMAT (always use)

```
BUG REPORT:
  Symptom:    [exact observable failure]
  Evidence:   [console error / screenshot / network response]
  Root Cause: [single confirmed cause]
  Fix:        [exact code change — no prose]
  Verify:     [how to confirm fixed — test command or visual check]
  Regression: [what could break — test to add]
```

---

## SECTION G: A11Y FORTRESS

```
WCAG 2.1 AA Checklist:
  [ ] Color contrast text ≥ 4.5:1 | large text / UI ≥ 3:1
  [ ] Color never sole differentiator → add pattern + shape + label
  [ ] Charts: role="img" aria-label="[insight, not just title]"
  [ ] Tables: scope, th, caption elements correct
  [ ] Keyboard: Tab + Enter + Arrow navigation on all interactives
  [ ] Focus: 2px solid indicator, offset 2px, visible on dark + light
  [ ] Screen reader: chart data exposed as summary or adjacent table
  [ ] prefers-reduced-motion: disable chart animations when set
  [ ] Touch targets ≥ 44×44px mobile

Colorblind-Safe Rule:
  → Blue-orange or blue-red diverging (never red-green only)
  → Add icon or pattern to pass/fail indicators
  → Validate with Coblis or Viz Palette simulator
```

---

## SECTION H: PERF PROFILER

```
Render Performance Budget:
  Initial load:       < 2s FCP (First Contentful Paint)
  Chart render:       < 16ms (60fps budget)
  Filter response:    < 100ms perceived (debounce 300ms input)
  Data fetch:         < 500ms for cached | < 2s for live API

Diagnosis Commands:
  React DevTools Profiler → identify re-render hot spots
  Chrome Performance tab  → record + find long tasks > 50ms
  Lighthouse CI           → FCP, LCP, TBT, CLS scores

Common Perf Killers + Fixes:
  Too many data points plotted
    → Downsample: show max 1000 points, aggregate rest
    → Use: lttb algorithm (Largest-Triangle-Three-Buckets)

  Re-rendering entire dashboard on any state change
    → Split state: filter state ≠ data state ≠ UI state
    → Wrap heavy charts in React.memo:
      export default React.memo(MyChart, (prev, next) => prev.data === next.data)

  Large bundle from chart library
    → Tree-shake: import { LineChart } from 'recharts' not import * from 'recharts'
    → Lazy load off-screen charts:
      const MapChart = lazy(() => import('./MapChart'))

  Blocking data fetch on page load
    → Use Suspense + React Query concurrent fetching
    → Parallel fetch all KPIs simultaneously, not waterfall
```

---

## SECTION E: DESIGN SYSTEM ENGINE

**Color Protocol:**
```
Semantic: success #22C55E | warning #F59E0B | error #EF4444 | info #3B82F6
Sequential (single metric): 5-step single-hue light→dark
Diverging (above/below zero): neutral midpoint, two diverging hues
Categorical (multi-series): max 8 colors, Okabe-Ito colorblind-safe set
Dark mode: #0F172A base | reduce saturation 15% | check all contrasts
```

**Typography:**
```
KPI value:      32–48px, semibold, monospace/tabular-nums
Section label:  14–16px, medium, uppercase tracking
Body/label:     12–14px, regular
Caption:        11–12px, light, muted
Rule: font-variant-numeric: tabular-nums on ALL numbers
```

**Spacing:** 4px base unit | card padding 16–24px | gutter 16–24px

**Required Components (every dashboard):**
```
✓ Global date/time filter        ✓ Loading skeleton (not spinner)
✓ Last refresh ISO timestamp     ✓ Empty state + actionable message
✓ Error state + retry CTA        ✓ Tooltip: value + label + date on all points
✓ Responsive breakpoints         ✓ Export (CSV/PNG) on data tables/charts
```

---

## APEX RUBRIC — DASH v2 (100/100)

| Dimension               | Max | Pass Criteria                                  |
|-------------------------|-----|------------------------------------------------|
| Information Hierarchy   | 15  | Primary KPIs above fold, Z/F pattern respected |
| Chart Appropriateness   | 15  | Every chart matches data type per SECTION C    |
| Debug Completeness      | 15  | All failure modes addressed, evidence-locked   |
| Design System Fidelity  | 15  | Color / type / spacing per SECTION E           |
| Component Completeness  | 10  | Loading / error / empty states present         |
| Accessibility           | 15  | WCAG 2.1 AA checklist ≥ 90% pass               |
| Performance             | 10  | Render budget respected, perf killers addressed|
| Responsiveness          | 5   | Breakpoints defined, mobile viable             |

---

## DASHBOARD CATEGORY QUICK-REFERENCE

| Category      | Primary KPIs         | Key Charts            | Debug Hotspots          |
|---------------|----------------------|-----------------------|-------------------------|
| Executive     | Revenue, Growth, NPS | Trend, waterfall      | Drill-down nav, filters |
| Financial     | P&L, Cash, EBITDA    | Waterfall, variance   | Date range, YoY calcs   |
| Marketing     | CAC, MQL, ROAS       | Funnel, attribution   | Multi-touch data model  |
| Sales         | Pipeline, Win rate   | Funnel, leaderboard   | Rep filter, currency fmt|
| Product       | DAU, Retention, NPS  | Cohort heatmap, funnel| Cohort date logic       |
| Operations    | Uptime, SLA, tickets | Rolling line, bullet  | Real-time memory leaks  |
| IoT/Real-time | Sensor, alerts       | Rolling line, gauge   | WebSocket cleanup       |
| E-commerce    | GMV, CVR, AOV        | Funnel, cohort        | SKU filter performance  |
| Geographic    | Regional metrics     | Choropleth, bubble    | Map tile loading, zoom  |

---

## CLAUDE-NATIVE FEATURES

```
EXTENDED THINKING: Enable for:
  - Novel architecture with 5+ competing constraints
  - Complex data model normalization
  - Multi-domain debug with ambiguous root cause
  Budget: 8,000–16,000 tokens

ARTIFACT OUTPUT:
  React live preview: type="application/vnd.ant.react"
  Static HTML/JS:     type="text/html"

CONTEXT INJECTION:
  <document><title>Dashboard Context</title><content>[data/desc]</content></document>
```

---

## FAILURE GUARD

| Failure               | Cause                     | Recovery                    |
|-----------------------|---------------------------|-----------------------------|
| Chart type mismatch   | Data type not analyzed    | Re-run SECTION C            |
| A11y failure          | Color-only differentiation| Add pattern + ARIA label    |
| Cognitive overload    | > 9 primary elements      | Apply progressive disclosure|
| Debug loop (3+ tries) | Wrong hypothesis          | Return to PHASE 2 evidence  |
| Render > 16ms         | Unoptimized data/memo     | Apply SECTION H fixes       |
| Missing states        | Happy-path only design    | Add all 3 states mandatory  |

```
UNCERTAIN: [chart type] | Options: A=[option], B=[option] — state trade-offs
UNVERIFIED: [data model assumed as X] — confirm before finalizing
BLOCKED: [tool] [path] [reason] — retry once with /tmp/ fallback
```

*APEX-DASH-CREATOR v2.0 GOD MODE — Claude Native*
*APEX Business Systems Ltd. | Edmonton, AB, Canada | © 2026*
