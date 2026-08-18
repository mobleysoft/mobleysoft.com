import test from "node:test";
import assert from "node:assert/strict";
import { FixedStepEngine } from "./runtime.mjs";
import {
  cloneSimulationState,
  createSimulationState,
  FIXED_STEP,
  stepSimulation,
} from "./simulation.mjs";
import { InputRecorder } from "./recorder.mjs";
import { fingerprintSimulationState } from "./fingerprint.mjs";

function roundedState(state) {
  return {
    attitude: Object.fromEntries(Object.entries(state.craft.attitude).map(([key, value]) => [key, Number(value.toFixed(8))])),
    position: state.craft.position.map((value) => Number(value.toFixed(8))),
    tick: state.tick,
    velocity: state.craft.velocity.map((value) => Number(value.toFixed(8))),
  };
}

test("fixed timestep produces the same state across render frame chunking", () => {
  const inputProvider = (state) => ({
    bank: state.tick < 90 ? -0.7 : 0.25,
    pitch: state.tick < 45 ? -0.35 : 0.1,
    thrust: state.tick < 120,
  });
  const sixtyFps = new FixedStepEngine({ inputProvider });
  const thirtyFps = new FixedStepEngine({ inputProvider });
  for (let frame = 0; frame < 180; frame += 1) sixtyFps.advance(1 / 60);
  for (let frame = 0; frame < 90; frame += 1) thirtyFps.advance(1 / 30);
  assert.deepEqual(roundedState(sixtyFps.state), roundedState(thirtyFps.state));
});

test("held thrust increases speed while reverse thrust opposes it", () => {
  const thrustState = createSimulationState({ position: [0, 0, 400], velocity: [0, 0, -10] });
  const reverseState = cloneSimulationState(thrustState);
  for (let tick = 0; tick < 60; tick += 1) {
    stepSimulation(thrustState, { thrust: true }, FIXED_STEP);
    stepSimulation(reverseState, { reverse: true }, FIXED_STEP);
  }
  assert.ok(thrustState.metrics.speed > reverseState.metrics.speed);
});

test("horizon boundary cannot capture a craft automatically", () => {
  const state = createSimulationState({ position: [0, 0, 106], velocity: [0, 0, -80] });
  for (let tick = 0; tick < 120; tick += 1) stepSimulation(state, {}, FIXED_STEP);
  assert.ok(state.metrics.distance >= 104 - 1e-8);
  assert.equal(state.craft.boundaryContact, true);
});

test("recorded inputs reproduce an identical deterministic result", () => {
  const recorder = new InputRecorder();
  const original = createSimulationState();
  for (let tick = 0; tick < 240; tick += 1) {
    const input = {
      bank: tick < 80 ? -0.8 : (tick < 160 ? 0.5 : 0),
      fire: tick % 17 === 0,
      pitch: tick < 120 ? -0.2 : 0.25,
      thrust: tick < 180,
    };
    stepSimulation(original, recorder.record(tick, input), FIXED_STEP);
  }

  const replay = createSimulationState();
  for (let tick = 0; tick < 240; tick += 1) {
    stepSimulation(replay, recorder.inputAt(tick), FIXED_STEP);
  }
  assert.deepEqual(roundedState(replay), roundedState(original));
  assert.equal(fingerprintSimulationState(replay), fingerprintSimulationState(original));
});

test("recorder exports and reloads an equivalent tick-indexed stream", () => {
  const original = new InputRecorder();
  original.record(0, { thrust: true });
  original.record(8, { bank: -0.333333, fire: true, thrust: true });
  original.record(21, {});
  const restored = new InputRecorder().load(original.export());
  assert.deepEqual(restored.inputAt(7), original.inputAt(7));
  assert.deepEqual(restored.inputAt(8), original.inputAt(8));
  assert.deepEqual(restored.inputAt(99), original.inputAt(99));
});

test("runtime returns every event emitted across fixed substeps", () => {
  const engine = new FixedStepEngine({ inputProvider: () => ({ fire: true }) });
  const result = engine.advance(FIXED_STEP * 4);
  assert.equal(result.substeps, 4);
  assert.deepEqual(result.events.map(({ type }) => type), ["fire"]);
});
