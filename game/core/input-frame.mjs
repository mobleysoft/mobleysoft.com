import { clamp } from "../engine/math.mjs";

export const EMPTY_INPUT = Object.freeze({
  bank: 0,
  fire: false,
  pitch: 0,
  reverse: false,
  scan: false,
  thrust: false,
});

export function normalizeInput(input = {}) {
  return {
    bank: clamp(Number(input.bank) || 0, -1, 1),
    fire: Boolean(input.fire),
    pitch: clamp(Number(input.pitch) || 0, -1, 1),
    reverse: Boolean(input.reverse),
    scan: Boolean(input.scan),
    thrust: Boolean(input.thrust),
  };
}

export function sameInput(a, b) {
  return a.bank === b.bank
    && a.fire === b.fire
    && a.pitch === b.pitch
    && a.reverse === b.reverse
    && a.scan === b.scan
    && a.thrust === b.thrust;
}

export function quantizeInput(input) {
  const normalized = normalizeInput(input);
  return {
    ...normalized,
    bank: Math.round(normalized.bank * 10000) / 10000,
    pitch: Math.round(normalized.pitch * 10000) / 10000,
  };
}
