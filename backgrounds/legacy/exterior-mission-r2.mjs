export function createExteriorMission() {
  return {
    approached: false,
    escaped: false,
    objective: "ESTABLISH AN APPROACH VECTOR",
    orbitTicks: 0,
    phase: "approach",
    surfTicks: 0,
  };
}

export function updateExteriorMission(mission, metrics) {
  if (metrics.radialVelocity < -3) mission.approached = true;
  if (mission.approached && metrics.radialVelocity > 5 && metrics.distance > 210) mission.escaped = true;

  mission.surfTicks = metrics.flightState === "horizon-surf" ? mission.surfTicks + 1 : 0;
  mission.orbitTicks = metrics.flightState === "orbit" ? mission.orbitTicks + 1 : 0;

  if (mission.surfTicks >= 45 && metrics.phaseLock >= 0.72) {
    mission.phase = "phase-ready";
    mission.objective = "HOLD PHASE / SCAN CONTROL REQUIRED";
  } else if (metrics.flightState === "horizon-surf") {
    mission.phase = "surf";
    mission.objective = "SURF THE READABLE SHEATH";
  } else if (metrics.flightState === "escape" && mission.approached) {
    mission.phase = "escape";
    mission.objective = "ESCAPE VECTOR CONFIRMED";
  } else if (mission.approached) {
    mission.phase = "orbit";
    mission.objective = "CONVERT APPROACH INTO ORBIT";
  }

  return mission;
}
