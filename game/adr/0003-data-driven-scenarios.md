# ADR 0003: Data-Driven Scenarios

## Status

Accepted.

## Decision

Scenario facts, thresholds, observations, and initial conditions live in
versioned immutable content modules. Generic systems evaluate them into runtime
world state.

## Rationale

Mission logic embedded in the render loop made objectives difficult to test and
encouraged one-off conditionals. A content boundary lets one engine support new
worldlines without cloning gameplay code.

## Consequences

- Content validation becomes a release gate.
- Designers can tune the slice without editing flight or timeline systems.
- Arbitrary executable scripts in content are prohibited; genuinely new mechanics
  require an explicit system and tests.
