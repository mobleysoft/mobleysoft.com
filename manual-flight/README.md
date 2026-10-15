# Manual orbital flight — 2026-10-15

This extends the homepage's existing Three.js r128 encounter. It uses the same
WebGL context and animation loop as the selected historical black-hole scene.
The recovered Three.js background's two GLSL fragment programs and original
background factory remain unchanged. Gameplay composes a temporary manual view
offset over its original animated camera, restoring that camera after rendering.
The protected portfolio shell and `/blackholes` gallery are preserved.

## Controls

- Left stick: view-relative horizontal/vertical strafe; no yaw or pitch.
- Right stick: drag to look; an unmoved release within 250 ms fires once.
  A drag-return or longer hold never fires. Sticks own independent pointers.
- Vertical lever: positive thrust, center neutral/coast, negative brake. It stays
  where released, freeing both thumbs. `0 COAST` resets it. Brake stops at zero.
- Desktop: WASD strafe; arrows or right-mouse drag look; Space or left canvas
  click fires; Shift thrust; B brake; N neutral; V camera; P pause.
- `VIEW` switches cockpit/chase and remembers the preference locally.
- Pause, blur, visibility loss, site reveal and viewport changes clear held input
  and lever thrust. Pausing or resizing cancels an in-progress jump charge.

The camera-center reticle defines aim. Muzzle rays converge geometrically and
stop on nearby obstructions. Player fire is never automatic, target selected,
snapped, homing, or instant nearest-enemy damage. Fighters patrol and fire along
their own heading; this is not yet a team fleet encounter.

## Collision and damage

Physics runs at 120 Hz with a bounded accumulator. Projectiles use continuous
relative-motion sweeps through visible hull triangles, including linearly
interpolated moving/rotating mesh vertices. Ship collisions sweep compound
capsules following body, gun, wings and engines (conservative contact margin
0.025 simulation units), plus sphere obstacles/planets. This is a bounded
approximation of curved rigid rotation within a single physics step.

Player hull is 100; fighter hull 80; a player hit deals 40; enemy shots deal 18.
Contact damages and rebounds the craft with a short damage cooldown. Hull flashes,
reticle hit feedback and destruction bursts make hits visible. The capital craft
and scenery are solid, indestructible obstacles. Tracers are capped at 96 and
transient geometries/materials are disposed; replay clears transient effects.

## Planets and hyperspace

Aurel and Nacre have stable IDs, seeds, scene positions and safe orbital arrivals
in `destinations.js`. Surface/cloud/atmosphere shaders are separately authored;
they do not replace the historical background shaders. Their day/night lighting,
cloud motion and atmosphere are illustrative procedural orbital views.

Select the other planet, align its diamond marker within 10 degrees, coast below
40 units/second, and move clear of nearby hulls. `CHARGE JUMP` (or J) starts a
three-second charge. Click again, press Escape, turn away, add thrust, take damage,
pause or resize to cancel. A 1.2-second explicit transit freezes local movement,
then places the craft outside colliders at zero velocity. It is not a high-speed
boost through intervening geometry. Seeded encounter props rebase around arrival;
there is no persistent interplanetary fleet simulation.

### Weyland integration boundary

`weyland-district` is disabled and reserved, with a `weyland:planet:primary` alias.
No Weyland terrain or city is duplicated. These two orbital worlds use simulation
units in `mobleysoft:system:local-v1`; they are not a meter-based planet-fixed
surface contract. No shared terrain sampler, chunk LOD, floating origin, agreed
canonical seed/generator hash, collider landing patch, walk spawn, surface landing
or cross-document handoff is implemented. Agree those fields and admit the shared
manifest with the Weyland owner before enabling this destination. Preserve the
proposed separation of planet/terrain authority and district content authority.

## Rendering budget and measured limits

Original beveled ship meshes, restrained exhaust, hemisphere/rim/key lighting,
512px desktop shadows, atmosphere and cloud layers form the bounded visual pass.
Coarse-pointer devices use DPR <= 1 with shadows off; desktop DPR <= 1.25.
Sustained slow frames disable shadows first, then lower resolution to 65%; sustained
fast frames gradually restore quality. This is not an authored AAA asset pipeline.

A short idle encounter profile on this Mac's Apple M4 through ANGLE Metal at
1440x900 (browser DPR 2, render DPR 1.25) measured:

| Metric | Previous encounter | This release |
| --- | ---: | ---: |
| Frame interval median / p95 (ms) | 14.50 / 27.10 | 14.65 / 27.00 |
| CPU frame median / p95 (ms) | 0.60 / 1.60 | 1.00 / 1.50 |
| GPU composite median / p95 (ms) | 0.245 / 0.365 | 1.160 / 1.323 |
| Draw calls | 29 | 110 |
| Triangles including shadow pass | 20,924 | 45,132 |
| Resident geometries / textures | 22 / 1 | 85 / 2 |

Phone-sized 390x844 and 844x390 Metal windows had candidate median GPU times
0.254 and 0.248 ms (DPR 1, shadows off). These are Mac viewport emulations,
**not iPhone GPU measurements**. SwiftShader software fallback at 960x600 measured
candidate GPU median/p95 10.09/10.97 ms and frame interval 23/35 ms, versus baseline
4.39/4.91 ms and 13.95/36.20 ms. Short samples do not establish sustained thermals,
low-end device performance or future fleet-combat load. Measure real phones next.

## Validation and next bounded slice

`node --test manual-flight/core.test.cjs manual-flight/travel.test.cjs` covers the
pure numerical controls, continuous collision and travel state machine. Browser
validation additionally covers real multitouch ownership/tap-vs-drag, both cameras,
manual hits/misses, damage, obstruction, round trips, adaptive quality, notch-safe
controls and stable resources through repeated replay. Browser fixtures expose
internal state only by intercepting local test responses; no test mutation API is
shipped.

Next proposed encounter: one allied and one opposing carrier, a small fixed pool
of fighters per side, autonomous target selection among multiple valid opponents,
player survival plus a carrier-defense objective, capped effects and a measured
performance budget. Keep manual player aim and let NPCs fight each other. This
release does not implement that fleet slice or seamless surface landing.
