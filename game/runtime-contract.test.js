"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const sourceRoot = path.resolve(__dirname, "..");
const liveRoot = path.resolve(sourceRoot, "..", "mobleysoft.com");
const canonicalHash = "417b9edc4e6e4c9c8857d96bbebb6ad305a516421b92e034b43a9c3627fe9f6d";

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function hash(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

test("live canonical renderer is byte-identical to the selected artifact", () => {
  const source = path.join(sourceRoot, "blackhole.js");
  const live = path.join(liveRoot, "blackhole.js");
  assert.equal(hash(source), canonicalHash);
  assert.equal(hash(live), canonicalHash);
  assert.deepEqual(fs.readFileSync(live), fs.readFileSync(source));
});

test("live page keeps canonical and encounter renderers on separate canvases", () => {
  const index = read(path.join(liveRoot, "index.html"));
  assert.match(index, /<canvas id="blackhole-canvas"/);
  assert.match(index, /<canvas id="encounter-canvas"/);
  assert.doesNotMatch(index, /game\/eventwake\.js/);
});

test("canonical bootstrap and input adapters load before the module client", () => {
  const index = read(path.join(liveRoot, "index.html"));
  const three = index.indexOf("/assets/vendor/three-r128.min.js");
  const bridge = index.indexOf("/blackhole-bootstrap.js");
  const canonical = index.indexOf("/blackhole.js");
  const core = index.indexOf("/game/input-core.js");
  const input = index.indexOf("/game/input.js");
  const client = index.indexOf("/game/client.mjs");
  assert.ok(three >= 0 && bridge > three && canonical > bridge);
  assert.ok(core > canonical && input > core && client > input);
});

test("game client observes the canonical camera without reproducing its shader", () => {
  const bridge = read(path.join(sourceRoot, "blackhole-bootstrap.js"));
  const client = read(path.join(sourceRoot, "game", "client.mjs"));
  assert.match(bridge, /MobleyCanonicalBridge/);
  assert.match(bridge, /PerspectiveCamera/);
  assert.match(client, /canonical\.camera/);
  assert.match(client, /alpha:\s*true/);
  assert.doesNotMatch(client, /ShaderMaterial/);
  assert.doesNotMatch(client, /vec3 doppler/);
});

test("engine client uses the deterministic runtime rather than direct screen positioning", () => {
  const client = read(path.join(sourceRoot, "game", "client.mjs"));
  const simulation = read(path.join(sourceRoot, "game", "engine", "simulation.mjs"));
  const flightSystem = read(path.join(sourceRoot, "game", "systems", "flight-system.mjs"));
  assert.match(client, /new FixedStepEngine/);
  assert.match(client, /fingerprintSimulationState/);
  assert.match(simulation, /stepWorld/);
  assert.match(flightSystem, /craft\.velocity/);
  assert.match(flightSystem, /gravity/);
  assert.doesNotMatch(client, /clientX\s*\/\s*innerWidth/);
});

test("mobile gameplay exposes controls and removes the site shell from interaction", () => {
  const index = read(path.join(liveRoot, "index.html"));
  const css = read(path.join(sourceRoot, "game", "eventwake.css"));
  assert.match(index, /id="flight-stick"/);
  assert.match(index, /data-flight-hold="thrust"/);
  assert.match(index, /data-flight-hold="reverse"/);
  assert.match(index, /data-flight-hold="fire"/);
  assert.match(index, /data-flight-hold="scan"/);
  assert.match(index, /id="flight-observation"/);
  assert.match(css, /body\.background-playing \.site-shell/);
  assert.match(css, /body\.background-playing \.flight-controls/);
});

test("runtime layers keep domain simulation independent from browser presentation", () => {
  const scheduler = read(path.join(sourceRoot, "game", "core", "scheduler.mjs"));
  const world = read(path.join(sourceRoot, "game", "core", "world.mjs"));
  const view = read(path.join(sourceRoot, "game", "presentation", "world-view.mjs"));
  const content = read(path.join(sourceRoot, "game", "content", "second-arrival.mjs"));
  assert.match(scheduler, /SYSTEM_SCHEDULE/);
  assert.match(world, /eventwake\.world\.v1/);
  assert.match(content, /eventwake\.scenario\.v1/);
  assert.doesNotMatch(`${scheduler}\n${world}`, /document\.|window\.|THREE|Math\.random|Date\(/);
  assert.match(view, /EventwakeWorldView/);
  assert.match(view, /CanvasTexture/);
});

test("story and game retain reciprocal navigation", () => {
  const index = read(path.join(liveRoot, "index.html"));
  const story = read(path.join(liveRoot, "eventwake", "index.html"));
  assert.match(index, /href="\/eventwake\/"/);
  assert.match(story, /href="\/\?encounter=eventwake"/);
});
