# Hero Video Motion Study

Date: 2026-09-09. Audience: the site owner and implementing developer.

## Decision

Recreate several coordinated structures with independent velocities and depth, rather than increasing one cloud's particle count. The source's strongest visual cues are a folded granular sheet, beaded curves, hairline filaments, a persistently blurred rear band, and sparse faster foreground elements.

Scope: the six-second `src/assets/hero-540.mp4` homepage clip and its appearance behind the existing HTML. Retain real Three.js rendering, pointer/scroll interaction, dynamic depth of field, restrained spirals, pause, and reduced-motion fallback. The footage does not establish its original simulation or rendering technique.

## Observations and Gaps

Source inspected at 24 quarter-second samples and enlarged crops. Frame timestamps describe the supplied clip, not generated animation.

| Layer | Direct Evidence | Gap in the Previous Renderer | Implementation |
| --- | --- | --- | --- |
| Folded fine-grain sheet | Throughout 0-5 s, dense fine grains form corrugated crests, gaps and local knots. Their width and height vary as folds migrate right. | Mostly one sinusoid displacing a random cloud. | A shared deforming sheet surface with crosswise folds, local density variations and small turbulent displacement. |
| Beaded ribbons | The lower-left arc deepens around 2-3 s and travels toward the center by 5 s. Larger grains outline several overlapping paths. | Grain sizes vary, but no distinct medium-bead population follows coherent paths. | Separate bead streams following phased curves; concentrations brighten and thin along their paths. |
| Continuous filaments | At 3 s, several faint continuous gold threads are visible beneath the central band, crossing the broader granular structures. | Three uniformly faint thin lines become nearly invisible under the overlay. | A few narrow continuous ribbons with soft edges, slow curvature changes, and localized moving highlights. |
| Rear band | Right-side grains form a soft broad band while center-left details remain relatively sharp across the clip. | Global focus motion dominates, and overlapping blur previously produced large white regions. | A distinct slower rear population, per-particle circle-of-confusion sizing and energy normalization; only modest focus drift. |
| Foreground elements | A large lower disc appears around x=0.32, 0.56 and 0.85 of image width at 0, 1 and 2 s. The fine field moves much more slowly. | All populations shared approximately the same horizontal motion. | Sparse independent near-camera elements, moving faster than the sheet, with substantial depth blur and gentle vertical drift. |

These are observations, not proof of a particular Blender particle system or fluid solver. Interpreting the overlapping paths as 3D spirals and the blur as a physical camera effect is a reconstruction choice. No large lightning bolts, starbursts or dramatic vortex are supported by the footage.

## Rendering Choices

Use instanced camera-facing geometry for grains, beads and occasional short flecks, allowing shape and projected size to vary independently. Three.js supplies [InstancedBufferGeometry](https://threejs.org/docs/pages/InstancedBufferGeometry.html) for instanced geometry. Narrow triangle strips provide controllable soft-edged filament widths; ordinary WebGL line widths are unsuitable for this treatment. Three.js also offers [LineMaterial](https://threejs.org/docs/pages/LineMaterial.html) when a standard wide-line material fits.

Apply restrained glow only to bright knots and filament highlights using [UnrealBloomPass](https://threejs.org/docs/pages/UnrealBloomPass.html). Follow the official [post-processing sequence](https://threejs.org/manual/en/post-processing.html): render the scene, apply bloom, then use OutputPass for tone mapping and color conversion. Glow is an implementation choice inferred from the footage, not a verified description of how its creator rendered it.

Keep all layers on the same simulation time so pause freezes geometry, highlights, focus, and near-camera motion together. Each layer has its own speed and phase. Sparse foreground travel is deliberately faster; the small spiral remains subordinate to the flowing sheet.

## Verification

Compare timed images and short motion sequences at the same aspect ratio, including a background-only view that reveals structure hidden by text. Check desktop, wide desktop and mobile canvas pixels, geometry movement, independent layer velocities, dynamic focus, pause, offscreen/hidden stops, cancellation, context loss and fallback. Compare visible output rather than treating successful animation alone as evidence of visual similarity.

The delivered scene uses five instanced populations plus four mobile or six desktop continuous filaments. `src/components/hero-wave-layers.ts` owns their geometry and shaders; `src/components/hero-wave.ts` owns the camera, animation lifecycle and post-processing. Mobile uses fewer instances, a pixel ratio capped at 1, and a 30 fps limit. Devices without floating-point color attachments retain the scene and output conversion but skip bloom.

Geometry inspection confirmed different speed ranges: the fine sheet travels at 0.55-0.73 world units per simulation second, rear dust at 0.16-0.24, and foreground elements at approximately 1.5-2.4. These are implementation values, not measurements of the source video. Depth and perspective further change their apparent screen speed.

Eight background-only captures span 5.28 simulation seconds. Visual inspection found evolving crests, crossing fine filaments, localized bright knots and faster near-camera travel. A follow-up adjustment widened the folds, added intermediate-depth flecks, and moved the right-hand sheet farther from the focus plane. The layer structure is closer to the source, but its exact grain paths, timing and lens characteristics remain procedural rather than shot-matched.

`pnpm build` passed. `node scripts/verify-hero.mjs` passed at 1440x900, 390x844 with DPR 3, and 1920x1080, including actual rendered-pixel checks, focus motion, pointer/scroll movement, pause, hidden/offscreen stops, live motion preferences, cancelled initialization, context loss, unavailable WebGL, rendering without float targets and lesson navigation. Desktop and mobile screenshots and all eight motion captures were visually inspected. Browser console checks were clean. The project typecheck still reports the same ten preexisting errors in `LessonView.tsx` and `live-text.ts`; none originate in the new scene modules.

Reproduce the motion capture with `node scripts/capture-hero-motion.mjs`. Screenshots and timing metadata are stored under the ignored `.reviews/threejs-hero/` directory. The changes are available in the Mac development preview; they have not been published to GitHub Pages.

## Sources and Limits

Primary visual source: repository asset `src/assets/hero-540.mp4`, 960x540, 24 fps, 6.000 s, inspected locally. Comparison contact sheet and the 3 s filament crop are QA artifacts, not inferred measurements from another website. Approximate screen positions above were visually sampled and are not optical-flow measurements.

Technical sources: official Three.js documentation linked above, accessed 2026-09-09, and the installed Three.js 0.185.1 add-on source on the Mac. An independent visual review corroborated the five layers and relative-motion gap. Research stopped after the major visual gaps had direct frame evidence and the required renderer capabilities were verified; further generic particle tutorials would not resolve source-specific details.

This is a procedural visual recreation. A single video cannot supply hidden scene geometry or guarantee pixel-identical output under a new camera view. Physical-phone GPU performance remains separate from browser viewport emulation.

## Subsequent User-Requested Revision

The scene now stays fixed behind the entire homepage while its animation continues. Scroll-driven camera motion was removed, mouse travel strengthened, and the wave's vertical amplitude increased by 85%. Its horizontal span adapts to the viewport with extra coverage beyond the edges. To limit continuous rendering cost, bloom was removed, rendering resolution and frame rates were capped, and slower devices receive reduced quality or the fixed poster fallback. See the [current implementation record](../superpowers/plans/2026-09-08-threejs-hero.md#fixed-background-and-performance-revision-2026-09-09) for settings and verification. The earlier bloom discussion above records the research-stage reconstruction choice, not the current pipeline.
