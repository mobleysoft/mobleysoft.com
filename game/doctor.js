"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const gameRoot = __dirname;
const sourceRoot = path.resolve(gameRoot, "..");
const liveRoot = path.resolve(sourceRoot, "..", "mobleysoft.com");
const expectedCanonicalHash = "417b9edc4e6e4c9c8857d96bbebb6ad305a516421b92e034b43a9c3627fe9f6d";
const expectedArchiveHash = "e1a5de7ae02166961defa349c3f47c7ff56ad96537da431d1e49041037c3a8a0";
const checks = [];

function read(filePath) {
  return fs.readFileSync(filePath);
}

function hash(filePath) {
  return crypto.createHash("sha256").update(read(filePath)).digest("hex");
}

function check(name, condition, detail) {
  checks.push({ detail, name, status: condition ? "PASS" : "FAIL" });
}

const canonicalSource = path.join(sourceRoot, "blackhole.js");
const canonicalLive = path.join(liveRoot, "blackhole.js");
const archive = path.join(sourceRoot, "backgrounds", "candidates", "live-adapted-e1a5de7a.js");
const legacyRoot = path.join(sourceRoot, "backgrounds", "legacy");
const mimeTypes = path.resolve(sourceRoot, "..", "nginx", "mime.types");
check("canonical source hash", hash(canonicalSource) === expectedCanonicalHash, canonicalSource);
check("canonical live hash", hash(canonicalLive) === expectedCanonicalHash, canonicalLive);
check("adapted runtime archived", fs.existsSync(archive) && hash(archive) === expectedArchiveHash, archive);
check(
  "legacy runtime isolated",
  !fs.existsSync(path.join(gameRoot, "eventwake.js"))
    && !fs.existsSync(path.join(gameRoot, "engine", "mission.mjs"))
    && fs.existsSync(path.join(legacyRoot, "eventwake-single-canvas.js"))
    && fs.existsSync(path.join(legacyRoot, "exterior-mission-r2.mjs")),
  legacyRoot,
);
check(
  "legacy runtime undeployed",
  !fs.existsSync(path.join(liveRoot, "game", "eventwake.js"))
    && !fs.existsSync(path.join(liveRoot, "game", "engine", "mission.mjs")),
  path.join(liveRoot, "game"),
);
check(
  "module MIME mapping",
  fs.existsSync(mimeTypes) && /application\/javascript\s+js mjs;/.test(read(mimeTypes).toString("utf8")),
  mimeTypes,
);

const deployedFiles = [
  "client.mjs",
  "eventwake.css",
  "input-core.js",
  "input.js",
  "content/second-arrival.mjs",
  "content/validate.mjs",
  "core/branch-graph.mjs",
  "core/branch-inputs.mjs",
  "core/flight-metrics.mjs",
  "core/input-frame.mjs",
  "core/quantize.mjs",
  "core/rng.mjs",
  "core/scheduler.mjs",
  "core/snapshot-store.mjs",
  "core/world.mjs",
  "engine/fingerprint.mjs",
  "engine/math.mjs",
  "engine/recorder.mjs",
  "engine/runtime.mjs",
  "engine/simulation.mjs",
  "platform/browser/session-repository.mjs",
  "presentation/world-view.mjs",
  "systems/echo-system.mjs",
  "systems/flight-system.mjs",
  "systems/horizon-system.mjs",
  "systems/interior-system.mjs",
  "systems/metrics-system.mjs",
  "systems/mission-system.mjs",
  "systems/scan-system.mjs",
  "systems/timeline-system.mjs",
];
deployedFiles.forEach((name) => {
  const source = path.join(gameRoot, name);
  const deployed = path.join(liveRoot, "game", name);
  check(`deployed ${name}`, fs.existsSync(deployed) && hash(source) === hash(deployed), deployed);
});

[
  ["index parity", path.join(sourceRoot, "index.html"), path.join(liveRoot, "index.html")],
  ["app parity", path.join(sourceRoot, "app.js"), path.join(liveRoot, "app.js")],
  ["build metadata parity", path.join(sourceRoot, "build.json"), path.join(liveRoot, "build.json")],
  ["bootstrap parity", path.join(sourceRoot, "blackhole-bootstrap.js"), path.join(liveRoot, "blackhole-bootstrap.js")],
].forEach(([name, source, deployed]) => check(name, hash(source) === hash(deployed), deployed));

const index = read(path.join(liveRoot, "index.html")).toString("utf8");
const story = read(path.join(liveRoot, "eventwake", "index.html")).toString("utf8");
check("dual canvas", index.includes('id="blackhole-canvas"') && index.includes('id="encounter-canvas"'), "canonical + encounter");
check("legacy runtime unloaded", !index.includes("/game/eventwake.js"), "eventwake.js absent from page");
check("game to story", index.includes('href="/eventwake/"'), "/eventwake/");
check("story to game", story.includes('href="/?encounter=eventwake"'), "/?encounter=eventwake");
check(
  "runtime load order",
  index.indexOf("/blackhole-bootstrap.js") < index.indexOf("/blackhole.js")
    && index.indexOf("/blackhole.js") < index.indexOf("/game/input-core.js")
    && index.indexOf("/game/input-core.js") < index.indexOf("/game/input.js")
    && index.indexOf("/game/input.js") < index.indexOf("/game/client.mjs"),
  "bridge -> canonical -> input -> engine client",
);

const status = JSON.parse(read(path.join(gameRoot, "status.json")).toString("utf8"));
checks.forEach(({ detail, name, status: result }) => {
  process.stdout.write(`${result.padEnd(5)} ${name.padEnd(30)} ${detail}\n`);
});
process.stdout.write(`\nVERIFIED ${status.verified.length}\n`);
process.stdout.write(`OPEN     ${(status.open_product_requirements || status.open_vertical_slice_requirements || []).length}\n`);
process.stdout.write(`CLASS    ${status.classification}\n`);

if (checks.some(({ status: result }) => result === "FAIL")) process.exitCode = 1;
