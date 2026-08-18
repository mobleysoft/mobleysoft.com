(() => {
  "use strict";

  const canvas = document.getElementById("blackhole-canvas");
  if (!canvas || !window.THREE) {
    console.warn("Mobleysoft blackhole runtime requires its canvas and Three.js r128.");
    return;
  }

  const THREE = window.THREE;
  const compact = window.matchMedia("(max-width: 720px)");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.1, 2400);
  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    alpha: false,
    canvas,
    powerPreference: "high-performance",
  });
  const clockState = {
    elapsed: 0,
    frame: 0,
    last: 0,
    playing: false,
    started: false,
    speed: 1,
  };
  const input = { x: 0, y: 0, targetX: 0, targetY: 0, keys: new Set() };
  const lasers = [];
  let randomState = 0x417b9edc;
  let nextEnemyShot = 2.4;
  let nextPlayerShot = 4.2;
  let hiddenWasPlaying = false;
  let lastBackgroundTap = 0;

  renderer.setClearColor(0x010205, 1);
  renderer.outputEncoding = THREE.sRGBEncoding;
  scene.fog = new THREE.FogExp2(0x010308, 0.00072);

  function random() {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 4294967296;
  }

  function resize() {
    const ratio = Math.min(devicePixelRatio || 1, compact.matches ? 1 : 1.25);
    renderer.setPixelRatio(ratio);
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderStill();
  }

  function makeGlowTexture() {
    const glowCanvas = document.createElement("canvas");
    glowCanvas.width = 128;
    glowCanvas.height = 128;
    const context = glowCanvas.getContext("2d");
    const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, "rgba(255, 217, 120, 1)");
    gradient.addColorStop(0.16, "rgba(232, 139, 35, .8)");
    gradient.addColorStop(0.45, "rgba(150, 54, 9, .24)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(glowCanvas);
  }

  const glowTexture = makeGlowTexture();

  function createStarField() {
    const count = compact.matches ? 1800 : 4200;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const color = new THREE.Color();
    for (let index = 0; index < count; index += 1) {
      const offset = index * 3;
      positions[offset] = (random() - 0.5) * 1600;
      positions[offset + 1] = (random() - 0.5) * 900;
      positions[offset + 2] = 180 - random() * 1700;
      color.setHSL(0.1 + random() * 0.07, 0.18 + random() * 0.45, 0.55 + random() * 0.35);
      colors[offset] = color.r;
      colors[offset + 1] = color.g;
      colors[offset + 2] = color.b;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return new THREE.Points(geometry, new THREE.PointsMaterial({
      color: 0xffffff,
      size: compact.matches ? 1.1 : 1.45,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.84,
      vertexColors: true,
    }));
  }

  const starField = createStarField();
  scene.add(starField);

  function createBlackhole() {
    const group = new THREE.Group();
    group.position.set(205, 58, -610);
    group.rotation.x = -0.28;

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0xe99b2e,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    glow.scale.set(510, 510, 1);
    group.add(glow);

    const disk = new THREE.Mesh(
      new THREE.RingGeometry(72, 250, 144, 8),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: { time: { value: 0 } },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec2 vUv;
          uniform float time;
          void main() {
            vec2 p = vUv - 0.5;
            float r = length(p) * 2.0;
            float a = atan(p.y, p.x);
            float body = smoothstep(0.18, 0.30, r) * (1.0 - smoothstep(0.76, 1.0, r));
            float bands = 0.38 + 0.62 * sin(r * 76.0 - time * 2.2 + a * 7.0);
            float hot = pow(max(0.0, 1.0 - r), 2.1);
            vec3 color = mix(vec3(0.34, 0.06, 0.01), vec3(1.0, 0.62, 0.12), hot + bands * 0.25);
            gl_FragColor = vec4(color, body * (0.22 + bands * 0.52));
          }
        `,
      }),
    );
    disk.scale.y = 0.32;
    group.add(disk);

    const horizon = new THREE.Mesh(
      new THREE.IcosahedronGeometry(71, 3),
      new THREE.MeshBasicMaterial({ color: 0x000000 }),
    );
    horizon.position.z = 4;
    group.add(horizon);

    const particleCount = compact.matches ? 2200 : 7600;
    const particlePositions = new Float32Array(particleCount * 3);
    for (let index = 0; index < particleCount; index += 1) {
      const offset = index * 3;
      const angle = random() * Math.PI * 2;
      const radius = 78 + Math.pow(random(), 0.62) * 245;
      particlePositions[offset] = Math.cos(angle) * radius;
      particlePositions[offset + 1] = Math.sin(angle) * radius * (0.24 + random() * 0.08);
      particlePositions[offset + 2] = (random() - 0.5) * 24;
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
    const particles = new THREE.Points(particleGeometry, new THREE.PointsMaterial({
      color: 0xf0a62d,
      size: compact.matches ? 1.2 : 1.55,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    particles.scale.y = 0.36;
    group.add(particles);
    group.userData = { disk, particles };
    return group;
  }

  const blackhole = createBlackhole();
  scene.add(blackhole);

  function wingGeometry() {
    const vertices = new Float32Array([
      0, 0, -6, -13, 0, 7, -2, 0, 5,
      0, 0, -6, 13, 0, 7, 2, 0, 5,
      -2, 0, 4, -7, 5, 8, -2, 0, 8,
      2, 0, 4, 7, 5, 8, 2, 0, 8,
    ]);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    return geometry;
  }

  function createShip({ hull, accent, scale = 1, enemy = false }) {
    const ship = new THREE.Group();
    const hullMaterial = new THREE.MeshPhongMaterial({
      color: hull,
      flatShading: true,
      shininess: 12,
      side: THREE.DoubleSide,
    });
    const accentMaterial = new THREE.MeshBasicMaterial({
      color: accent,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
    });
    const bodyGeometry = new THREE.ConeGeometry(3.1, 20, 4, 1, false);
    const body = new THREE.Mesh(bodyGeometry, hullMaterial);
    body.rotation.x = -Math.PI / 2;
    ship.add(body);

    const wings = new THREE.Mesh(wingGeometry(), hullMaterial);
    wings.position.y = -0.5;
    ship.add(wings);

    const wingEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(wingGeometry(), 18),
      new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 0.72 }),
    );
    wingEdges.position.y = -0.42;
    ship.add(wingEdges);

    const cockpit = new THREE.Mesh(new THREE.IcosahedronGeometry(1.75, 1), accentMaterial);
    cockpit.scale.set(0.8, 0.58, 1.8);
    cockpit.position.set(0, 1.45, -1.8);
    ship.add(cockpit);

    [-1.35, 1.35].forEach((x) => {
      const engine = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexture,
        color: enemy ? 0xff4028 : 0x55e8ff,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }));
      engine.position.set(x, -0.15, 10.2);
      engine.scale.set(7, 7, 1);
      ship.add(engine);
    });
    ship.scale.setScalar(scale);
    ship.userData.enemy = enemy;
    return ship;
  }

  const player = createShip({ hull: 0x172530, accent: 0xf2b13e, scale: 1.12 });
  const warpAperture = new THREE.Mesh(
    new THREE.RingGeometry(4.5, 5.4, 12),
    new THREE.MeshBasicMaterial({
      color: 0x65efff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  warpAperture.position.z = 12;
  warpAperture.visible = false;
  player.add(warpAperture);
  scene.add(player);

  const enemies = [
    createShip({ hull: 0x351018, accent: 0xff4b35, scale: 0.72, enemy: true }),
    createShip({ hull: 0x271018, accent: 0xff7452, scale: 0.62, enemy: true }),
    createShip({ hull: 0x2c1111, accent: 0xff352e, scale: 0.56, enemy: true }),
  ];
  enemies.forEach((enemy, index) => {
    enemy.userData.phase = index * 2.07 + 0.4;
    enemy.userData.depth = -105 - index * 56;
    scene.add(enemy);
  });

  scene.add(new THREE.AmbientLight(0x233244, 0.82));
  const keyLight = new THREE.DirectionalLight(0xffc46a, 1.15);
  keyLight.position.set(180, 120, 80);
  scene.add(keyLight);

  function createLaser(from, to, color, duration = 0.24) {
    const direction = to.clone().sub(from).normalize();
    const start = from.clone().add(direction.multiplyScalar(6));
    const end = start.clone().lerp(to, 0.76);
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.96,
      blending: THREE.AdditiveBlending,
    });
    const line = new THREE.Line(geometry, material);
    scene.add(line);
    lasers.push({ line, material, geometry, life: duration, duration });
  }

  function clearLasers() {
    lasers.splice(0).forEach(({ line, material, geometry }) => {
      scene.remove(line);
      material.dispose();
      geometry.dispose();
    });
  }

  function firePlayer() {
    if (!clockState.playing || !enemies.length) return;
    const target = enemies.reduce((nearest, enemy) => (
      enemy.position.distanceToSquared(player.position) < nearest.position.distanceToSquared(player.position)
        ? enemy
        : nearest
    ), enemies[0]);
    createLaser(player.position, target.position, 0x67efff, 0.18);
  }

  function updateInput(delta) {
    const pace = delta * 0.95;
    if (input.keys.has("KeyA")) input.targetX -= pace;
    if (input.keys.has("KeyD")) input.targetX += pace;
    if (input.keys.has("KeyW")) input.targetY += pace;
    if (input.keys.has("KeyS")) input.targetY -= pace;
    input.targetX = THREE.MathUtils.clamp(input.targetX, -1, 1);
    input.targetY = THREE.MathUtils.clamp(input.targetY, -1, 1);
    input.x += (input.targetX - input.x) * Math.min(1, delta * 4.6);
    input.y += (input.targetY - input.y) * Math.min(1, delta * 4.6);
  }

  function updateEncounter(delta) {
    const time = clockState.elapsed;
    const intro = THREE.MathUtils.clamp(time / 4.2, 0, 1);
    const entrance = 1 - Math.pow(1 - intro, 3);
    updateInput(delta);

    const autopilotX = Math.sin(time * 0.48) * 0.18;
    const autopilotY = Math.sin(time * 0.31 + 1.2) * 0.12;
    const steerX = input.x + autopilotX;
    const steerY = input.y + autopilotY;
    player.position.set(
      THREE.MathUtils.lerp(24, steerX * 32, entrance),
      THREE.MathUtils.lerp(-46, -5 + steerY * 19, entrance),
      THREE.MathUtils.lerp(42, 12 + Math.sin(time * 0.55) * 2, entrance),
    );
    player.rotation.z += ((-steerX * 0.62) - player.rotation.z) * Math.min(1, delta * 4);
    player.rotation.x += ((steerY * 0.16) - player.rotation.x) * Math.min(1, delta * 4);
    warpAperture.visible = time < 2.25;
    warpAperture.scale.setScalar(0.35 + time * 2.7);
    warpAperture.material.opacity = Math.max(0, 0.92 - time / 2.3);
    warpAperture.rotation.z = time * 1.4;

    enemies.forEach((enemy, index) => {
      const phase = enemy.userData.phase;
      const radius = 48 + index * 11;
      enemy.position.set(
        Math.sin(time * (0.42 + index * 0.045) + phase) * radius,
        7 + Math.cos(time * (0.56 + index * 0.04) + phase) * (18 + index * 4),
        enemy.userData.depth + Math.sin(time * 0.73 + phase) * 35,
      );
      enemy.lookAt(player.position);
      enemy.rotateY(Math.PI);
      enemy.rotateZ(Math.sin(time * 1.4 + phase) * 0.48);
    });

    if (time >= nextEnemyShot && intro > 0.62) {
      const shooter = enemies[Math.floor(time * 0.7) % enemies.length];
      createLaser(shooter.position, player.position, 0xff3b2f, 0.28);
      nextEnemyShot = time + 0.74 + random() * 0.7;
    }
    if (time >= nextPlayerShot && intro > 0.88) {
      firePlayer();
      nextPlayerShot = time + 1.25;
    }

    for (let index = lasers.length - 1; index >= 0; index -= 1) {
      const laser = lasers[index];
      laser.life -= delta;
      laser.material.opacity = Math.max(0, laser.life / laser.duration);
      if (laser.life <= 0) {
        scene.remove(laser.line);
        laser.material.dispose();
        laser.geometry.dispose();
        lasers.splice(index, 1);
      }
    }

    const cameraTarget = new THREE.Vector3(
      player.position.x * 0.42,
      player.position.y + 10,
      player.position.z + 38,
    );
    camera.position.lerp(cameraTarget, Math.min(1, delta * 2.2));
    camera.lookAt(player.position.x * 0.22, player.position.y + 1, player.position.z - 105);
    starField.position.z = (time * 8) % 260;
    blackhole.userData.disk.material.uniforms.time.value = time;
    blackhole.userData.particles.rotation.z = time * 0.018;
    blackhole.rotation.z = Math.sin(time * 0.08) * 0.035;
  }

  function renderStill() {
    if (clockState.playing) return;
    renderer.render(scene, camera);
  }

  function frame(timestamp) {
    if (!clockState.playing) return;
    const delta = Math.min(0.05, Math.max(0, (timestamp - clockState.last) / 1000)) * clockState.speed;
    clockState.last = timestamp;
    clockState.elapsed += delta;
    updateEncounter(delta);
    renderer.render(scene, camera);
    clockState.frame = requestAnimationFrame(frame);
  }

  function emitState() {
    window.dispatchEvent(new CustomEvent("mobley:blackhole-state", {
      detail: {
        elapsed: clockState.elapsed,
        playing: clockState.playing,
        release: "blackhole-a-20260522",
        speed: clockState.speed,
      },
    }));
  }

  function resetEncounter() {
    cancelAnimationFrame(clockState.frame);
    clockState.elapsed = 0;
    clockState.last = performance.now();
    randomState = 0x417b9edc;
    nextEnemyShot = 2.4;
    nextPlayerShot = 4.2;
    input.x = 0;
    input.y = 0;
    input.targetX = 0;
    input.targetY = 0;
    clearLasers();
    player.position.set(24, -46, 42);
    player.rotation.set(0, 0, 0);
    warpAperture.visible = false;
    warpAperture.material.opacity = 0;
    camera.position.set(0, 12, 78);
    camera.lookAt(0, -5, -110);
    blackhole.userData.disk.material.uniforms.time.value = 0;
    blackhole.userData.particles.rotation.z = 0;
    renderer.render(scene, camera);
  }

  function play() {
    if (clockState.playing) return;
    if (!clockState.started) {
      resetEncounter();
      clockState.started = true;
    }
    clockState.playing = true;
    clockState.last = performance.now();
    clockState.frame = requestAnimationFrame(frame);
    emitState();
  }

  function pause() {
    if (!clockState.playing) return;
    clockState.playing = false;
    cancelAnimationFrame(clockState.frame);
    emitState();
  }

  function replay() {
    const shouldPlay = clockState.playing || clockState.started;
    clockState.playing = false;
    resetEncounter();
    clockState.started = true;
    if (shouldPlay) play();
    else emitState();
  }

  function toggle() {
    clockState.playing ? pause() : play();
  }

  function setSpeed(speed) {
    clockState.speed = THREE.MathUtils.clamp(Number(speed) || 1, 0.25, 2);
    emitState();
  }

  addEventListener("resize", resize, { passive: true });
  addEventListener("pointermove", (event) => {
    if (!clockState.playing) return;
    input.targetX = THREE.MathUtils.clamp((event.clientX / innerWidth) * 2 - 1, -1, 1);
    input.targetY = THREE.MathUtils.clamp(1 - (event.clientY / innerHeight) * 2, -1, 1);
  }, { passive: true });
  addEventListener("keydown", (event) => {
    if (/^(INPUT|TEXTAREA|BUTTON)$/.test(document.activeElement?.tagName || "")) return;
    if (["KeyW", "KeyA", "KeyS", "KeyD"].includes(event.code)) input.keys.add(event.code);
    if (event.code === "Space") {
      event.preventDefault();
      clockState.playing ? firePlayer() : play();
    }
  });
  addEventListener("keyup", (event) => input.keys.delete(event.code));
  addEventListener("touchend", (event) => {
    if (event.target.closest("a, button, input, textarea, select, dialog")) return;
    const now = performance.now();
    if (now - lastBackgroundTap < 340) {
      event.preventDefault();
      clockState.playing ? firePlayer() : play();
      lastBackgroundTap = 0;
      return;
    }
    lastBackgroundTap = now;
  }, { passive: false });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      hiddenWasPlaying = clockState.playing;
      pause();
    } else if (hiddenWasPlaying) {
      hiddenWasPlaying = false;
      play();
    }
  });

  window.MobleyBlackhole = {
    fire: firePlayer,
    getState: () => ({ ...clockState }),
    pause,
    play,
    release: "blackhole-a-20260522",
    replay,
    setSpeed,
    toggle,
  };

  resize();
  resetEncounter();
  if (reducedMotion.matches) renderer.setPixelRatio(1);
  window.dispatchEvent(new CustomEvent("mobley:blackhole-ready", {
    detail: { release: window.MobleyBlackhole.release },
  }));
})();
