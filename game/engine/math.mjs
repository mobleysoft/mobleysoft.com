export function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function length(vector) {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

export function normalize(vector, fallback = [0, 0, 0]) {
  const magnitude = length(vector);
  return magnitude > 1e-9 ? scale(vector, 1 / magnitude) : [...fallback];
}

export function scale(vector, scalar) {
  return [vector[0] * scalar, vector[1] * scalar, vector[2] * scalar];
}

export function subtract(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function clampMagnitude(vector, maximum) {
  const magnitude = length(vector);
  return magnitude > maximum ? scale(vector, maximum / magnitude) : vector;
}

export function forwardFromAttitude(attitude) {
  const cosPitch = Math.cos(attitude.pitch);
  return [
    -Math.sin(attitude.yaw) * cosPitch,
    Math.sin(attitude.pitch),
    -Math.cos(attitude.yaw) * cosPitch,
  ];
}

export function lerp(a, b, alpha) {
  return a + (b - a) * alpha;
}

export function lerpVector(a, b, alpha) {
  return [lerp(a[0], b[0], alpha), lerp(a[1], b[1], alpha), lerp(a[2], b[2], alpha)];
}
