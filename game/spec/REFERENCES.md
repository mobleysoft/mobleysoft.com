# Engineering References

This architecture correction used primary or maintainer-authored technical
sources rather than treating the existing prototype as its own precedent.

## Simulation And Replay

- Glenn Fiedler, [Fix Your Timestep](https://gafferongames.com/post/fix_your_timestep/):
  fixed simulation steps, an accumulator, interpolation, catch-up headroom, and
  a cap that avoids the spiral of death.
- [GGPO](https://www.ggpo.net/): deterministic input-driven execution, save/load,
  and gameplay-frame execution without rendering as the substrate for rollback.

Applied here: the browser render rate produces wall time; `FixedStepEngine`
consumes it in 60 Hz steps, caps substeps, records inputs, saves world snapshots,
and can reconstruct or replay without Three.js.

## World And System Organization

- [Bevy ECS](https://bevy.org/learn/quick-start/getting-started/ecs/): entities
  hold data, systems process explicit data sets, and ordering is declared when it
  matters.
- [Godot scene organization](https://docs.godotengine.org/en/stable/tutorials/best_practices/scene_organization.html):
  one definitive entry point, relational ownership, and independent systems kept
  independent.
- [Godot resources](https://docs.godotengine.org/en/stable/tutorials/scripting/resources.html):
  behavior and reusable data are distinct concerns.

Applied here: EVENTWAKE uses a domain-sized serializable world rather than a
general-purpose ECS package, but adopts the important boundary: immutable
scenario data plus an explicit ordered system schedule. `client.mjs` is the
browser entry point, not the authority for mission state.

## Browser Runtime

- [MDN Anatomy of a video game](https://developer.mozilla.org/en-US/docs/Games/Anatomy):
  present, accept input, interpret, calculate, and repeat; bind frame work to
  `requestAnimationFrame` and keep infrequent work outside the frame loop.
- [MDN Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers)
  and [OffscreenCanvas](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas):
  background execution and rendering can leave the main thread when profiling
  justifies the transport cost.
- [Three.js responsive rendering](https://threejs.org/manual/en/responsive.html):
  drawing-buffer size and display size are separate concerns.

Applied here: requestAnimationFrame drives presentation, simulation is
frame-independent, persistence occurs at checkpoints instead of every frame,
and render resolution degrades before simulation. A Worker/OffscreenCanvas move
is deliberately deferred until profiling demonstrates a main-thread bottleneck;
the new headless core is already transferable when that threshold is reached.
