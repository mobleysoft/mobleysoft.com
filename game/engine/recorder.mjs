import { quantizeInput, sameInput } from "../core/input-frame.mjs";

export class InputRecorder {
  constructor() {
    this.entries = [];
  }

  record(tick, rawInput) {
    const input = quantizeInput(rawInput);
    const previous = this.entries.at(-1)?.input;
    if (!previous || !sameInput(previous, input)) this.entries.push({ input, tick });
    return input;
  }

  inputAt(tick) {
    let selected = null;
    for (const entry of this.entries) {
      if (entry.tick > tick) break;
      selected = entry.input;
    }
    return quantizeInput(selected || {});
  }

  export() {
    return this.entries.map(({ input, tick }) => ({ input: { ...input }, tick }));
  }

  load(entries = []) {
    this.entries = entries.map(({ input, tick }) => ({
      input: quantizeInput(input),
      tick: Math.max(0, Math.trunc(Number(tick) || 0)),
    })).sort((a, b) => a.tick - b.tick);
    return this;
  }

  reset() {
    this.entries.length = 0;
  }
}
