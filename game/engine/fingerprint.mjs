const TRANSIENT_KEYS = new Set(["commands", "events"]);

function canonicalize(value) {
  if (typeof value === "number") return Number.isInteger(value) ? value : Math.round(value * 1e9) / 1e9;
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value)
    .filter((key) => !TRANSIENT_KEYS.has(key))
    .sort()
    .map((key) => [key, canonicalize(value[key])]));
}

export function simulationSnapshot(state) {
  return canonicalize(state);
}

export function fingerprintSimulationState(state) {
  const payload = JSON.stringify(simulationSnapshot(state));
  let hash = 0x811c9dc5;
  for (let index = 0; index < payload.length; index += 1) {
    hash ^= payload.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
