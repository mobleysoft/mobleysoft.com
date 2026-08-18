export function scanSystem(world, input, context) {
  const config = context.content.scan;
  world.scan.active = false;
  world.scan.quality = 0;
  if (world.scene !== "exterior") {
    world.scan.lock = Math.max(0, world.scan.lock - config.lockDecay);
    return;
  }

  const usefulGeometry = world.metrics.distance <= context.content.anomaly.readableRadius
    && world.metrics.phaseLock >= config.minimumQuality;
  if (!input.scan || !usefulGeometry) {
    world.scan.lock = Math.max(0, world.scan.lock - config.lockDecay);
    return;
  }

  world.scan.active = true;
  world.scan.quality = world.metrics.phaseLock;
  world.scan.lock = world.metrics.phaseLock;
  world.scan.progress += world.scan.quality;

  for (const discovery of config.discoveries) {
    if (world.scan.progress < discovery.threshold || world.scan.discoveries.includes(discovery.id)) continue;
    world.scan.discoveries.push(discovery.id);
    world.scan.lastObservation = discovery.observation;
    if (discovery.projection && !world.scan.projections.some((projection) => projection.id === discovery.projection.id)) {
      world.scan.projections.push(structuredClone(discovery.projection));
    }
    if (discovery.frameOffset !== undefined) {
      world.scan.selectedFrame = {
        discoveryId: discovery.id,
        sourceBranchId: world.timeline.activeBranchId,
        targetTick: Math.max(0, world.timeline.localTick + Math.trunc(discovery.frameOffset)),
      };
    }
    world.events.push({
      discoveryId: discovery.id,
      observation: discovery.observation,
      tick: world.tick,
      type: "scan-discovery",
    });
  }
}
