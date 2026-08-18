import test from "node:test";
import assert from "node:assert/strict";
import { SECOND_ARRIVAL } from "../content/second-arrival.mjs";
import { validateScenario } from "../content/validate.mjs";
import { createWorld } from "../core/world.mjs";
import { FIXED_STEP, stepWorld } from "../core/scheduler.mjs";
import { fingerprintSimulationState } from "../engine/fingerprint.mjs";
import { InputRecorder } from "../engine/recorder.mjs";
import { FixedStepEngine } from "../engine/runtime.mjs";

function fastScenario() {
  const content = structuredClone(SECOND_ARRIVAL);
  content.id = "second-arrival-acceptance";
  content.initialCraft = {
    attitude: { pitch: 0, roll: 0, yaw: Math.PI / 2 },
    position: [114, 0, 0],
    velocity: [-3.8, 0, -44],
  };
  content.anomaly.commitRadius = 113;
  content.scan.discoveries = content.scan.discoveries.map((discovery, index) => ({
    ...discovery,
    threshold: (index + 1) * 0.55,
    ...(discovery.frameOffset === undefined ? {} : { frameOffset: -20 }),
  }));
  content.entry.crossingTicks = 15;
  content.entry.minimumLock = 0.5;
  content.interior.exitCoherenceTicks = 4;
  content.interior.exitWindow = 2.5;
  content.interior.maximumExitSpeed = 4;
  content.contact.requiredTicks = 4;
  content.snapshots.interval = 1;
  return validateScenario(content);
}

function causalInputProvider(content, visited = new Set()) {
  return (world) => {
    visited.add(world.scene);
    if (world.scene === "exterior") return { scan: true, thrust: true };
    if (world.scene === "interior") {
      const offset = world.interior.position - world.interior.targetTick;
      const desiredVelocity = Math.max(-8, Math.min(8, -offset * 1.2));
      if (Math.abs(offset) <= content.interior.exitWindow && Math.abs(world.interior.velocity) <= content.interior.maximumExitSpeed) {
        return { scan: true };
      }
      if (world.interior.velocity > desiredVelocity + 0.35) return { thrust: true };
      if (world.interior.velocity < desiredVelocity - 0.35) return { reverse: true };
      return {};
    }
    if (world.scene === "past-exterior") return { scan: true };
    return {};
  };
}

function runCausalLoop(content, inputProvider = causalInputProvider(content)) {
  const engine = new FixedStepEngine({ content, inputProvider });
  const events = [];
  for (let tick = 0; tick < 2400 && engine.state.mission.status === "active"; tick += 1) {
    events.push(...engine.advance(FIXED_STEP).events.map((event) => event.type));
  }
  return { engine, events };
}

test("scanning is active observation gated by useful flight geometry", () => {
  const content = fastScenario();
  const far = createWorld(content);
  far.craft.position = [400, 0, 0];
  stepWorld(far, { scan: true }, { content, delta: FIXED_STEP });
  assert.equal(far.scan.progress, 0);

  const near = createWorld(content);
  stepWorld(near, {}, { content, delta: FIXED_STEP });
  assert.equal(near.scan.progress, 0);
  stepWorld(near, { scan: true }, { content, delta: FIXED_STEP });
  assert.ok(near.scan.progress > 0);
});

test("entry remains blocked without both a resolved frame and deliberate thrust", () => {
  const content = fastScenario();
  const world = createWorld(content);
  world.scan.selectedFrame = { discoveryId: "insertion-frame", sourceBranchId: "branch-0", targetTick: 0 };
  world.scan.lock = 1;
  stepWorld(world, { scan: true }, { content, delta: FIXED_STEP });
  assert.equal(world.scene, "exterior");
});

test("session export and restore preserve the authoritative checksum", () => {
  const engine = new FixedStepEngine({ inputProvider: () => ({ bank: -0.2, thrust: true }) });
  for (let tick = 0; tick < 90; tick += 1) engine.advance(FIXED_STEP);
  const checksum = fingerprintSimulationState(engine.state);
  const restored = new FixedStepEngine({ session: engine.exportSession() });
  assert.equal(fingerprintSimulationState(restored.state), checksum);
  assert.deepEqual(restored.recorder.export(), engine.recorder.export());
});

test("The Second Arrival causal loop completes from semantic inputs alone", () => {
  const content = fastScenario();
  const visited = new Set();
  const { engine, events } = runCausalLoop(content, causalInputProvider(content, visited));

  assert.equal(engine.state.mission.status, "complete");
  assert.ok(visited.has("crossing"));
  assert.ok(visited.has("interior"));
  assert.ok(visited.has("past-exterior"));
  assert.equal(engine.state.timeline.branches.length, 2);
  assert.equal(engine.state.echoes.length, 1);
  assert.deepEqual(engine.state.scan.projections.map(({ id }) => id), ["future-wreck"]);
  assert.ok(events.includes("branch-created"));
  assert.ok(events.includes("mission-complete"));
  assert.equal(engine.state.timeline.branches[0].status, "preserved");
});

test("a complete branched run replays to the same checksum", () => {
  const content = fastScenario();
  const { engine: original } = runCausalLoop(content);
  const targetTick = original.state.tick;
  const targetFingerprint = fingerprintSimulationState(original.state);
  const recorded = new InputRecorder().load(original.recorder.export());
  const replay = new FixedStepEngine({ content, inputProvider: (world) => recorded.inputAt(world.tick) });
  for (let tick = 0; tick < targetTick; tick += 1) replay.advance(FIXED_STEP);
  assert.equal(fingerprintSimulationState(replay.state), targetFingerprint);
  assert.equal(replay.state.timeline.branches.length, 2);
  assert.equal(replay.state.echoes.length, 1);
});

test("a branched session survives JSON storage and restoration", () => {
  const content = fastScenario();
  const { engine } = runCausalLoop(content);
  const serialized = JSON.parse(JSON.stringify(engine.exportSession()));
  const restored = new FixedStepEngine({ content, session: serialized });
  assert.equal(fingerprintSimulationState(restored.state), fingerprintSimulationState(engine.state));
  assert.equal(restored.state.timeline.branches[0].status, "preserved");
  assert.equal(restored.state.timeline.branches[1].parentId, "branch-0");
});
