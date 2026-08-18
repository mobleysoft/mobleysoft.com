export function interiorSystem(world, input, context) {
  const config = context.content.interior;
  if (world.scene === "crossing") {
    world.transition.crossingTicks += 1;
    if (world.transition.crossingTicks < context.content.entry.crossingTicks) return;
    world.scene = "interior";
    world.interior.sourceTick = world.timeline.localTick;
    world.interior.targetTick = world.scan.selectedFrame.targetTick;
    world.interior.position = world.timeline.localTick;
    world.interior.velocity = 0;
    world.interior.coherenceTicks = 0;
    world.interior.exitReady = false;
    world.events.push({
      sourceTick: world.interior.sourceTick,
      targetTick: world.interior.targetTick,
      tick: world.tick,
      type: "interior-entered",
    });
    return;
  }
  if (world.scene !== "interior") return;

  const acceleration = (input.reverse ? 1 : 0) - (input.thrust ? 1 : 0);
  world.interior.velocity += acceleration * config.acceleration * context.delta;
  world.interior.velocity *= Math.exp(-config.drag * context.delta);
  world.interior.position += world.interior.velocity * context.delta;
  const offset = world.interior.position - world.interior.targetTick;
  const aligned = Math.abs(offset) <= config.exitWindow
    && Math.abs(world.interior.velocity) <= config.maximumExitSpeed;
  if (input.scan && aligned) world.interior.coherenceTicks += 1;
  else world.interior.coherenceTicks = Math.max(0, world.interior.coherenceTicks - 2);
  world.interior.exitReady = world.interior.coherenceTicks >= config.exitCoherenceTicks;
  world.metrics.temporalOffset = offset;
}
