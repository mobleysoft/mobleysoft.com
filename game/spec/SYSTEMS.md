# Runtime Systems

## Authority

The deterministic world is authoritative. DOM state, render frame rate, wall
clock time, and Three.js objects are not game state.

The browser collects one semantic input frame. The fixed-step scheduler advances
the world at 60 Hz. Presentation receives a read-only snapshot and emitted
effects after each batch of simulation ticks.

## Fixed System Order

Order is part of the simulation contract and may not depend on import order.

1. `input`: normalize the semantic input frame.
2. `flight`: apply attitude, propulsion, gravity, drag, and weapon cooldown.
3. `metrics`: derive radial and tangential motion, range, and phase quality.
4. `scan`: accumulate observation only when geometry and active input permit it.
5. `horizon`: block accidental capture or issue a deliberate crossing command.
6. `interior`: move along the selected temporal coordinate after crossing.
7. `echo`: replay the source branch craft after a fork.
8. `timeline`: request a branch fork when an earlier exit is physically valid.
9. `mission`: derive objective, success, and failure from world facts.
10. `quantize`: canonicalize numeric state before checksums and snapshots.

Systems may mutate only serializable world data and append domain events or
commands. They may not access the DOM, storage, audio, network, wall clock, or
random globals.

## Commands And Effects

Commands request structural mutations that need engine services. They are
processed after the ordered systems finish a tick.

- `fork-branch`: reconstruct a source branch at a target tick and create a child.
- `save-checkpoint`: request durable persistence.
- `complete-run`: freeze the result and request durable persistence.

Domain events are facts such as `scan-discovery`, `crossing-started`,
`branch-created`, and `mission-complete`. Presentation may turn confirmed events
into light, audio, or haptics. Re-simulation suppresses presentation effects.

## Determinism Rules

- Simulation always uses `1 / 60` seconds.
- `Math.random`, `Date`, `performance`, DOM APIs, and network state are forbidden
  in core and systems.
- Randomness comes from a seeded generator stored in world state.
- Inputs are quantized and indexed by execution tick.
- World numerics are quantized after every tick.
- Save/load and no-render stepping are first-class engine operations.
- Rendering interpolates previous and current presentation snapshots; it never
  feeds interpolated values back into simulation.

## Platform Boundary

`platform/browser` owns input adapters, persistence, page lifecycle, and future
worker transport. `presentation` owns Three.js and HUD projections. `content`
owns scenario data. None of those layers may be imported by `core` or `systems`.
