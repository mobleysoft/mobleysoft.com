import { cloneWorld } from "./world.mjs";

export class SnapshotStore {
  constructor(options = {}) {
    this.interval = Math.max(1, Math.trunc(options.interval || 30));
    this.maximumPerBranch = Math.max(2, Math.trunc(options.maximumPerBranch || 256));
    this.branches = new Map();
  }

  record(world, force = false) {
    const branchId = world.timeline.activeBranchId;
    const localTick = world.timeline.localTick;
    if (!force && localTick % this.interval !== 0) return false;
    const entries = this.branches.get(branchId) || [];
    const existing = entries.findIndex((entry) => entry.localTick === localTick);
    const snapshot = { executionTick: world.tick, localTick, world: cloneWorld(world) };
    if (existing >= 0) entries[existing] = snapshot;
    else entries.push(snapshot);
    entries.sort((a, b) => a.localTick - b.localTick);
    if (entries.length > this.maximumPerBranch) entries.splice(0, entries.length - this.maximumPerBranch);
    this.branches.set(branchId, entries);
    return true;
  }

  latestAtOrBefore(branchId, localTick) {
    const entries = this.branches.get(branchId) || [];
    let selected = null;
    for (const entry of entries) {
      if (entry.localTick > localTick) break;
      selected = entry;
    }
    return selected ? { ...selected, world: cloneWorld(selected.world) } : null;
  }

  export() {
    return [...this.branches.entries()].map(([branchId, entries]) => ({
      branchId,
      entries: cloneWorld(entries),
    }));
  }

  load(payload = []) {
    this.branches.clear();
    for (const branch of payload) this.branches.set(branch.branchId, cloneWorld(branch.entries || []));
    return this;
  }
}
