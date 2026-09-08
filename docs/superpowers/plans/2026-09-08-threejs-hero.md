# Three.js Gold Wave Implementation Plan

> **For agentic workers:** Execute the approved design inline using the executing-plans workflow. Review implementation and browser evidence before completion.

**Goal:** Replace the homepage hero video with an interactive gold particle wave in real 3D, retaining the current text and layout.

**Architecture:** A React HeroBackground component owns client-only scene startup and a plain-color fallback. A dynamically imported Three.js module owns GPU particles, camera parallax, resizing, visibility, pause, and resource cleanup. Hero text remains server-rendered HTML.

**Renderer-only revision (2026-09-09):** The old video poster no longer appears on the homepage, including before hydration, during delayed Three.js imports, under reduced motion, or after renderer failure. Those states use the renderer's plain clear color. The unused hero videos are excluded from Vite's media glob and production output; source references remain available for research. The poster is retained only as an existing web-lesson illustration. Earlier poster-fallback entries below describe the superseded implementation. `scripts/verify-hero-startup.mjs` checks startup and network requests with JavaScript disabled and delayed scene imports on desktop/mobile.

**Tech Stack:** Existing Astro, React, Framer Motion, pnpm, Playwright; add three, @types/three, and lucide-react for the pause/play control.

**Approved scope:** User confirmed the same gold wave with real depth and mouse/scroll interaction. Work in the existing Mac checkout /Users/fiez/Dev/ai-arai-dee, on a feature branch. Local checkout has the identical starting commit and is used to prepare patches for transfer. Do not publish.

## Task 1: Dependencies and Scene

- [x] Add dependencies using pnpm on the Mac; retain its generated lockfile.
- [x] Create src/components/hero-wave.ts: seeded points and flowing strands in XYZ space, shader movement/glow, perspective camera, renderer with capped pixel ratio and a lower mobile particle count.
- [x] Render only while visible and unpaused; stop on hidden tabs; smoothly respond to mouse and scroll without intercepting input.
- [x] Handle resize while paused; catch startup/render failures and context loss; dispose GPU resources and event listeners on teardown.

## Task 2: React Integration

- [x] Create src/components/HeroBackground.tsx: dynamically import scene after mount, retain existing poster until first successful render, expose ready state for pause control, and show poster on failure.
- [x] Modify Hero() in src/components/Experience.tsx: replace video/background translation with scene, keep headline and hint, connect accessible pause/play icon button.
- [x] Listen to reduced-motion changes at runtime and render only the poster when enabled. No canvas should be needed to read or navigate the page.
- [x] Guard asynchronous initialization after teardown and verify live reduced-motion changes initialize at most one canvas.

## Task 3: Verification and Preview

- [x] Update scripts/probe.mjs to verify the new hero contract instead of video readiness; retain existing whole-page checks. Make occupied test ports fail without killing other processes.
- [x] Add focused browser verification for desktop/mobile nonblank canvas, animation, pointer/scroll changes, pause stability, offscreen stop, reduced motion, context loss and blocked WebGL fallback. Capture screenshots to ignored .reviews/.
- [x] Run pnpm build, TypeScript checking, and the updated existing probe; report preexisting failures separately if any.
- [x] Inspect desktop/mobile screenshots and actual canvas pixels. Test lesson navigation and the fallback image.
- [x] Compare wave silhouette, gold density, strand direction and framing against the existing hero poster. Animation is a new procedural recreation, not an exact reproduction of the MP4.
- [x] Leave a local preview running on a free Mac port, provide its URL, and record verification results here.

## Verification Results

- Mac branch: feat/threejs-gold-wave. Preview: http://localhost:4325/ai-arai-dee/.
- `pnpm build` passes. The dynamically loaded Three.js scene is approximately 129 KB gzip; Vite reports its standard 500 KB uncompressed chunk advisory.
- `PORT=4327 pnpm probe` passes the complete site checks, including all eight sections, five images, plate parallax, reduced motion and clean console.
- `node scripts/verify-hero.mjs` passes at 1440x900, 390x844 (DPR 3), and 1920x1080. Checks inspect actual gold canvas pixels and camera matrices for pointer/scroll effects; pause, resize, offscreen/hidden stops, live preferences, context loss, cancelled import, no Three.js download with reduced motion, fallback loading and lesson navigation pass.
- `pnpm exec tsc --noEmit` reports ten preexisting errors in LessonView.tsx and live-text.ts. An archived copy of HEAD with the same dependencies reproduces the identical ten errors. No new type errors were reported.
- Plan and implementation received an independent read-only review; input verification was strengthened to inspect camera matrices rather than relying on animation screenshots.
- Screenshots: .reviews/threejs-hero/{desktop,mobile,wide,reduced-motion}.png. Mobile browser emulation verifies framing and behavior, not physical-phone GPU performance.

## Visual Revisions

The user requested a closer match to the original video, dynamic foreground/background depth blur, and restrained spiral movement. The renderer now uses an irregular, concentrated stream with larger warm highlights and restores the original hero overlay. Depth-of-field sprites calculate their circle of confusion from camera distance and a smoothly moving focus plane; light is normalized across sprite area to prevent bright patches where blurred particles overlap. Focus responds gently to time and pointer position, and freezes with pause.

Three faint trails turn slowly around the stream with shallow helical offsets; their visibility falls with distance from the focus plane. The particle stream has a smaller matching twist. One spiral revolution takes approximately 20 seconds. The browser verification also asserts that the focus uniform changes over time and remains fixed when paused. The result is a procedural 3D recreation, not pixel-identical video playback.

## Layered Motion Revision, 2026-09-09

Following the user's request for deeper video analysis, the previous single-field renderer was replaced by five instanced populations: a folded granular sheet, beaded ribbons, rear dust, sparse foreground bokeh and drifting flecks. Four mobile or six desktop soft-edged continuous filaments share the evolving surface and carry moving highlights. Independent layer speeds, mild spiral offsets, depth-dependent sprite blur and restrained bloom reproduce more of the source's coordinated motion. The shared shaders and geometry live in `src/components/hero-wave-layers.ts`.

The [video motion study](../../research/hero-video-motion-study.md) records direct frame evidence, reconstruction choices, technical sources, verification and remaining visual limitations. Twenty-four source frames and eight rendered frames informed the changes. The final scene bundle is 134.44 KB gzip. Production build and the expanded desktop/mobile/wide hero verification pass; the ten existing typecheck errors are unchanged. Float-target support is checked before enabling bloom, with a tested non-bloom rendering path for unsupported devices.

## Fixed Background and Performance Revision, 2026-09-09

The user's clarified contract supersedes hero-only scrolling behavior: retain animation, remove scroll-driven camera movement, keep the background visible throughout the homepage, increase vertical spiral coverage, and strengthen mouse interaction. `PageBackground` now owns a fixed viewport layer outside the main content and a fixed pause control. The poster fallback is fixed too. Content remains above the scene, with its existing panels and images intact.

The flowing sheet and filaments have 1.85 times their previous vertical amplitude. A viewport-derived horizontal span includes overscan for perspective, rear depth and stronger mouse movement, including ultrawide screens. Mouse camera travel is now +/-2.4 world units horizontally and +/-1 vertically, with faster smoothing. Scroll events no longer change the camera.

Rendering is capped at 30 fps, or 24 fps for small/coarse-pointer/limited-memory-or-core devices. On a 60 Hz display the latter renders about 20 fps. The drawing buffer is capped at 1.2 million pixels or 600,000 on the lower profile, independent of device pixel ratio. The lower profile uses smaller particle populations. Multipass bloom was removed; the existing depth blur and final tone mapping remain. Sustained slow frames reduce resolution to 70% in each dimension and cap rendering at 20 fps; continued severe slowdown switches to the poster and stops GPU work. Hidden-tab, pause, reduced-motion, initialization-failure and context-loss handling remain.

The expanded hero verification passes at 1440x900, 390x844 (DPR 3), 1920x1080 and 2560x720. It asserts fixed viewport bounds through the footer, continued animation below the hero, no scroll camera displacement, stronger mouse travel, pixel/FPS/draw-call budgets, live preferences, pause, context loss and fallback behavior. Simulated two-core/2 GB hardware selects the low profile; simulated sustained slow frame timestamps verify both adaptive reduction and final poster fallback. The test uses full Chromium's headless mode, which accesses the Mac's Apple M1 Metal renderer, instead of the headless shell's slow software rasterizer. Sampled desktop/wide/ultrawide rates were 29.9 fps; the mobile viewport profile was 19.9 fps. These are Mac measurements and emulated constraints, not physical-phone benchmarks.

Build passes; the scene bundle is 132.98 KB gzip. The same ten preexisting typecheck errors remain. Desktop, mobile, scrolled-page and pointer-displaced ultrawide screenshots were inspected for background coverage and text readability.

## Wheel Spin and Particle Size Revision, 2026-09-09

The user requested gentle up/down scroll rotation, explicit scroll-wheel response, and larger particles. A shared `uScrollSpin` uniform now rotates the particle sheet and its filaments around their horizontal axis without moving the camera or the fixed background. Scroll travel and normalized wheel deltas request 0.2 radians per viewport, with smoothing, a 0.25 radian/second speed limit and a bounded pending turn. Passive wheel input also works at page boundaries; its corresponding native scrolling is suppressed as a second rotation source for 350 ms. Pixel, line and page delta modes are normalized. Ctrl-wheel zoom is ignored. Pause and hidden-tab transitions discard queued movement and do not replay scrolling on resume.

Regular particle diameters and their blur footprints are scaled by 1.25; the sparse foreground population uses 1.5. The foreground size ceiling rises from 125 to 187.5 CSS pixels. Particle counts, fixed viewport placement, mouse response, drawing-buffer budgets, frame limits and quality fallback are unchanged. Frozen-time desktop/mobile before-and-after captures in `.reviews/threejs-hero/particle-size/` verify the size change independently of animation.

Build and the expanded four-viewport hero checks pass, including real wheel input at the top boundary, reverse direction, normal page scrolling without duplicate rotation, line/page delta normalization, zoom exclusion, paused scroll/wheel input and unchanged GPU budgets. The high-DPI wheel test compensates for Chromium's injected device-pixel deltas; this is a browser-test adjustment, not extra scaling in the application. Sampled rates remain about 29.9 fps on desktop/wide/ultrawide and 19.9 fps in the low-power mobile viewport profile. The scene bundle is 133.31 KB gzip; the same ten existing project typecheck errors remain.

Input handling follows the documented distinction between [wheel and scroll events](https://developer.mozilla.org/en-US/docs/Web/API/Element/wheel_event) and [wheel delta modes](https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent/deltaMode). The custom rotation gain, limits and deduplication interval are application choices.

The user's follow-up requested slightly more responsive wheel input. Wheel gain is now 0.24 radians per viewport (20% higher); non-wheel page-scroll gain remains 0.2. Easing is faster, with a 0.3 radian/second speed ceiling. The pending-turn limit remains 0.25 radians, preserving gentle bounded movement. The browser checks now also require a prompt wheel response within 350 ms without overshoot.
