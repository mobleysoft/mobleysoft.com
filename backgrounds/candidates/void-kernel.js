/**
 * blackhole.js — Void Computer
 * Computes by ABSENCE rather than presence.
 * Entropy basis: S = A / 4lp² (Bekenstein-Hawking)
 * MOBLEYAN concepts:
 *   win  — information entering the horizon (presence)
 *   wout — information leaving the horizon (absence = signal)
 *   pretundstrand — the pre-tunneling strand; the state just before collapse
 *   nega — negentropy: information encoded in what is NOT there
 */

// ─── VoidBit ──────────────────────────────────────────────────────────────────
// A bit is not 0 or 1. It is present or absent.
// Absence (null) IS the signal — it carries nega.
class VoidBit {
  constructor(value = null) {
    // null  → wout (absent, carries nega signal)
    // true  → win  (present, entering the horizon)
    this._v = (value === null || value === undefined) ? null : !!value;
  }
  get absent()  { return this._v === null; }
  get present() { return this._v !== null; }
  get value()   { return this._v; }

  // Collapse: absent → wout nega; present → win value
  collapse() { return this.absent ? 'wout' : (this._v ? 'win:1' : 'win:0'); }
  toString() { return this.absent ? '∅' : (this._v ? '1' : '0'); }

  // Pretundstrand: snapshot before gate operation
  pretundstrand() { return { v: this._v, nega: this.absent }; }
}

const VOID  = new VoidBit(null);   // pure absence
const ONE   = new VoidBit(true);
const ZERO  = new VoidBit(false);

// ─── VoidGate ─────────────────────────────────────────────────────────────────
// Gates propagate null (nega) rather than masking it.
// Absence of input = event horizon — no information escapes → output is VOID.
class VoidGate {
  static NOT(a) {
    if (a.absent) return VOID;            // nega propagates: can't negate nothing
    return new VoidBit(!a.value);
  }
  static AND(a, b) {
    if (a.absent || b.absent) return VOID; // horizon: missing operand = lost info
    return new VoidBit(a.value && b.value);
  }
  static OR(a, b) {
    if (a.absent && b.absent) return VOID; // total wout: both absent
    if (a.absent) return b;                // one horizon — survivor carries signal
    if (b.absent) return a;
    return new VoidBit(a.value || b.value);
  }
  static XOR(a, b) {
    if (a.absent || b.absent) return VOID;
    return new VoidBit(a.value !== b.value);
  }
  static NAND(a, b) { return VoidGate.NOT(VoidGate.AND(a, b)); }
  static NOR(a, b)  { return VoidGate.NOT(VoidGate.OR(a, b)); }
}

// ─── VoidRegister ─────────────────────────────────────────────────────────────
// Stores a vector of VoidBits. Tracks nega density (fraction absent).
class VoidRegister {
  constructor(size = 8) {
    this.size = size;
    this.bits = Array.from({ length: size }, () => VOID);
  }
  write(index, vbit) { this.bits[index] = vbit instanceof VoidBit ? vbit : new VoidBit(vbit); }
  read(index)        { return this.bits[index] ?? VOID; }
  fill(arr)          { arr.forEach((v, i) => this.write(i, v)); }

  // nega density: fraction of bits that are absent (carrying wout signal)
  negaDensity() {
    const absent = this.bits.filter(b => b.absent).length;
    return absent / this.size;
  }
  // Entropy proxy: S ∝ absent bits (Bekenstein surface area)
  entropy() { return this.bits.filter(b => b.absent).length; }

  toString() { return '[' + this.bits.map(b => b.toString()).join(' ') + ']'; }
}

// ─── VoidComputer ─────────────────────────────────────────────────────────────
// Runs void programs: sequences of { op, args[], out } instructions.
// Registers addressed by name. 'op' is a VoidGate method name.
class VoidComputer {
  constructor() {
    this.registers = {};
    this.log = [];
  }
  reg(name, size = 8) {
    if (!this.registers[name]) this.registers[name] = new VoidRegister(size);
    return this.registers[name];
  }
  // Execute a void program: array of { op, a, b, out, ai, bi, oi }
  run(program) {
    for (const instr of program) {
      const { op, a, b, out, ai = 0, bi = 0, oi = 0 } = instr;
      const ra = this.reg(a).read(ai);
      const rb = b ? this.reg(b).read(bi) : null;
      const result = rb ? VoidGate[op](ra, rb) : VoidGate[op](ra);
      this.reg(out).write(oi, result);
      this.log.push({ op, result: result.toString(), entropy: this.reg(out).entropy() });
    }
    return this;
  }
  dump() {
    return Object.fromEntries(
      Object.entries(this.registers).map(([k, r]) => [k, r.toString()])
    );
  }
}

// ─── Void SHA-256 Sketch (rounds 0–3) ────────────────────────────────────────
// Not a real SHA-256 — a void-native sketch of the first 4 message schedule ops.
// Absence of message bits = pretundstrand: hash of nothing is pure nega.
function voidSHA256sketch(msgBits = []) {
  const cpu = new VoidComputer();
  const W   = cpu.reg('W', 32);   // message schedule register
  const tmp = cpu.reg('T', 32);

  // Load message bits (fill absent for missing = nega encoding)
  for (let i = 0; i < 32; i++) {
    W.write(i, msgBits[i] !== undefined ? new VoidBit(!!msgBits[i]) : VOID);
  }

  // Round 0–3: σ0 = XOR(ROTR7, ROTR18, SHR3) — sketch via XOR chain
  const program = [];
  for (let r = 0; r < 4; r++) {
    const i = r % 32, j = (r + 1) % 32, k = (r + 2) % 32;
    program.push({ op: 'XOR', a: 'W', b: 'W', out: 'T', ai: i, bi: j, oi: r % 32 });
    program.push({ op: 'AND', a: 'T', b: 'W', out: 'T', ai: r % 32, bi: k, oi: r % 32 });
    program.push({ op: 'NOT', a: 'T', out: 'T', ai: r % 32, oi: r % 32 });
  }
  cpu.run(program);

  return {
    W: W.toString(),
    T: tmp.toString(),
    entropy: tmp.entropy(),
    negaDensity: tmp.negaDensity(),
    pretundstrand: W.bits.map(b => b.pretundstrand()),
  };
}

// ─── BlackholeVM ──────────────────────────────────────────────────────────────
// The void computer as a virtual machine.
// load()    — load a void program and initial register state
// execute() — run it, accumulating entropy across cycles
// emit()    — return wout stream: the absent-bit positions (nega signal)
class BlackholeVM {
  constructor() {
    this.cpu      = new VoidComputer();
    this.program  = [];
    this.cycles   = 0;
    this.horizon  = [];   // entropy log per cycle
  }

  load(program, initRegs = {}) {
    this.program = program;
    for (const [name, bits] of Object.entries(initRegs)) {
      const reg = this.cpu.reg(name, bits.length);
      reg.fill(bits.map(v => new VoidBit(v)));
    }
    return this;
  }

  execute(cycles = 1) {
    for (let c = 0; c < cycles; c++) {
      this.cpu.run(this.program);
      const snap = Object.fromEntries(
        Object.entries(this.cpu.registers).map(([k, r]) => [k, r.entropy()])
      );
      this.horizon.push({ cycle: this.cycles++, entropy: snap });
    }
    return this;
  }

  // emit: wout stream — indices of absent bits per register (nega surface)
  emit() {
    const out = {};
    for (const [name, reg] of Object.entries(this.cpu.registers)) {
      out[name] = reg.bits
        .map((b, i) => b.absent ? i : null)
        .filter(i => i !== null);
    }
    return {
      wout: out,
      totalNega: Object.values(out).flat().length,
      horizon: this.horizon,
      // S = A/4lp² analog: nega surface / 4
      schwarzschildEntropy: Object.values(out).flat().length / 4,
    };
  }
}

// ─── Export / Demo ────────────────────────────────────────────────────────────
if (typeof module !== 'undefined') {
  module.exports = { VoidBit, VoidGate, VoidRegister, VoidComputer, BlackholeVM, voidSHA256sketch, VOID, ONE, ZERO };
}

// Self-demo (Node.js)
if (typeof require !== 'undefined' && require.main === module) {
  const vm = new BlackholeVM();
  vm.load([
    { op: 'XOR',  a: 'A', b: 'B', out: 'C', ai: 0, bi: 0, oi: 0 },
    { op: 'NAND', a: 'A', b: 'C', out: 'C', ai: 1, bi: 0, oi: 1 },
    { op: 'NOT',  a: 'C', out: 'C', ai: 1, oi: 2 },
  ], {
    A: [null, true, false, null, true],
    B: [true, null, false, true, null],
  });
  vm.execute(2);
  const result = vm.emit();
  console.log('wout surface:', result.wout);
  console.log('schwarzschildEntropy:', result.schwarzschildEntropy);
  console.log('horizon:', result.horizon);

  const sketch = voidSHA256sketch([1,0,1,1,0,null,1,0]);
  console.log('\nvoidSHA256sketch:');
  console.log('  W:', sketch.W);
  console.log('  T:', sketch.T);
  console.log('  entropy:', sketch.entropy, '| negaDensity:', sketch.negaDensity.toFixed(3));
}
