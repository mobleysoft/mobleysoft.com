(function initializeInputCore(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.MobleyInputCore = api;
})(typeof globalThis === "object" ? globalThis : this, function createInputCore() {
  "use strict";

  const FLIGHT_CODES = new Set([
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "ControlLeft",
    "ControlRight",
    "KeyA",
    "KeyD",
    "KeyE",
    "KeyS",
    "KeyW",
    "ShiftLeft",
    "ShiftRight",
    "Space",
  ]);

  function clamp(value, minimum = -1, maximum = 1) {
    return Math.max(minimum, Math.min(maximum, Number(value) || 0));
  }

  function normalizeStick(x, y, deadzone = 0.12) {
    const rawX = clamp(x);
    const rawY = clamp(y);
    const magnitude = Math.min(1, Math.hypot(rawX, rawY));
    if (magnitude <= deadzone) return { active: false, x: 0, y: 0 };
    const scaled = (magnitude - deadzone) / (1 - deadzone);
    return {
      active: true,
      x: clamp((rawX / magnitude) * scaled),
      y: clamp((rawY / magnitude) * scaled),
    };
  }

  function keyboardSnapshot(codes) {
    const has = (code) => codes.has(code);
    const bank = (has("KeyD") || has("ArrowRight") ? 1 : 0)
      - (has("KeyA") || has("ArrowLeft") ? 1 : 0);
    // Up/W pitches the nose down; Down/S pitches it up.
    const pitch = (has("KeyS") || has("ArrowDown") ? 1 : 0)
      - (has("KeyW") || has("ArrowUp") ? 1 : 0);
    return {
      active: bank !== 0 || pitch !== 0,
      bank: clamp(bank),
      fire: has("ShiftLeft") || has("ShiftRight"),
      pitch: clamp(pitch),
      reverse: has("ControlLeft") || has("ControlRight"),
      scan: has("KeyE"),
      thrust: has("Space"),
    };
  }

  function isFlightCode(code) {
    return FLIGHT_CODES.has(code);
  }

  return Object.freeze({ clamp, isFlightCode, keyboardSnapshot, normalizeStick });
});
