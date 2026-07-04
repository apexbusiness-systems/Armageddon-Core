# APEX DASHBOARD PERFORMANCE OPTIMIZATION GUIDE
## Render Budget, Profiling, and Fix Patterns

---

## PERFORMANCE BUDGET

| Metric | Target | Critical Threshold | Tool |
|--------|--------|-------------------|------|
| First Contentful Paint (FCP) | < 1.5s | > 3s | Lighthouse |
| Largest Contentful Paint (LCP) | < 2.5s | > 4s | Lighthouse |
| Total Blocking Time (TBT) | < 150ms | > 600ms | Lighthouse |
| Cumulative Layout Shift (CLS) | < 0.1 | > 0.25 | Lighthouse |
| Chart render time | < 16ms | > 50ms | Chrome Perf |
| Filter response | < 100ms | > 300ms | React Profiler |
| API response | < 500ms | > 2s | Network tab |
| Memory usage | < 50MB | > 200MB | Chrome Memory |

---

## PROFILING COMMANDS

```bash
# Lighthouse CI
npx lighthouse-ci autorun --config=lighthouserc.js

# Bundle analysis
npx vite-bundle-visualizer  # Vite
npx webpack-bundle-analyzer  # Webpack

# React component profiling (Chrome DevTools)
# Open React DevTools → Profiler tab → Record → interact → Stop → Analyze
```

---

## TOP 10 PERF KILLERS + FIXES

### 1. Re-rendering entire dashboard on filter change
```tsx
// ❌ Bad: All charts re-render when any filter changes
function Dashboard() {
  const [filters, setFilters] = useState(defaultFilters)
  return (
    <div>
      <Filters onChange={setFilters} />
      <Chart1 filters={filters} />  {/* Re-renders on every filter change */}
      <Chart2 filters={filters} />
      <Chart3 filters={filters} />
    </div>
  )
}

// ✅ Good: Memoize charts, only re-render when their data changes
const Chart1 = React.memo(({ data }) => <LineChart data={data} />,
  (prev, next) => JSON.stringify(prev.data) === JSON.stringify(next.data)
)

// Even better: move data fetching into each chart with its own query
```

### 2. Transforming data on every render
```tsx
// ❌ Bad: transform runs on every render
function Chart({ rawData }) {
  const chartData = rawData.map(d => ({  // Recalculates every render!
    date: new Date(d.timestamp),
    value: d.amount / 100
  }))
  return <LineChart data={chartData} />
}

// ✅ Good: memoize transformation
function Chart({ rawData }) {
  const chartData = useMemo(() =>
    rawData.map(d => ({ date: new Date(d.timestamp), value: d.amount / 100 })),
    [rawData]  // Only recalculate when rawData reference changes
  )
  return <LineChart data={chartData} />
}
```

### 3. Too many data points
```tsx
// ❌ Bad: Rendering 50,000 data points crashes browser
<LineChart data={fiftyThousandPoints} />

// ✅ Good: LTTB downsampling
import { largestTriangleThreeBuckets } from 'downsample'

const chartData = useMemo(() => {
  if (data.length > 1000) {
    return largestTriangleThreeBuckets(data, 500)  // Reduce to 500 points
  }
  return data
}, [data])
```

### 4. Heavy chart library imported as whole bundle
```tsx
// ❌ Bad: imports entire Recharts bundle
import * as Recharts from 'recharts'

// ✅ Good: named imports — tree-shakeable
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
```

### 5. Lazy loading off-screen / tab charts
```tsx
import { lazy, Suspense } from 'react'

// Heavy map chart only loaded when tab is active
const GeoMap = lazy(() => import('./GeoMapChart'))

function DashboardTabs() {
  const [activeTab, setActiveTab] = useState('overview')
  return (
    <>
      <TabList ... />
      {activeTab === 'geography' && (
        <Suspense fallback={<ChartSkeleton height={400} />}>
          <GeoMap data={geoData} />
        </Suspense>
      )}
    </>
  )
}
```

### 6. Waterfall data fetching (sequential)
```tsx
// ❌ Bad: Each fetch waits for the previous one
const kpis = await fetchKPIs()        // 500ms
const charts = await fetchCharts()    // 400ms
const table = await fetchTable()      // 300ms
// Total: 1200ms

// ✅ Good: Parallel fetching with Promise.all or React Query
const [kpis, charts, table] = await Promise.all([
  fetchKPIs(), fetchCharts(), fetchTable()
])
// Total: 500ms (longest single request)
```

### 7. Layout thrash from dynamic chart heights
```tsx
// ❌ Bad: Reading layout then writing causes reflow
const width = container.offsetWidth   // LAYOUT READ
container.style.height = ...          // LAYOUT WRITE → reflow!
const height = container.offsetHeight // LAYOUT READ → another reflow!

// ✅ Good: Use ResizeObserver or useElementSize hook
const { width, height } = useElementSize(containerRef)
// ResizeObserver batches layout reads — no thrash
```

### 8. Missing virtualization for large tables
```tsx
import { useVirtualizer } from '@tanstack/react-virtual'

function VirtualTable({ rows }: { rows: DataRow[] }) {
  const parentRef = useRef<HTMLDivElement>(null)
  
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,  // Row height
  })

  return (
    <div ref={parentRef} className="h-[400px] overflow-auto">
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map(virtualRow => (
          <div key={virtualRow.key} style={{ position: 'absolute', top: virtualRow.start, height: 48 }}>
            <TableRow data={rows[virtualRow.index]} />
          </div>
        ))}
      </div>
    </div>
  )
}
```

### 9. WebSocket memory accumulation
```tsx
// ❌ Bad: Unbounded array growth
ws.onmessage = (e) => setData(prev => [...prev, JSON.parse(e.data)])

// ✅ Good: Cap at N most recent points
ws.onmessage = (e) => {
  const newPoint = JSON.parse(e.data)
  setData(prev => {
    const updated = [...prev, newPoint]
    return updated.length > 200 ? updated.slice(-200) : updated
  })
}
```

### 10. No loading priority (all charts equal priority)
```tsx
// ✅ Good: Above-fold loads first
// Primary KPI cards: immediate (no suspense)
// Charts in view: load with priority
// Off-screen charts: deferred load

function Dashboard() {
  return (
    <>
      {/* CRITICAL: No suspense — renders sync */}
      <KPICards data={kpiData} />
      
      {/* HIGH: Suspense with skeleton */}
      <Suspense fallback={<ChartSkeleton />}>
        <PrimaryChart />
      </Suspense>
      
      {/* DEFERRED: Only loads when scrolled into view */}
      <IntersectionObserverWrapper>
        <Suspense fallback={<ChartSkeleton />}>
          <SecondaryChart />
        </Suspense>
      </IntersectionObserverWrapper>
    </>
  )
}
```

---

*APEX-DASH-CREATOR Performance Guide v2.0 — APEX Business Systems Ltd. © 2026*
