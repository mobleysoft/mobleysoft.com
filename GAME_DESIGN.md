# Mobleysoft Anomaly Game

## Game Design Document

**Status:** Vertical-slice specification 0.3  
**Working-title candidate:** `EVENTWAKE`  
**Title status:** Provisional. No title or anomaly name is canonized.  
**Platform:** Browser game embedded behind the primary `mobleysoft.com` interface  
**Canonical visual artifact:** `blackhole.js`  
**Current implementation status:** `eventwake-slice-r3` implements the deterministic causal loop in the headless engine and exposes its first player-facing systems through the deployed homepage. It remains a vertical slice in production, not a finished game.

## High Concept

A survey pilot encounters an impossible anomaly whose moving Doppler surface encodes frames of time. The pilot may orbit it, surf arbitrarily close to its horizon, deliberately choose an entry trajectory, navigate time as space inside it, and emerge into the past of the scenario alongside an earlier version of the same ship.

The anomaly never automatically consumes the player. Entry is a physical and causal decision produced by trajectory, proximity, phase alignment, and commitment.

## One-Sentence Pitch

Surf the surface of an impossible black hole, choose a moment written into its moving light, and fly through it to arrive before you did.

## Player Fantasy

The player is not merely flying a spacecraft or operating a time machine. The player becomes a navigator of worldlines.

The desired emotional progression is:

1. Awe at the anomaly.
2. Competence while learning orbital flight.
3. Intimacy while surfing close enough to read its surface.
4. Dread when future events become visible.
5. Commitment when selecting an inward trajectory.
6. Disorientation when time becomes spatial inside.
7. Recognition when the player sees their own earlier approach.
8. Agency when exiting into the past and changing the scenario.
9. Consequence when both timelines continue to exist.

## Design Pillars

### 1. The Canonical Artifact Is the World

The exact `blackhole.js` renderer is not raw material to redesign. Its Doppler field, particles, horizon geometry, and camera behavior establish the anomaly's exterior identity.

Gameplay must interpret the artifact rather than cover or replace it.

### 2. Flight, Not a Timer, Causes Entry

No progress bar, countdown, scripted pull, or elapsed-time threshold may force a crossing.

The player can remain outside indefinitely. Entry requires an intentional trajectory.

### 3. The Surface Is Legible

The moving visual pattern is not decoration. It communicates temporal frames, phase compatibility, branch intersections, and insertion opportunities.

Learning to read the existing effect is a core skill.

### 4. Time Becomes Navigable Space

Inside the anomaly, the scenario's worldline is spatially inspectable. The player can travel among frames, compare outcomes, select an earlier state, and exit into it.

### 5. Every Run Persists

Returning to the past creates a branch instead of erasing the originating timeline. Earlier player ships, failed attempts, successful interventions, and abandoned outcomes remain available to the simulation.

### 6. Mystery Precedes Explanation

The interface reports observations, not invented certainty. It must not immediately label the anomaly, declare a multiverse, or explain its purpose.

## Website Integration Contract

The game is part of the Mobleysoft homepage background, not a separate promotional iframe.

- The default page remains the Mobleysoft product SPA over the canonical background.
- The game never autoplays.
- Selecting `Investigate` hides the primary site shell and warms in the survey craft.
- Pausing restores the site shell without losing the game state.
- The canonical background remains visually exact in ambient and exterior-play states.
- Gameplay uses a separate rendering and simulation layer.
- The exterior game layer may add the ship, restrained instruments, scan returns, and trajectory cues.
- The exterior game layer may not repaint the anomaly or substitute a derivative Cube.
- Mobile and reduced-motion modes must preserve the same game rules at lower visual density.
- A completed or abandoned run returns gracefully to the Mobleysoft product experience.

## The Anomaly

The anomaly appears finite from outside but has no ordinary interior volume.

The current scientific interpretation within the fiction is intentionally uncertain:

- engineered event horizon,
- higher-dimensional projection,
- temporal archive,
- natural worldline intersection,
- multiversal-foam boundary,
- prison or preservation mechanism,
- or coordinate system mistaken for an object.

The anomaly itself remains unnamed. Operational labels such as `ANOMALY`, `EVENT SURFACE`, and `UNKNOWN INTERIOR` are permitted before lore establishes a proper name.

## Meaning of the Existing Exterior Effect

The visual behavior of `blackhole.js` acquires possible in-world meaning without changing its implementation.

| Existing behavior | Possible observation |
| --- | --- |
| Moving radial bands | Temporally adjacent world frames |
| Nonlinear spectral shifts | Relative temporal displacement or incompatibility |
| Bright overlapping regions | Frames shared by multiple branches |
| Dark gaps | Unresolved, decoherent, or inaccessible states |
| Orbiting particles | Matter worldlines caught in the field |
| Inward particle loss | States crossing the causal boundary |
| Changing observer view | The anomaly depends on the observer's worldline |

These remain hypotheses during the first encounter. Later discoveries may contradict them.

## Exterior Flight Model

The ship has persistent physical state:

- position `p`,
- velocity `v`,
- attitude `q`,
- angular velocity,
- available thrust,
- structural integrity,
- and causal coherence.

Player input changes thrust and attitude. It does not directly assign screen position.

At the anomaly surface, velocity separates into normal and tangential components:

```text
v_normal = dot(v, surface_normal) * surface_normal
v_tangent = v - v_normal
```

### Flight Outcomes

| State | Physical condition | Result |
| --- | --- | --- |
| Escape | Positive outward velocity exceeds capture | Ship leaves the field |
| Orbit | Tangential velocity balances inward acceleration | Stable exterior observation |
| Surf | Near-surface distance, high tangential velocity, controlled normal velocity | Maximum scan resolution |
| Skim | Trajectory grazes the surface without phase lock | Deflection or slingshot |
| Unstable capture | Inward velocity without a viable frame | Shear, damage, or forced ejection |
| Deliberate entry | Surface intersection, inward commitment, trajectory alignment, phase lock | Interior transition |

### Horizon Surfing

The player may surf arbitrarily close to the horizon but cannot hover there without cost.

- Required correction frequency increases with proximity.
- Temporal-frame resolution increases with proximity.
- Small errors produce increasingly large trajectory changes.
- Tangential speed allows the ship to ride a propagating band.
- Radial thrust controls scan depth and risk.
- The player may abort before crossing the irreversible commit surface.

The bright visible surface is the readable exterior sheath. The irreversible causal boundary lies just beneath it.

## Scanning

Scanning is active observation, not automatic progress.

A scan result depends on:

- where the player is,
- how close the ship is,
- the direction of the sensor,
- relative velocity to the selected band,
- how long phase lock is maintained,
- and whether the same region has been observed from another trajectory.

### Scan Discoveries

The first scenario should reveal discoveries in this order:

1. Scan returns arrive with inconsistent latency.
2. Some returns arrive before transmission.
3. Surface bands correlate with moments in the surrounding scenario.
4. One band contains an image of the player's ship approaching.
5. Another contains the aftermath of a catastrophe that has not yet occurred.
6. A stable band can be followed around the horizon.
7. Matching its trajectory creates a viable insertion frame.

## Deliberate Entry

Entry has three player-controlled stages.

### Acquire

The player finds a temporal band associated with the desired frame.

### Synchronize

The player surfs alongside the band until relative phase and velocity become stable.

### Commit

The player turns inward and maintains the required trajectory through the causal boundary.

Before commitment, the player can abort. After commitment, normal propulsion cannot restore the exterior trajectory.

## Interior Direction

The interior is an inverted horizon, not a room containing literal foam spheres.

The player enters a vast negative volume surrounded by unreachable, living views of outside reality.

### First Reveal

1. The exterior disappears into darkness.
2. Instruments continue while ordinary distance readings fail.
3. The camera turns toward the entry direction.
4. The originating universe appears as a finite window far away.
5. The window shows the player's approach still occurring.
6. Additional apparent faces emerge, each showing another moment or branch.
7. The player realizes that the finite exterior object contains an effectively unbounded temporal coordinate system.

### Six Living Skies

The interior initially resolves into six apparent boundary directions. They are not fixed walls and are not permanently assigned meanings.

At a given observer state, they may show:

- the originating present,
- the recent past,
- a likely future,
- a failed branch,
- an incompatible physical vacuum,
- and the observer as seen from another branch.

As the player moves, faces divide, merge, exchange positions, or become inaccessible.

### Interior Movement

- Traveling parallel to a resolved horizon scrubs its scenario forward or backward.
- Rotating relative to it reveals neighboring branches.
- Approaching it increases detail but does not reduce distance normally.
- Matching a frame's causal phase makes an exit physically reachable.
- Crossing a branch seam transfers the ship laterally between possible histories.

The exterior Doppler language returns on immense translucent causal sheets viewed from the reverse side. Generic neon tunnels and wireframe bubble clusters are explicitly outside the art direction.

## Temporal Model

The simulation treats each timeline as a persistent branch of deterministic world state.

```text
S(branch, tick) = snapshot + ordered events since snapshot
```

When a player exits into an earlier frame:

```text
new_branch = fork(origin_branch, exit_tick, traveler_state)
```

The origin branch is not deleted. The traveler's memories and carried objects cross into the new branch. Any earlier version of the traveler remains present unless the scenario establishes otherwise.

### Consequences

- The player can meet an earlier self.
- A failed run can provide information to a later branch.
- Objects can be duplicated across branches, creating strategic and narrative risk.
- Contradictory outcomes coexist instead of invoking an immediate paradox.
- Repeated intervention makes the interior more populated and harder to navigate.
- Some branches may later prove self-consistent rather than divergent.

## Core Verbs

| Verb | Meaning |
| --- | --- |
| Fly | Apply thrust and attitude through a continuous field |
| Orbit | Maintain a stable exterior trajectory |
| Surf | Match a moving temporal band near the horizon |
| Scan | Resolve a frame through active observation |
| Observe | Watch a frame without entering it |
| Scrub | Move forward or backward along a worldline |
| Compare | Resolve two outcomes simultaneously |
| Anchor | Preserve access to a selected frame |
| Fork | Exit into an earlier state and create a branch |
| Carry | Move memory, information, or matter between branches |
| Merge | Reconcile compatible state from two branches |
| Prune | Make a branch inaccessible without pretending it never existed |

Combat is subordinate to these verbs. If weapons appear, they interact with ships, trajectories, coherence, and branch structure rather than introducing a generic shooting gallery.

## First Playable Scenario: The Second Arrival

The first vertical slice should prove one complete temporal loop.

### Sequence

1. The player selects `Investigate` from the Mobleysoft homepage.
2. The survey craft warms in outside the anomaly's capture region.
3. The player learns inertial thrust, braking, and orbital approach.
4. The player discovers that closer surfing produces clearer temporal returns.
5. A scan reveals a destructive event shortly ahead in the current scenario.
6. The player selects a frame before that event.
7. The player synchronizes with the corresponding Doppler band.
8. The player deliberately commits to an entry trajectory.
9. Inside, the player locates the approach worldline and scrubs backward.
10. The player exits into the past of the scenario.
11. The player sees the earlier survey craft approaching.
12. Both versions of the ship coexist long enough to confirm that a branch was created.
13. The slice ends after the player transmits information to the earlier self or performs an impossible rendezvous.

The exact catastrophe remains an open narrative decision. It should be legible, preventable with foreknowledge, and small enough for a browser vertical slice.

## Failure and Recovery

Failure should enrich the temporal structure rather than always produce a conventional reload screen.

- A destroyed ship may remain visible in later scans.
- A failed entry may create a damaged branch echo.
- Ejection may return the player at a later exterior time.
- Loss of coherence may separate memory from physical cargo.
- A replay begins from a known snapshot but does not erase recorded runs.

Hard reset remains available for accessibility and debugging.

## Progression

### Stage 1: One Worldline

The player learns exterior flight, surfing, scanning, and one backward exit.

### Stage 2: Branches

The player compares outcomes and meets prior selves.

### Stage 3: Transfer

Information and physical objects move between branches.

### Stage 4: Intervention

The player attempts to prevent larger events while managing unintended branches.

### Stage 5: Interpretation

The player investigates whether the anomaly records reality, generates it, navigates it, or merely reveals what already exists.

## Controls

The primary keyboard scheme is defined. Controls operate ship attitude and thrust; they never assign screen position directly.

The pitch convention follows a flight stick:

- `W` or `ArrowUp` pushes the nose down.
- `S` or `ArrowDown` pulls the nose up.
- `A` or `ArrowLeft` banks left.
- `D` or `ArrowRight` banks right.

Banking produces a coordinated turn while thrust is applied. It is not a screen-space strafe.

### Desktop

| Input | Provisional action |
| --- | --- |
| Space, held | Apply forward thrust |
| Control, held | Apply reverse thrust |
| W or Arrow Up | Pitch down / nose forward |
| S or Arrow Down | Pitch up / nose backward |
| A or Arrow Left | Bank left |
| D or Arrow Right | Bank right |
| Shift | Fire the equipped weapon |
| Pointer | Aim sensors, inspect frames, and operate pointer UI without replacing flight attitude controls |
| P | Pause and restore site shell |
| Escape | Abort instrument mode or open pause state |

Active scanning requires a separate control because Space is thrust. Its final binding remains an open playtest decision; candidates are `E`, a mouse button, or a dedicated HUD control.

### Input Behavior

- Thrust is proportional to how long Space or Control is held.
- Forward and reverse thrust may be applied while pitching or banking.
- Simultaneous inputs are supported, including thrust plus pitch plus bank.
- Shift fire is rate-limited by the equipped weapon, not by keyboard repeat behavior.
- Opposing pitch or bank inputs cancel rather than choosing the most recent key.
- Browser scrolling and browser shortcuts associated with Space, Control, and arrow keys are suppressed only while the game has flight focus.
- Releasing flight focus immediately clears held inputs to prevent stuck thrust.
- Window blur, tab visibility loss, pause, and site-shell restoration also clear held inputs.

### Mobile

- Left control governs thrust vector.
- Right control governs attitude and sensor direction.
- Double-tap warms in from the ambient homepage.
- Separate forward-thrust, reverse-thrust, fire, and scan controls replace ambiguous repeated tapping during flight.
- Touch controls disappear while the site shell is visible.

## Interface Direction

The exterior HUD must be quieter than the canonical anomaly.

Show only information needed for a flight decision:

- relative velocity,
- radial and tangential velocity,
- predicted trajectory,
- distance to the readable sheath,
- phase-lock quality,
- selected frame offset,
- ship integrity,
- and causal coherence.

Do not display speculative universe counts, automatically increasing confidence, unexplained branch exponents, or mission prose that resolves the mystery prematurely.

## Art Direction

### Exterior

- Canonical orange-gold `blackhole.js` remains exact.
- The player craft uses original low-poly geometry informed by late-1990s space-combat readability.
- Added effects are sparse, geometric, and subordinate to the anomaly.
- Trajectory visualization appears only when useful.
- Scan effects sample or echo the surface instead of drawing a replacement over it.

### Interior

- Near-black negative volume.
- Six or more unreachable living skies.
- Exterior scenes repeated at different times and causal states.
- Reversed spectral language inherited from the canonical Doppler effect.
- Vast translucent causal sheets instead of bubbles.
- Apparent geometry that changes with observation.
- Prior player trajectories visible as worldline traces.

### Explicit Rejections

- Generic wireframe sphere clusters.
- Neon tunnel shorthand.
- Automatic camera pull into the anomaly.
- A replacement Cube renderer.
- Ordinary room-scale interiors.
- Combat waves disconnected from temporal mechanics.

## Audio Direction

- Exterior audio is sparse enough to preserve the webpage's ambient quality.
- Engine sound communicates thrust, load, and proximity.
- Doppler bands have spatial tones that can be matched by ear.
- Scan returns may arrive before the transmission sound.
- Horizon surfing produces phase beats rather than constant warning alarms.
- Crossing removes ordinary engine sound before reconstructing it from delayed fragments.
- Interior audio layers earlier and later versions of the same event.

## Technical Architecture

### Canonical Renderer Bridge

`blackhole.js` remains immutable. A bootstrap observer may expose the canonical camera and render timing without mutating scene state or shader output. The encounter renderer copies the relevant projection state so ships and instruments occupy the same apparent world.

### Deterministic Simulation

- Fixed simulation timestep.
- Seeded randomness.
- Input recorded by tick.
- Periodic world snapshots.
- Append-only event log between snapshots.
- Deterministic replay verification.

### Timeline Graph

- Every branch has a stable identifier.
- Every branch records its parent branch and fork tick.
- Traveler state records origin branch and departure tick.
- Exiting into the past creates a child branch.
- Prior branches remain addressable.
- Storage may begin in IndexedDB and later synchronize through a user account.

### Rendering Separation

- Canonical exterior canvas at the base.
- Independent transparent encounter canvas outside.
- Independent interior scene after deliberate crossing.
- Site shell remains a separate interface layer.
- No gameplay code is permitted inside the canonical renderer artifact.

## First Vertical Slice Acceptance Criteria

The first slice is accepted only when all conditions pass.

1. `blackhole.js` remains byte-identical to the selected canonical artifact.
2. The game never starts without explicit player input.
3. The ship uses velocity and thrust rather than direct screen positioning.
4. Space applies forward thrust and Control applies reverse thrust continuously while held.
5. W/Up pitches down, S/Down pitches up, A/Left banks left, and D/Right banks right.
6. Shift fires without relying on operating-system key-repeat timing.
7. Simultaneous thrust, pitch, and bank inputs behave consistently.
8. The ship can approach, escape, orbit, and surf without automatic capture.
9. No elapsed-time threshold causes entry.
10. Entry requires a deliberate inward trajectory and phase lock.
11. The exterior HUD reports only actionable observations.
12. The interior is viewed outward through temporal horizons, not rendered as foam spheres.
13. The player can navigate to at least one earlier deterministic snapshot.
14. Exiting creates a persistent child branch.
15. The earlier player craft remains present in that branch.
16. Pause restores the Mobleysoft site shell without resetting the run.
17. Replay is deterministic for the same input log.
18. Desktop and mobile controls complete the same causal loop.
19. The local build passes canonical-hash, reference, syntax, and visual checks before deployment.

## Implementation Status - 2026-07-27

`eventwake-slice-r3` supersedes the exterior-only `eventwake-engine-r2` runtime.
It replaces mission conditionals in the browser client with immutable scenario
content, a serializable world, and an explicit deterministic system schedule.

Verified in this release:

- The deployed canonical `blackhole.js` is byte-identical to release
  `blackhole-a-20260522` with SHA-256 `417b9edc...`.
- The canonical field and the encounter use independent WebGL renderers and
  canvases; the gameplay client contains no copy of the canonical shader.
- Position, velocity, attitude, thrust, reverse thrust, gravity, drag, and the
  non-capturing horizon boundary advance at a fixed 60 Hz.
- Approach, escape, orbit, horizon-surf, phase-lock, and trajectory telemetry are
  derived from simulation state rather than direct screen coordinates.
- Keyboard, pointer, touch, and gamepad actions share one semantic input contract.
- Tick-indexed input recording reproduces an identical simulation fingerprint.
- Pause freezes the simulation and restores the site shell without resetting the
  run.
- The automated Chrome smoke gate verifies WebGL initialization, renderer
  separation, held thrust, simultaneous pitch/bank/thrust, pause invariance, and
  deterministic replay through the deployed NGINX route. Its phone emulation
  also verifies touch thrust, safe width, visible controls, and a non-interactive
  site shell.
- NGINX serves JavaScript modules with the required MIME type from the centralized
  `/Users/johnmobley/nginx/mime.types` source.
- Active scanning resolves ordered observations only under useful flight
  geometry. `E`, touch, and gamepad scan controls share one semantic action.
- A resolved frame, sufficient phase lock, inward radial motion, and held thrust
  are all required before crossing; accidental horizon contact remains blocked.
- Interior thrust and reverse move along a temporal coordinate. A scan-stabilized
  exit reconstructs the source branch at the selected tick and creates a child.
- The earlier craft is reconstructed from source snapshots and source-branch
  inputs, then continues beside the traveler in the child branch.
- Active runs persist as versioned JSON sessions. Completed runs are archived in
  bounded local browser storage.
- Automated acceptance completes The Second Arrival from semantic inputs, then
  independently replays the branched run to the same checksum.
- The browser presentation is separated into a world view that renders the
  player craft, earlier craft, scan link, trajectory, and six live exterior views
  inside the anomaly without copying the canonical shader.

Still open, and therefore not to be described as a finished game:

- Player playtesting and tuning of the complete causal loop through the deployed
  presentation, beyond automated headless completion and browser input smoke.
- A legible preventable catastrophe in the exterior world, rather than scan text
  alone.
- Causal hazards or combat that change branch outcomes instead of generic firing.
- Final interior art, audio, haptics, onboarding, and accessibility passes.
- Profile-driven performance budgets on representative mobile hardware.
- Physical-device portrait and landscape acceptance testing.

## Product Role

The game demonstrates several Mobleysoft capabilities in one public artifact:

- procedural visual identity,
- browser-native simulation,
- deterministic replay,
- temporal version history,
- branching state management,
- agent-assisted game development,
- and a website that is simultaneously interface, product theater, and playable world.

Its technology can later inform Mobleysoft's site-evolution playback: snapshots, deterministic transitions, branching versions, comparison, restoration, and provenance.

## Name Brainstorm

No availability, trademark, game-title, or domain clearance has been performed. These are creative candidates only.

| Candidate | What it communicates | Assessment |
| --- | --- | --- |
| **EVENTWAKE** | Event horizon, ship wake, aftermath, awakening, and the trail left through time | Strongest coined title; compact and expandable |
| **CAUSAL WAKE** | A persistent trail through cause and effect | Clearest expression of the branch mechanic |
| **SIX SKIES** | The interior's multiple outward horizons | Poetic and visually specific |
| **BEFORE ARRIVAL** | Exiting before the original approach | Strong narrative hook; less obviously a space game |
| **SECOND ARRIVAL** | Meeting the earlier version of the player | Excellent first-scenario or episode title |
| **WORLDLINE ZERO** | Foundational temporal navigation | Hard-science tone; somewhat familiar construction |
| **HORIZONWAKE** | Surfing and leaving a trail across the event surface | Descriptive and ownable-sounding |
| **FRAMEFALL** | Falling through frames rather than space | Action-oriented; concise |
| **BLACKFRAME** | Black hole plus a frame of time | Strong visual identity; may sound like infrastructure software |
| **THE OTHER APPROACH** | Watching another version of the arrival | Eerie and narrative-led |
| **EVENT SURFACE** | The readable boundary and scenario events | Hard-science tone; more descriptive than emotional |
| **PAST THE HORIZON** | Crossing both a physical boundary and into the past | Immediately legible; more generic |
| **BRANCHWAKE** | The wake formed by branching histories | Mechanically accurate but less elegant than Eventwake |
| **TIMESKIN** | Time encoded on the anomaly's surface | Memorable, organic, and slightly unsettling |
| **ELSEWHEN** | Another time as a destination | Elegant but likely used elsewhere and requires careful clearance |
| **YOU ARRIVE TWICE** | The central impossible encounter | Distinctive and human; suitable as a campaign subtitle |

## Recommended Naming Structure

The strongest current structure is:

```text
Game: EVENTWAKE
First scenario: THE SECOND ARRIVAL
Object: unnamed anomaly until discovered in play
```

`EVENTWAKE` works because "wake" simultaneously means the trail behind a ship, the consequences following an event, a vigil for a dead timeline, and becoming conscious. It describes the game without prematurely naming the anomaly.

## Open Decisions

- Final game title.
- The exact preventable catastrophe in the first scenario.
- The player's organization and reason for investigating.
- Whether weapons appear in the first vertical slice.
- How much an earlier self can understand or cooperate.
- Whether branch merging is physically possible or only informational.
- What the anomaly ultimately is, if the game ever supplies one definitive answer.
- Whether the anomaly was discovered, built, summoned, or has always been present outside ordinary observation.
