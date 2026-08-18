export function missionSystem(world, input, context) {
  const mission = world.mission;
  if (mission.status !== "active") return;
  const metrics = world.metrics;
  if (metrics.radialVelocity < -3) mission.approached = true;
  if (mission.approached && metrics.radialVelocity > 5 && metrics.distance > 210) mission.escaped = true;
  mission.surfTicks = metrics.flightState === "horizon-surf" ? mission.surfTicks + 1 : 0;
  mission.orbitTicks = metrics.flightState === "orbit" ? mission.orbitTicks + 1 : 0;

  if (world.craft.integrity <= 0 || world.craft.causalCoherence <= 0) {
    mission.status = "failed";
    mission.phase = "failed";
    mission.objective = "RUN LOST / BRANCH EVIDENCE PRESERVED";
    world.events.push({ tick: world.tick, type: "mission-failed" });
    world.commands.push({ tick: world.tick, type: "save-checkpoint" });
    return;
  }

  if (world.scene === "past-exterior" && mission.contactTicks >= context.content.contact.requiredTicks) {
    mission.status = "complete";
    mission.phase = "complete";
    mission.objective = "WARNING RECEIVED / SECOND ARRIVAL CONFIRMED";
    world.scene = "resolved";
    world.events.push({ tick: world.tick, type: "mission-complete" });
    world.commands.push({ tick: world.tick, type: "complete-run" });
    return;
  }

  if (world.scene === "crossing") {
    mission.phase = "crossing";
    mission.objective = "MAINTAIN ATTITUDE THROUGH CAUSAL SHEAR";
  } else if (world.scene === "interior" || world.scene === "forking") {
    mission.phase = "interior";
    const offset = Math.round(world.interior.position - world.interior.targetTick);
    if (Math.abs(offset) <= context.content.interior.exitWindow) {
      mission.objective = Math.abs(world.interior.velocity) <= context.content.interior.maximumExitSpeed
        ? "HOLD SCAN TO COHERE EXIT FRAME"
        : "BRAKE INSIDE THE SELECTED FRAME";
    } else {
      mission.objective = offset > 0 ? "THRUST BACKWARD ALONG THE WORLDLINE" : "REVERSE TOWARD THE SELECTED FRAME";
    }
  } else if (world.scene === "past-exterior") {
    mission.phase = "second-arrival";
    mission.objective = "HOLD SCAN LINK ON THE EARLIER CRAFT";
  } else if (world.scan.selectedFrame && world.scan.lock >= context.content.entry.minimumLock) {
    mission.phase = "phase-ready";
    mission.objective = "TURN INWARD AND COMMIT UNDER THRUST";
  } else if (world.scan.discoveries.length > 0) {
    mission.phase = "scan";
    mission.objective = world.scan.selectedFrame
      ? "REACQUIRE PHASE LOCK ON THE INSERTION BAND"
      : "HOLD ACTIVE SCAN WHILE SURFING";
  } else if (metrics.flightState === "horizon-surf") {
    mission.phase = "surf";
    mission.objective = "HOLD E TO SCAN THE READABLE SHEATH";
  } else if (metrics.flightState === "escape" && mission.approached) {
    mission.phase = "escape";
    mission.objective = "ESCAPE VECTOR CONFIRMED";
  } else if (mission.approached) {
    mission.phase = "orbit";
    mission.objective = "CONVERT APPROACH INTO A CONTROLLED SURF";
  }
}
