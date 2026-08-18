"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("./input-core.js");

test("agreed keyboard controls map to semantic flight actions", () => {
  const input = core.keyboardSnapshot(new Set(["KeyW", "KeyA", "KeyE", "Space", "ShiftLeft"]));
  assert.equal(input.bank, -1);
  assert.equal(input.pitch, -1);
  assert.equal(input.thrust, true);
  assert.equal(input.reverse, false);
  assert.equal(input.fire, true);
  assert.equal(input.scan, true);
});

test("arrow keys mirror WASD and control applies reverse thrust", () => {
  const input = core.keyboardSnapshot(new Set(["ArrowDown", "ArrowRight", "ControlRight"]));
  assert.equal(input.bank, 1);
  assert.equal(input.pitch, 1);
  assert.equal(input.reverse, true);
});

test("opposing controls cancel cleanly", () => {
  const input = core.keyboardSnapshot(new Set(["KeyA", "KeyD", "KeyW", "KeyS"]));
  assert.equal(input.bank, 0);
  assert.equal(input.pitch, 0);
  assert.equal(input.active, false);
});

test("stick normalization removes drift and preserves direction", () => {
  assert.deepEqual(core.normalizeStick(0.03, -0.02), { active: false, x: 0, y: 0 });
  const input = core.normalizeStick(0.8, -0.4);
  assert.equal(input.active, true);
  assert.ok(input.x > 0);
  assert.ok(input.y < 0);
  assert.ok(Math.hypot(input.x, input.y) <= 1.000001);
});
