# APEX DASHBOARD TAXONOMY — Full Reference
## 12 Categories × KPIs × Charts × UX Patterns × Debug Hotspots

---

| Category | Primary KPIs | Secondary KPIs | Must-Have Charts | UX Pattern | Refresh | Debug Hotspots |
|---|---|---|---|---|---|---|
| **Executive/CEO** | Revenue, Growth %, NPS | EBITDA margin, headcount, churn | Trend line, waterfall, geo map | Drill-down to dept → rep | Daily | Drill-down nav, date range |
| **Financial** | P&L, cash position, EBITDA | AR/AP, burn rate, runway | Waterfall, variance bar, bullet | Period comparison, YoY toggle | Daily | YoY calc logic, currency fmt |
| **Marketing** | CAC, MQLs, ROAS | Impression CPM, CTR, pipeline contrib | Funnel, attribution bar, channel line | Channel filter, UTM breakdown | Hourly | Multi-touch attribution model |
| **Sales** | Pipeline $, win rate, quota % | Deal velocity, avg deal size, ACV | Funnel, leaderboard, scatter | Rep filter, stage filter | Real-time | Currency formatting, rep filter |
| **Product** | DAU/MAU, retention D7/D30, NPS | Feature adoption %, error rate | Cohort heatmap, funnel, line | Feature toggle, segment filter | Daily | Cohort date boundary logic |
| **Operations** | Uptime %, SLA compliance, MTTR | Ticket volume, P1 count, on-call | Rolling line, bullet chart, heatmap | Alert threshold, incident overlay | Real-time | WebSocket leaks, alert logic |
| **HR/People** | Headcount, attrition %, offer accept | eNPS, time-to-hire, comp ratio | Org bar, cohort retention, scatter | Dept filter, time filter | Weekly | Sensitive data masking |
| **Healthcare** | Patient flow, LOS, bed occupancy | Readmission rate, wait time, HCAHPS | Timeline, geo map, Gantt | Compliance overlay, shift filter | Real-time | HIPAA data handling |
| **IoT/Real-time** | Sensor readings, alert count, uptime | Anomaly score, threshold breach % | Rolling line (last 60pts), gauge, badge grid | Device filter, threshold config | Sub-second | Memory leak, resize observer |
| **E-commerce** | GMV, conversion rate, AOV | Cart abandon %, return rate, LTV | Funnel, cohort, category bar | SKU filter, category filter | Hourly | Large product list performance |
| **Geographic** | Regional revenue, market share | Store performance, delivery SLA | Choropleth, bubble map, bar | Map zoom, region click filter | Daily | Tile loading, GeoJSON size |
| **Compliance** | Risk score, SLA %, violation count | Audit completion %, open findings | Heatmap, bullet, RAG badge | RAG status filter, date filter | Daily | RAG color logic, audit trail |

---

## Dashboard Layout Archetypes

### Archetype 1: Summary → Detail (Most Common)
```
[Global Filters Row]
[KPI Cards Row — 3-4 metrics]
[Primary Chart — full width or 2/3]  [Supporting Chart — 1/3]
[Data Table — filterable, sortable, exportable]
```

### Archetype 2: Operational Real-Time
```
[System Status Bar — RAG badges]
[Rolling Charts Grid — 2×2 or 3×2]
[Alert Feed — live, most recent top]
[Incident Timeline]
```

### Archetype 3: Multi-Period Comparison
```
[Period Selector — current vs. prior period vs. target]
[Variance KPI Cards — delta highlighted]
[Side-by-side bar or grouped bar chart]
[Breakdown table — sortable by variance]
```

### Archetype 4: Exploration / Analysis
```
[Segment Selector — cohort, region, channel]
[Primary Scatter or Heatmap — correlation]
[Drill-down Panel — opens on click]
[Data export control]
```

---

## KPI Card Anatomy (Standard)

```
┌──────────────────────────────┐
│ Label          [info icon]   │
│                              │
│ $1,234,567     ▲ +12.3%      │  ← Primary value + trend delta
│                              │
│ ▁▂▃▄▅▆▇█  [sparkline]       │  ← Last 30 days trend
│                              │
│ vs. $1,100,000 prior period  │  ← Context comparison
└──────────────────────────────┘
```

**Code Pattern (Tremor):**
```tsx
import { Card, Metric, Text, BadgeDelta, Sparkline } from '@tremor/react'

<Card>
  <Text>Monthly Revenue</Text>
  <div className="flex items-end justify-between">
    <Metric>$1,234,567</Metric>
    <BadgeDelta deltaType="increase">+12.3%</BadgeDelta>
  </div>
  <Sparkline data={sparkData} color="blue" />
</Card>
```

---

*APEX-DASH-CREATOR Taxonomy Reference v2.0 — APEX Business Systems Ltd. © 2026*
