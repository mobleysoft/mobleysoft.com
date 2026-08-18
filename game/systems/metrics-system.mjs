import { deriveFlightMetrics } from "../core/flight-metrics.mjs";

export function metricsSystem(world, input, context) {
  world.metrics = deriveFlightMetrics(world.craft, world.scene, context.content, world.interior);
}
