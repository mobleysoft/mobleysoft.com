const PRECISION = 1e9;

export function quantizeNumber(value) {
  if (!Number.isFinite(value) || Number.isInteger(value)) return value;
  return Math.round(value * PRECISION) / PRECISION;
}

export function quantizeWorld(value) {
  if (typeof value === "number") return quantizeNumber(value);
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) value[index] = quantizeWorld(value[index]);
    return value;
  }
  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) value[key] = quantizeWorld(value[key]);
  }
  return value;
}
