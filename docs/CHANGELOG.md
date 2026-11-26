# Changelog
## 0.9.34 (on top of 0.9.33)
- **New female hairstyle "Soft cropped bob"** from the "Galaxia anime girl" model (Tatenashi, CC-BY 4.0, credited in CREDITS.md and the in-game credits). Rendered on all three faces from 8 angles and from above on a magenta background: closed, no holes. Women now have 6 hairstyles plus shaved.
- Looked at the other new models and left them out on purpose: Galaxia's face and clothes (a school uniform) and Annie's hair (open forehead with a hairband-like edge) did not meet the standard; hirakata kana, anime_girl_cuc, reze and the two plain "anime girl" models are modern clothes, flat-colour hair or have no skeleton.

## 0.9.33 (on top of 0.9.32; the notes below repeat 0.9.32 where unchanged)
- **Opening-screen ring.** The blue ring now starts at the top of the logo and fills clockwise around it, in one direction. It waits until the logo image has decoded and the layout has settled before it starts, so it no longer starts small and expands. (Checked in code and the story/opening tests only, not on a phone.)
- **Female heads and torso.** The donor head was two open shells (a skull that stopped short of the face, and a face mask that stopped short of the skull). A closed skin shell now lies under both, the edge of every face mask is eased flush into the head, its flat forehead/temple shading follows the head's own curve, and its tone matches the skull at the join. Rendered from 8 angles on a magenta background (any hole shows through) for all three faces, bald and with each of the five hairstyles. The "cut open" stomach/chest was transparent texels in the body texture plus painted-on black underwear: both repainted as plain skin. Under the Gown and Adventurer outfits the torso skin is drawn slightly inward so it no longer pokes through the bodice or skirt, and the Adventurer lining reaches down to the hips.
- **Trousers in the run.** The loose Dragon and Ninja trousers were bound partly to the pelvis, which made them balloon in the run. They now take their weights from the legs, so they follow the legs. All six male bases rebuilt. The running animation is untouched.
- **Jump.** A moving jump now uses the running-jump clip over its own frames (take-off, flight, contact), a standing jump keeps the standing clip; landing frames follow the real time to the floor.
- Thumbnails regenerated.
- Known limits: the new donor models were converted and tested but NOT used: both face -Z with arms raised in their bind pose, their clothes are a school uniform and sportswear (modern, against the no-modern-clothing rule), and their hair is plain-colour strand cards with no scalp, which did not reach the standard (hair strands covered the face on one, left a bald crown on the other). No new credits needed. A tiny skin notch remains at the Adventurer skirt's back waist edge. Nothing has been verified on a phone or in the full 3D scene.
## 0.9.31 (on top of 0.9.30)
- **Dragon and Ninja outfits now match the real models.** The earlier re-cutting (black sleeves, torn bib, keyhole neck) is gone. Each outfit now keeps its donor design: red brocade jacket with five frog-button closures, flared sleeves with black cuffs and white piping, black cropped trousers and shoes (Dragon); wrap-front jinbei with flared short sleeves, pocket, bandaged forearms and shorts (Ninja). A thin lining grown from the final body closes the shoulder, back and neck cut-outs, so no skin shows through. Rebuilt on all six male bases.
- **Female underwear.** The bandeau top is rebuilt with a smooth surface and a clean, gently curved top edge (the jagged "drip" edge is gone), and the creator thumbnails are framed above it.
- Thumbnails regenerated.
- Known limits: a hair-thin crease can remain at the armpit seam of the Dragon/Ninja jackets in side view. The bald-head ridge in your earlier screenshot still could not be reproduced offline. Nothing has been verified on a phone or in the full 3D scene.
## 0.9.30 (on top of 0.9.29)
- **Jump landing fixed.** The jump no longer plays its landing pose in mid-air: the flight frames follow your real vertical speed on the way up and the real time-to-floor on the way down, so the feet-contact pose is reached only when the feet reach the ground; frames never run backwards. New tests cover this.
- **Female bodies and heads.** The missing belly strip is bridged with a continuous torso, the crown has a hair-coloured scalp shell fitted to each hairstyle, and the donor face skin above the hairline is trimmed, so no holes or skin patches show on the head or underwear (checked front/side/back on all five hairstyles).
- **Dragon vest and Shinobi outfit.** The vest is lined in its own red and sits clear of the skin; the loose black bib and back flap were remade in the vest's red brocade; hems and cuffs are re-cut clean. Rebuilt on all six male bases.
- Thumbnails regenerated for the female bases, faces, hairs, outfits and the two new male outfits.
- Known limits: the bald male head looked smooth in every offline render, so the ridge in your screenshot could NOT be reproduced here; if it is still there, send a new screenshot. Nothing has been verified on a phone or in the full 3D scene, only in offline renders and the test suite.
## 0.9.29 (on top of 0.9.28)
- **Female section is open.** The creator's MALE/FEMALE buttons now work. Five young-woman bases share one slim anime body, with three faces, five hairstyles (bob, long with headband, long with fringe and ahoge, bobbed fringe, bun with headband), black underwear by default, and two medieval-fitting outfits: a white off-shoulder Gown and a layered Adventurer outfit (leather vest, skirt, boots). Faces, hairs and outfits are filtered by gender; saved male characters are untouched. The opening walk-in before the creator stays male-only.
- Hair crown: donor hairstyles leave gaps in the strands, so a thin hair-coloured cap now covers the crown and the donor face skin is trimmed above the hairline (no skin patches on top of the head).
- New creator thumbnails for the female bases, faces, hairs and outfits, and for the Dragon and Shinobi outfits that had none in 0.9.28.
- Credits added for the female donor models (infinitymanpk, McKaneCL, dequeijospizza, BELAZ).
- Known limits: only two female outfits (not a full wardrobe); the Gown skirt is rigid, so legs may poke through at very long strides; nothing is verified on a phone or in the full 3D scene, only in offline renders and tests.
## 0.9.28 (on top of 0.9.27)
- **Two new male outfits, built from your two models:** Dragon-guard vest (black long-sleeved top under a red embroidered vest, black cropped trousers with red trim, red-and-black shoes) and Shinobi garb (indigo tunic with white wrist wraps, short loose trousers, sandals). Both are fitted to the slim body on all six bases, are dyeable, and appear after the existing outfits in the wardrobe (so saved characters keep their outfit).
- Trousers that stop at the calf now show clean bare shins above the shoes (new Skin_BodyL layer, shown only for these two outfits). Cloth textures had transparent gaps that showed the skin through; they are filled with cloth colour. The crotch panel of loose trousers follows the pelvis instead of being cut away.
- **Jump rebuilt on your reference Jump.fbx** (M:Jump): the captured frames are scrubbed by the real flight time (launch to contact), the landing absorbs on the captured landing frames and then hands back to walk or run at once; feet stay pinned to the real ground, so nobody lands and walks on air. A step off a ledge still uses the falling pose; a tiny terrain bump no longer flickers the fall pose (it waits 0.2 s).
- Female section: see 0.9.29.
## 0.9.27 (on top of 0.9.26)
- **Run no longer sways left and right.** The captured Standard_Run swung the pelvis about 37 degrees side to side and rolled it about 19 degrees, with the spine leaning sideways on every step. Those swings are now cut to about a third (yaw 11, roll 5 degrees) and the spine's sideways lean to 40 percent, so the body stays steady and faces forward while the legs and arms keep their captured motion.
- **Forward lean eased from about 31 to about 17 degrees** (your reference range is 5-15; the reference run is a hard sprint so a little extra is kept). Torso, neck and collar bones tilt up with the pelvis; legs and arms are untouched.
- The Standard_Walk gets a mild version of the same sway calming (swing kept at 70 percent). Done offline with tools/anim/damp_sway.py, so nothing changes at runtime.
## 0.9.26 (goes on top of 0.9.25 + 0.9.25b + 0.9.25c)
- **Walk and run replaced by your reference Mixamo clips.** Standard_Walk and Standard_Run are converted into the engine (M:Standard_Walk / M:Standard_Run) and are now THE walk and run for every creator character and for the creator's opening walk-in. They play exactly as captured: none of my earlier posture edits are applied to them (no extra lean, knee or arm changes), so posture, arm pump, knee drive and stride are the reference's own.
- Playback speed is matched to the clip's measured foot speed (walk 1.55, run 3.85 leg-lengths per second) so feet do not slide; the body keeps the captured vertical bounce while feet are still kept out of the ground.
- Joystick mapping from 0.9.25c is unchanged (walk to ~55% push, run from ~58%).
- The old M:Walking / M:Running clips stay in the file as a fallback only.
## 0.9.25 (includes 0.9.22-0.9.24; apply on top of 0.9.21)
- **Running posture (sprinter form).** Forward lean of about 15 degrees (pelvis to head, head looking ahead), knees drive forward instead of up, elbows bent about 90 degrees and pumping opposite to the legs with hands between chest and hip. Built up smoothly from a brisk walk; idle and walking are unchanged.
- **Why the lean never showed in 0.9.25/b:** the form was keyed to a speed number the creator characters never reach (their real ground speed is tiny at child scale). It is now keyed to the run animation and eased in and out.
- **Joystick (analog, like a console game).** Up to about 55% push you walk (slow to brisk); from about 58% you break into a run that reaches full speed by 65%; the ring glows green while running. RUN button stays removed.
- **No RUN button.** Removed from the controls. Inside the joystick circle you walk (slow to brisk); push the stick all the way to the rim to run. The stick ring glows green while you are at full push.
- **Civilian HUD.** With no gear: no kills/blades row, no gas gauge, no squad, no titan bar. Portrait, Lv, health, mission banner (moved under the health bar), minimap, clock, menu icons and a single big JUMP button remain.
- **Neck, all six bases.** The bridge strip between neck and head now carries the body's skin weights on its lower edge, so the neck stays one smooth surface in every pose (idle, walking, running). lad, nin, beauty, blen and dragon rebuilt like boy.
- Not verified on a phone or in the full 3D scene; checked with side/front/back renders and the test suites.
## 0.9.24 (includes 0.9.22 and 0.9.23; apply on top of 0.9.21)
- **One pose, skipped or played.** The creator's resting pose now always uses the upright correction (head and neck upright, so the back of the neck stays closed) with the arms hanging naturally close to the body (abduction cut from 10 to 4 degrees). Skipping the intro and playing it end in the same pose.
- **HUD in story/everyday mode.** The reference HUD (portrait, Lv, HP and gas bars, blades and kills, Mission banner, minimap with N/S/E/W and clock, pause/settings/book/flag icons, crosshair, bag under the joystick) is now shown in story mode too; the old oversized story buttons and quest box are gone. The quest appears in the Mission banner. Only the bottom-right cluster changes with the mode (everyday: JUMP + RUN, gear: hooks/gas/blade/jump/dodge, battle: full cluster with ATTACK and LOCK ON). Minimap and icons are now reference-sized; tapping the minimap or the flag opens the full map, the book opens the journal, pause/settings open the pause menu. The portrait is the created character's face.
- Includes 0.9.22 (hair/head, walk/run, joystick, contextual action cluster) and 0.9.23 (neck bridge, squad list).
- Not verified on a phone or in the full 3D scene.
## 0.9.23
- **Neck, rebuilt.** The neck is now one continuous surface from the shoulders to the head. The body's ragged neck-top edge is removed and the head piece's neck tube is lofted down onto the funnel surface by a bridge strip (same skin weights and texture as the tube), so there is no ledge, no sawtooth, no opening at the back of the neck and no dark slit at the sides. Verified in front, back, side and three-quarter close-ups, bare and with the peasant outfit. All six bases rebuilt.
- **HUD.** Top-left now follows the reference: round portrait, "Lv" badge under it (rises with kills), HP and gas bars to its right, blades and kills row, mission banner. Compass letters N/S/E/W sit inside the minimap (E was hidden under the menu buttons). A squad list (up to three portraits with a "C" badge and health bar) appears on the left in gear/battle mode whenever the game sets `window.__squad = [{n, hp, img}]`; with no allies it stays hidden.
- Not verified on a phone or in the full 3D scene. Squad list has no data source yet (no allies exist in the game). Creator thumbnails were not regenerated for the neck change.

## 0.9.22
- **Hair and head.** Hair lag is now at most 2 cm, low-pass filtered and can never be pushed down into the scalp (it was up to 7.5 cm and kicked by every footfall, so it went in and out of the head). The head rides smoothly while running: stride bob is filtered out, the springs are critically damped and the turn-lead is reduced at speed.
- **Walk/run.** The walking and running mocap loops are now exactly left/right symmetric (each frame is averaged with the mirrored frame half a cycle later; tested), which removes the one-leg-bends-more / side lean. Playback rate is now ground speed divided by the clip's measured stance-foot speed (walk 1.9, run 4.75 leg-lengths per second), so feet no longer skate and the legs no longer spin. Sprint pace lowered (3.1 -> 2.1) and the full stick no longer sprints: slight push to 80 % of the circle walks (slow to brisk), a full push runs.
- **HUD.** The bottom-right cluster now follows what you are doing: everyday life (no gear) shows a big JUMP and a hold-to-RUN button; gear on shows HOOK L/R, GAS, BRAKE, JUMP, DODGE, BLADE; blades drawn or a titan near shows the full reference layout with a pulsing ATTACK and LOCK ON. Buttons slide and fade between layouts; gas/blade/supply widgets are hidden in everyday life.
- **Neck.** The head piece's neck rim is also kept inside the body's neck in depth (a sky-coloured wedge behind the nape). A faint seam line at the front neck base is still visible in close-ups.
- Not verified on a phone or in the full 3D scene.
## 0.9.21
- **Opening is now fast and thunderous.** One bolt, a ~0.5 s fall (was 2 s) with a hit-stop and a harder landing shake; the camera cranes up through the storm, whips down with the bolt and slams in on the impact. Total opening is ~12 s (was 16.6 s): landing, slow stand-up, then the walk-in while the UI fades in.
- **The walk-in is a real walk again.** Cause found: the 0.9.20 posture correction treated the cinematic walker as standing still and flattened his legs, so he slid. Posture correction is now speed-aware for scripted actors and no longer touches non-locomotion clips (crouch, jump-down, etc.).
- **Casual outfit hips.** The donor trousers flared to a 38 cm hip band (a female silhouette); the hip band is now brought in to the body's own width and the belt/vest hem follows. Skin under cloth is pressed in a little deeper.
- **Underwear colour.** Boxers are black by default and have their own palette; the colour panel now refreshes when you pick an outfit (before, picking Casual left the BOXERS swatches on screen, so clicking one dyed the casual trousers).
- **Neck.** The cone-shaped neck-to-trapezius funnel is smoothed (shrink-free Laplacian) so it flows vertically into the head's neck tube; the crease ring is gone in the viewer renders.
- **In game.** Joystick: everything inside the circle walks (slow to brisk), only a full push to the rim runs (was: about half way already jogged/ran). Jump now uses the motion-captured jump clips driven by air time (before, a jump played the ODM flight pose). Walk/run posture correction is gentler so the natural spine and shoulder motion is kept (it was flattening the stride).
- Not verified on a phone or in the full 3D scene (software-rendered frames of body/clothes and a 2D check of the opening camera only). Known: ragged shoulder edge on the village shirt sleeves in close-ups, faint streaks on the trousers, tiny armpit notches. Head/neck secondary motion is unchanged from 0.9.20.
## 0.9.20
- **Posture.** The boy now stands upright and symmetric: the left/right legs and arms take their mean at rest, the forward stoop is removed from the spine/neck/pelvis, and the arms stand clear of the body (7 degrees out). Applies to every creator character and NPC on the upright clips, and is scaled out as they walk and run so locomotion keeps its natural lean (idle -> walk -> jog -> run now eases between three postures instead of one).
- **Hands, neck, hair.** Natural curled hands (no crooked fingers); the neck base is subdivided and smoothed; hairstyle 5 no longer pushes a black collar piece out of the neck. All six bases rebuilt.
- **Creator UI.** The "UNDERCLOTHES" label no longer overlaps the colour palette. Default underclothes are dark boxers; default skin is the warmer "Sun" swatch.
- **Title.** After "touch to begin" the logo goes straight to the title (no flash of Shiganshina or a black gap). **Joystick:** a slight push walks (slow, scaled), a full push runs, with a smooth ramp between.
- **Main-menu Jean.** The wrist no longer bends before the arm rises to point.
- **Creator opening rebuilt:** a slow crane up through the clouds with distant thunder, then ONE lightning strike (the extra "calling" bolt, twin bolt and after-flicker bolts are gone and the bolt has one hard stroke). The camera tips down and tracks the falling character from the cloud to the ground. The fall uses only the airborne frames of the jump clip, the landing settles, and he then rises SLOWLY from the crouch with long cross-fades (no second drop to the ground), walks into the light while the menus fade in.
- Not verified on a phone: everything above was checked with unit tests and software-rendered frames only. Known: a faint seam ring at the neck base on some poses, a pink patch at the peasant collar/shoulder and slight hairline marks remain.
## 0.9.19
- **No hunchback, broader smooth slope.** A designed neck-to-shoulder envelope (steady drop from the neck base out to the deltoid, no hump at the upper back) is applied to the body and to every outfit; the trapezius is smoother and the neck/shoulder anatomy softer, so the line reads as one broad slope.
- **Textures.** The body skin now has real baked shading: a gradient atlas with per-vertex cavity/curvature shading and warm blush at knees, elbows, shoulders, knuckles and toes (before it was one flat colour). New default skin tone "Sun" (warm tan, swatch 7 appended, saved looks keep their indices). Carved grooves (spine, sternum, linea alba) are wider so they no longer alias into hairlines on the back.
- **Neck.** Under clothes the neck column keeps its smooth shape (the "tuck under cloth" no longer collapses it into a faceted pyramid in open collars); dressed skin mesh is subdivided like the bare one.
- **Ranger outfit rebuilt cleanly:** the spiky, torn donor sleeves, bracers and shoulder piece are replaced by smooth sleeves, leather cuffs and shoulder caps grown from our own arm. **Village clothes:** the waistcoat/shirt no longer swap order (no cream shards through the vest); sleeves clear the shoulder.
- Pack size ~5.3 MB raw per base (test limit raised to 5.5 MB). Not verified on a phone. Still well below the reference render: faces, hair, boots, cloak, gear and PBR/normal-map materials are unchanged; faint hairline marks remain on the back; cloth has no folds.
## 0.9.18
- **Why the neck/shoulders looked like wood:** the body surface there was 13-21 mm per polygon, too coarse for any anatomy to show. The neck/shoulder/upper-chest surface is now subdivided (to ~3-5 mm) without cracks, and the anatomy is sculpted on it: suprasternal notch, clavicles with grooves, sternocleidomastoid cords, trapezius edge, acromion, separated deltoid, legs (quadriceps, kneecap, calves, hamstrings, slim ankles), arms (biceps, triceps, forearm, slim wrist).
- **Shoulder deformation:** the chest side of the shoulder no longer rides the upper arm (weights fall to 0 by |x|=.115), which removes the folded/torn faces at the front of the shoulder when the arm lowers.
- Under clothes the pressed-in skin keeps the smooth shape, so the ridges never poke through cloth.
- Pack size ~+1.5 MB per base (compressed still under the test limit). Not verified on a phone. Faces, hair, boots, gear and PBR materials are unchanged and still well below the reference render.
## 0.9.17
- **Slimmer.** Arms drawn in toward their centre line (upper arm 16%, forearm 10%); every sleeve is built from the slimmed arm, so outfits are slim too.
- **Neck and shoulders.** Trapezius raised and smoothed so the visible neck is shorter and the neck-to-shoulder line is one even slope; relief amplitude 1.8 -> 2.2 for more chest/ab/collarbone detail.
- All six bases and thumbnails rebuilt. Not verified on a phone. Known: tiny dark slits at the front of the deltoid in some poses; muscle detail still softer than your reference.
## 0.9.16
- **Shoulders.** Root cause found: the clips swing the clavicle bones ~25-30 degrees (a shrug), which lifted the deltoid cap off the neck line. The clip's clavicle direction is now damped to 10% (game.js toDirs), and the body no longer binds to the clavicle joints. Neck-to-shoulder is one continuous slope in every pose I rendered.
- **Sleeves.** Scout jacket and peasant shirt sleeves are rebuilt from the body's own arm surface (same weights, cloth UV, clean cuff ring), so the arm can't poke out of them; the dressed skin shoulder/arm is pulled in. Ranger: sleeves refitted to the arm, dark lining under the tunic.
- Boxer waistband is charcoal. All six bases and thumbnails rebuilt.
- Not verified on a phone. Known rough: Ranger tunic/boots geometry (donor mesh) is still crumpled with small gaps; tiny dark slivers at the top of the bare shoulder in some frames; peasant collar/vest edge is ragged.
## 0.9.15
- **Shoulders and upper body.** Shoulder-girdle skin weights are smoothed so the deltoid/clavicle no longer splits or balls up when the arm moves; creator thumbnails regenerated (sloped neck-to-shoulder line).
- **No more bones/skin through outfits.** Peasant shirt sleeves are now grown from the body's own arm surface (the donor's floating double sleeves are removed); arms are no longer tucked/braided under clothing.
- All six bases rebuilt. Not verified on a phone. Still imperfect: ragged donor collar on the peasant shirt, rough cuff edge, Ranger sleeves not yet refitted.
## 0.9.14
- **Body rebuilt from your reference model, then re-sculpted.** Slim anime body (your reference mesh retargeted to our rig) with sculpted, symmetric anatomy: collarbones, pectorals with a lower edge, sternum groove, six-pack with a centre line, iliac V-lines, obliques, scapulae, spine and lat definition (amplitude `RELIEF`, default 1.8).
- **Feet, ankles and legs fixed.** The old build pressed the body in under every outfit, which shredded the bare feet and thinned the legs. The bare body is now left exactly as modelled.
- **Two skins.** `Skin_Body` (bare, used with the boxers), `Skin_BodyD` (hips up, pressed in under the clothes, used for every outfit so nothing shows through trousers/boots) and `Skin_Neck` (head piece neck, always on). Switched in js/story/teen.js.
- **Neck.** The body's neck is widened to the head's neck tube and tapers inside it; the tube's flared lower rim is removed and held inside the body, so there is no ledge, wings or collar edge.
- **Boxers** are dark charcoal cotton in the pack itself (also in thumbnails), waist to mid-thigh.
- **Opening re-directed.** Wide centred start looking up into the storm, tracked bolt, reveal with a slow reel-in; smoothed shake; the camera settles after the reveal.
- **Head level.** The live head layer cancels the clip's forward bow using the measured head tilt (tests/_headmeas.js).
- **Loading ring** follows the logo contour.
- Tools: tools/teen/ref_body.npz, build_all `RELIEF`, compose.inflate_garments (kept, unused by default).
- Not verified on a phone: cinematic and head/hair motion are checked by tests and mock-ups only. Known: peasant shirt sleeves and ranger boot tops are the donor garments' own ragged edges.
## 0.9.13
- **Opening rebuilt.** Wide, centred start over the Shiganshina wall; the sky darkens, anime-style golden forked lightning (3D bolts with glow, branches and after-flash) strikes, the character drops out of the bolt, lands with a shock ring and fog, rises as a silhouette while the fog thins, then the reveal and the studio slide-in. Hermite camera with fluid tracking, hit-stop and a camera that stays out of buildings. Tap to skip. `js/story/strike.js` (storm lighting via `window.__storm`).
- **Neck, head and hair are alive.** Every creator character now has a live layer on top of the clips: idle drift and glances, the head leads into turns and looks toward the camera, two spring chains (neck, head), and hair that swings and settles from the body's motion (shader sway on Hair_* only). Bounded and tested (`tests/live_head.test.js`).
- **Shoulders and arms.** Narrower, lower, smoother shoulders with no raised-shoulder look; sleeve stretching (the hand poking out while running) fixed by re-deriving every garment's skin weights from the body; garments no longer stick out at the shoulder.
- **Body detail.** Boxers now start at the waist (waistband) and end at the thigh; chest, abs (six-pack) and back muscle relief added.
- **Dye.** Hair textures re-based so every hairstyle takes any dye colour.
- **Thumbnails** for bases, faces, hair, outfits and gear regenerated from the fixed body.
- Tools: `tools/teen/posecl.py` poses a pack with a clip frame for checking deformation.
- Not verified on a phone: the cinematic and the head/hair layer were checked by logic tests and 2D mocks only.
## 0.9.12
- **New body.** One slim, anatomically proportioned anime body replaces the old procedural one; shoulders, armpits, torso and arms are smoothed (no creases or armpit web) and the neck is slightly longer so no collar swallows the head. Every base shares it, so every outfit fits every base and one animation set drives all of them.
- **Real outfits, worn like the references.** Scout Regiment: the full kit (jacket, straps, cloak with the Wings emblem, boots, ODM gear, swords) adapted from the Levi rig. Village clothes: vest, shirt, breeches and boots adapted from the Furlan character. Traveller armour is refitted. New default underclothes (boxers) replace "Everyday"; **no modern clothing remains** (Everyday and the Crimson robe are gone).
- **Bases.** Exactly six, all different and all fully customisable: Kuro, Ryu, Haru, Midori and the two new boys Kage (ninja) and Aoi (for_blender). The duplicate "characters"/presets grid is gone: choosing a base brings its own face and signature hair, everything else stays as chosen. Sora and Kaito (baked bases) are removed.
- **Variety.** 6 faces and 8 distinct hairstyles (the duplicate pairs are gone, two new styles from the new bases) fit every base. New menu thumbnails for bases, faces, hair, outfits and gear.
- **Animation.** The supplied pack (Idle, Breathing Idle, Walking, Running, Jump, Jumping Down, Crouch To Stand, Right Turn, Talking, Telling A Secret) is baked into the game (clips `M:*`, `tools/fbx_clips.py`). Every creator character now stands upright in idle and walks/runs with stride-matched playback.
- **Creator opening.** Stormy centred stage in Shiganshina, a forked lightning strike, the default character falls inside it ("Jumping Down"), lands in a flash, shock ring and fog, rises from a crouch as a silhouette while the fog thins, walks to the camera in his underclothes, and the studio slides in from a close-up. Tap to skip. `js/story/strike.js`.
- Saves from before 0.9.12 migrate (colours and sliders kept; removed bases/outfits/hair are remapped).
- Tests: teen_creator (26 checks) updated; new tests/strike.test.js. The pack size budget rose to 4.2 MB per base.
## 0.9.11
- Clothes fit like the reference: every base's legs are slimmed and every shared outfit (Village, Traveller armour, Scout, Crimson robe, Everyday) now hugs the leg instead of ballooning (cap = leg radius + 1 to 2.4 cm), so there is a clear gap between the legs. Tunic and skirt hems hang outside the trousers, which removes the dark/white patches that showed through at the hem. `tools/teen/slim_outfits.py` does this to a pack (run once per pack; it is not repeatable on an already slimmed pack).
- Loading: a model pack is fetched six files at a time with up to four retries each (a single dropped request on a mobile connection no longer fails the whole model). The error message now names the exact file and reason. Other bases load only when picked (the old preload of all six bases used far too much texture memory on a phone).
- Creator opening: letterbox bars, a longer smoother camera crane, the build-up (clay, skin and eyes, hair, clothes) plays first and the menus slide in once the character is built. Dress-up: picking an outfit, gear or a preset now does a full wardrobe turn with the light burst, pop and embers.
- Tests: new leg-width check on every pack.
## 0.9.10
- Character creator is anime-only. The realistic teen model, its presets, faces, hair, `assets/teen/teen.*` and the Character Lab dev page are removed. The creator no longer has a model switch: you pick a **base**.
- Six bases on the same 24-joint skeleton (so every animation works on all of them): Kuro (the original anime boy), Ryu, Haru, Midori (fully customisable) and Sora, Kaito (modelled as a single piece: colours, height and build are yours, clothes/face/hair are as sculpted). Packs live in `assets/<key>/` and load on demand.
- 4 faces and 11 hairstyles that work on every full base; hair colour has a new "Original" option plus silver, crimson and midnight. 8 presets.
- Outfits: Everyday (each base's own clothes), Village clothes, **Crimson robe (the red dragon outfit)**, Traveller armour and Scout Regiment, refitted to every base. Clothes are pushed out of the skin so the body's painted underwear no longer shows through. Colours recolour casual outfits only; armour, Scout uniform are locked until missions, ODM gear until training.
- Locomotion: sprint pace raised to ~5 body-heights per second, jog 2.2, run clip allowed up to 2x playback so the feet match the ground.
- Tools: `tools/teen/build_bases.py` rebuilds all packs from the supplied models.
- Tests: `tests/teen_creator.test.js` rewritten (25 checks incl. every pack); obsolete creator/teen_foundation tests removed.

## 0.9.8
- Repo assembled from the three split uploads and repaired: character creator v2 installed correctly (teen.js, creator.js, actors.js, run clip, anime boy base, v2 teen assets) together with its 8 game.js hooks, so every file is from the same release.
- Stale .rej / .bak leftovers and old update zips removed from the repo (they are not part of the game).

## 0.9.7
- Loading: a blue ring fills around the key-art square (no bar under it, so it never overlaps "Touch to begin").
- The opening animation after the character creator is removed: creator -> straight into the game.
- Page zoom locked: pinch, double-tap and browser zoom can no longer scale the game screen (viewport lock + gesture blocking).
- Visuals: cinematic sun bloom, slow god-rays and anamorphic streak over the menu/title scene, engraved icon shadows and a selection sheen on the menu.

## 0.9.6
- New Game now goes menu -> character creator (teen creator v1 merged: teen.js, creator.js, assets/teen) -> opening cinematic -> prologue. If the teen model fails to load, the menu returns with a message instead of silently reloading.
- Pointing rebuilt to be slow and weighted: shoulder leads, upper arm lifts while the forearm trails folded, the elbow opens into a relaxed bent point, a slow sweep along the Wall, then the elbow folds as the arm lowers. All S-curve easing, no overshoot; the wrist roll follows the arm lift gently (no twist).
- Smoke test updated: New Game hands over to the creator entry.

## 0.9.5
- Audio: the key-art screen now waits for a first touch ("Touch to begin") so iPhone sound is unlocked from the very first screen; studio sting, title boom/bell, score, wind and menu sounds follow. Sound button shows when audio is still locked.
- index.html loads boot.js with a version tag so a stale cached boot.js can no longer mix old and new files.
- Pointing: stretch animation removed; the point is rebuilt with a deep elbow fold, an unfolding whip, a bent-elbow hold, wrist turn (back of hand to camera) and a folding release.
- Cape: long slow lulls (about 40% of the time it hangs low) then swells back up, still silky and clear of the ODM gear.
- Camera: slow crane-and-orbit with parallax, handheld breath, and a gentle push toward the Wall while he points.

## 0.9.4
- Arms: jointed, staggered motion (shoulder > elbow > wrist > fingers) with overshoot and settle; point at the walls and tired stretch rebuilt.
- Cape: wider slow gusts and lulls so it drops lower and lifts again, kept clear of the ODM gear.
- Audio: tap/hover/select sounds, title boom and bell, music and wind restored with retry unlock for iOS; Sound On/Off button in the menu bar.

## 0.9.3
- Cape keeps a minimum clearance from the ODM gear at all times (steady outward bias, gentler gust range) while still rising, falling and rippling.
- Hair no longer moves with the wind; it stays on the head (head motion from the idle is unchanged).
- Idle gestures every ~34 s: Jean points toward the Wall with his left arm, later a tired two-arm stretch (chest opens, head tips back, small shiver, then relaxes); both are eased in and out. Pose edits are now derived from the clean clip pose, so nothing accumulates.

## 0.9.2
- Menu framing: closer, head-to-hips shot of Jean, so his legs and the roof edge no longer show.
- Cape and hair: silkier wind (waves travelling down the cloth, a steady blow-out plus gusts and side drift instead of an up/down bob).
- Hands and arms follow the idle: arms and forearms sway with the breathing and the fingers keep a relaxed, breathing half-curl.

## 0.9.1
- Loading screen now opens with the key-art logo (assets/ui/key_art.webp), then the Joshie Sama studio logo, then the title.
- Fixed the menu scene flashing between the studio logo and the title: the camera stays on the title shot and a black cover holds until the title is placed.
- Title lettering is the bloody-silver ASHES OF THE WALLS cut from the game logo (assets/ui/title_letters.webp), separate from the crest; reveal wipe, glint, Japanese subtitle, credit line, tap prompt in sequence.
- Smoother title to menu transition: lettering lifts and dissolves while the camera arcs behind Jean over ~4 s, then menu items, logo, news card and bar reveal in a staggered sequence.
- Jean: wind-driven cape and hair (vertex wind in game.js), living idle (breathing, weight shift, head drifting along the skyline), ember/ash drift over the scene; menu layout no longer collides on small phones.

## 0.9.0: New launch flow, 3D title screen, main menu with Jean
- **Flow**: launch -> loading bar -> Joshie Sama logo (blue identity, name only, about 3.5 s, tap skips) -> 3D title (Shiganshina at sunset, drifting camera, TAP TO CONTINUE) -> main menu. The Colossal cinematic no longer plays at launch, on Continue, or when returning to the title.
- **NEW GAME** -> confirmation -> character creator -> Colossal opening cinematic (`OP.cinematic`, to be polished next) -> prologue. **CONTINUE** lists saves, loads the chosen one and goes straight into the game. Saves are never touched by the menu.
- **Menu** (`js/story/menu.js`, `css/menu.css`): NEW GAME, CONTINUE and CHARACTER (only when a save exists), SETTINGS, EXTRAS (credits, back up / restore saves). Touch, keyboard (arrows/W S, Enter, Esc) and gamepad (d-pad/stick, A, B). Hover/select sounds, one title track, audio unlocked on the first tap, everything cleaned up when leaving (Jean, effect loops, camera).
- **Scene**: the new official logo (`assets/ui/game_logo.webp`, separate from the studio mark) glides from the title centre to the top right; animated banner and birds on a light 2D layer over the live 3D scene.
- **Jean (Scout Regiment)**: converted from your FBX with `tools/fbx2glb.py` (mesh, skeleton, textures, idle). Added to `npc.pack` / `models.pack` as `jean` with clip `J:idle`.
- Tests: `tests/menu.test.js`, smoke test updated for the new flow.
## 0.8.2
- Gate: hidden stone plugs on both sides of the gate close the cracks (`tools/patch_gap.py`).
- Ground: removed the dark cobble joint lines added in 0.8.0; kept pebbles, grain and grass breakup.
- Day cycle: sky/cloud/fog/post warmth now depends on real sun height (golden only near the horizon); new MORN keyframe so 7-8 am and 4-5 pm look like morning/afternoon; noon blue and white; dusk and night unchanged.
## 0.8.1
- Intro Colossal: only two clips now, `C2:in` (rise) then `C2:jt_roar`; the swat is gone. Title screen: removed the old version label and ticker that overlapped the Credits button.
## 0.8.0: Gate-centred opening, new houses, landmark home, closer realism
- **Opening**: Colossal2 and the strike are now centred on the main gate (x=0). The camera can never go under the terrain. The intro waits for the Titan models before frame one. A hidden stone plug inside the gate complex closes the see-through slit in the wall.
- **Houses**: `tools/patch_district.py` replaced house types 1-4 (all instances, original positions and yaw kept) with the four anime medieval townhouses from `anime_medieval_house.glb` (`h8_v1..v4`). Types 5-8 stay for variety.
- **Landmark**: your `medieval_house_anime_based` model (stairs, wood, brick, roof, walls, plants with alpha, normal maps) stands at about x=21.8, z=-86.7 (replaces one big house on the south row). This is the character's home.
- **Ground**: close-range rounded cobbles with dark joints, pebbles on dirt, blade-scale grass breakup (fade with distance).
- **Music**: drop `intro.mp3` / `title.mp3` (or .m4a/.ogg/.wav) into `assets/music/` and they play instead of the built-in score. The built-in score is original, in the same genre; I cannot reproduce the real "Shinzou wo Sasageyo" (copyrighted).
- Tests: `tests/district_v08.test.js`.
## 0.7.0: Clip-driven Colossal, post pipeline, sky, masonry, Titan shading, AoT-style score
- **Intro Colossal2 is driven only by its own clips**: `C2:in` (rise), `C2:skl01` (swat), `C2:jt_roar` (roar), `C2:idle` between. No IK grip, no finger curl, no scripted heave. (`OP.c2Seq`, `OP.c2clip`; the old Colossal still uses the IK path.)
- **Phase 2, post pipeline** (`js/post.js`, new): scene renders into an off-screen colour + depth texture; bloom (bright pass, 3-4 level chain), sun light shafts (screen-space, depth-masked to the sky), SSAO-lite (ULTRA), FXAA, one finishing grade, vignette, film grain. Tiers: LOW off, MEDIUM FXAA+vignette+grain, HIGH +bloom+shafts, ULTRA +SSAO. ACES stays only in the scene shaders (never applied again). MSAA is gone (FXAA replaces it). `E.deferPost` lets game.js draw actors and FX into the scene target before `E.endPost()`. Fallbacks: shader/FBO failure turns post off and the old direct path returns. `?post=0` disables it.
- **Phase 3, sky**: two cloud layers with domain-warped billows, sun-side lit rims and dark undersides, sunset horizon glow, dusty-rose opposite horizon; forward-scatter glow and more height haze on distant scenery. Fog uses a cheap gradient (no cloud noise per pixel).
- **Phase 4, masonry** (`stoneFx` in the main shader): wall blocks, house bricks, stone blocks with mortar, per-block tone, chipped corners, hairline cracks, stains, damp mossy foot, bump lighting; fades with distance. Optional real textures: put `assets/stone_albedo.jpg` and `assets/stone_normal.jpg` in the repo and they are blended in (triplanar).
- **Phase 5, Titan skin**: SSS-style warm terminator, fresnel rim (sun and sky), wet specular, albedo-driven fibre contrast; full strength on Titans and Colossal/Armored, light on people.
- **Audio**: new drive layer in the intro and title (galloping string ostinato, snare rolls, heroic horn line, choir stabs), original writing in the genre.
- Tests: `tests/post.test.js` (16). Version 0.7.0.
## 0.6.0: Colossal 2, graphics foundation (phase 1)
- **colossal2 is now the intro Titan.** Its bones were named like `Bip001 Pelvis_51`, so the game's rig could not find them; the names are fixed in `data/npc_models.json` and its real height (0.257) replaces the wrong 0.36. Its own clips (roar, atk01, atk02, hit, die, idle, in, skl01, jt_*) are baked into the game's clip format by `tools/add_glb_clips.py` and are in `assets/models.pack` as `C2:*`. The intro plays `C2:idle`, then `C2:jt_roar` at the reveal, with the hands planted on the wall by IK. Set `STORY.opening.useC2 = false` to fall back to the old Colossal.
- **Graphics phase 1** (`js/quality.js`): LOW/MEDIUM/HIGH/ULTRA tiers, capability probe, adaptive resolution, frame-time monitor (p90/p99, jank, thermal baseline, 30 Hz cap detection), per-tier shadow size and cascades (LOW = one cascade). Options > Graphics chooses a tier or Auto. `?gfx=low` also works. `GFX.report()` prints the numbers. Engine changes are small: `setShadowSize`, `cascades`, `antialias` option, aniso cap.
- Tests: `tests/quality.test.js` (19 checks); `tests/actor_pose.test.js` no longer skips colossal2's body mesh.
## 0.5.2: Slower, grip fix, title polish
- Crest: the glowing crack now runs through the centre of the emblem.
- Studio logo: mark, JOSHIE SAMA, PRESENTS, then the legal line, in a single column with no overlap.
- Intro retimed to 12.6 s. Three shots, two cuts; the B to C change now dips through black (0.55 s) instead of a 2-frame flash. The last shot is one continuous low crane from the hand to the face.
- Colossal hands: arm IK plants each wrist on the real stone height under it (cast), palm down, fingers curled over the front edge. Each hand rests on top of the wall with the fingers curled over the front edge (uses the engine hand orientation and finger curl through `OP.hands`, tuned by `OP.K.fd/pn/curlT/curl`). game.js passes the model `M` to `a.poseFn` and exposes `__initHandLoc`.
- Stamp: English "Three days before" removed (Japanese only). Title: the date line is hidden once docked so nothing overlaps the Begin Journey card.
- Title: drifting mist banks and hearth-smoke columns over the town.
- Audio: `AU.unlock()` on every gesture; iOS audioSession "playback" plus a silent looping audio element so the sound is not muted by the ringer switch.
## 0.5.0: Logo gate, the Colossal at the wall, a full score
- Boot: pure black until the story layer takes over. No loading text and no test arena any more (the canvas and game HUD stay hidden with the `aow-boot` class on <html>). Only a hairline progress bar shows low on the screen.
- New crest on the tap screen: Wall Maria, Rose and Sina as three rings, split by a glowing crack, an ember at the core, ash lifting off, with the ASHES OF THE WALLS wordmark and 壁の灰 under it.
- Intro rebuilt as a 9.4 s breach teaser (js/story/fx.js + opening.js): fade up from black, storm flicker and sky bolts, a golden plasma ball swells above the wall, a lightning strike with whiteout, shockwave ring, fireball, embers, steam and smoke rolling over the wall (hidden correctly by the wall), then one hand clamps the wall top, the other follows, he heaves up and the face rises over the edge with a roar, steam and skin arcs. Camera shake, god rays and a storm grade. No Scouts or arena. Effects canvas is now near full resolution.
- Title: all credit and legal text removed from the title screen (it lives in the Credits scene). Credits button stays bottom right.
- Sharper image: dynamic resolution is locked to 90 percent or better during the opening and title (it used to fall to 55 percent, which looked blurry), and the grain layer is gone. New golden-hour grade with a low sun glare.
- Audio: master make-up gain plus a compressor (it was too quiet). New orchestral title theme (strings, cello drive, taiko, horns, choir), a scored intro cue, and new effects: rumble, stone crack, debris, boom, ODM fire and reel, Titan roar, gusts.
- Engine hooks (game.js): a.clipT scrubs a clip, a.poseFn edits a pose, a.vg sets a virtual ground. viewer.js: __lockScale. Camera starts with a valid target (it threw errors before the game started).
- Tests: opening.test.js covers the new timeline (camAt, colossalState, trauma, cpose); new fx.test.js covers the effects; audio gained thunder and plasmaCharge.
## 0.4.0: The opening, rebuilt (js/story/opening.js, css/opening.css)
- Tap gate in black with a Japanese and English prompt. The first tap unlocks audio.
- Studio mark: the hexagon "H" is drawn in SVG with a light sweep and the name JOSHIE SAMA, with a procedural sting (no audio files).
- Cinematic intro of about 7 seconds. Shot A: three Scouts in a V formation fly over the district with ODM wires and the camera dives in behind the leader. Shot B: street level with Eren, Armin and Mikasa while the Colossal rises over the wall with lightning and steam. Shot C: impact frame, flash, speed lines, hard cut to black and a heartbeat. Wipe captions appear in Japanese with English glosses. Tap, Space, Enter or Esc skips.
- Title stamp: the wordmark Ashes of the Walls and 壁の灰 slam onto black, then the lockup docks (FLIP animation) into the title layout over the aerial dawn camera (three-sine drift around Shiganshina).
- Menu in the Wings of Freedom manner: skewed slash selection, a description card for the hovered item, heartbeat on Begin Journey, locked Training Grounds, Load file greyed without a save, and an Exit card ("See you beyond the wall"). Credits sit in a slim band at the bottom like the AoT2 fine print. Keyboard: arrows, W/S, Enter, Space.
- Japanese text uses a Noto Serif CJK JP subset (assets/fonts/aow-jp-*.woff, SIL OFL). Latin display fonts are Cinzel and Grenze Gotisch from Google Fonts, with fallbacks.
- Added to the audio module: logoSting, riser, steam, drone, stampHit, menuTick, a formant choir pad and a title bell.
- game.js: one-line hook so actors can fly (a.fly). main.js: openingHost, a new title camera, an exit handler. coldOpen is now only the fade-out into the creator.
- Tests: story_smoke updated for the new flow (mock DOM now supports innerHTML), new tests/opening.test.js.
## 0.3.0: Opening, registry, living cast
- Opening: tap gate, parchment splash with drifting ash, silence and wind, a distant Titan footstep and a crow. Title over the fog-shrouded dawn district with a slowly creeping camera, chiselled stone menu (Begin journey, Load file, Training grounds, Options, Credits), heartbeat on Begin, steel clink elsewhere. Credits now blend in as a slim line at the bottom of the title.
- Cold open: black, gas canisters, the camera rockets up the wall, lightning, the Colossal Titan rises over the wall, the title is stamped onto black with a violin screech, then "Three days before".
- All audio is synthesised live (wind, footsteps, crows, heartbeat, steel, bells, a generative cello and voice). No sound files, no licences.
- Registry creator: in-universe, with a live 3D preview of you and your Anchor. Name, voice, pronouns, body, height and build sliders, head shape, skin, hair, eyes, scars (recorded), clothing colours and wear.
- Destiny: bloodline, family and Anchor are rolled by the system and cannot be chosen. Ackerman is 0.5% (about 25 per 5,000 players) and stays hidden. The roll is seeded and persisted so reloading cannot re-roll it.
- Model converter and 11 converted models (Eren, Mikasa, Armin, Sasha, Annie, Reiner, Bertholdt, two civilian bodies, Colossal, Armored). Any converted model can be posed with the game's own animation set.
- Real characters in the world: you, your Anchor and the cast stand in Shiganshina, face you as you pass, and gesture while they talk. A shoulder camera frames every conversation.
- Three in-game days before the breach, with a day clock, 3 main quests and 4 side quests, 25 conversations.
- District map (pan, zoom, objective, NPCs), opened from the HUD or with M.
- Free roam removed from the menu. ODM, Titan and combat code are untouched and ready for the Training Grounds.
- game.js: per-prim tinting, actor drawing, cinematic camera, Colossal prop. Free-roam ODM behaviour is unchanged.
## 0.2.0: Story backbone
- New: opening sequence, title screen over the live district, character creator (name, pronouns, look, bloodline, Anchor, difficulty).
- New: dialogue engine with choices, conditions and effects; quest journal; bond meters; talk prompts and objective markers; chapter cards; letterbox, flash and shake.
- New: saves (autosave plus 3 slots, backup export/import), pause menu, settings, credits scene, rotating credits on the loading screen.
- New: playable Prologue part 1: a morning in Shiganshina, three side conversations, the gate, the first view of the breach and a saved choice.
- Free roam keeps the original ODM test arena with the Titan.
- game.js: small hooks (freeze, ODM lock, Titan hide, avatar hide). No gameplay changes in free roam.
## 0.1.0
- Split the single 14.9 MB HTML into index.html, css, js, data and binary asset packs (11 MB total).
- Replaced base64 blobs with real binary files. Added boot.js loader. No gameplay changes.
