import { SECOND_ARRIVAL } from "../content/second-arrival.mjs";
import { deriveFlightMetrics } from "../core/flight-metrics.mjs";
import { normalizeInput } from "../core/input-frame.mjs";
import { FIXED_STEP, stepWorld } from "../core/scheduler.mjs";
import { cloneWorld, createWorld } from "../core/world.mjs";

export { FIXED_STEP, normalizeInput };

export const DEFAULT_CONFIG = Object.freeze({
  ...SECOND_ARRIVAL.physics,
  horizonMargin: SECOND_ARRIVAL.anomaly.collisionMargin,
  horizonRadius: SECOND_ARRIVAL.anomaly.horizonRadius,
  readableSheathRadius: SECOND_ARRIVAL.anomaly.readableRadius,
});

export function createSimulationState(overrides = {}) {
  const world = createWorld(SECOND_ARRIVAL);
  if (overrides.position) world.craft.position = [...overrides.position];
  if (overrides.velocity) world.craft.velocity = [...overrides.velocity];
  if (overrides.attitude) world.craft.attitude = { ...world.craft.attitude, ...overrides.attitude };
  world.metrics = deriveFlightMetrics(world.craft, world.scene, SECOND_ARRIVAL, world.interior);
  return world;
}

export function stepSimulation(state, rawInput, delta = FIXED_STEP) {
  return stepWorld(state, rawInput, {
    content: SECOND_ARRIVAL,
    delta,
    inputAtBranch: () => normalizeInput(),
  });
}

export function cloneSimulationState(state) {
  return cloneWorld(state);
}

export function updateMetrics(state) {
  state.metrics = deriveFlightMetrics(state.craft, state.scene, SECOND_ARRIVAL, state.interior);
  return state.metrics;
}

export function predictTrajectory(state, ticks = 180) {
  if (!["exterior", "past-exterior"].includes(state.scene)) return [[...state.craft.position]];
  const predicted = cloneWorld(state);
  const points = [];
  for (let tick = 0; tick < ticks; tick += 1) {
    stepWorld(predicted, {}, { content: SECOND_ARRIVAL, delta: FIXED_STEP });
    predicted.commands = [];
    if (tick % 3 === 0) points.push([...predicted.craft.position]);
  }
  return points;
}
