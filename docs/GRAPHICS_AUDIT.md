# Graphics audit and upgrade roadmap (benchmark: Colossal-over-the-wall render)

Nothing in the game's rendering has been changed for this audit. Only the opening-intro hand fix (v0.5.2) was done.

## 1. What the engine is today
- Custom WebGL2 engine (`js/engine.js`, 30 KB). **No Three.js.** The brief mentions Three.js, but everything in it has to be built on this engine.
- Already present: 2-cascade shadow maps (3072 px on mobile, 4096 on desktop, hardware PCF via `sampler2DShadow`), ACES tone map, an "anime grade" in the fragment shader, tangent-space normal maps (`u_norm`), height-derived ground bump, procedural moss, distance fog blended to the sky dome, painted-noise wash, MSAA (`antialias:true`), DPR cap 2 (2.2 in the viewer), LOD (`lodScale`), frustum-cull in `drawScene`.
- Missing: PBR (metal/rough/AO maps), SSAO, bloom, post-processing chain (no off-screen colour target), volumetric light, reflections, separate quality tiers, adaptive resolution.

## 2. Why the current frame looks weaker than the benchmark
| Area | Benchmark | Now | Fix type |
|---|---|---|---|
| Sky | dense, high-contrast fiery clouds with bright rims | soft pastel gradient, flat clouds | **Code**: layered fbm cloud shader with sun-rim lighting, stronger sunset grade |
| Wall | brick-by-brick stone, cracks, large cast shadows | flat tan slabs, almost no detail | **Code + texture**: procedural brick/mortar normal + albedo variation; one 1024 px tiling stone normal map (asset) |
| Titan | thick layered muscle fibres, specular sheen, rim light, subsurface red | smooth red with a few cream lines | **Asset**: a higher-detail muscle model/normal map; **code**: rim + wrap lighting + SSS-like term |
| Hands | fingers hooked over the edge, back of hand up | (fixed in v0.5.2 by IK; palm orientation being finalised) | Code |
| Lighting | strong warm key, deep shadows, bounce | weak key, flat ambient | **Code**: stronger directional contrast, AO in shadow, warm bounce |
| Depth | haze layers, god rays | thin fog | **Code**: height fog, light shafts (screen-space radial blur), volumetric-looking mist |
| Image | bloom, vignette, grading, film grain | none | **Code**: post pass |

## 3. What code can do vs. what needs assets
- Code only: sky/clouds, sunset grade, bloom, vignette, SSAO-lite, height fog, god rays, rim/SSS light on Titans, brick procedural detail, quality tiers, adaptive resolution.
- Needs assets (you add through GitHub): a stone wall normal+albedo texture (CC0, 1024 px), a higher-detail Colossal mesh or muscle normal map. `colossal_titan_2.glb` (the model you sent) is already packed as `colossal2`. It has a different skeleton, so the hand IK and finger curl built for `colossal` need a retarget before the intro can use it. See the next phase.

## 4. Mobile limits that shape the plan
Safari/Chrome mobile WebGL2: no timer queries, ~4 GB shared memory, thermal throttling after 1 to 2 minutes at full load, MSAA on a high-DPR canvas is expensive. So: render the scene to an off-screen target at an adaptive scale (0.6 to 1.0), run one combined post pass (bloom + grade + vignette + FXAA), cap SSAO to ULTRA, and drop shadows to one cascade on LOW.

## 5. Phased roadmap
1. **Quality tiers + adaptive resolution** (engine.js, viewer.js, boot.js): LOW/MEDIUM/HIGH/ULTRA, auto-pick from GPU string, memory, DPR and a 2-second benchmark; runtime scaler that watches frame time.
2. **Post pipeline** (engine.js): off-screen colour + depth, bloom, FXAA, vignette, colour grade, optional god rays.
3. **Sky and atmosphere** (engine.js SKY shader): fbm clouds with sun-rim lighting, richer sunset, height fog, layered mist.
4. **Wall and building materials**: procedural brick/mortar detail now; swap in the real normal map when supplied.
5. **Titan shading**: rim light, wrap diffuse, specular sheen on muscle, SSS-like warm bleed, normal-map support for `colossal2`.
6. **Colossal 2 integration**: retarget the grip IK to its skeleton and switch the intro to it if it looks better.
7. **SSAO-lite** on HIGH/ULTRA only.

Each phase ships as its own zip, with the exact files and Codespaces commands, and is checked with the test suites and render frames before delivery.

## 6. Decision needed
Which phase first? Recommended: 2 + 3 (post pipeline and sky), because those give the largest visual jump toward the benchmark.
