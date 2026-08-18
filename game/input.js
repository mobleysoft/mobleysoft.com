(() => {
  "use strict";

  const core = window.MobleyInputCore;
  if (!core) {
    console.warn("EVENTWAKE input requires input-core.js.");
    return;
  }

  const pressed = new Set();
  const virtualActions = { fire: false, reverse: false, scan: false, thrust: false };
  const pointerAxis = { active: false, x: 0, y: 0 };
  const touchAxis = { active: false, x: 0, y: 0 };
  const stick = document.getElementById("flight-stick");
  const stickKnob = document.getElementById("flight-stick-knob");
  let active = false;
  let stickPointerId = null;

  function isTypingTarget(target) {
    return /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(target?.tagName || "") || target?.isContentEditable;
  }

  function resetStick() {
    stickPointerId = null;
    touchAxis.active = false;
    touchAxis.x = 0;
    touchAxis.y = 0;
    if (stickKnob) stickKnob.style.transform = "translate3d(0, 0, 0)";
  }

  function reset() {
    pressed.clear();
    pointerAxis.active = false;
    pointerAxis.x = 0;
    pointerAxis.y = 0;
    Object.keys(virtualActions).forEach((action) => { virtualActions[action] = false; });
    document.querySelectorAll("[data-flight-hold]").forEach((button) => {
      button.classList.remove("is-held");
      button.setAttribute("aria-pressed", "false");
    });
    resetStick();
  }

  function setActive(nextActive) {
    active = Boolean(nextActive);
    if (!active) reset();
  }

  function updateStick(event) {
    if (!stick || event.pointerId !== stickPointerId) return;
    const rect = stick.getBoundingClientRect();
    const radius = Math.max(1, Math.min(rect.width, rect.height) * 0.38);
    const rawX = (event.clientX - (rect.left + rect.width / 2)) / radius;
    const rawY = (event.clientY - (rect.top + rect.height / 2)) / radius;
    const normalized = core.normalizeStick(rawX, rawY, 0.04);
    touchAxis.active = true;
    touchAxis.x = normalized.x;
    touchAxis.y = normalized.y;
    if (stickKnob) {
      stickKnob.style.transform = `translate3d(${normalized.x * radius}px, ${normalized.y * radius}px, 0)`;
    }
  }

  function bindStick() {
    if (!stick) return;
    stick.addEventListener("pointerdown", (event) => {
      if (!active) return;
      event.preventDefault();
      stickPointerId = event.pointerId;
      stick.setPointerCapture(event.pointerId);
      updateStick(event);
    });
    stick.addEventListener("pointermove", (event) => {
      if (stickPointerId === null) return;
      event.preventDefault();
      updateStick(event);
    });
    ["pointerup", "pointercancel", "lostpointercapture"].forEach((eventName) => {
      stick.addEventListener(eventName, resetStick);
    });
  }

  function bindHoldButton(button) {
    const action = button.dataset.flightHold;
    if (!(action in virtualActions)) return;
    const setHeld = (held) => {
      virtualActions[action] = held;
      button.classList.toggle("is-held", held);
      button.setAttribute("aria-pressed", String(held));
      if (held && action === "fire" && navigator.vibrate) navigator.vibrate(12);
    };
    button.addEventListener("pointerdown", (event) => {
      if (!active) return;
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      setHeld(true);
    });
    ["pointerup", "pointercancel", "lostpointercapture"].forEach((eventName) => {
      button.addEventListener(eventName, () => setHeld(false));
    });
  }

  function readGamepad() {
    if (!navigator.getGamepads) return null;
    const gamepad = [...navigator.getGamepads()].find(Boolean);
    if (!gamepad) return null;
    const axes = core.normalizeStick(gamepad.axes[0] || 0, gamepad.axes[1] || 0, 0.16);
    return {
      active: axes.active,
      bank: axes.x,
      fire: Boolean(gamepad.buttons[0]?.pressed || gamepad.buttons[5]?.pressed),
      pitch: axes.y,
      reverse: Boolean(gamepad.buttons[6]?.pressed),
      scan: Boolean(gamepad.buttons[2]?.pressed || gamepad.buttons[4]?.pressed),
      thrust: Boolean(gamepad.buttons[7]?.pressed || gamepad.buttons[1]?.pressed),
    };
  }

  function read() {
    if (!active) return { bank: 0, fire: false, pitch: 0, reverse: false, scan: false, source: "idle", thrust: false };
    const keyboard = core.keyboardSnapshot(pressed);
    const gamepad = readGamepad();
    let axes = pointerAxis;
    let source = pointerAxis.active ? "pointer" : "idle";
    if (keyboard.active) {
      axes = { x: keyboard.bank, y: keyboard.pitch };
      source = "keyboard";
    }
    if (gamepad?.active) {
      axes = { x: gamepad.bank, y: gamepad.pitch };
      source = "gamepad";
    }
    if (touchAxis.active) {
      axes = touchAxis;
      source = "touch";
    }
    if (source === "idle" && (virtualActions.fire || virtualActions.reverse || virtualActions.scan || virtualActions.thrust)) {
      source = "touch";
    } else if (source === "idle" && (keyboard.fire || keyboard.reverse || keyboard.scan || keyboard.thrust)) {
      source = "keyboard";
    } else if (source === "idle" && (gamepad?.fire || gamepad?.reverse || gamepad?.scan || gamepad?.thrust)) {
      source = "gamepad";
    }
    return {
      bank: core.clamp(axes.x),
      fire: virtualActions.fire || keyboard.fire || Boolean(gamepad?.fire),
      pitch: core.clamp(axes.y),
      reverse: virtualActions.reverse || keyboard.reverse || Boolean(gamepad?.reverse),
      scan: virtualActions.scan || keyboard.scan || Boolean(gamepad?.scan),
      source,
      thrust: virtualActions.thrust || keyboard.thrust || Boolean(gamepad?.thrust),
    };
  }

  addEventListener("keydown", (event) => {
    if (!active || isTypingTarget(event.target) || !core.isFlightCode(event.code)) return;
    event.preventDefault();
    pressed.add(event.code);
  });
  addEventListener("keyup", (event) => pressed.delete(event.code));
  addEventListener("pointermove", (event) => {
    if (!active || event.pointerType === "touch" || stickPointerId !== null) return;
    pointerAxis.active = true;
    pointerAxis.x = core.clamp((event.clientX / innerWidth) * 2 - 1);
    pointerAxis.y = core.clamp((event.clientY / innerHeight) * 2 - 1);
  }, { passive: true });
  addEventListener("blur", reset);
  document.addEventListener("visibilitychange", () => { if (document.hidden) reset(); });

  bindStick();
  document.querySelectorAll("[data-flight-hold]").forEach(bindHoldButton);

  window.MobleyFlightInput = Object.freeze({
    diagnostics: () => ({
      active,
      gamepad: Boolean(navigator.getGamepads && [...navigator.getGamepads()].find(Boolean)),
      touch: navigator.maxTouchPoints > 0,
    }),
    read,
    reset,
    setActive,
  });
  window.dispatchEvent(new CustomEvent("mobley:flight-input-ready"));
})();
