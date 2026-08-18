import { performance } from "node:perf_hooks";
import { FIXED_STEP } from "../core/scheduler.mjs";
import { FixedStepEngine } from "../engine/runtime.mjs";

const BATCHES = 30;
const TICKS_PER_BATCH = 600;
const samples = [];
const engine = new FixedStepEngine({
  inputProvider: (world) => ({
    bank: Math.sin(world.tick * 0.01) * 0.4,
    pitch: Math.cos(world.tick * 0.013) * 0.2,
    scan: world.tick % 180 < 90,
    thrust: world.tick % 240 < 160,
  }),
});

for (let batch = 0; batch < BATCHES + 2; batch += 1) {
  const started = performance.now();
  for (let tick = 0; tick < TICKS_PER_BATCH; tick += 1) engine.advance(FIXED_STEP);
  const millisecondsPerTick = (performance.now() - started) / TICKS_PER_BATCH;
  if (batch >= 2) samples.push(millisecondsPerTick);
}

samples.sort((a, b) => a - b);
const percentile = (value) => samples[Math.min(samples.length - 1, Math.floor(samples.length * value))];
const result = {
  batches: samples.length,
  meanMillisecondsPerTick: samples.reduce((sum, value) => sum + value, 0) / samples.length,
  p50MillisecondsPerTick: percentile(0.5),
  p95MillisecondsPerTick: percentile(0.95),
  ticks: samples.length * TICKS_PER_BATCH,
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (result.p95MillisecondsPerTick >= 2) {
  process.stderr.write("EVENTWAKE simulation exceeded its 2 ms reference budget.\n");
  process.exitCode = 1;
}
