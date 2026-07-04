# APEX DASHBOARD DEBUG PLAYBOOK
## Complete Reference — All Frameworks, All Failure Modes

---

## 1. TRIAGE DECISION TREE

```
Console error visible?
├── YES → Fix error first. Never debug further until console clean.
└── NO
    ├── Chart blank / missing?     → Render Pathology (Section 4)
    ├── Wrong data showing?        → Data Pipeline (Section 2)
    ├── Interaction not working?   → Interaction Tracer (Section 3)
    ├── Layout broken?             → Layout Engine (Section 1)
    ├── Slow / janky?             → Perf Profiler (Section 6)
    └── Mobile broken?            → Responsive Auditor (Section 5)
```

---

## 2. EVIDENCE COLLECTION PROTOCOL

Before touching a single line of code:

```bash
# Browser DevTools Checklist
Console tab:   Copy exact error + stack trace
Network tab:   Check API response — status, payload, timing
React DevTools: Component tree → find data prop values
Performance:   Record 3s → look for long tasks > 50ms
Elements:      Inspect chart container → verify computed width/height
```

**Minimal Repro Pattern:**
```jsx
// Isolate the broken component with hardcoded data
// This eliminates data pipeline as variable
const STATIC_DATA = [
  { date: '2024-01', value: 100 },
  { date: '2024-02', value: 120 },
]

function DebugChart() {
  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer>
        <LineChart data={STATIC_DATA}>
          <Line dataKey="value" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
// If this renders: problem is data/state
// If this doesn't render: problem is layout/library config
```

---

## 3. DATA PIPELINE DEBUG MATRIX

### State Debugging Patterns

```typescript
// Pattern: Data boundary logging — trace data through every transform
const useChartData = (filters: Filters) => {
  const rawData = useQuery(['data', filters], fetchData)
  
  console.group('🔍 Data Pipeline Debug')
  console.log('1. Raw API data:', rawData.data)
  
  const filtered = useMemo(() => {
    const result = applyFilters(rawData.data ?? [], filters)
    console.log('2. After filter:', result.length, 'rows')
    return result
  }, [rawData.data, filters])
  
  const transformed = useMemo(() => {
    const result = transformForChart(filtered)
    console.log('3. Chart-ready:', result)
    console.groupEnd()
    return result
  }, [filtered])
  
  return { data: transformed, isLoading: rawData.isLoading }
}
```

### Common Data Bugs Reference

| Bug | Detection | Fix |
|-----|-----------|-----|
| undefined passed as data | `console.log(data)` shows undefined | `const safe = data ?? []` |
| Date string not parsed | Dates not sorting correctly | `new Date(d.date + 'T12:00:00Z')` |
| Stale cache after filter | Shows old data on filter change | Add filter to queryKey array |
| Aggregate divide-by-zero | NaN in chart | Guard: `arr.length > 0 ? sum/arr.length : 0` |
| Currency float precision | `100.1 + 200.2 = 300.30000000004` | `(val).toFixed(2)` or use `dinero.js` |
| Timezone off-by-one day | Dates show previous day | Parse at T12:00:00Z, use date-fns |
| Missing field key | Chart renders but no line | Verify `dataKey` matches exact field name |
| Array mutation bug | Chart not updating on state change | `setData([...newData])` not `data.push()` |

### React Query Patterns

```typescript
// Correct: all filters in queryKey for automatic refetch
useQuery(
  ['dashboard-kpis', dateRange.start, dateRange.end, selectedRegion],
  () => fetchKPIs({ dateRange, region: selectedRegion }),
  {
    keepPreviousData: true,    // No flash of empty on refetch
    staleTime: 60_000,         // 1 min cache for dashboard data
    retry: 2,                  // Retry twice on failure
    onError: (err) => toast.error(`Data load failed: ${err.message}`)
  }
)
```

---

## 4. CHART LIBRARY DEBUG GUIDE

### Recharts

```typescript
// Issue: ResponsiveContainer renders at 0px height
// Cause: Parent has no explicit height
// Fix:
<div className="w-full h-[300px]">  {/* EXPLICIT HEIGHT REQUIRED */}
  <ResponsiveContainer width="100%" height="100%">
    <LineChart data={data}>
      ...
    </LineChart>
  </ResponsiveContainer>
</div>

// Issue: Tooltip not showing
// Fix: Verify <Tooltip /> is inside chart root, not outside
<LineChart data={data}>
  <Tooltip />  {/* MUST be inside here */}
  <Line dataKey="value" />
</LineChart>

// Issue: Custom tooltip crashing
// Fix: Always guard activePayload
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null  // GUARD required
  return (
    <div className="bg-white border rounded p-2 shadow">
      <p>{label}</p>
      <p>{payload[0].value}</p>
    </div>
  )
}

// Issue: Reference line not showing
// Cause: y value outside chart domain
// Fix: Explicitly set domain: <YAxis domain={[0, 'auto']} />

// Issue: Legend labels cut off on mobile
<Legend wrapperStyle={{ overflowY: 'auto', maxHeight: 100, fontSize: 12 }} />
```

### D3.js

```typescript
// Issue: Elements appended multiple times (double render)
// Fix: Always clear before redraw
useEffect(() => {
  const svg = d3.select(svgRef.current)
  svg.selectAll('*').remove()  // MANDATORY
  
  // Draw logic here
  const width = svgRef.current.getBoundingClientRect().width
  const height = 300
  
  // ... rest of D3 code
}, [data])

// Issue: Axes not updating when data changes
// Fix: Transition existing elements, don't re-create
const xScale = d3.scaleTime().domain(d3.extent(data, d => d.date)).range([0, width])
svg.select('.x-axis').transition().duration(300).call(d3.axisBottom(xScale))

// Issue: SVG not responsive
// Fix: Use viewBox instead of fixed width/height
svg.attr('viewBox', `0 0 ${width} ${height}`)
   .attr('preserveAspectRatio', 'xMinYMin meet')
   .style('width', '100%')
   .style('height', 'auto')
```

### Nivo

```typescript
// Issue: Server-side rendering hydration mismatch
// Fix in Next.js:
const MyChart = dynamic(() => import('./NivoChart'), { ssr: false })

// Issue: Dark mode colors not applying
// Fix: Use theme prop, not hardcoded colors
const theme = {
  background: 'transparent',
  textColor: 'var(--text-primary)',
  grid: { line: { stroke: 'var(--border-color)' } }
}
<ResponsiveLine theme={theme} ... />

// Issue: Tooltip overlapping chart edge
<ResponsiveLine
  tooltip={({ point }) => <CustomTooltip point={point} />}
  // Nivo handles positioning automatically — verify useMesh={true}
  useMesh={true}
/>
```

### Chart.js (vanilla or React wrapper)

```typescript
// Issue: Chart not destroying on unmount / remount = double chart
// Fix: Return cleanup in useEffect
useEffect(() => {
  const chart = new Chart(canvasRef.current, config)
  return () => chart.destroy()  // CRITICAL cleanup
}, [data])

// Issue: Animation causing flicker on data update
// Fix: Disable animation on update, keep on mount
chart.options.animation = false
chart.update()
```

---

## 5. RESPONSIVE DEBUG CHECKLIST

```typescript
// Testing breakpoints programmatically
const breakpoints = {
  mobile: 375,
  tablet: 768,
  desktop: 1440,
}

// Utility: Use this hook to get responsive chart height
const useChartHeight = () => {
  const width = useWindowWidth()
  if (width < 640) return 200    // Mobile: shorter charts
  if (width < 1024) return 260   // Tablet
  return 320                      // Desktop
}

// Common: Table that converts to cards on mobile
function ResponsiveTable({ data }) {
  const isMobile = useWindowWidth() < 640
  
  if (isMobile) {
    return (
      <div className="space-y-3">
        {data.map(row => <DataCard key={row.id} data={row} />)}
      </div>
    )
  }
  return <DataTable data={data} />
}
```

### Tailwind Responsive Chart Wrappers

```jsx
{/* Good: Responsive height using Tailwind */}
<div className="w-full h-48 sm:h-64 md:h-80 lg:h-96">
  <ResponsiveContainer width="100%" height="100%">
    ...
  </ResponsiveContainer>
</div>

{/* Good: KPI grid that reflows */}
<div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
  {kpis.map(kpi => <KPICard key={kpi.id} {...kpi} />)}
</div>
```

---

## 6. REAL-TIME DASHBOARD DEBUG GUIDE

### WebSocket Debug Pattern

```typescript
// Issue: Memory leak on unmount
// Issue: Multiple connections opened
const useRealtimeData = (endpoint: string) => {
  const [data, setData] = useState([])
  
  useEffect(() => {
    const ws = new WebSocket(endpoint)
    
    ws.onmessage = (event) => {
      const newPoint = JSON.parse(event.data)
      setData(prev => {
        const updated = [...prev, newPoint]
        return updated.slice(-100)  // Keep last 100 points MAX
      })
    }
    
    ws.onerror = (err) => console.error('WebSocket error:', err)
    
    return () => {
      ws.close()  // MANDATORY cleanup
    }
  }, [endpoint])  // endpoint in deps prevents stale closure
  
  return data
}
```

### Polling Debug Pattern

```typescript
// Issue: Multiple intervals stacking on re-render
const usePolling = (fetchFn: () => void, intervalMs: number) => {
  useEffect(() => {
    fetchFn()  // Immediate first call
    const id = setInterval(fetchFn, intervalMs)
    return () => clearInterval(id)  // MANDATORY
  }, [fetchFn, intervalMs])
}
```

---

## 7. FILTER SYSTEM DEBUG GUIDE

### Filter State Architecture (Correct Pattern)

```typescript
// Centralized filter state — single source of truth
type DashboardFilters = {
  dateRange: { start: Date; end: Date }
  regions: string[]
  channels: string[]
  granularity: 'day' | 'week' | 'month'
}

// Context pattern for cross-component filter sync
const FilterContext = createContext<{
  filters: DashboardFilters
  setFilter: <K extends keyof DashboardFilters>(key: K, value: DashboardFilters[K]) => void
} | null>(null)

// Every chart consumes from context — no prop drilling
const useFilters = () => {
  const ctx = useContext(FilterContext)
  if (!ctx) throw new Error('useFilters must be inside FilterProvider')
  return ctx
}
```

### Cross-Filter Debug

```typescript
// Pattern: Chart click triggers dashboard-wide filter
const handleChartClick = (data: any) => {
  if (!data?.activePayload?.length) return  // Guard null
  
  const clickedValue = data.activePayload[0].payload.region
  setFilter('regions', [clickedValue])  // Propagates to all charts
}

<BarChart data={chartData} onClick={handleChartClick}>
  ...
</BarChart>
```

---

## 8. DARK MODE DEBUG

```css
/* Problem: Chart colors hardcoded, don't respect dark mode */
/* Fix: CSS custom properties in chart theme */

:root {
  --chart-color-1: #3b82f6;
  --chart-color-2: #22c55e;
  --chart-color-3: #f59e0b;
  --chart-bg: #ffffff;
  --chart-text: #374151;
  --chart-grid: #e5e7eb;
  --chart-border: #d1d5db;
}

.dark {
  --chart-bg: #0f172a;
  --chart-text: #f1f5f9;
  --chart-grid: #1e293b;
  --chart-border: #334155;
}
```

```typescript
// Recharts dark mode theme
const darkModeProps = {
  stroke: 'var(--chart-text)',
  fill: 'var(--chart-bg)',
}

<CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
<XAxis tick={{ fill: 'var(--chart-text)' }} />
<YAxis tick={{ fill: 'var(--chart-text)' }} />
```

---

## 9. EXPORT FUNCTIONALITY DEBUG

```typescript
// Chart PNG export (Recharts)
const exportChartAsPNG = (chartRef: RefObject<HTMLDivElement>, filename: string) => {
  const svg = chartRef.current?.querySelector('svg')
  if (!svg) return

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const data = new XMLSerializer().serializeToString(svg)
  const img = new Image()
  
  img.onload = () => {
    canvas.width = img.width
    canvas.height = img.height
    ctx.fillStyle = '#ffffff'  // White background
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0)
    
    const link = document.createElement('a')
    link.download = `${filename}.png`
    link.href = canvas.toDataURL()
    link.click()
  }
  
  img.src = 'data:image/svg+xml;base64,' + btoa(data)
}

// CSV export
const exportToCSV = (data: Record<string, unknown>[], filename: string) => {
  const headers = Object.keys(data[0]).join(',')
  const rows = data.map(row => Object.values(row).join(',')).join('\n')
  const csv = `${headers}\n${rows}`
  
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
```

---

*APEX-DASH-CREATOR Debug Playbook v2.0*
*APEX Business Systems Ltd. © 2026*
