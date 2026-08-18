# Acceptance Gates

## Gate A: Canonical Exterior

- Source and deployed `blackhole.js` hashes equal the selected canonical hash.
- Gameplay and canonical renderers use separate canvases and WebGL contexts.
- No gameplay module contains the canonical shader implementation.

## Gate B: Deterministic Core

- Equal seed, content, and input log yield an equal checksum.
- Render-frame chunking does not change the world result.
- Save then load produces the same checksum.
- Restoring a snapshot and re-simulating reaches the original checksum.
- Core tests run without a browser or renderer.

## Gate C: Causal Loop

- Scanning does not progress outside useful geometry.
- Discoveries unlock in declared content order.
- No scan input means no frame resolution.
- Horizon contact without a viable frame cannot capture the craft.
- A locked inward trajectory creates exactly one crossing.
- Interior thrust and reverse move along the temporal coordinate.
- Exit outside the target window cannot fork a branch.
- Valid exit preserves the source branch and creates one child branch.
- The earlier craft starts from reconstructed source state and follows its
  recorded inputs.
- Directed contact resolves the mission and persists the result.

## Gate D: Browser Product

- Homepage interaction starts and pauses the game without reload.
- Pause freezes simulation and restores the Mobleysoft product shell.
- Keyboard, touch, and gamepad map to the same semantic actions.
- Scan has a visible desktop binding and touch control.
- HUD reports actionable range, motion, scan, phase, temporal offset, and goal.
- Context loss, visibility changes, and input release cannot leave held actions.
- The deployed route loads JavaScript modules with the correct MIME type.

## Gate E: Performance And Accessibility

- Simulation budget is below 2 ms per 60 Hz tick at the vertical-slice entity
  count on the reference Mac.
- Desktop targets 60 rendered frames per second with quality degradation before
  simulation degradation.
- Mobile targets 30 rendered frames per second while simulation remains 60 Hz.
- Catch-up work is capped; overload records dropped wall time rather than entering
  an unbounded spiral.
- Reduced motion lowers presentation intensity without changing game rules.
- All touch controls respect safe areas and remain operable in portrait and
  landscape.

## Evidence Rule

A gate is `verified` only when its current automated check passes after the last
mutation. Physical-device gates remain `unverified` until observed on hardware.
