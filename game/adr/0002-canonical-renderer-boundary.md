# ADR 0002: Canonical Renderer Boundary

## Status

Accepted.

## Decision

The selected `blackhole.js` stays byte-identical. A bridge exposes only its
camera and lifecycle. EVENTWAKE renders craft and instruments through a separate
transparent canvas.

## Rationale

The anomaly's Doppler field is an authored artifact and the product homepage's
identity. Treating it as engine code previously encouraged accidental visual
rewrites whenever gameplay changed.

## Consequences

- Gameplay can fail or be disabled without corrupting the homepage background.
- Exterior depth occlusion across canvases is approximate and must be designed
  around rather than solved by editing the canonical shader.
- Interior rendering is a separate scene entered only after a confirmed crossing.
