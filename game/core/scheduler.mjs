import { quantizeWorld } from "./quantize.mjs";
import { normalizeInput } from "./input-frame.mjs";
import { flightSystem } from "../systems/flight-system.mjs";
import { metricsSystem } from "../systems/metrics-system.mjs";
import { scanSystem } from "../systems/scan-system.mjs";
import { horizonSystem } from "../systems/horizon-system.mjs";
import { interiorSystem } from "../systems/interior-system.mjs";
import { echoSystem } from "../systems/echo-system.mjs";
import { timelineSystem } from "../systems/timeline-system.mjs";
import { missionSystem } from "../systems/mission-system.mjs";

export const FIXED_STEP = 1 / 60;

export const SYSTEM_SCHEDULE = Object.freeze([
  ["flight", flightSystem],
  ["metrics", metricsSystem],
  ["scan", scanSystem],
  ["horizon", horizonSystem],
  ["interior", interiorSystem],
  ["echo", echoSystem],
  ["timeline", timelineSystem],
  ["mission", missionSystem],
]);

export function stepWorld(world, rawInput, options = {}) {
  const input = normalizeInput(rawInput);
  const context = {
    content: options.content,
    delta: options.delta || FIXED_STEP,
    inputAtBranch: options.inputAtBranch || (() => normalizeInput()),
    reconstructing: Boolean(options.reconstructing),
  };
  world.events = [];
  world.commands = [];
  for (const [, system] of SYSTEM_SCHEDULE) system(world, input, context);
  world.tick += 1;
  world.time = world.tick * context.delta;
  world.timeline.localTick += 1;
  for (const event of world.events) if (event.tick === undefined) event.tick = world.tick - 1;
  quantizeWorld(world);
  return world;
}
