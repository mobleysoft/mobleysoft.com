function requireFinite(value, label) {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite.`);
}

function requireVector(value, label) {
  if (!Array.isArray(value) || value.length !== 3) throw new TypeError(`${label} must contain three numbers.`);
  value.forEach((entry, index) => requireFinite(entry, `${label}[${index}]`));
}

export function validateScenario(content) {
  if (!content || content.schema !== "eventwake.scenario.v1") {
    throw new TypeError("Unsupported EVENTWAKE scenario schema.");
  }
  if (!/^[a-z0-9-]+$/.test(content.id || "")) throw new TypeError("Scenario id is invalid.");
  requireVector(content.initialCraft?.position, "initialCraft.position");
  requireVector(content.initialCraft?.velocity, "initialCraft.velocity");
  ["pitch", "roll", "yaw"].forEach((axis) => requireFinite(content.initialCraft?.attitude?.[axis], `initialCraft.attitude.${axis}`));

  const anomaly = content.anomaly || {};
  ["horizonRadius", "collisionMargin", "commitRadius", "readableRadius"].forEach((key) => requireFinite(anomaly[key], `anomaly.${key}`));
  if (!(anomaly.horizonRadius < anomaly.commitRadius && anomaly.commitRadius < anomaly.readableRadius)) {
    throw new RangeError("Anomaly radii must satisfy horizon < commit < readable.");
  }

  const discoveries = content.scan?.discoveries;
  if (!Array.isArray(discoveries) || discoveries.length === 0) throw new TypeError("Scenario requires scan discoveries.");
  let previousThreshold = -Infinity;
  const ids = new Set();
  for (const discovery of discoveries) {
    if (!/^[a-z0-9-]+$/.test(discovery.id || "") || ids.has(discovery.id)) throw new TypeError("Scan discovery ids must be unique slugs.");
    if (!discovery.observation) throw new TypeError(`Scan discovery ${discovery.id} requires an observation.`);
    requireFinite(discovery.threshold, `scan discovery ${discovery.id} threshold`);
    if (discovery.threshold <= previousThreshold) throw new RangeError("Scan discovery thresholds must be strictly increasing.");
    if (discovery.frameOffset !== undefined) {
      requireFinite(discovery.frameOffset, `scan discovery ${discovery.id} frameOffset`);
      if (discovery.frameOffset >= 0) throw new RangeError("Insertion frames must precede their discovery tick.");
    }
    if (discovery.projection) {
      if (!/^[a-z0-9-]+$/.test(discovery.projection.id || "")) throw new TypeError("Projection id is invalid.");
      requireVector(discovery.projection.position, `scan discovery ${discovery.id} projection.position`);
    }
    ids.add(discovery.id);
    previousThreshold = discovery.threshold;
  }

  return content;
}
