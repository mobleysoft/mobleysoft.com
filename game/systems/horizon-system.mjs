import { dot, length, normalize, scale, subtract } from "../engine/math.mjs";
import { deriveFlightMetrics } from "../core/flight-metrics.mjs";

export function enforceExteriorBoundary(craft, content, events = [], actorId = craft.id) {
  const minimumRadius = content.anomaly.horizonRadius + content.anomaly.collisionMargin;
  const distance = length(craft.position);
  if (distance > minimumRadius) return false;
  const outward = normalize(craft.position, [0, 0, 1]);
  craft.position = scale(outward, minimumRadius);
  const inwardVelocity = dot(craft.velocity, outward);
  if (inwardVelocity < 0) craft.velocity = subtract(craft.velocity, scale(outward, inwardVelocity));
  craft.boundaryContact = true;
  events.push({ actorId, type: "boundary-contact" });
  return true;
}

export function horizonSystem(world, input, context) {
  const content = context.content;
  if (world.scene === "past-exterior") {
    if (enforceExteriorBoundary(world.craft, content, world.events)) {
      world.metrics = deriveFlightMetrics(world.craft, world.scene, content, world.interior);
    }
    return;
  }
  if (world.scene !== "exterior") return;

  const frame = world.scan.selectedFrame;
  const deliberateEntry = frame
    && input.thrust
    && !input.reverse
    && world.scan.lock >= content.entry.minimumLock
    && world.metrics.phaseLock >= content.entry.minimumLock
    && world.metrics.radialVelocity <= -content.entry.minimumInwardVelocity
    && world.metrics.distance <= content.anomaly.commitRadius;

  if (deliberateEntry) {
    world.scene = "crossing";
    world.transition.crossingTicks = 0;
    world.transition.sourceTick = world.timeline.localTick;
    world.events.push({
      sourceBranchId: frame.sourceBranchId,
      targetTick: frame.targetTick,
      tick: world.tick,
      type: "crossing-started",
    });
    world.metrics = deriveFlightMetrics(world.craft, world.scene, content, world.interior);
    return;
  }

  if (enforceExteriorBoundary(world.craft, content, world.events)) {
    world.metrics = deriveFlightMetrics(world.craft, world.scene, content, world.interior);
  }
}
