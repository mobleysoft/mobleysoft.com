(() => {
  "use strict";

  const canvas = document.getElementById("encounter-canvas");
  if (!canvas || !window.THREE) {
    console.warn("The anomaly encounter requires its own canvas and Three.js r128.");
    return;
  }

  const THREE = window.THREE;
  const compact = window.matchMedia("(max-width: 720px)");
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(64, innerWidth / innerHeight, 0.1, 1400);
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: !compact.matches,
    canvas,
    powerPreference: "high-performance",
  });
  const input = { x: 0, y: 0, targetX: 0, targetY: 0, keys: new Set() };
  const beams = [];
  const bursts = [];
  const surveyPulses = [];
  const foamCells = [];
  const state = {
    branchOrder: 0,
    coherence: 100,
    elapsed: 0,
    frame: 0,
    hostiles: 0,
    hull: 100,
    last: 0,
    location: "ANOMALY / EXTERIOR",
    mission: "WARM-IN READY",
    nextEnemyShot: Infinity,
    phase: "exterior",
    phaseElapsed: 0,
    playing: false,
    probeMessageUntil: 0,
    scanProgress: 0,
    started: false,
  };
  let lastBackgroundTap = 0;
  let seed = 0x4d4f424c;

  function random() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  }

  function clamp01(value) {
    return Math.max(0, Math.min(1, value));
  }

  function ease(value) {
    const x = clamp01(value);
    return x * x * (3 - 2 * x);
  }

  renderer.setClearColor(0x000000, 0);
  renderer.outputEncoding = THREE.sRGBEncoding;
  camera.position.set(0, 10, 92);
  camera.lookAt(0, 0, -180);

  function makeGlowTexture() {
    const glowCanvas = document.createElement("canvas");
    glowCanvas.width = 128;
    glowCanvas.height = 128;
    const context = glowCanvas.getContext("2d");
    const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, "rgba(255, 244, 206, 1)");
    gradient.addColorStop(0.18, "rgba(84, 232, 255, .86)");
    gradient.addColorStop(0.5, "rgba(22, 88, 120, .24)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(glowCanvas);
  }

  const glowTexture = makeGlowTexture();

  function createHullGeometry() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute([
      0, 0, -16,
      0, 2.2, 2,
      -3.2, -1.1, 8,
      3.2, -1.1, 8,
      0, -2.2, 4,
    ], 3));
    geometry.setIndex([
      0, 1, 2,
      0, 3, 1,
      0, 2, 4,
      0, 4, 3,
      1, 3, 2,
      2, 3, 4,
    ]);
    geometry.computeVertexNormals();
    return geometry;
  }

  function createWingGeometry(width = 17) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute([
      -2.2, -0.4, -1,
      -width, -0.7, 8,
      -3.2, -0.8, 7,
      2.2, -0.4, -1,
      3.2, -0.8, 7,
      width, -0.7, 8,
    ], 3));
    geometry.computeVertexNormals();
    return geometry;
  }

  function createShip({ hull, accent, scale = 1, enemy = false }) {
    const ship = new THREE.Group();
    const hullMaterial = new THREE.MeshPhongMaterial({
      color: hull,
      flatShading: true,
      shininess: 18,
      side: THREE.DoubleSide,
    });
    const accentMaterial = new THREE.MeshBasicMaterial({
      color: accent,
      opacity: 0.9,
      transparent: true,
    });
    const hullGeometry = createHullGeometry();
    const wingGeometry = createWingGeometry(enemy ? 13 : 17);
    ship.add(new THREE.Mesh(hullGeometry, hullMaterial));
    ship.add(new THREE.Mesh(wingGeometry, hullMaterial));
    ship.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(wingGeometry, 12),
      new THREE.LineBasicMaterial({ color: accent, opacity: 0.78, transparent: true }),
    ));

    const cockpit = new THREE.Mesh(new THREE.OctahedronGeometry(1.55, 0), accentMaterial);
    cockpit.scale.set(0.8, 0.55, 1.8);
    cockpit.position.set(0, 1.6, -2.2);
    ship.add(cockpit);

    [-1.35, 1.35].forEach((x) => {
      const engine = new THREE.Sprite(new THREE.SpriteMaterial({
        blending: THREE.AdditiveBlending,
        color: enemy ? 0xff4028 : 0x55e8ff,
        depthWrite: false,
        map: glowTexture,
        opacity: 0.92,
        transparent: true,
      }));
      engine.position.set(x, -0.45, 8.4);
      engine.scale.set(6.5, 6.5, 1);
      ship.add(engine);
    });

    ship.scale.setScalar(scale);
    ship.userData = { alive: true, baseScale: scale, enemy, flash: 0, hull: enemy ? 2 : 100 };
    return ship;
  }

  const player = createShip({ hull: 0x172530, accent: 0xf2b13e, scale: 0.92 });
  player.name = "Mobleysoft Survey Craft";
  scene.add(player);

  const warmIn = new THREE.Mesh(
    new THREE.RingGeometry(5.4, 6.1, 20),
    new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color: 0x65efff,
      depthWrite: false,
      opacity: 0,
      side: THREE.DoubleSide,
      transparent: true,
    }),
  );
  warmIn.position.z = 12;
  warmIn.visible = false;
  player.add(warmIn);

  const scanGroup = new THREE.Group();
  const scanRings = [0, 1, 2].map((index) => {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(11.7, 12.25, 64),
      new THREE.MeshBasicMaterial({
        blending: THREE.AdditiveBlending,
        color: index === 1 ? 0xf2b13e : 0x5eead4,
        depthWrite: false,
        opacity: 0,
        side: THREE.DoubleSide,
        transparent: true,
      }),
    );
    ring.position.set(0, -2, -116 - index * 2);
    ring.userData.offset = index / 3;
    scanGroup.add(ring);
    return ring;
  });
  scene.add(scanGroup);

  const boundaryGroup = new THREE.Group();
  const boundaryFrame = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.OctahedronGeometry(43, 1)),
    new THREE.LineBasicMaterial({ color: 0x68efff, opacity: 0.22, transparent: true }),
  );
  boundaryFrame.scale.set(1.35, 0.72, 1);
  boundaryGroup.add(boundaryFrame);
  [0, 1, 2].forEach((index) => {
    const gate = new THREE.Mesh(
      new THREE.TorusGeometry(36 + index * 7, 0.2, 4, 72),
      new THREE.MeshBasicMaterial({
        blending: THREE.AdditiveBlending,
        color: index === 1 ? 0xf2b13e : 0x5eead4,
        opacity: 0.13,
        transparent: true,
      }),
    );
    gate.position.z = -index * 7;
    boundaryGroup.add(gate);
  });
  boundaryGroup.position.set(0, -2, -150);
  boundaryGroup.visible = false;
  scene.add(boundaryGroup);

  const crossingGroup = new THREE.Group();
  const crossingRings = [];
  for (let index = 0; index < 14; index += 1) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(22 + index * 3.2, 0.22, 4, 48),
      new THREE.MeshBasicMaterial({
        blending: THREE.AdditiveBlending,
        color: index % 3 === 0 ? 0xf2b13e : 0x63dff2,
        opacity: 0.12,
        transparent: true,
      }),
    );
    ring.position.z = -35 - index * 38;
    ring.rotation.z = index * 0.31;
    crossingGroup.add(ring);
    crossingRings.push(ring);
  }
  crossingGroup.visible = false;
  scene.add(crossingGroup);

  const interiorGroup = new THREE.Group();
  const foamPositions = [];
  for (let index = 0; index < 28; index += 1) {
    const radius = 9 + random() * 29;
    const position = new THREE.Vector3(
      (random() - 0.5) * 250,
      (random() - 0.5) * 125,
      -90 - random() * 980,
    );
    const material = new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color: index % 5 === 0 ? 0xf3b94f : (index % 2 === 0 ? 0x5eead4 : 0x4888ba),
      depthWrite: false,
      opacity: 0.08 + random() * 0.08,
      transparent: true,
      wireframe: true,
    });
    const cell = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 1), material);
    cell.position.copy(position);
    cell.userData = {
      baseOpacity: material.opacity,
      basePosition: position.clone(),
      drift: 0.08 + random() * 0.2,
      phase: random() * Math.PI * 2,
      spin: (random() - 0.5) * 0.12,
    };
    foamCells.push(cell);
    foamPositions.push(position);
    interiorGroup.add(cell);
  }

  const connectorPoints = [];
  foamPositions.forEach((position, index) => {
    let nearest = null;
    let nearestDistance = Infinity;
    foamPositions.forEach((candidate, candidateIndex) => {
      if (candidateIndex === index) return;
      const distance = position.distanceToSquared(candidate);
      if (distance < nearestDistance) {
        nearest = candidate;
        nearestDistance = distance;
      }
    });
    if (nearest && nearestDistance < 65000) connectorPoints.push(position, nearest);
  });
  const connectorGeometry = new THREE.BufferGeometry().setFromPoints(connectorPoints);
  interiorGroup.add(new THREE.LineSegments(
    connectorGeometry,
    new THREE.LineBasicMaterial({
      blending: THREE.AdditiveBlending,
      color: 0x47798d,
      opacity: 0.12,
      transparent: true,
    }),
  ));

  const interiorStars = new Float32Array((compact.matches ? 340 : 900) * 3);
  for (let index = 0; index < interiorStars.length; index += 3) {
    interiorStars[index] = (random() - 0.5) * 520;
    interiorStars[index + 1] = (random() - 0.5) * 260;
    interiorStars[index + 2] = -40 - random() * 1250;
  }
  const interiorStarGeometry = new THREE.BufferGeometry();
  interiorStarGeometry.setAttribute("position", new THREE.BufferAttribute(interiorStars, 3));
  interiorGroup.add(new THREE.Points(
    interiorStarGeometry,
    new THREE.PointsMaterial({
      blending: THREE.AdditiveBlending,
      color: 0x88dce4,
      depthWrite: false,
      opacity: 0.36,
      size: 0.72,
      transparent: true,
    }),
  ));
  interiorGroup.visible = false;
  scene.add(interiorGroup);

  const enemies = [
    createShip({ hull: 0x351018, accent: 0xff4b35, scale: 0.48, enemy: true }),
    createShip({ hull: 0x271018, accent: 0xff7452, scale: 0.44, enemy: true }),
    createShip({ hull: 0x2c1111, accent: 0xff352e, scale: 0.4, enemy: true }),
  ];
  enemies.forEach((enemy, index) => {
    enemy.name = `Causal Antibody ${index + 1}`;
    enemy.userData.phase = index * 2.07 + 0.4;
    enemy.userData.depth = -150 - index * 58;
    enemy.visible = false;
    scene.add(enemy);
  });

  scene.add(new THREE.AmbientLight(0x233244, 0.92));
  const keyLight = new THREE.DirectionalLight(0xffc46a, 1.25);
  keyLight.position.set(80, 90, 120);
  scene.add(keyLight);

  const hud = document.createElement("section");
  hud.className = "encounter-hud";
  hud.setAttribute("aria-live", "polite");
  hud.innerHTML = `
    <div class="encounter-ident"><span id="encounter-location">ANOMALY / EXTERIOR</span><strong id="encounter-mission">WARM-IN READY</strong></div>
    <dl>
      <div><dt>Hull</dt><dd id="encounter-hull">100</dd></div>
      <div><dt>Coherence</dt><dd id="encounter-coherence">100</dd></div>
      <div><dt>Branch model</dt><dd id="encounter-branches">-</dd></div>
      <div><dt>Contacts</dt><dd id="encounter-hostiles">0</dd></div>
    </dl>
    <div class="encounter-scan"><span>Foam-model confidence</span><i><b id="encounter-scan-meter"></b></i><strong id="encounter-scan">0%</strong></div>
    <p id="encounter-guidance">Space emits a survey pulse / Pointer or WASD to steer</p>
  `;
  document.body.appendChild(hud);
  const branchOutput = hud.querySelector("#encounter-branches");
  const coherenceOutput = hud.querySelector("#encounter-coherence");
  const guidanceOutput = hud.querySelector("#encounter-guidance");
  const hostileOutput = hud.querySelector("#encounter-hostiles");
  const hullOutput = hud.querySelector("#encounter-hull");
  const locationOutput = hud.querySelector("#encounter-location");
  const missionOutput = hud.querySelector("#encounter-mission");
  const scanMeter = hud.querySelector("#encounter-scan-meter");
  const scanOutput = hud.querySelector("#encounter-scan");

  function emitState() {
    window.dispatchEvent(new CustomEvent("mobley:encounter-state", {
      detail: {
        branchOrder: state.branchOrder,
        coherence: state.coherence,
        elapsed: state.elapsed,
        hostiles: state.hostiles,
        hull: state.hull,
        location: state.location,
        mission: state.mission,
        phase: state.phase,
        playing: state.playing,
        scanProgress: state.scanProgress,
      },
    }));
  }

  function updateHud() {
    const scanPercent = Math.round(state.scanProgress * 100);
    branchOutput.textContent = state.branchOrder > 0 ? `10^${state.branchOrder}` : "-";
    coherenceOutput.textContent = String(Math.max(0, Math.round(state.coherence)));
    hostileOutput.textContent = String(state.hostiles);
    hullOutput.textContent = String(Math.max(0, Math.round(state.hull)));
    locationOutput.textContent = state.location;
    missionOutput.textContent = state.mission;
    scanMeter.style.width = `${scanPercent}%`;
    scanOutput.textContent = `${scanPercent}%`;
    hud.classList.toggle("is-critical", state.hull <= 30 || state.coherence <= 35);
    hud.classList.toggle("is-complete", state.mission === "INTERIOR STABLE" || state.mission === "SECTOR CLEAR");
    hud.dataset.phase = state.phase;
  }

  function setMission(mission) {
    if (state.mission === mission) return;
    state.mission = mission;
    updateHud();
    emitState();
  }

  function createBeam(from, to, color, duration = 0.22) {
    const direction = to.clone().sub(from).normalize();
    const start = from.clone().add(direction.multiplyScalar(6));
    const geometry = new THREE.BufferGeometry().setFromPoints([start, to]);
    const material = new THREE.LineBasicMaterial({
      blending: THREE.AdditiveBlending,
      color,
      opacity: 0.98,
      transparent: true,
    });
    const line = new THREE.Line(geometry, material);
    scene.add(line);
    beams.push({ duration, geometry, life: duration, line, material });
  }

  function createBurst(position, color) {
    const count = 30;
    const positions = new Float32Array(count * 3);
    const velocities = [];
    for (let index = 0; index < count; index += 1) {
      velocities.push(new THREE.Vector3(
        (Math.random() - 0.5) * 24,
        (Math.random() - 0.5) * 24,
        (Math.random() - 0.5) * 24,
      ));
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      blending: THREE.AdditiveBlending,
      color,
      depthWrite: false,
      opacity: 1,
      size: 2.4,
      transparent: true,
    });
    const points = new THREE.Points(geometry, material);
    points.position.copy(position);
    scene.add(points);
    bursts.push({ geometry, life: 0.8, material, points, velocities });
  }

  function createSurveyPulse() {
    const geometry = new THREE.RingGeometry(3.4, 4.1, 64);
    const material = new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color: 0x79f3ec,
      depthWrite: false,
      opacity: 0.9,
      side: THREE.DoubleSide,
      transparent: true,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(player.position.x * 0.25, player.position.y * 0.25, -48);
    scene.add(mesh);
    surveyPulses.push({ geometry, life: 1, material, mesh });
  }

  function clearEffects() {
    beams.splice(0).forEach(({ line, material, geometry }) => {
      scene.remove(line);
      material.dispose();
      geometry.dispose();
    });
    bursts.splice(0).forEach(({ points, material, geometry }) => {
      scene.remove(points);
      material.dispose();
      geometry.dispose();
    });
    surveyPulses.splice(0).forEach(({ mesh, material, geometry }) => {
      scene.remove(mesh);
      material.dispose();
      geometry.dispose();
    });
  }

  function nearestLivingEnemy() {
    const living = enemies.filter((enemy) => enemy.userData.alive);
    if (!living.length) return null;
    return living.reduce((nearest, enemy) => (
      enemy.position.distanceToSquared(player.position) < nearest.position.distanceToSquared(player.position)
        ? enemy
        : nearest
    ), living[0]);
  }

  function setPhase(phase, silent = false) {
    if (state.phase === phase && !silent) return;
    state.phase = phase;
    state.phaseElapsed = 0;
    canvas.classList.toggle("is-crossing", phase === "crossing");
    canvas.classList.toggle("is-interior", phase === "interior");
    crossingGroup.visible = phase === "crossing";
    interiorGroup.visible = phase !== "exterior";
    scanGroup.visible = phase === "exterior";
    boundaryGroup.visible = phase !== "interior" && state.scanProgress >= 0.34;

    if (phase === "exterior") {
      renderer.setClearColor(0x000000, 0);
      state.coherence = 100;
      state.hostiles = 0;
      state.location = "ANOMALY / EXTERIOR";
      guidanceOutput.textContent = "Space emits a survey pulse / Pointer or WASD to steer";
      enemies.forEach((enemy) => { enemy.visible = false; });
    } else if (phase === "crossing") {
      state.coherence = 82;
      state.hostiles = 0;
      state.location = "CAUSAL BOUNDARY";
      state.mission = "CROSSING THE OBSERVABLE SURFACE";
      guidanceOutput.textContent = "Hold course / Control authority is phase-limited";
      enemies.forEach((enemy) => { enemy.visible = false; });
    } else {
      renderer.setClearColor(0x02070d, 1);
      state.coherence = 76;
      state.hostiles = enemies.filter((enemy) => enemy.userData.alive).length;
      state.location = "INTERIOR / FOAM MANIFOLD";
      state.mission = "MAP THE BRANCHING VACUA";
      state.nextEnemyShot = state.elapsed + 4.2;
      guidanceOutput.textContent = "WASD or pointer to steer / Space or double-tap to fire";
      enemies.forEach((enemy) => { enemy.visible = enemy.userData.alive; });
    }
    updateHud();
    if (!silent) emitState();
  }

  function fire() {
    if (!state.playing || state.mission === "HULL FAILURE" || state.mission === "SECTOR CLEAR") return false;

    if (state.phase === "exterior") {
      createSurveyPulse();
      state.scanProgress = Math.min(1, state.scanProgress + 0.13);
      state.probeMessageUntil = state.elapsed + 1.15;
      state.branchOrder = Math.max(state.branchOrder, Math.floor(state.scanProgress * 18));
      setMission("ACTIVE PROBE / RETURN MULTIPLIED");
      if (state.scanProgress >= 1) setPhase("crossing");
      updateHud();
      return true;
    }

    if (state.phase !== "interior") return false;
    const target = nearestLivingEnemy();
    if (!target) return false;
    createBeam(player.position.clone(), target.position.clone(), 0x67efff, 0.18);
    target.userData.hull -= 1;
    target.userData.flash = 0.16;
    if (target.userData.hull <= 0) {
      const burstPosition = target.position.clone();
      target.userData.alive = false;
      target.visible = false;
      state.hostiles -= 1;
      createBurst(burstPosition, 0xff8b35);
      setMission(state.hostiles === 0 ? "SECTOR CLEAR" : "CAUSAL DEFENSE DISRUPTED");
    } else {
      setMission("CONTACT DECOHERING");
    }
    updateHud();
    emitState();
    return true;
  }

  function updateInput(delta) {
    const pace = delta * 0.95;
    if (input.keys.has("KeyA")) input.targetX -= pace;
    if (input.keys.has("KeyD")) input.targetX += pace;
    if (input.keys.has("KeyW")) input.targetY += pace;
    if (input.keys.has("KeyS")) input.targetY -= pace;
    input.targetX = THREE.MathUtils.clamp(input.targetX, -1, 1);
    input.targetY = THREE.MathUtils.clamp(input.targetY, -1, 1);
    const response = state.phase === "crossing" ? 1.6 : 4.6;
    input.x += (input.targetX - input.x) * Math.min(1, delta * response);
    input.y += (input.targetY - input.y) * Math.min(1, delta * response);
  }

  function updateEffects(delta) {
    for (let index = beams.length - 1; index >= 0; index -= 1) {
      const beam = beams[index];
      beam.life -= delta;
      beam.material.opacity = Math.max(0, beam.life / beam.duration);
      if (beam.life <= 0) {
        scene.remove(beam.line);
        beam.material.dispose();
        beam.geometry.dispose();
        beams.splice(index, 1);
      }
    }
    for (let index = bursts.length - 1; index >= 0; index -= 1) {
      const burst = bursts[index];
      burst.life -= delta;
      const position = burst.geometry.attributes.position;
      burst.velocities.forEach((velocity, particleIndex) => {
        position.array[particleIndex * 3] += velocity.x * delta;
        position.array[particleIndex * 3 + 1] += velocity.y * delta;
        position.array[particleIndex * 3 + 2] += velocity.z * delta;
      });
      position.needsUpdate = true;
      burst.material.opacity = Math.max(0, burst.life / 0.8);
      if (burst.life <= 0) {
        scene.remove(burst.points);
        burst.material.dispose();
        burst.geometry.dispose();
        bursts.splice(index, 1);
      }
    }
    for (let index = surveyPulses.length - 1; index >= 0; index -= 1) {
      const pulse = surveyPulses[index];
      pulse.life -= delta;
      const progress = 1 - Math.max(0, pulse.life);
      pulse.mesh.scale.setScalar(1 + progress * 14);
      pulse.material.opacity = Math.max(0, pulse.life * 0.82);
      if (pulse.life <= 0) {
        scene.remove(pulse.mesh);
        pulse.material.dispose();
        pulse.geometry.dispose();
        surveyPulses.splice(index, 1);
      }
    }
  }

  function updateExterior(delta) {
    state.scanProgress = Math.min(1, state.scanProgress + delta / 11.5);
    state.branchOrder = Math.max(1, Math.floor(state.scanProgress * 18));
    state.coherence = 100 - state.scanProgress * 4;
    boundaryGroup.visible = state.scanProgress >= 0.34;
    boundaryGroup.rotation.z += delta * 0.07;
    boundaryFrame.rotation.x = Math.sin(state.elapsed * 0.18) * 0.12;
    boundaryFrame.rotation.y += delta * 0.1;

    scanRings.forEach((ring) => {
      const cycle = (state.elapsed * 0.23 + ring.userData.offset) % 1;
      ring.scale.setScalar(0.55 + cycle * 3.4);
      ring.material.opacity = Math.sin(cycle * Math.PI) * (0.08 + state.scanProgress * 0.2);
      ring.rotation.z = state.elapsed * 0.08;
    });

    if (state.elapsed >= state.probeMessageUntil) {
      if (state.scanProgress < 0.22) setMission("MEASURING SPECTRAL SHEAR");
      else if (state.scanProgress < 0.48) setMission("VACUUM CELLS DETECTED");
      else if (state.scanProgress < 0.76) setMission("FOAM TOPOLOGY CANDIDATE");
      else setMission("MATCHING BOUNDARY PHASE");
    }
    if (state.scanProgress >= 1) setPhase("crossing");
  }

  function updateCrossing(delta) {
    const progress = clamp01(state.phaseElapsed / 3.25);
    const opacity = ease(progress);
    renderer.setClearColor(0x02070d, opacity);
    state.coherence = 82 - Math.sin(progress * Math.PI) * 51;
    state.branchOrder = 18 + Math.floor(progress * 34);
    crossingRings.forEach((ring, index) => {
      ring.position.z += delta * (80 + index * 7);
      ring.rotation.z += delta * (index % 2 ? -0.45 : 0.45);
      if (ring.position.z > 78) ring.position.z -= 14 * 38;
      ring.material.opacity = 0.08 + Math.sin(state.phaseElapsed * 3 + index) * 0.04;
    });
    camera.position.x = Math.sin(state.phaseElapsed * 17) * (1 - progress) * 0.8;
    camera.position.y = 10 + Math.cos(state.phaseElapsed * 13) * (1 - progress) * 0.65;
    if (progress >= 1) setPhase("interior");
  }

  function updateInterior(delta) {
    state.scanProgress = 1;
    state.branchOrder = Math.min(63, Math.max(52, 52 + Math.floor(state.phaseElapsed / 2)));
    state.coherence += (94 - state.coherence) * Math.min(1, delta * 0.18);
    camera.position.x += (0 - camera.position.x) * Math.min(1, delta * 1.8);
    camera.position.y += (10 - camera.position.y) * Math.min(1, delta * 1.8);

    foamCells.forEach((cell) => {
      const { baseOpacity, basePosition, drift, phase, spin } = cell.userData;
      cell.rotation.x += delta * spin;
      cell.rotation.y -= delta * spin * 0.7;
      cell.position.y = basePosition.y + Math.sin(state.phaseElapsed * drift + phase) * 7;
      cell.position.x = basePosition.x + Math.cos(state.phaseElapsed * drift * 0.7 + phase) * 4;
      cell.material.opacity = baseOpacity * (0.72 + Math.sin(state.phaseElapsed * drift * 3 + phase) * 0.28);
    });

    enemies.forEach((enemy, index) => {
      if (!enemy.userData.alive) return;
      const phase = enemy.userData.phase;
      const radius = 43 + index * 10;
      enemy.position.set(
        Math.sin(state.phaseElapsed * (0.34 + index * 0.045) + phase) * radius,
        4 + Math.cos(state.phaseElapsed * (0.48 + index * 0.04) + phase) * (14 + index * 3),
        enemy.userData.depth + Math.sin(state.phaseElapsed * 0.63 + phase) * 28,
      );
      enemy.lookAt(player.position);
      enemy.rotateY(Math.PI);
      enemy.rotateZ(Math.sin(state.phaseElapsed * 1.2 + phase) * 0.36);
      enemy.scale.setScalar(enemy.userData.baseScale * (enemy.userData.flash > 0 ? 1.1 : 1));
      enemy.userData.flash = Math.max(0, enemy.userData.flash - delta);
    });

    if (state.phaseElapsed > 2.2 && state.mission === "MAP THE BRANCHING VACUA") {
      setMission("CAUSAL DEFENSE ACTIVE");
    }
    if (state.elapsed >= state.nextEnemyShot && state.hostiles > 0 && state.mission !== "HULL FAILURE") {
      const living = enemies.filter((enemy) => enemy.userData.alive);
      if (living.length) {
        const shooter = living[Math.floor(state.elapsed * 0.7) % living.length];
        createBeam(shooter.position.clone(), player.position.clone(), 0xff3b2f, 0.28);
        state.hull -= 4;
        setMission(state.hull <= 0 ? "HULL FAILURE" : "UNDER FIRE / CAUSAL SHEAR");
        state.nextEnemyShot = state.elapsed + 2.7 + Math.random() * 1.2;
      }
    }
  }

  function update(delta) {
    state.phaseElapsed += delta;
    updateInput(delta);

    const intro = THREE.MathUtils.clamp(state.elapsed / 3.2, 0, 1);
    const entrance = 1 - Math.pow(1 - intro, 3);
    const steerX = input.x + Math.sin(state.elapsed * 0.48) * 0.05;
    const steerY = input.y + Math.sin(state.elapsed * 0.31 + 1.2) * 0.04;
    const crossingDepth = state.phase === "crossing" ? ease(state.phaseElapsed / 3.25) * -52 : 0;
    player.position.set(
      THREE.MathUtils.lerp(24, steerX * 29, entrance),
      THREE.MathUtils.lerp(-42, -19 + steerY * 16, entrance),
      THREE.MathUtils.lerp(48, 6 + Math.sin(state.elapsed * 0.55) * 1.6 + crossingDepth, entrance),
    );
    player.rotation.z += ((-steerX * 0.58) - player.rotation.z) * Math.min(1, delta * 4);
    player.rotation.x += ((steerY * 0.14) - player.rotation.x) * Math.min(1, delta * 4);
    warmIn.visible = state.elapsed < 2.2;
    warmIn.scale.setScalar(0.35 + state.elapsed * 2.5);
    warmIn.material.opacity = Math.max(0, 0.9 - state.elapsed / 2.2);
    warmIn.rotation.z = state.elapsed * 1.4;

    if (state.phase === "exterior") updateExterior(delta);
    else if (state.phase === "crossing") updateCrossing(delta);
    else updateInterior(delta);

    updateEffects(delta);
    updateHud();
  }

  function frame(timestamp) {
    if (!state.playing) return;
    const delta = Math.min(0.05, Math.max(0, (timestamp - state.last) / 1000));
    state.last = timestamp;
    state.elapsed += delta;
    update(delta);
    camera.lookAt(0, 0, -180);
    renderer.render(scene, camera);
    state.frame = requestAnimationFrame(frame);
  }

  function reset() {
    cancelAnimationFrame(state.frame);
    state.branchOrder = 0;
    state.coherence = 100;
    state.elapsed = 0;
    state.hostiles = 0;
    state.hull = 100;
    state.last = performance.now();
    state.location = "ANOMALY / EXTERIOR";
    state.mission = "WARM-IN READY";
    state.nextEnemyShot = Infinity;
    state.phase = "exterior";
    state.phaseElapsed = 0;
    state.probeMessageUntil = 0;
    state.scanProgress = 0;
    input.x = 0;
    input.y = 0;
    input.targetX = 0;
    input.targetY = 0;
    input.keys.clear();
    clearEffects();
    player.position.set(24, -42, 48);
    player.rotation.set(0, 0, 0);
    warmIn.visible = false;
    warmIn.material.opacity = 0;
    crossingRings.forEach((ring, index) => {
      ring.position.z = -35 - index * 38;
      ring.rotation.z = index * 0.31;
    });
    enemies.forEach((enemy, index) => {
      enemy.visible = false;
      enemy.userData.alive = true;
      enemy.userData.hull = 2;
      enemy.userData.flash = 0;
      enemy.scale.setScalar(enemy.userData.baseScale);
      enemy.position.set(0, 0, -150 - index * 58);
    });
    camera.position.set(0, 10, 92);
    setPhase("exterior", true);
    renderer.clear();
    updateHud();
  }

  function play() {
    if (state.playing) return;
    if (!state.started) {
      reset();
      state.started = true;
    }
    state.playing = true;
    state.last = performance.now();
    canvas.classList.add("is-active");
    hud.classList.add("is-active");
    state.frame = requestAnimationFrame(frame);
    emitState();
  }

  function pause() {
    if (!state.playing) return;
    state.playing = false;
    cancelAnimationFrame(state.frame);
    canvas.classList.remove("is-active");
    hud.classList.remove("is-active");
    emitState();
  }

  function replay() {
    const shouldPlay = state.playing || state.started;
    state.playing = false;
    reset();
    state.started = true;
    if (shouldPlay) play();
    else emitState();
  }

  function toggle() {
    state.playing ? pause() : play();
  }

  function resize() {
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, compact.matches ? 1 : 1.25));
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    if (state.playing) renderer.render(scene, camera);
  }

  addEventListener("resize", resize, { passive: true });
  addEventListener("pointermove", (event) => {
    if (!state.playing) return;
    input.targetX = THREE.MathUtils.clamp((event.clientX / innerWidth) * 2 - 1, -1, 1);
    input.targetY = THREE.MathUtils.clamp(1 - (event.clientY / innerHeight) * 2, -1, 1);
  }, { passive: true });
  addEventListener("keydown", (event) => {
    if (/^(INPUT|TEXTAREA|BUTTON)$/.test(document.activeElement?.tagName || "")) return;
    if (["KeyW", "KeyA", "KeyS", "KeyD"].includes(event.code)) input.keys.add(event.code);
    if (event.code === "Space") {
      event.preventDefault();
      state.playing ? fire() : play();
    }
  });
  addEventListener("keyup", (event) => input.keys.delete(event.code));
  addEventListener("touchend", (event) => {
    if (event.target.closest("a, button, input, textarea, select, dialog")) return;
    const now = performance.now();
    if (now - lastBackgroundTap < 340) {
      event.preventDefault();
      state.playing ? fire() : play();
      lastBackgroundTap = 0;
      return;
    }
    lastBackgroundTap = now;
  }, { passive: false });

  window.MobleyEncounter = Object.freeze({
    fire,
    getState: () => ({ ...state }),
    pause,
    play,
    replay,
    toggle,
  });

  reset();
  resize();
  window.dispatchEvent(new CustomEvent("mobley:encounter-ready"));
})();
