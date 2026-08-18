import { clamp, dot, length, normalize, scale, subtract } from "../engine/math.mjs";

export function deriveFlightMetrics(craft, scene, content, interior = null) {
  const distance = length(craft.position);
  const radial = normalize(craft.position, [0, 0, 1]);
  const radialVelocity = dot(craft.velocity, radial);
  const tangentialVelocity = subtract(craft.velocity, scale(radial, radialVelocity));
  const tangentialSpeed = length(tangentialVelocity);
  const sheathSpan = content.anomaly.readableRadius - content.anomaly.horizonRadius;
  const radialPosition = clamp((content.anomaly.readableRadius - distance) / sheathSpan, 0, 1);
  const tangentialQuality = clamp(tangentialSpeed / 42, 0, 1);
  const radialQuality = 1 - clamp(Math.abs(radialVelocity) / 24, 0, 1);
  const phaseLock = radialPosition * tangentialQuality * radialQuality;
  let flightState;

  if (scene === "crossing") flightState = "crossing";
  else if (scene === "interior" || scene === "forking") flightState = "interior";
  else if (scene === "resolved") flightState = "resolved";
  else if (distance <= content.anomaly.readableRadius && Math.abs(radialVelocity) < 9 && tangentialSpeed > 10) flightState = "horizon-surf";
  else if (radialVelocity < -3) flightState = "approach";
  else if (radialVelocity > 3) flightState = "escape";
  else flightState = "orbit";

  return {
    distance,
    flightState,
    phaseLock,
    radialVelocity,
    speed: length(craft.velocity),
    tangentialSpeed,
    temporalOffset: interior?.targetTick == null ? 0 : interior.position - interior.targetTick,
  };
}
