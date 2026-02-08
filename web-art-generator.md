---
name: web-art-generator
description: "Silicon Valley production house-grade web artifact generation. Triggers: app icon, hero image, favicon, splash screen, UI animation, demo video, marketing banner, loading animation, button design, brand assets, social cards, og:image, Apple touch icon, PWA assets, store screenshots, feature graphics. Produces: .png, .svg, .gif, .mp4, .html, .jsx at Apple-polish quality. Zero generic AI aesthetics."
license: "Proprietary - APEX Business Systems Ltd. Complete terms in LICENSE.txt"
---

# web-art-generator

**Mission**: Generate web application media assets at Silicon Valley production house quality. Every artifact looks like Apple made it.

## Contract

**Input**: Asset type + context (brand, purpose, platform)  
**Output**: Production-ready media files in `/mnt/user-data/outputs/`  
**Success**: Asset passes platform validation, looks premium, zero AI-slop aesthetics

---

## Decision Tree

**What are you generating?**

| Asset Type | Section | Primary Output |
|------------|---------|----------------|
| App Icon / Favicon | → Section A | .png/.svg/.ico |
| Hero Image / Banner | → Section B | .png/.svg/.html |
| UI Animation / Loading | → Section C | .gif/.svg/.html/.jsx |
| Demo Video / Explainer | → Section D | .mp4/.gif/.html |
| Buttons / Components | → Section E | .svg/.jsx/.html |
| Social / OG Cards | → Section F | .png |
| Store Screenshots | → Section G | .png |
| Brand Kit Export | → Section H | multi-format bundle |

---

## A. App Icons & Favicons

**Platform requirements** (memorize these):

| Platform | Sizes Required | Format |
|----------|----------------|--------|
| iOS | 1024, 180, 167, 152, 120, 87, 80, 76, 60, 58, 40, 29, 20 | PNG (no alpha for App Store) |
| Android | 512, 192, 144, 96, 72, 48, 36 | PNG (adaptive icons need foreground/background) |
| Web Favicon | 512, 192, 180, 152, 144, 128, 96, 72, 48, 32, 16 | PNG + ICO |
| macOS | 1024, 512, 256, 128, 64, 32, 16 | PNG/ICNS |

**Common Failures**:
- ❌ Using transparency on iOS App Store icons (REJECTED)
- ❌ Non-square aspect ratio (ALL platforms require 1:1)
- ❌ Fine details that disappear at small sizes
- ❌ Text in icons (illegible at 16px)
- ❌ Generic gradients (screams AI-made)

**Correct Approach**:
```
DESIGN PRINCIPLE: Icon must be recognizable at 16px

1. Create at 1024x1024 (master)
2. Use bold, simple shapes
3. Max 2-3 colors
4. Test readability at 32px BEFORE finalizing
5. Export all sizes programmatically
```

**Run generation script**:
```bash
python /home/claude/web-art-generator/scripts/icon_generator.py \
  --master icon_1024.png \
  --platforms ios,android,web,macos \
  --output /mnt/user-data/outputs/icons/
```

---

## B. Hero Images & Banners

**Platform Specs**:

| Placement | Dimensions | Notes |
|-----------|------------|-------|
| Website Hero | 1920x1080, 1440x900 | Above the fold, <200KB |
| App Store Hero | 2880x1800 (retina) | Feature graphic |
| Social Banner | 1500x500 (Twitter), 1200x628 (LinkedIn) | Text in safe zone |
| Google Play Feature | 1024x500 | No device frames |

**Design System** (Lazy-CEO Mode):
```
HERO IMAGE FORMULA:
┌─────────────────────────────────────────┐
│  [GRADIENT/TEXTURE BACKGROUND]          │
│     ┌────────────┐                      │
│     │ FOCAL      │   HEADLINE           │
│     │ ELEMENT    │   Subtext            │
│     └────────────┘   [CTA Button]       │
└─────────────────────────────────────────┘

Z-pattern reading flow. Focal element left, text right.
```

**Generate as HTML artifact**:
```html
<!-- Hero images as code = infinite resolution -->
<div style="width:1920px;height:1080px;background:linear-gradient(135deg,#667eea,#764ba2);position:relative;">
  <!-- Build composable, export via screenshot -->
</div>
```

---

## C. UI Animations & Loading States

**Types**:

| Animation | Format | Use Case |
|-----------|--------|----------|
| Spinner/Loader | SVG animation | Page loads |
| Skeleton | CSS | Content placeholders |
| Micro-interaction | CSS/JS | Button hovers, toggles |
| Page Transition | Framer Motion | Route changes |
| Lottie | JSON | Complex animations |

**Common Failures**:
- ❌ Animations longer than 300ms for UI feedback
- ❌ Linear easing (feels robotic)
- ❌ Infinite loops without purpose
- ❌ Heavy GIFs when SVG works

**Correct Approach**:
```css
/* ALWAYS use these curves for premium feel */
--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
--ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1);
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);

/* Apple-standard durations */
--duration-fast: 150ms;    /* Micro-interactions */
--duration-normal: 250ms;  /* Standard transitions */
--duration-slow: 400ms;    /* Emphasis animations */
```

**SVG Spinner (Premium)**:
```svg
<svg viewBox="0 0 50 50" style="animation:rotate 1s linear infinite">
  <circle cx="25" cy="25" r="20" fill="none" stroke="currentColor" 
    stroke-width="3" stroke-linecap="round"
    stroke-dasharray="80 200" stroke-dashoffset="0">
    <animate attributeName="stroke-dashoffset" values="0;-150" 
      dur="1.5s" repeatCount="indefinite"/>
  </circle>
</svg>
```

---

## D. Demo Videos & Explainers

**Video specs by platform**:

| Platform | Resolution | Duration | Format |
|----------|------------|----------|--------|
| App Store Preview | 1920x1080, 1080x1920 | 15-30s | H.264 MP4 |
| Landing Page | 1920x1080 | 30-90s | MP4/WebM |
| Social | 1080x1080, 1080x1920 | 15-60s | MP4 |
| Product Hunt | 1920x1080 | 30-60s | MP4/GIF |

**Demo Video Framework**:
```
HOOK (0-3s):   Problem statement OR wow moment
SHOW (3-20s):  Feature demonstration, screen recordings
PROVE (20-25s): Social proof, results, testimonials
CTA (25-30s):  Clear next action
```

**Generate with HTML + Puppeteer** (for code-based demos):
```bash
python /home/claude/web-art-generator/scripts/video_from_html.py \
  --html demo_animation.html \
  --duration 30 \
  --fps 60 \
  --output demo.mp4
```

---

## E. Buttons & UI Components

**Button states** (always design all 5):
```
DEFAULT → HOVER → ACTIVE → FOCUS → DISABLED
```

**Premium button recipe**:
```jsx
<button className="
  px-6 py-3 rounded-xl font-semibold
  bg-gradient-to-b from-white/20 to-transparent
  shadow-[0_1px_2px_rgba(0,0,0,0.05),0_0_0_1px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)]
  transition-all duration-150 ease-out
  hover:shadow-[0_4px_12px_rgba(0,0,0,0.15),0_0_0_1px_rgba(0,0,0,0.1)]
  hover:-translate-y-0.5
  active:translate-y-0 active:shadow-[0_1px_2px_rgba(0,0,0,0.1)]
">
  Get Started
</button>
```

---

## F. Social & OG Cards

**Required meta images**:

| Type | Size | Platform |
|------|------|----------|
| og:image | 1200x630 | Facebook, LinkedIn |
| twitter:image | 1200x600 | Twitter/X |
| schema.org image | 1200x1200 | Google |

**Template structure**:
```
┌──────────────────────────────────┐
│ [LOGO/BRAND]                     │
│                                  │
│     LARGE BOLD TITLE             │
│     Supporting description       │
│                                  │
│ [product screenshot] [CTA]       │
└──────────────────────────────────┘
```

---

## G. Store Screenshots

**Sizes**:
- iPhone: 1290x2796, 1284x2778, 1242x2688
- iPad: 2048x2732
- Android: 1080x1920

**Framework** (3-5 screenshots):
```
1. Hero Shot: Main value proposition
2. Feature 1: Key differentiator
3. Feature 2: Workflow demonstration
4. Social Proof: Reviews, numbers
5. CTA: Download prompt
```

---

## H. Brand Kit Export

**Deliverables checklist**:
- [ ] Logo: .svg, .png (dark/light variants)
- [ ] Colors: .json, CSS variables, Tailwind config
- [ ] Typography: font files, usage guide
- [ ] Icons: Full set .svg/.png
- [ ] Social templates: Figma/Canva links
- [ ] Guidelines: Brand usage .pdf

Run full export:
```bash
python /home/claude/web-art-generator/scripts/brand_kit_export.py \
  --config brand.json \
  --output /mnt/user-data/outputs/brand-kit/
```

---

## Quality Rubric

Before delivering ANY asset, validate:

| Criterion | Check |
|-----------|-------|
| **Platform Compliant** | Meets exact size/format specs |
| **Premium Feel** | Zero AI-slop aesthetics |
| **Performance** | Under size limits, optimized |
| **Accessibility** | Contrast ratios, alt text ready |
| **Consistency** | Matches brand system |

---

## References

- `references/platform-specs.md` - Complete specs for all platforms
- `references/color-systems.md` - Brand color generation
- `references/animation-library.md` - Premium animation presets
- `references/typography-guide.md` - Font pairing and usage
