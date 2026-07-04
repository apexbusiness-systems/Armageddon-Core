# VISUALIZATION LIBRARY INDEX
## Every Major Library — Use-Case Matrix + Copy-Paste Code Stubs

---

## DECISION MATRIX

| Library | Best For | Bundle | Learning | Perf | SSR | License |
|---------|----------|--------|----------|------|-----|---------|
| Recharts | Standard charts, React | 🟡 Medium | ✅ Easy | ✅ Good | ✅ Yes | MIT |
| Tremor | Admin/KPI dashboards | 🟢 Small | ✅ Easy | ✅ Good | ✅ Yes | Apache 2 |
| Nivo | Aesthetic, unique charts | 🔴 Large | 🟡 Medium | 🟡 OK | ✅ Yes | MIT |
| Victory | Animated, composable | 🟡 Medium | 🟡 Medium | ✅ Good | ✅ Yes | MIT |
| D3 (raw) | Custom/novel viz | 🟡 Medium | 🔴 Hard | ✅ Best | 🔴 No (need wrapper) | BSD |
| ECharts | Complex, large data | 🔴 Large | 🟡 Medium | ✅ Great | ✅ Yes | Apache 2 |
| Chart.js | Vanilla JS, simple | 🟢 Small | ✅ Easy | ✅ Good | 🟡 With plugin | MIT |
| Plotly | Scientific, 3D | 🔴 Large | 🟡 Medium | 🟡 OK | ✅ Yes | MIT |
| Observable | Grammar of graphics | 🟡 Medium | 🔴 Hard | ✅ Good | 🟡 Partial | ISC |
| Grafana | Ops, time-series, infra | N/A (hosted) | 🟡 Medium | ✅ Excellent | N/A | AGPL |
| Streamlit | Python/ML dashboards | N/A (Python) | ✅ Easy | 🟡 OK | N/A | Apache 2 |

---

## RECHARTS — Code Stubs

### Line Chart
```tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export function TrendChart({ data }: { data: { date: string; value: number }[] }) {
  return (
    <div className="w-full h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 32, left: 48 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid, #E5E7EB)" />
          <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
          <YAxis tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
                 tickFormatter={(v) => `$${v.toLocaleString()}`} />
          <Tooltip
            contentStyle={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-primary)' }}
            formatter={(v: number) => [`$${v.toLocaleString()}`, 'Revenue']}
          />
          <Legend />
          <Line type="monotone" dataKey="value" stroke="#3B82F6" strokeWidth={2}
                dot={false} activeDot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
```

### Bar Chart
```tsx
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

export function ComparisonBar({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map(d => d.value))
  return (
    <div className="w-full h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 48, bottom: 0, left: 80 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="label" tick={{ fontSize: 12 }} width={80} />
          <Tooltip formatter={(v: number) => v.toLocaleString()} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.value === max ? '#2563EB' : '#BFDBFE'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

### KPI Sparkline
```tsx
import { AreaChart, Area, ResponsiveContainer } from 'recharts'

export function Sparkline({ data, color = '#3B82F6', positive = true }) {
  return (
    <ResponsiveContainer width="100%" height={40}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.15} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={1.5}
              fill="url(#sparkGrad)" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
```

---

## TREMOR — Code Stubs

### KPI Card
```tsx
import { Card, Metric, Text, BadgeDelta, AreaChart } from '@tremor/react'

export function KPICard({ title, value, change, changeType, sparkData }) {
  return (
    <Card>
      <Text>{title}</Text>
      <div className="flex items-end justify-between mt-2">
        <Metric>{value}</Metric>
        <BadgeDelta deltaType={changeType}>{change}</BadgeDelta>
      </div>
      <AreaChart
        className="mt-4 h-16"
        data={sparkData}
        index="date"
        categories={['value']}
        colors={['blue']}
        showXAxis={false}
        showYAxis={false}
        showLegend={false}
        showGridLines={false}
        showTooltip={false}
      />
    </Card>
  )
}
```

---

## D3 — Code Stubs

### Responsive Line Chart (D3 + React hooks)
```tsx
import { useEffect, useRef } from 'react'
import * as d3 from 'd3'

export function D3LineChart({ data }: { data: { date: Date; value: number }[] }) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current || !data.length) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()  // CRITICAL: clear on redraw

    const { width, height } = svgRef.current.getBoundingClientRect()
    const margin = { top: 8, right: 16, bottom: 32, left: 48 }
    const innerW = width - margin.left - margin.right
    const innerH = height - margin.top - margin.bottom

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    const x = d3.scaleTime().domain(d3.extent(data, d => d.date) as [Date, Date]).range([0, innerW])
    const y = d3.scaleLinear().domain([0, d3.max(data, d => d.value)!]).nice().range([innerH, 0])

    g.append('g').attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(6).tickSize(0))
      .call(g => g.select('.domain').remove())

    g.append('g').call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(',.0f')))
      .call(g => g.select('.domain').remove())

    const line = d3.line<typeof data[0]>().x(d => x(d.date)).y(d => y(d.value)).curve(d3.curveMonotoneX)

    g.append('path').datum(data).attr('fill', 'none').attr('stroke', '#3B82F6')
      .attr('stroke-width', 2).attr('d', line)

  }, [data])

  return <svg ref={svgRef} style={{ width: '100%', height: 300 }} />
}
```

---

## PYTHON STACKS — Code Stubs

### Streamlit Dashboard Pattern
```python
import streamlit as st
import pandas as pd
import plotly.express as px

st.set_page_config(page_title="APEX Dashboard", layout="wide")

# Filters in sidebar
with st.sidebar:
    date_range = st.date_input("Date Range", [start_date, end_date])
    region = st.selectbox("Region", options=["All"] + regions)

# Load with caching
@st.cache_data(ttl=300)  # 5-min cache
def load_data(start, end, region):
    return fetch_from_db(start, end, region)

data = load_data(*date_range, region)

# KPI row
col1, col2, col3, col4 = st.columns(4)
col1.metric("Revenue", f"${data['revenue'].sum():,.0f}", f"{delta:.1f}%")
col2.metric("DAU", f"{data['dau'].mean():,.0f}", ...)

# Chart
fig = px.line(data, x='date', y='revenue', title='Revenue Trend')
fig.update_layout(plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)')
st.plotly_chart(fig, use_container_width=True)
```

---

*APEX-DASH-CREATOR Viz Library Index v2.0 — APEX Business Systems Ltd. © 2026*
