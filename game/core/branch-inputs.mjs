import { quantizeInput, sameInput } from "./input-frame.mjs";

export class BranchInputStore {
  constructor() {
    this.branches = new Map();
  }

  record(branchId, localTick, rawInput) {
    const entries = this.branches.get(branchId) || [];
    const input = quantizeInput(rawInput);
    if (!entries.length || !sameInput(entries.at(-1).input, input)) {
      entries.push({ input, tick: Math.max(0, Math.trunc(localTick)) });
      this.branches.set(branchId, entries);
    }
    return input;
  }

  inputAt(branchId, localTick) {
    const entries = this.branches.get(branchId) || [];
    let selected = null;
    for (const entry of entries) {
      if (entry.tick > localTick) break;
      selected = entry.input;
    }
    return quantizeInput(selected || {});
  }

  export() {
    return [...this.branches.entries()].map(([branchId, entries]) => ({
      branchId,
      entries: structuredClone(entries),
    }));
  }

  load(payload = []) {
    this.branches.clear();
    for (const branch of payload) {
      this.branches.set(branch.branchId, structuredClone(branch.entries || []).sort((a, b) => a.tick - b.tick));
    }
    return this;
  }
}
