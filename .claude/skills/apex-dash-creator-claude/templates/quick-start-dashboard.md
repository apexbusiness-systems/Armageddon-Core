# APEX DASHBOARD QUICK-START TEMPLATES
## 3 Production-Ready Templates — Copy, Customize, Deploy

---

## TEMPLATE 1: EXECUTIVE KPI DASHBOARD

### Architecture
```
[Date Range Filter] [Region Filter] [Last Refresh: HH:mm:ss]
─────────────────────────────────────────────────────────────
[Revenue $] [Growth %] [NPS Score] [Churn Rate]  ← KPI Cards
─────────────────────────────────────────────────────────────
[Revenue Trend Line — 12 months    ] [Pipeline by Stage Funnel]
─────────────────────────────────────────────────────────────
[Top 10 Accounts Table — sortable, exportable              ]
```

### React + Recharts Implementation
```tsx
import { useState } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis,
         CartesianGrid, Tooltip, ResponsiveContainer, FunnelChart, Funnel } from 'recharts'
import { useQuery } from '@tanstack/react-query'

// KPI Card Component
function KPICard({ title, value, delta, deltaType, sparkData, loading }) {
  if (loading) return <div className="animate-pulse h-24 bg-gray-100 rounded-lg" />

  const deltaColor = deltaType === 'increase' ? 'text-green-600' : 'text-red-500'
  const deltaIcon  = deltaType === 'increase' ? '▲' : '▼'

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{title}</p>
      <div className="flex items-end justify-between mt-2">
        <p className="text-3xl font-bold tabular-nums">{value}</p>
        <span className={`text-sm font-medium ${deltaColor}`}>{deltaIcon} {delta}</span>
      </div>
      {/* Sparkline */}
      <ResponsiveContainer width="100%" height={32}>
        <LineChart data={sparkData}>
          <Line dataKey="v" stroke="#3B82F6" strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// Main Dashboard
export default function ExecutiveDashboard() {
  const [dateRange, setDateRange] = useState({ start: '2024-01-01', end: '2024-12-31' })

  const { data, isLoading, error, refetch } = useQuery(
    ['executive', dateRange],
    () => fetchExecutiveData(dateRange),
    { keepPreviousData: true, staleTime: 300_000 }
  )

  if (error) return <ErrorState error={error} onRetry={refetch} />

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Executive Dashboard</h1>
        <div className="flex items-center gap-3">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <RefreshIndicator isLoading={isLoading} lastUpdated={new Date()} />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Revenue" value="$2.4M" delta="+12.3%" deltaType="increase"
                 sparkData={data?.revenueSpark} loading={isLoading} />
        <KPICard title="Growth" value="23.4%" delta="+4.1pp" deltaType="increase"
                 sparkData={data?.growthSpark} loading={isLoading} />
        <KPICard title="NPS" value="62" delta="+5pts" deltaType="increase"
                 sparkData={data?.npsSpark} loading={isLoading} />
        <KPICard title="Churn" value="2.1%" delta="-0.3pp" deltaType="increase"
                 sparkData={data?.churnSpark} loading={isLoading} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500 mb-4">
            Revenue Trend — Last 12 Months
          </h2>
          {isLoading ? <div className="animate-pulse h-64 bg-gray-100 rounded" /> : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.revenueTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9CA3AF' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }}
                         tickFormatter={v => `$${(v/1000).toFixed(0)}K`} />
                  <Tooltip formatter={v => [`$${v.toLocaleString()}`, 'Revenue']} />
                  <Line type="monotone" dataKey="revenue" stroke="#2563EB"
                        strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500 mb-4">
            Pipeline by Stage
          </h2>
          {isLoading ? <div className="animate-pulse h-64 bg-gray-100 rounded" /> : (
            <PipelineFunnel data={data?.pipeline} />
          )}
        </div>
      </div>
    </div>
  )
}
```

---

## TEMPLATE 2: MARKETING FUNNEL DASHBOARD

### Architecture
```
[Date Range] [Channel: All/Organic/Paid/Email] [Region]
────────────────────────────────────────────────────────
[CAC $] [MQLs #] [SQL→Opp %] [ROAS x]  ← KPI Cards
────────────────────────────────────────────────────────
[Funnel: Visits→Lead→MQL→SQL→Won] [Channel Attribution Bar]
────────────────────────────────────────────────────────
[CAC Trend by Channel — Line] [Conversion Rate Heatmap]
```

### Key Components
```tsx
// Conversion Funnel
import { FunnelChart, Funnel, LabelList, Tooltip, Cell } from 'recharts'

const FUNNEL_COLORS = ['#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE', '#DBEAFE']

function ConversionFunnel({ stages }: { stages: { name: string; value: number }[] }) {
  const maxVal = stages[0].value

  return (
    <div className="space-y-2">
      {stages.map((stage, i) => {
        const pct = (stage.value / maxVal * 100)
        const convRate = i > 0 ? (stage.value / stages[i-1].value * 100).toFixed(1) : 100
        return (
          <div key={stage.name}>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>{stage.name}</span>
              <span className="tabular-nums">{stage.value.toLocaleString()} ({convRate}%)</span>
            </div>
            <div className="h-8 bg-gray-100 rounded overflow-hidden">
              <div className="h-full rounded transition-all duration-300"
                   style={{ width: `${pct}%`, background: FUNNEL_COLORS[i] }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

---

## TEMPLATE 3: OPS REAL-TIME DASHBOARD

### Architecture
```
[System Status: ● All Systems Operational]  [Auto-refresh: 30s]
────────────────────────────────────────────────────────────────
[Uptime 99.94%] [P1 Incidents: 0] [Avg Response: 142ms] [SLA: 99.8%]
────────────────────────────────────────────────────────────────
[Response Time Rolling 60min ————————] [Error Rate Rolling 60min]
────────────────────────────────────────────────────────────────
[Service Status Grid: badges per service    ] [Alert Feed: live]
```

### Real-Time Chart Component
```tsx
function RollingLineChart({ title, data, threshold, unit, color = '#3B82F6' }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-gray-700">{title}</h2>
        <span className="text-xs text-gray-400">Last 60 min</span>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F9FAFB" />
            <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#9CA3AF' }} tickCount={6} />
            <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }}
                   tickFormatter={v => `${v}${unit}`} />
            <Tooltip formatter={v => [`${v}${unit}`, title]} />
            {threshold && (
              <ReferenceLine y={threshold} stroke="#EF4444"
                             strokeDasharray="4 4" label={{ value: 'SLA', fill: '#EF4444', fontSize: 10 }} />
            )}
            <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.5}
                  dot={false} isAnimationActive={false} /* DISABLE animation for real-time */ />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// Service Status Badge Grid
function StatusGrid({ services }: { services: { name: string; status: 'up' | 'degraded' | 'down' }[] }) {
  const statusColors = { up: 'bg-green-100 text-green-700', degraded: 'bg-amber-100 text-amber-700', down: 'bg-red-100 text-red-700' }
  const statusDots   = { up: '●', degraded: '◐', down: '●' }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
      {services.map(svc => (
        <div key={svc.name} className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium ${statusColors[svc.status]}`}>
          <span>{statusDots[svc.status]}</span>
          <span>{svc.name}</span>
        </div>
      ))}
    </div>
  )
}
```

---

## DEBUG BUG REPORT TEMPLATE

```markdown
## Dashboard Bug Report

**Symptom:**
[Exact observable failure — what you see vs. what you expect]

**Reproduction Steps:**
1. Open [URL / component]
2. Select [filter/action]
3. Observe: [what happens]

**Evidence Collected:**
- Console error: [paste exact error + stack trace]
- Network response: [status + payload snippet]
- Screenshot: [attached]
- React DevTools data: [component → prop value]
- Viewport: [browser + dimensions]
- Data state: [filter values, date range, user role]

**Root Cause Hypothesis:**
[Single confirmed or suspected cause]

**Proposed Fix:**
[Exact code change — file + line + before/after]

**Verification:**
[Test command or visual check to confirm fixed]

**Regression Risk:**
[What could break + test to prevent]
```

---

*APEX-DASH-CREATOR Quick-Start Templates v2.0 — APEX Business Systems Ltd. © 2026*
