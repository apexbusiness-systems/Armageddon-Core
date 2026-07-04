# UX LAWS & ANTI-PATTERNS FOR DASHBOARDS
## Applied Cognitive Psychology + Design Principles

---

## THE 8 LAWS EVERY DASHBOARD MUST RESPECT

### 1. Miller's Law — 7 ± 2 items in working memory
**Application:** Max 7 primary elements per dashboard view.
**Anti-Pattern:** 15 KPI cards visible at once with equal visual weight.
**Fix:** Group into hierarchy. Show 3–4 primary KPIs. Collapse secondary into expandable row.

### 2. Fitts' Law — larger targets = faster to click
**Application:** Interactive chart elements (bars, data points) must have adequate click areas.
**Anti-Pattern:** 2px-wide line chart with tiny dot targets, impossible on mobile.
**Fix:** Add transparent click zones. Use `activeDot={{ r: 8 }}` in Recharts.

### 3. Hick's Law — more choices = slower decisions
**Application:** Minimize filter options visible simultaneously.
**Anti-Pattern:** 12 filter dropdowns all visible at page load.
**Fix:** Show 3–4 primary filters. Hide advanced filters behind "More filters" toggle.

### 4. Gestalt: Proximity — nearby items = related items
**Application:** Group related KPIs together. Separate unrelated groups with whitespace.
**Anti-Pattern:** Revenue KPI next to Headcount KPI with no visual grouping.
**Fix:** Use card containers to group related metrics.

### 5. Gestalt: Similarity — similar appearance = same category
**Application:** Same data series = same color everywhere in dashboard.
**Anti-Pattern:** Revenue shown in blue in chart 1, green in chart 2.
**Fix:** Maintain a color-to-metric mapping. Never reassign colors per chart.

### 6. Pre-attentive Attributes — instant visual perception
**Application:** Use color, size, position to direct attention before reading.
**Priority order:** Position > Color > Size > Shape > Text
**Application:** Use red/green color + ▲▼ arrow for instant delta comprehension.
**Anti-Pattern:** All KPI cards same color and size — requires reading every card.

### 7. Progressive Disclosure — reveal complexity on demand
**Application:** Summary → drill-down → raw data. Never show all levels simultaneously.
**Pattern:**
```
Level 1: KPI card with single number
Level 2: Click → chart showing trend
Level 3: Click → table with raw rows
Level 4: Click → export to CSV
```

### 8. Data-Ink Ratio (Tufte) — maximize data, minimize decoration
**Application:** Every pixel must encode data or provide essential context.
**Formula:** Data-ink ratio = data ink / total ink in graphic
**Anti-Patterns:**
```
✗ Grid lines that are heavier than data lines
✗ Chart borders with no semantic value
✗ 3D effects adding zero data content
✗ Decorative backgrounds behind charts
✗ Gradient fills when solid suffices
```
**Fix:** Default to no chart border, light grid lines, no chart background fill.

---

## COMPREHENSIVE ANTI-PATTERN REGISTRY

| Anti-Pattern | Why Bad | Fix |
|---|---|---|
| 3D charts | Distorts perceived values (perspective skew) | 2D equivalents always |
| Dual Y-axes | Misleads scale relationships | Two separate charts |
| Pie > 5 slices | Impossible to compare arc lengths accurately | Sorted bar or treemap |
| Rainbow sequential scale | No natural order, confuses magnitude | Single-hue gradient |
| Truncated Y-axis (non-zero) | Exaggerates variance | Annotate or start at 0 |
| Auto-rotating carousel | Hides critical data on rotation | Tabs or static grid |
| Decorative icons (no data) | Adds noise, wastes attention | Remove or link to data |
| Missing null/empty states | Blank space = confusing | Always handle all states |
| Color as sole differentiator | Fails colorblind users | Add pattern + label |
| Unlabeled axes | Requires guessing units | Always label with units |
| Chart title = chart type | "Line Chart" is useless | "Revenue Trend — Last 12 Months" |
| Inconsistent date formats | Forces cognitive translation | ISO 8601 or locale-consistent |
| Number without unit | "$1,234" — dollars? thousands? | "$1,234" or "$1.2M" |
| Animated by default | Distracting, inaccessible | Off by default, opt-in |
| Right-aligned large numbers | Harder to scan | Left-align labels, right-align numbers |

---

## CHART TITLE FORMULA

**Bad:** "Sales Data" | "Chart 1" | "Line Chart"
**Good:** "[Metric] [Trend/Comparison/Distribution] — [Time Period / Scope]"

**Examples:**
```
✓ "Monthly Revenue Trend — Last 12 Months"
✓ "Regional CAC Comparison — Q4 2025"
✓ "D7 Retention by Signup Cohort — 2025"
✓ "Top 10 SKUs by GMV — Current Month"
```

---

## Z/F READING PATTERN APPLICATION

**Z-Pattern (scanning):** For dashboards read quickly, not read deeply.
```
[KPI 1] ————————————————— [KPI 2]
                    ╲
                     ╲
[Action / Filter] —— [KPI 3]
```
Place primary KPI top-left. Place secondary action or filter bottom-left.

**F-Pattern (reading):** For data-dense analysis dashboards.
```
[Filter Bar — Full Width ——————————————]
[KPI Row — Full Width ——————————————————]
[Primary Chart ——————] [Secondary ——————]
[Supporting ——————————] [Table ————————]
```

---

*APEX-DASH-CREATOR UX Laws Reference v2.0 — APEX Business Systems Ltd. © 2026*
