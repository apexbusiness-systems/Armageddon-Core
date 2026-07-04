# APEX-DEMO-CREATOR Universal — Quick-Start Templates

## How to Use This Skill

Paste the SKILL.md content into the system prompt of ANY LLM.  
The agent will instantly gain Remotion determinism expertise.

---

## Prompt Templates for Common Tasks

### Task: Generate a new Remotion scene
```
Using the apex-demo-creator skill, create a deterministic Remotion component for:
[describe scene — e.g., "showing active agent count animating from 0 to 247 over 60 frames"]

Requirements:
- Follow all iron laws from the skill
- Include full TypeScript types
- Source data from getInputProps()
- Use spring() or interpolate() for all animation
- Validate against Section 4 checklist before outputting
```

### Task: Audit an existing component
```
Using the apex-demo-creator skill, audit this Remotion component and fix all violations:

[paste component code]

Output:
1. List every violation found (hook name, line number, reason)
2. Rewrite the component with all violations fixed
3. Confirm each fix
4. Run the Section 4 checklist and report pass/fail
```

### Task: Design an OmniHub demo video
```
Using the apex-demo-creator skill, design a complete APEX-OmniHub demo video with:
- Duration: 210 frames at 60fps (3.5 seconds)
- Scenes: Hero (0-90), Metrics (90-180), CTA (180-210)
- Data: { activeAgents: 247, uptimePercent: 99.98, avgLatencyMs: 42 }
- Colors: background #0a0a0f, accent #6C63FF

Output:
1. Root composition (index.ts)
2. HeroScene.tsx
3. MetricsScene.tsx
4. CTAScene.tsx
All files must pass the Section 4 validation checklist.
```

---

## Key API Reference (Embed in Any Agent Context)

```typescript
// THE ONLY LEGAL ANIMATION PATTERNS:

// Pattern A: Spring (bouncy/physical)
import { spring } from 'remotion';
const value = spring({ frame, fps, config: { damping: 12, stiffness: 180 } });

// Pattern B: Interpolate (linear/eased)
import { interpolate } from 'remotion';
const value = interpolate(frame, [startFrame, endFrame], [startValue, endValue], {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp'
});

// ALWAYS source time from:
const frame = useCurrentFrame();
const { fps, durationInFrames } = useVideoConfig();

// ALWAYS source data from:
const props = getInputProps();
```
