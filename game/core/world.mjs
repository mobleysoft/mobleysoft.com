import { SECOND_ARRIVAL } from "../content/second-arrival.mjs";
import { validateScenario } from "../content/validate.mjs";
import { deriveFlightMetrics } from "./flight-metrics.mjs";
import { normalizeSeed } from "./rng.mjs";

export const WORLD_SCHEMA = "eventwake.world.v1";

export function cloneWorld(world) {
  return structuredClone(world);
}

export function createWorld(content = SECOND_ARRIVAL, options = {}) {
  validateScenario(content);
  const initial = content.initialCraft;
  const world = {
    schema: WORLD_SCHEMA,
    contentId: content.id,
    tick: 0,
    time: 0,
    rngState: normalizeSeed(options.seed ?? content.seed),
    scene: "exterior",
    craft: {
      id: "traveler-0",
      attitude: { ...initial.attitude },
      boundaryContact: false,
      branchId: "branch-0",
      causalCoherence: 1,
      integrity: 1,
      originBranchId: null,
      position: [...initial.position],
      velocity: [...initial.velocity],
      weaponCooldown: 0,
    },
    echoes: [],
    metrics: {},
    scan: {
      active: false,
      discoveries: [],
      lastObservation: null,
      lock: 0,
      progress: 0,
      projections: [],
      quality: 0,
      selectedFrame: null,
    },
    transition: {
      crossingTicks: 0,
      sourceTick: null,
    },
    interior: {
      coherenceTicks: 0,
      exitReady: false,
      position: 0,
      sourceTick: null,
      targetTick: null,
      velocity: 0,
    },
    timeline: {
      activeBranchId: "branch-0",
      branchCounter: 1,
      branches: [{
        createdAtExecutionTick: 0,
        forkTick: null,
        id: "branch-0",
        parentId: null,
        status: "active",
      }],
      localTick: 0,
    },
    mission: {
      approached: false,
      contactTicks: 0,
      escaped: false,
      objective: "ESTABLISH AN APPROACH VECTOR",
      orbitTicks: 0,
      phase: "approach",
      status: "active",
      surfTicks: 0,
    },
    events: [],
    commands: [],
  };
  world.metrics = deriveFlightMetrics(world.craft, world.scene, content, world.interior);
  return world;
}
