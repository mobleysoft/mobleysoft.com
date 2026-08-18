import { SECOND_ARRIVAL } from "../content/second-arrival.mjs";
import { applyBranchFork } from "../core/branch-graph.mjs";
import { BranchInputStore } from "../core/branch-inputs.mjs";
import { deriveFlightMetrics } from "../core/flight-metrics.mjs";
import { FIXED_STEP, stepWorld } from "../core/scheduler.mjs";
import { SnapshotStore } from "../core/snapshot-store.mjs";
import { cloneWorld, createWorld, WORLD_SCHEMA } from "../core/world.mjs";
import { InputRecorder } from "./recorder.mjs";

export const SESSION_SCHEMA = "eventwake.session.v1";

export class FixedStepEngine {
  constructor(options = {}) {
    this.content = options.content || SECOND_ARRIVAL;
    this.fixedStep = options.fixedStep || FIXED_STEP;
    this.inputProvider = options.inputProvider || (() => ({}));
    this.maxFrameDelta = options.maxFrameDelta || 0.2;
    this.maxSubsteps = options.maxSubsteps || 8;
    this.recorder = options.recorder || new InputRecorder();
    this.branchInputs = options.branchInputs || new BranchInputStore();
    this.snapshotStore = options.snapshotStore || new SnapshotStore({
      interval: this.content.snapshots.interval,
      maximumPerBranch: this.content.snapshots.maximumPerBranch,
    });
    this.stateFactory = options.stateFactory || (() => createWorld(this.content));
    this.accumulator = 0;
    this.droppedTime = 0;
    this.previousState = null;
    this.state = this.stateFactory();
    this.previousState = cloneWorld(this.state);
    this.snapshotStore.record(this.state, true);
    if (options.session) this.loadSession(options.session);
  }

  simulationContext(reconstructing = false) {
    return {
      content: this.content,
      delta: this.fixedStep,
      inputAtBranch: (branchId, tick) => this.branchInputs.inputAt(branchId, tick),
      reconstructing,
    };
  }

  reconstructBranchAt(branchId, targetTick) {
    const snapshot = this.snapshotStore.latestAtOrBefore(branchId, targetTick);
    if (!snapshot) throw new Error(`No snapshot can reconstruct ${branchId} at tick ${targetTick}.`);
    const reconstructed = snapshot.world;
    while (reconstructed.timeline.localTick < targetTick) {
      const input = this.branchInputs.inputAt(branchId, reconstructed.timeline.localTick);
      stepWorld(reconstructed, input, this.simulationContext(true));
      reconstructed.commands = [];
    }
    return reconstructed;
  }

  processCommands() {
    const commands = [...this.state.commands];
    this.state.commands = [];
    for (const command of commands) {
      if (command.type === "fork-branch") {
        const originWorld = this.reconstructBranchAt(command.sourceBranchId, command.targetTick);
        applyBranchFork(this.state, command, originWorld);
        this.state.commands = this.state.commands.filter((entry) => entry.type !== "save-checkpoint");
        this.state.metrics = deriveFlightMetrics(this.state.craft, this.state.scene, this.content, this.state.interior);
        this.snapshotStore.record(this.state, true);
      } else if (command.type === "save-checkpoint" || command.type === "complete-run") {
        this.state.events.push({ reason: command.type, tick: this.state.tick, type: "persistence-requested" });
      }
    }
  }

  advance(realDelta) {
    const acceptedDelta = Math.min(this.maxFrameDelta, Math.max(0, realDelta));
    this.accumulator += acceptedDelta;
    const events = [];
    let substeps = 0;
    while (this.accumulator + 1e-12 >= this.fixedStep && substeps < this.maxSubsteps) {
      this.previousState = cloneWorld(this.state);
      const input = this.recorder.record(this.state.tick, this.inputProvider(this.state));
      this.branchInputs.record(this.state.timeline.activeBranchId, this.state.timeline.localTick, input);
      stepWorld(this.state, input, this.simulationContext());
      this.processCommands();
      this.snapshotStore.record(this.state);
      events.push(...this.state.events.map((event) => ({ ...event })));
      this.accumulator -= this.fixedStep;
      substeps += 1;
    }
    if (substeps === this.maxSubsteps && this.accumulator >= this.fixedStep) {
      this.droppedTime += this.accumulator;
      this.accumulator = 0;
    }
    return { alpha: this.accumulator / this.fixedStep, events, state: this.state, substeps };
  }

  exportSession() {
    return {
      schema: SESSION_SCHEMA,
      contentId: this.content.id,
      worldSchema: WORLD_SCHEMA,
      state: cloneWorld(this.state),
      previousState: cloneWorld(this.previousState),
      recorder: this.recorder.export(),
      branchInputs: this.branchInputs.export(),
      snapshots: this.snapshotStore.export(),
    };
  }

  loadSession(session) {
    if (session?.schema !== SESSION_SCHEMA || session.contentId !== this.content.id || session.worldSchema !== WORLD_SCHEMA) {
      throw new TypeError("Incompatible EVENTWAKE session.");
    }
    this.state = cloneWorld(session.state);
    this.previousState = cloneWorld(session.previousState || session.state);
    this.recorder.load(session.recorder || []);
    this.branchInputs.load(session.branchInputs || []);
    this.snapshotStore.load(session.snapshots || []);
    this.accumulator = 0;
    this.droppedTime = 0;
    return this.state;
  }

  reset(state = null) {
    this.accumulator = 0;
    this.droppedTime = 0;
    this.recorder.reset();
    this.branchInputs = new BranchInputStore();
    this.snapshotStore = new SnapshotStore({
      interval: this.content.snapshots.interval,
      maximumPerBranch: this.content.snapshots.maximumPerBranch,
    });
    this.state = state ? cloneWorld(state) : this.stateFactory();
    this.previousState = cloneWorld(this.state);
    this.snapshotStore.record(this.state, true);
    return this.state;
  }
}
