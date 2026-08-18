# EVENTWAKE Engine

This directory is the source of truth for the playable Mobleysoft background.
`/Users/johnmobley/mobleysoft.com/game/` is the NGINX deployment target.

## Rendering Contract

The base renderer is `/Users/johnmobley/mobleysoft/blackhole.js`, SHA-256
`417b9edc4e6e4c9c8857d96bbebb6ad305a516421b92e034b43a9c3627fe9f6d`.
The deployed `/Users/johnmobley/mobleysoft.com/blackhole.js` must remain
byte-identical.

`blackhole-bootstrap.js` observes the canonical scene, camera, and renderer
constructors, then restores Three.js before the game client initializes. The
game uses a second transparent WebGL renderer on `encounter-canvas`; it does not
copy or mutate the canonical shader.

The superseded single-canvas runtimes and page-level prototypes are preserved
under `backgrounds/legacy/` with checksums. They are absent from the deployed
runtime. `backgrounds/candidates/live-adapted-e1a5de7a.js` preserves the selected
pre-r3 adaptation separately.

## Runtime Layers

- `content/`: immutable, validated scenario facts for The Second Arrival.
- `core/`: serializable world state, fixed schedule, input history, seeded
  randomness, quantization, snapshots, and branch reconstruction.
- `systems/`: flight, metrics, scan, horizon, interior, echo, timeline, and
  mission behavior in an explicit deterministic order.
- `engine/simulation.mjs`: compatibility facade and trajectory prediction.
- `engine/recorder.mjs`: tick-indexed, quantized input recording and playback.
- `engine/fingerprint.mjs`: stable simulation snapshots and replay fingerprints.
- `engine/runtime.mjs`: accumulator-based 60 Hz scheduler with substep event
  aggregation, reconstruction services, save/load, and dropped-time protection.
- `presentation/world-view.mjs`: transparent Three.js craft, echo, scan,
  trajectory, effects, and interior views.
- `platform/browser/`: versioned browser persistence and future platform adapters.
- `client.mjs`: browser lifecycle, telemetry, replay, quality scaling, and
  canonical-camera synchronization.
- `input-core.js`: pure control mapping and stick normalization.
- `input.js`: keyboard, pointer, touch, and gamepad adapters.
- `eventwake.css`: HUD, dual-canvas, mobile controls, and safe-area behavior.

## Release Gates

```bash
npm run check --prefix /Users/johnmobley/mobleysoft/game
npm run smoke:browser --prefix /Users/johnmobley/mobleysoft/game
npm run benchmark --prefix /Users/johnmobley/mobleysoft/game
```

`check` runs pure engine tests, page contracts, deployed-file parity, canonical
hash verification, and the game doctor. `smoke:browser` launches the installed
Chrome in an isolated headless profile, loads the local NGINX site, drives real
keyboard input through Chrome DevTools Protocol, verifies pause and replay, and
captures a rendered frame in memory.

NGINX must serve `.mjs` as `application/javascript`. The authoritative mapping
is `/Users/johnmobley/nginx/mime.types`.

## Controls

- Space: forward thrust.
- Control: reverse thrust.
- E: active scan / temporal frame coherence.
- W / Up: pitch down.
- S / Down: pitch up.
- A / Left: bank left.
- D / Right: bank right.
- Shift: fire.
- P: pause.
- Touch: analog bank/pitch stick plus held reverse, fire, and thrust controls.
- Gamepad: left stick, triggers for thrust/reverse, A or right shoulder to fire.

## Current Boundary

`eventwake-slice-r3` executes the complete Second Arrival state machine in
headless acceptance tests and exposes the same systems in the deployed browser.
It is not a finished game. Presentation playtesting, the preventable catastrophe,
causal hazards, final interior art, audio, haptics, profiling, and physical mobile
acceptance remain open.
