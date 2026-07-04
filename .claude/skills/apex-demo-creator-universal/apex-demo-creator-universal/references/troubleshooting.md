# APEX-DEMO-CREATOR Universal — Troubleshooting Guide

## Render Pipeline Crash Scenarios

### Crash: "Cannot read properties of undefined"
- **Cause**: getInputProps() returns unexpected shape
- **Fix**: Add default values to all destructured props
```tsx
const { activeAgents = 0, uptimePercent = 100 } = getInputProps() as OmniHubInputProps;
```

### Crash: "Puppeteer timeout"
- **Cause**: useEffect or async code blocking the render thread
- **Fix**: Delete all useEffect calls. Move their logic to a pre-render script that populates getInputProps().

### Crash: "Asset not found"
- **Cause**: Asset URL is wrong, or using `<img>` instead of `<Img>`
- **Fix**: 
  1. Place asset in `public/` directory
  2. Reference as `/asset-name.ext` (root-relative)
  3. Use `<Img src="/asset-name.ext" />` from 'remotion'

### Crash: "ReferenceError: fetch is not defined"
- **Cause**: fetch() called inside component during headless render
- **Fix**: Move all fetch calls to a separate pre-render script. Results are passed via `--props` CLI argument.

---

## Visual Quality Issues

### Problem: Animation doesn't loop cleanly
```tsx
// Fix: Use modulo for loops
const loopLen = fps * 2;
const loopFrame = frame % loopLen;
const value = interpolate(loopFrame, [0, loopLen/2, loopLen], [0, 1, 0]);
```

### Problem: Text flickers between frames
- **Cause**: Text value changes are frame-rate dependent with Math.round()
- **Fix**: Ensure counter update granularity matches fps
```tsx
// Smooth: resolves every frame
const value = interpolate(frame, [0, 60], [0, 100], { extrapolateRight: 'clamp' });
// Display: round only for display
const display = Math.round(value);
```

### Problem: Elements appear before they should
- **Cause**: spring() starts immediately at frame 0
- **Fix**: Use `delay` config or offset the frame input
```tsx
const delayed = spring({ frame: Math.max(0, frame - 30), fps, config: { damping: 12, stiffness: 180 } });
```

### Problem: Multiple items all animate at the same time
- **Cause**: Same frame input for all items
- **Fix**: Stagger by index
```tsx
const itemFrame = Math.max(0, frame - index * 8); // 8-frame stagger
const scale = spring({ frame: itemFrame, fps, config: { damping: 14, stiffness: 200 } });
```

---

## Performance Issues

### Slow render times
- Use `npx remotion render --concurrency 4` to parallelize
- Avoid heavy computations in render loop — pre-compute in getInputProps pre-fetch

### Large output file size
- Use codec: 'h264' for web, 'prores-4444' for post-production
- Lower bitrate: `--crf 23` for h264

---

## Integration with APEX-OmniHub Pipeline

```bash
# Step 1: Pre-fetch OmniHub telemetry (outside render)
node scripts/fetch-omnihub-data.js > /tmp/omnihub-props.json

# Step 2: Validate components
python scripts/validator.py --target src/compositions/ --strict

# Step 3: Render with live data
npx remotion render OmniHubDemo out/demo.mp4 \
  --props="$(cat /tmp/omnihub-props.json)"

# Step 4: Verify output
ffprobe out/demo.mp4 -v quiet -print_format json -show_streams
```
