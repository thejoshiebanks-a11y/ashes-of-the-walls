# Graphics architecture (phases 1 to 3 design, phase 1 implemented in v0.6.0)

Engine: custom WebGL2 (`js/engine.js`). No Three.js. Every new feature below is additive and has a fallback.

## 1. Frame today (unchanged order, new knobs in bold)
1. `GFX.update(dt)` (js/quality.js) watches real frame time and moves **E.scale** (render resolution), and when needed the tier.
2. Shadow pass: up to **2 cascades**, each a depth-only render into a `DEPTH_COMPONENT24` texture (`sampler2DShadow`, hardware PCF). Size is **per tier** (1024 / 2048 / 3072 / 4096). On LOW only the far cascade is rendered and both shader samplers are pointed at it.
3. Sky (fullscreen triangle, no depth write), then main pass (opaque, ACES + anime grade in the fragment shader), then water (blended).
4. Default framebuffer is presented directly. MSAA comes from `antialias:true` on the context.

## 2. Phase 2 pipeline (design: what talks to what)
```
shadow cascades (depth textures, unchanged)
        |  sampled by
        v
scene pass --> SCENE FBO  (RGBA16F colour if EXT_color_buffer_half_float, else RGBA8)   (+ DEPTH texture, 24-bit)
                    |  colour (linear HDR, NO tone map yet)         |  depth (sampled for SSAO-lite, god rays, fog)
                    v                                                v
        bloom: bright-pass at 1/2 res -> 4-level downsample chain -> upsample/blur (dual Kawase) 
                    |
                    v
        POST shader (one fullscreen pass): colour + bloom -> exposure -> ACES tone map (ONCE) -> grade (ONCE)
                    -> vignette -> film grain -> FXAA (on the final LDR) -> default framebuffer
```
- **Depth texture**: the scene FBO uses a depth *texture* (not a renderbuffer) so SSAO-lite and light shafts can read it. On devices without depth-texture readback it falls back to renderbuffer depth and those two effects switch off.
- **Tone mapping and grading exactly once**: today ACES and the anime grade live inside the main/sky/water fragment shaders. When the post pipeline is on, a `u_post` uniform makes those shaders output linear HDR and skip ACES and the grade; the post shader then applies both. When post is off (fallback) the shaders behave as today. A test checks that `u_post` flips both together so the grade can never apply twice.
- **MSAA and the off-screen pipeline**: `antialias:true` only multisamples the default framebuffer, which the scene no longer draws to once the pipeline is on, so it would be wasted memory. Plan: on HIGH/ULTRA render the scene into a multisampled renderbuffer FBO (`renderbufferStorageMultisample`, 4x on HIGH, 2x on ULTRA only if a bandwidth test passes) and resolve with `blitFramebuffer` into the texture FBO; on LOW/MEDIUM no MSAA and FXAA alone. FXAA is never stacked on top of MSAA. The context is created with `antialias:false` once phase 2 ships (phase 1 keeps today's value unless you pick LOW/MEDIUM).
- **Shadows with the FBO**: shadow maps are separate depth textures drawn before the scene pass, so nothing changes for them; the scene FBO just replaces the screen as the main pass target. Viewport and `E.scale` apply to the scene FBO size; the post pass writes at canvas size.
- **Fallbacks**: no float render target: RGBA8 scene buffer and bloom with a soft threshold; no depth texture: no SSAO/shafts; FBO incomplete or frame time over budget: post off, old direct path.

## 3. Phase 1 (implemented now)
- `js/quality.js`: tiers, capability probe, frame-time monitor, adaptive resolution, thermal drift note, auto tier. Persisted in `localStorage` (`aow.gfx`), overridable with `?gfx=low|medium|high|ultra`. Options > Graphics in the pause menu sets it (Auto / Low / Medium / High / Ultra).
- Tier table:

| Tier | DPR cap | scale range | shadow map | cascades | LOD | aniso | MSAA (until phase 2) |
|---|---|---|---|---|---|---|---|
| LOW | 1.25 | 0.50 to 0.85 | 1024 | 1 | 0.75 | 2 | off |
| MEDIUM | 1.6 | 0.55 to 1.0 | 2048 | 2 | 0.9 | 4 | off |
| HIGH | 2.0 | 0.60 to 1.0 | 3072 | 2 | 1.0 | 8 | on |
| ULTRA | 2.5 | 0.70 to 1.0 | 4096 | 2 | 1.15 | 16 | on |

- **How a tier is chosen**: a starting guess from capabilities (device memory when exposed, core count, screen pixels, `MAX_TEXTURE_SIZE`, `MAX_SAMPLES`, float-target support). The GPU name is used only to veto software renderers. Then measurement decides: if p90 frame time stays over 1.3x the target, resolution drops in steps; at the floor for about 6 s the tier drops. If p90 stays under 0.92x and average under 0.85x for about 3 s, resolution rises, and after it is maxed the tier can rise (HIGH max on phones, ULTRA only on desktop; at most once a minute, never while throttling). An explicit choice in Options is never changed automatically.
- **Frame-rate cap detection**: if shrinking the picture 3 times does not change frame time (iPhone low-power mode caps at 30 fps), the monitor treats it as a cap, restores resolution and keeps the tier.
- **Thermal**: the first 8 s after a tier change set a baseline median frame time. If the rolling median later exceeds it by 30% the monitor flags "THROTTLE" (shown in the stats line) and blocks auto-raising.
- **Cinematics**: while the opening runs (`__lockScale`) the scale floor is 0.9, so it stays sharp.
- Everything is reversible: `GFX.off()` restores the old fixed behaviour; removing the `quality.js` line from `boot.js` removes the system completely.

## 4. How to read performance honestly
`GFX.report()` (run in the browser console, or the stats line at the top right on tablets) gives tier, canvas resolution, shadow size, fps, average ms, p90, p99, jank count and baseline. The numbers in my test environment come from a software renderer and say nothing about phone speed; real baselines have to be collected on your phone (see the upload notes).
