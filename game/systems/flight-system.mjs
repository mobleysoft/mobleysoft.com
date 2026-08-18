import {
  add,
  clamp,
  clampMagnitude,
  forwardFromAttitude,
  length,
  normalize,
  scale,
} from "../engine/math.mjs";

export function integrateCraft(craft, input, delta, content, events = [], actorId = craft.id) {
  const config = content.physics;
  const targetRoll = input.bank * config.maxBankAngle;
  craft.attitude.roll += (targetRoll - craft.attitude.roll) * Math.min(1, config.bankResponse * delta);
  craft.attitude.pitch = clamp(
    craft.attitude.pitch + input.pitch * config.maxPitchRate * delta,
    -config.maxPitch,
    config.maxPitch,
  );
  const speedRatio = clamp(length(craft.velocity) / 80, 0.25, 1.4);
  craft.attitude.yaw -= Math.sin(craft.attitude.roll) * config.turnRate * speedRatio * delta;

  const forward = forwardFromAttitude(craft.attitude);
  const thrust = input.thrust ? config.thrustAcceleration : 0;
  const reverse = input.reverse ? config.reverseAcceleration : 0;
  const distance = Math.max(content.anomaly.horizonRadius, length(craft.position));
  const gravityDirection = scale(normalize(craft.position, [0, 0, 1]), -1);
  const gravity = scale(gravityDirection, config.mu / (distance * distance));
  const propulsion = scale(forward, thrust - reverse);
  const acceleration = add(gravity, propulsion);

  craft.velocity = add(craft.velocity, scale(acceleration, delta));
  craft.velocity = scale(craft.velocity, Math.exp(-config.drag * delta));
  craft.velocity = clampMagnitude(craft.velocity, config.maxSpeed);
  craft.position = add(craft.position, scale(craft.velocity, delta));

  craft.weaponCooldown = Math.max(0, craft.weaponCooldown - delta);
  if (input.fire && craft.weaponCooldown <= 0) {
    craft.weaponCooldown = config.weaponInterval;
    events.push({ actorId, type: "fire" });
  }
}

export function flightSystem(world, input, context) {
  if (!["exterior", "past-exterior", "crossing"].includes(world.scene)) return;
  world.craft.boundaryContact = false;
  integrateCraft(world.craft, input, context.delta, context.content, world.events);
}
