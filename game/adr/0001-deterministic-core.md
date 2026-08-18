# ADR 0001: Deterministic Headless Core

## Status

Accepted.

## Decision

EVENTWAKE uses a serializable JavaScript world stepped by an explicit ordered
system schedule at 60 Hz. The simulation can save, load, checksum, reconstruct,
and advance without a renderer.

## Rationale

The game's central mechanic is returning to an earlier state while preserving
the originating history. That mechanic is substantially easier to test and
reason about when history is input plus snapshots, not captured Three.js state.

## Consequences

- Presentation becomes replaceable and interpolated.
- Replays, earlier selves, debugging, and future rollback share one substrate.
- Cross-engine floating-point identity is not assumed. State is quantized at the
  simulation boundary; fixed-point remains an option if network lockstep later
  requires stronger guarantees.
