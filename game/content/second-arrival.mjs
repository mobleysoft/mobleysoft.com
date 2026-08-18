import { validateScenario } from "./validate.mjs";

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

export const SECOND_ARRIVAL = deepFreeze(validateScenario({
  schema: "eventwake.scenario.v1",
  id: "second-arrival",
  title: "The Second Arrival",
  seed: 0x45564e54,
  initialCraft: {
    attitude: { pitch: 0.08, roll: 0, yaw: 0.7 },
    position: [160, -24, 190],
    velocity: [-12, 0, -15],
  },
  anomaly: {
    collisionMargin: 4,
    commitRadius: 112,
    horizonRadius: 100,
    readableRadius: 175,
  },
  physics: {
    bankResponse: 4.8,
    drag: 0.012,
    maxBankAngle: Math.PI * 0.42,
    maxPitch: Math.PI * 0.42,
    maxPitchRate: 1.18,
    maxSpeed: 180,
    mu: 135000,
    reverseAcceleration: 22,
    thrustAcceleration: 34,
    turnRate: 0.92,
    weaponInterval: 0.18,
  },
  scan: {
    discoveries: [
      { id: "impossible-latency", threshold: 12, observation: "RETURN PRECEDES TRANSMISSION BY 0.18 S" },
      { id: "reciprocal-return", threshold: 30, observation: "THE SAME BAND ANSWERS FROM TWO BEARINGS" },
      { id: "local-worldline", threshold: 54, observation: "BAND MOTION CORRELATES WITH LOCAL EVENT TIME" },
      { id: "earlier-arrival", threshold: 84, observation: "CONTACT: THIS CRAFT, BEFORE CURRENT APPROACH" },
      {
        id: "future-loss",
        threshold: 120,
        observation: "UNOBSERVED FRAME CONTAINS A DESTROYED SURVEY CRAFT",
        projection: { id: "future-wreck", kind: "wreck", position: [-92, 36, 80] },
      },
      { id: "insertion-frame", threshold: 165, observation: "VIABLE INSERTION FRAME RESOLVED", frameOffset: -180 },
    ],
    lockDecay: 0.018,
    minimumQuality: 0.24,
  },
  entry: {
    crossingTicks: 72,
    minimumInwardVelocity: 3.5,
    minimumLock: 0.62,
  },
  interior: {
    acceleration: 92,
    drag: 1.7,
    exitCoherenceTicks: 30,
    exitWindow: 18,
    maximumExitSpeed: 22,
  },
  contact: {
    range: 180,
    requiredTicks: 90,
  },
  snapshots: {
    interval: 30,
    maximumPerBranch: 256,
  },
}));
