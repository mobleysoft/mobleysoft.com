# Scenario Content Schema

Mission content is data consumed by generic systems. It must not contain DOM or
Three.js objects, executable condition strings, or mutable runtime state.

## Required Shape

```js
{
  schema: "eventwake.scenario.v1",
  id: "second-arrival",
  title: "The Second Arrival",
  seed: 0x45564e54,
  initialCraft: {
    position: [160, -24, 190],
    velocity: [-12, 0, -15],
    attitude: { pitch: 0.08, roll: 0, yaw: 0.7 }
  },
  anomaly: {
    horizonRadius: 100,
    collisionMargin: 4,
    commitRadius: 112,
    readableRadius: 175
  },
  scan: {
    discoveries: [{ id, threshold, observation, frameOffset }],
    minimumQuality: 0.3
  },
  entry: {
    minimumLock: 0.68,
    minimumInwardVelocity: 4,
    crossingTicks: 72
  },
  interior: {
    acceleration: 90,
    drag: 1.8,
    exitWindow: 18,
    maximumExitSpeed: 22
  },
  contact: {
    range: 180,
    requiredTicks: 90
  }
}
```

## Validation

Content is validated once when a world is created. Invalid identifiers,
non-finite numerics, unordered discovery thresholds, impossible radii, missing
observations, or a future target masquerading as an earlier insertion frame are
hard errors.

## Versioning

Saved sessions record both the scenario schema and content ID. A migration is
required before loading a save under an incompatible schema. Silent best-effort
loading is prohibited because it undermines deterministic replay.
