# APEX-DEMO-CREATOR — Universal Edition v1.0
**Omniscient Remotion Determinism Engine**  
**Vendor-Agnostic | Any LLM | Any Agent Platform**

---

## METADATA

| Field | Value |
|---|---|
| **Skill Name** | apex-demo-creator |
| **Version** | 1.0.0 |
| **Author** | APEX Business Systems Ltd. |
| **Created** | 2026-03-12 |
| **Platform** | Model-agnostic (GPT-4, Gemini, Claude, Llama, Mistral, Grok, any) |
| **Domain** | Remotion Video Rendering / React Animation |
| **Archetype** | Workflow + Guardian |

---

## ACTIVATION TRIGGERS

Activate this skill when ANY of these keywords appear in the prompt:

```
remotion, demo video, create video, render scene, video component,
composition, video rendering, FFmpeg render, Puppeteer render,
useCurrentFrame, getInputProps, spring animation, interpolate,
OmniHub render, APEX video, deterministic render, video pipeline,
telemetry animation, video sequence, motion sequence
```

---

## PRIME DIRECTIVE

> **A video is a pure function of time. Frame N must render identically every time it is evaluated. Any deviation is a CRITICAL FAILURE that crashes the headless render pipeline.**

```
VIDEO RENDERING LAW:
  render(frame: number) → pixels

  Constraints:
  - render() must be a pure function
  - render() must be synchronous
  - render() must be deterministic
  - render() must have zero side effects
  - Violation of ANY constraint = pipeline crash
```

---

## SECTION 1: HARD CONSTRAINTS — NEVER DO THESE

### 1A. Forbidden React Hooks

| Hook | Why Forbidden | Replacement |
|------|--------------|-------------|
| `useState` | Mutable state breaks frame determinism | `interpolate(frame, [...], [...])` |
| `useReducer` | Same as useState | `interpolate(frame, [...], [...])` |
| `useRef` (for visual data) | Persists across frames, breaks isolation | Derive from `frame` directly |
| `useEffect` | Side effect = pipeline crash | Move logic to `getInputProps()` pre-fetch |
| `useLayoutEffect` | Same as useEffect | Same fix |

### 1B. Forbidden Timers

```
NEVER USE: setTimeout, setInterval, requestAnimationFrame
WHY: Remotion owns the render clock. Timers are asynchronous. Async = crash.
FIX: All timing is derived from useCurrentFrame()
```

### 1C. Forbidden Network Calls

```
NEVER USE: fetch, axios, XMLHttpRequest, any API call inside a component
WHY: Headless Puppeteer has no network in render mode
FIX: Pre-fetch all data BEFORE render. Pass via getInputProps()
```

### 1D. Forbidden CSS

```
NEVER USE: CSS transition, CSS animation, CSS @keyframes
WHY: CSS animation runs on its own timeline, not Remotion's frame clock
FIX: Animate ONLY via spring() and interpolate()
```

### 1E. Forbidden HTML Media Tags

```
NEVER USE: <img>, <video>, <audio>, <iframe>
WHY: Raw HTML tags bypass Remotion's asset loading system → undefined behavior
FIX: Use Remotion's components: <Img>, <Video>, <Audio>, <IFrame> (from 'remotion')
```

---

## SECTION 2: REQUIRED OPERATIONS — ALWAYS DO THESE

### 2A. Time Sourcing (MANDATORY)

```tsx
// This MUST appear in every animated component
const frame = useCurrentFrame();
const { fps, durationInFrames } = useVideoConfig();

// ALL visual changes derive from `frame`. Zero exceptions.
```

### 2B. Data Injection (MANDATORY)

```tsx
// This is the ONLY legal way to bring external data into a component
const inputProps = getInputProps();

// Data flows: pre-fetched → getInputProps() → root Composition → child components
// Do NOT hardcode telemetry values. Do NOT fetch them. Pre-fetch externally, pass here.
```

### 2C. Motion Physics (MANDATORY)

**Option A — Physics spring (for entrances, exits, bouncy motion):**
```tsx
import { spring } from 'remotion';
const scale = spring({
  frame,
  fps,
  config: { damping: 12, stiffness: 180 }  // tune these for feel
});
// style={{ transform: `scale(${scale})` }}
```

**Option B — Linear/eased interpolation (for counters, opacity, progress bars):**
```tsx
import { interpolate } from 'remotion';
const opacity = interpolate(
  frame,
  [0, 30],          // frame range: start, end
  [0, 1],           // value range: from, to
  {
    extrapolateLeft: 'clamp',   // ALWAYS include both clamps
    extrapolateRight: 'clamp'   // prevents value bleeding outside range
  }
);
```

### 2D. Asset Loading (MANDATORY)

```tsx
import { Img, Video, Audio, IFrame } from 'remotion';
// Use these INSTEAD of raw HTML tags:
<Img src="/apex-logo.svg" />
<Video src="/background.mp4" />
<Audio src="/sfx.mp3" />
```

---

## SECTION 3: COMPONENT ARCHITECTURE

### Data Flow Rule

```
[External System / Pre-fetch Script]
          │
          ▼ (synchronous, no async)
    getInputProps()                    ← ENTRY POINT (root only)
          │
          ▼
    Root Composition Component         ← Destructure ALL props here
          │
          ├──▶ <Sequence> SceneA       ← Receives props as arguments
          ├──▶ <Sequence> SceneB       ← Receives props as arguments
          └──▶ <Sequence> SceneC       ← Receives props as arguments

RULE: Data flows DOWN ONLY. Children never call getInputProps() directly.
```

### Minimal Working Component

```tsx
import {
  useCurrentFrame, useVideoConfig,
  interpolate, spring,
  Img, AbsoluteFill, getInputProps
} from 'remotion';

// Step 1: Define prop contract
interface SceneProps {
  title: string;
  metricValue: number;
  accentColor: string;
}

// Step 2: Build pure functional component
export const ApexScene: React.FC = () => {
  // Step 3: Get props from getInputProps (root only) OR from React props (children)
  const { title, metricValue, accentColor } = getInputProps() as SceneProps;

  // Step 4: Source time
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Step 5: Derive ALL animation values from frame
  const scale   = spring({ frame, fps, config: { damping: 12, stiffness: 180 } });
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });

  // Step 6: Apply derived values to styles
  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0f' }}>
      <div style={{ opacity, transform: `scale(${scale})` }}>
        <h1 style={{ color: accentColor }}>{title}</h1>
        <p>{metricValue}</p>
      </div>
    </AbsoluteFill>
  );
};
```

### Sequence Timing Pattern

```tsx
// Sequences handle ALL timing. Children use frame=0 relative to Sequence start.
<AbsoluteFill>
  <Sequence from={0}   durationInFrames={90}>  <SceneA {...props} /> </Sequence>
  <Sequence from={90}  durationInFrames={120}> <SceneB {...props} /> </Sequence>
  <Sequence from={210} durationInFrames={90}>  <SceneC {...props} /> </Sequence>
</AbsoluteFill>
```

---

## SECTION 4: VALIDATION PROTOCOL

**Run this checklist on EVERY component before rendering:**

### Step 1 — Forbidden Pattern Scan
Search the entire component tree for:
- `useState` → if found: REWRITE immediately
- `useEffect` → if found: REWRITE immediately
- `fetch` / `axios` → if found: REWRITE immediately
- `CSS transition:` → if found: REWRITE immediately
- `<img` / `<video` / `<audio` → if found: REPLACE immediately

### Step 2 — Time Binding Audit
- Every animated CSS property must trace back to `useCurrentFrame()`
- No hardcoded animation values (e.g., no `opacity: 0.5` that should animate)

### Step 3 — Data Source Audit
- All external data must come from `getInputProps()`
- No hardcoded telemetry values in component body

### Step 4 — Extrapolation Audit
- Every `interpolate()` call must include `extrapolateRight: 'clamp'`
- Every `interpolate()` call must include `extrapolateLeft: 'clamp'`

### Step 5 — Smoke Test
```bash
# Test frame 0
npx remotion still <CompositionId> --frame=0

# Test mid-point frame
npx remotion still <CompositionId> --frame=<durationInFrames/2>

# Render must exit with code 0. Any error = validation failed.
```

---

## SECTION 5: FAILURE DIAGNOSIS MATRIX

| Symptom | Probable Cause | Fix |
|---------|---------------|-----|
| Frame renders differently on re-run | useState/useRef holding visual state | Replace with `interpolate(frame, ...)` |
| Puppeteer timeout during render | useEffect or network call blocking | Delete useEffect; move data to getInputProps pre-fetch |
| Animation doesn't start at frame 0 | Missing `delay` config or wrong input range | Check interpolate inputRange starts at 0 |
| Values spike past expected range | Missing `extrapolate: 'clamp'` | Add clamp options to all interpolate() calls |
| Asset not loading in headless render | Raw `<img>` tag used | Replace with `<Img>` from 'remotion' |
| Staggered items overlap at frame 0 | Negative frame passed to spring | Add: `Math.max(0, frame - index * delay)` |
| Audio out of sync | Using `<audio>` tag | Replace with `<Audio>` from 'remotion' |
| CSS animation runs at wrong speed | CSS animation property used | Delete CSS animation; use `spring()` |

---

## SECTION 6: APEX-OMNIHUB TELEMETRY DATA CONTRACT

```typescript
// Full input props schema for OmniHub demo videos
interface OmniHubInputProps {
  // Identity
  systemName: string;          // "APEX-OmniHub v2.4"
  buildDate: string;           // "2026-03-12"

  // Central Control Plane metrics
  activeAgents: number;        // 247
  workflowsOrchestrated: number;
  uptimePercent: number;       // 99.98
  avgLatencyMs: number;        // 42

  // Branding
  accentColor: string;         // "#6C63FF"
  logoUrl: string;             // "/apex-logo.svg"

  // Video config
  fps: number;                 // 60
  durationInFrames: number;    // 360
}
```

---

## SECTION 7: VISUAL DESIGN SYSTEM

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#0a0a0f` | All scene backgrounds |
| Primary | `#6C63FF` | APEX violet — primary text, accents |
| Data Cyan | `#00D4FF` | Telemetry highlights, live metrics |
| Success | `#00FF88` | Uptime green, positive indicators |
| Warning | `#FFB800` | Alert amber |
| Text Primary | `#FFFFFF` | Headlines, key values |
| Text Secondary | `#A0A0B0` | Labels, captions |
| Font Stack | `-apple-system, BlinkMacSystemFont, 'Inter', sans-serif` | All text |
| Grid | `1920×1080 @ 60fps` | Standard desktop |
| Grid (Vertical) | `1080×1920 @ 60fps` | Mobile / social |
| Grid (Social) | `1200×628 @ 30fps` | OG image / LinkedIn |

---

## SECTION 8: COMMON ANIMATION RECIPES

### Animated Counter
```tsx
const count = Math.round(
  interpolate(frame, [0, 60], [0, targetValue], { extrapolateRight: 'clamp' })
);
```

### Staggered List Entrance
```tsx
items.map((item, i) => {
  const opacity = interpolate(
    frame, [i * 8, i * 8 + 20], [0, 1],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
  );
  return <div style={{ opacity }}>{item}</div>;
})
```

### Progress Bar
```tsx
const width = interpolate(frame, [0, 45], [0, percent], { extrapolateRight: 'clamp' });
// style={{ width: `${width}%` }}
```

### Looping Status Pulse
```tsx
const loopLen = fps * 2;
const pulse = interpolate(
  frame % loopLen, [0, loopLen / 2, loopLen], [1, 1.08, 1]
);
```

---

## SECTION 9: INSTRUCTIONS FOR CONSUMING AGENTS

### How to Apply This Skill

**When user requests a Remotion video component:**

1. Read Sections 1–4 completely before writing any code
2. Write the component contract (props interface) FIRST
3. Scaffold the component using the Section 3 template
4. Derive ALL animation from `useCurrentFrame()`
5. Source ALL external data from `getInputProps()`
6. Run the Section 4 validation checklist mentally before outputting
7. Output the component with a confirmation: "Validation passed: zero forbidden patterns"

**When user provides existing code to audit:**

1. Run Section 4 Step 1 scan immediately
2. List every forbidden pattern found with line numbers
3. Rewrite each violation with the correct deterministic equivalent
4. Confirm each fix with: "Replaced [forbidden pattern] with [deterministic equivalent]"
5. Output the clean version

**Quality Gate (non-negotiable before any output):**
- [ ] Zero forbidden hooks
- [ ] All motion traces to `useCurrentFrame()`
- [ ] All data from `getInputProps()`
- [ ] All assets use Remotion components
- [ ] All `interpolate()` calls have `extrapolate: 'clamp'`

---

## USAGE EXAMPLES

### Example 1: Generate a new OmniHub scene
**User prompt:** "Create a Remotion scene showing APEX-OmniHub uptime at 99.98%"

**Agent action:**
1. Activate apex-demo-creator
2. Scaffold using Section 3 template
3. Use animated counter recipe from Section 8
4. Pass uptimePercent via getInputProps()
5. Output validated TypeScript component

### Example 2: Audit broken component
**User prompt:** "Fix this component — the render is crashing"

**Agent action:**
1. Run Section 4 Step 1 scan
2. Identify: `useState` found on line 4
3. Rewrite: Replace `const [opacity, setOpacity] = useState(0)` with `const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' })`
4. Confirm: "Fixed. useState eliminated. Motion now bound to useCurrentFrame()."

---

## IRON LAWS (Non-Negotiable)

| # | Law | Violation = |
|---|-----|-------------|
| 1 | Video is a pure function of time | Rewrite the component |
| 2 | No async operations in render path | Delete and move to pre-fetch |
| 3 | No CSS-owned animations | Replace with spring/interpolate |
| 4 | getInputProps() is the only data source | Externalize all hardcoded data |
| 5 | Always clamp interpolate() output | Add extrapolate: 'clamp' |
| 6 | Use Remotion asset components only | Replace raw HTML tags |
| 7 | Validate before every render | Run Section 4 checklist |

---

**APEX-DEMO-CREATOR Universal Edition v1.0**  
**APEX Business Systems Ltd. | Edmonton, Alberta, Canada**  
**© 2026 All Rights Reserved | https://apexbusiness-systems.com**
