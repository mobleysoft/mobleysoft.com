export function normalizeSeed(seed) {
  const normalized = Number(seed) >>> 0;
  return normalized || 0x6d2b79f5;
}

export function nextUint32(state) {
  let value = normalizeSeed(state);
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return value >>> 0;
}

export function nextRandom(world) {
  world.rngState = nextUint32(world.rngState);
  return world.rngState / 0x100000000;
}
