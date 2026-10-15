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
    kills: 0,
  };
  // Bursts (2026-10-05): a shot that lands blows the ship up - a glow sprite
  // that flares and fades - and the ship comes back from deep space. Before
  // this, firing only drew a line toward the nearest ship and nothing happened.
  const bursts = [];
  const input = { x: 0, y: 0, targetX: 0, targetY: 0, keys: new Set() };
  const lasers = [];
  let randomState = 0x417b9edc;
  let nextEnemyShot = 2.4;
  let nextPlayerShot = 4.2;
  let hiddenWasPlaying = false;

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
    originalBackground.resize();
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

  // Selected source: May 22 Three.js original, SHA-256 417b9edc…3627fe9f6d.
  // Its shaders, geometry, particle forces and camera orbit below are recovered
  // directly from backgrounds/candidates/email-threejs.js. Adapter only:
  // one existing WebGL context/RAF, a fixed 60 Hz simulation, independent seed,
  // and background-first compositing so it cannot occlude or steer the game.
  function createOriginalBackground() {
    const backgroundScene = new THREE.Scene();
    const backgroundCamera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 2000);
    let backgroundSeed = 0x417b9edc;
    function backgroundRandom() {
      backgroundSeed = (Math.imul(backgroundSeed, 1664525) + 1013904223) >>> 0;
      return backgroundSeed / 4294967296;
    }
const c = 1, G = 1, M = 50;
const Rs = 2 * G * M / (c * c);

const diskGeometry = new THREE.PlaneGeometry(Rs * 10, Rs * 10, 100, 100);
const diskMaterial = new THREE.ShaderMaterial({
  transparent: true,
  vertexShader: `
    varying vec2 vUv; varying float vDist;
    void main() {
      vUv = uv;
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vDist = length(wp.xz);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position,
1.0);
    }`,
  fragmentShader: `
    varying vec2 vUv; varying float vDist;
    uniform float time, Rs;
    vec3 doppler(vec3 col, float v) {
      float g = 1.0/sqrt(1.0-v*v), d = g*(1.0-v);
      return col * vec3(clamp(1.0/d,0.0,2.0), clamp(1.0/sqrt(d),0.0,2.0),
clamp(sqrt(d),0.0,2.0));
    }
    void main() {
      float r = vDist, v = sqrt(Rs/(2.0*r));
      vec3 sc = doppler(vec3(1.0,0.6,0.2), v);
      float i = smoothstep(Rs, Rs*5.0, r) * (1.0 - smoothstep(Rs*5.0,
Rs*8.0, r));
      float p = sin(r*20.0 - time*2.0)*0.5+0.5;
      gl_FragColor = vec4(sc*i*p, i*0.8);
    }`,
  uniforms: { time: { value: 0 }, Rs: { value: Rs } },
  blending: THREE.AdditiveBlending, side: THREE.DoubleSide
});
const disk = new THREE.Mesh(diskGeometry, diskMaterial);
disk.rotation.x = Math.PI / 3;
backgroundScene.add(disk);

const hGeo = new THREE.IcosahedronGeometry(Rs, 4);
const hMat = new THREE.ShaderMaterial({
  vertexShader: `
    varying vec3 vP, vN;
    void main() { vP = position; vN = normal; gl_Position =
projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    varying vec3 vP, vN; uniform float time;
    float hex(vec3 p) { vec2 a = vec2(p.x+p.y/2.0,p.y)*3.0, f = fract(a);
vec2 v = vec2((f.x+f.y/2.0)*2.0-1.0,f.y-0.5); return
step(abs(v.x)+abs(v.y),1.0); }
    void main() {
      float fr = pow(1.0-abs(dot(normalize(vP),vN)),2.0);
      float p = hex(vP+vec3(time*0.1));
      vec3 col = mix(vec3(0.8,0.3,0.1),vec3(1.0,0.6,0.2),p);
      gl_FragColor = vec4(col, fr*0.9);
    }`,
  uniforms: { time: { value: 0 } },
  transparent: true, blending: THREE.AdditiveBlending
});
backgroundScene.add(new THREE.Mesh(hGeo, hMat));

// Particle count reduced on mobile for performance
const N = (compact.matches || window.matchMedia("(pointer: coarse)").matches) ? 2000 : 10000, pts = new Float32Array(N*3), vel = new
Float32Array(N*3);
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
const pMat = new THREE.PointsMaterial({ size: 0.1, color: 0xffaa00,
transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending });

function initP(i) {
  const r = Rs*(3+backgroundRandom()*5), t = backgroundRandom()*Math.PI*2;
  pts[i*3]=r*Math.cos(t); pts[i*3+1]=(backgroundRandom()-0.5)*Rs;
pts[i*3+2]=r*Math.sin(t);
  const v = Math.sqrt(G*M/r);
  vel[i*3]=-v*Math.sin(t); vel[i*3+1]=0; vel[i*3+2]=v*Math.cos(t);
}
for (let i=0;i<N;i++) initP(i);
backgroundScene.add(new THREE.Points(pGeo, pMat));


    let time = 0;
    let accumulator = 0;
    function step() {
  time += 0.01;
  hMat.uniforms.time.value = time;
  diskMaterial.uniforms.time.value = time;
  for (let i=0;i<N;i++) {
    const j=i*3, x=pts[j], z=pts[j+2], r=Math.sqrt(x*x+z*z);
    if (r<Rs*1.1){initP(i);continue;}
    const a=G*M/(r*r), t=Math.atan2(z,x),
fd=Math.max(0,(Rs*2-r)/(Rs*2))*0.1;
    vel[j]+=(-a*Math.cos(t)+fd*Math.sin(t));
    vel[j+2]+=(-a*Math.sin(t)-fd*Math.cos(t));
    pts[j]+=vel[j]; pts[j+1]+=vel[j+1]; pts[j+2]+=vel[j+2];
  }
  pGeo.attributes.position.needsUpdate = true;
  const cr=Rs*2.5, td=Math.sqrt(1-Rs/cr), dt=time*td;
  backgroundCamera.position.set(cr*Math.cos(dt*0.1), cr*Math.sin(dt*0.15),
cr*Math.cos(dt*0.2));
  backgroundCamera.lookAt(0,0,0);

    }
    function reset() {
      backgroundSeed = 0x417b9edc;
      for (let i = 0; i < N; i++) initP(i);
      time = 0; accumulator = 0;
      step();
    }
    reset();
    return {
      scene: backgroundScene,
      camera: backgroundCamera,
      reset,
      update(delta) {
        accumulator += delta;
        while (accumulator >= 1 / 60) {
          step(); accumulator -= 1 / 60;
        }
      },
      resize() {
        backgroundCamera.aspect = innerWidth / innerHeight;
        backgroundCamera.updateProjectionMatrix();
      },
    };
  }

  const originalBackground = createOriginalBackground();
  renderer.autoClear = false;
  function renderComposite() {
    renderer.setClearColor(0x000000, 1);
    renderer.clear();
    // The recovered renderer used Three.js's default LinearEncoding.
    renderer.outputEncoding = THREE.LinearEncoding;
    renderer.render(originalBackground.scene, originalBackground.camera);
    renderer.clearDepth();
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.render(scene, camera);
  }

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

  function spawnBurst(position, color, size) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture, color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    sprite.position.copy(position);
    sprite.scale.set(size, size, 1);
    scene.add(sprite);
    bursts.push({ sprite, life: 0.55, duration: 0.55, size });
  }

  function destroyEnemy(enemy) {
    spawnBurst(enemy.position, 0xffb347, 26);
    spawnBurst(enemy.position, 0xff4b35, 14);
    clockState.kills += 1;
    // Respawn far down the lane with a fresh phase so the lane never empties.
    enemy.userData.depth = -150 - random() * 90;
    enemy.userData.phase = random() * Math.PI * 2;
    enemy.position.z = enemy.userData.depth;
    emitState();
  }

  function firePlayer() {
    if (!clockState.playing || !enemies.length) return;
    const target = enemies.reduce((nearest, enemy) => (
      enemy.position.distanceToSquared(player.position) < nearest.position.distanceToSquared(player.position)
        ? enemy
        : nearest
    ), enemies[0]);
    createLaser(player.position, target.position, 0x67efff, 0.18);
    // A shot lands when the ship is inside the lane ahead (within 190 units):
    // the laser is drawn to the ship, so the hit is what the player sees.
    if (target.position.distanceTo(player.position) < 190) destroyEnemy(target);
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

    for (let index = bursts.length - 1; index >= 0; index -= 1) {
      const burst = bursts[index];
      burst.life -= delta;
      const t = 1 - burst.life / burst.duration;
      burst.sprite.material.opacity = Math.max(0, 1 - t);
      burst.sprite.scale.setScalar(burst.size * (1 + t * 1.8));
      if (burst.life <= 0) {
        scene.remove(burst.sprite);
        burst.sprite.material.dispose();
        bursts.splice(index, 1);
      }
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
    originalBackground.update(delta);
  }

  function renderStill() {
    if (clockState.playing) return;
    renderComposite();
  }

  function frame(timestamp) {
    if (!clockState.playing) return;
    const delta = Math.min(0.05, Math.max(0, (timestamp - clockState.last) / 1000)) * clockState.speed;
    clockState.last = timestamp;
    clockState.elapsed += delta;
    updateEncounter(delta);
    renderComposite();
    clockState.frame = requestAnimationFrame(frame);
  }

  function emitState() {
    window.dispatchEvent(new CustomEvent("mobley:blackhole-state", {
      detail: {
        elapsed: clockState.elapsed,
        kills: clockState.kills,
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
    bursts.splice(0).forEach(({ sprite }) => { scene.remove(sprite); sprite.material.dispose(); });
    clockState.kills = 0;
    player.position.set(24, -46, 42);
    player.rotation.set(0, 0, 0);
    warpAperture.visible = false;
    warpAperture.material.opacity = 0;
    camera.position.set(0, 12, 78);
    camera.lookAt(0, -5, -110);
    originalBackground.reset();
    renderComposite();
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
  // Touch (2026-10-05): a phone steers by dragging anywhere on the sky and
  // fires with a plain tap - no double-tap, no press-and-hold, because iOS
  // turns holds into text selection and link previews and a game must never
  // depend on them. Touches that start on the site shell or a control are
  // left alone so the page still scrolls and buttons still work.
  const touch = { id: null, x: 0, y: 0, startX: 0, startY: 0, t: 0, moved: false };
  const touchOnUi = (event) => event.target.closest("a, button, input, textarea, select, dialog, .site-shell, .background-player, .reveal-hint, .timeline-panel");
  addEventListener("touchstart", (event) => {
    if (touchOnUi(event) || event.touches.length !== 1) return;
    const t = event.touches[0];
    touch.id = t.identifier; touch.x = touch.startX = t.clientX; touch.y = touch.startY = t.clientY; touch.t = performance.now(); touch.moved = false;
  }, { passive: true });
  addEventListener("touchmove", (event) => {
    if (touch.id === null) return;
    const t = Array.from(event.changedTouches).find((c) => c.identifier === touch.id);
    if (!t) return;
    if (clockState.playing) event.preventDefault();
    const dx = t.clientX - touch.x, dy = t.clientY - touch.y;
    touch.x = t.clientX; touch.y = t.clientY;
    if (Math.hypot(t.clientX - touch.startX, t.clientY - touch.startY) > 10) touch.moved = true;
    if (!clockState.playing) return;
    input.targetX = THREE.MathUtils.clamp(input.targetX + dx / innerWidth * 3.2, -1, 1);
    input.targetY = THREE.MathUtils.clamp(input.targetY - dy / innerHeight * 3.2, -1, 1);
  }, { passive: false });
  addEventListener("touchend", (event) => {
    if (touch.id === null) return;
    const t = Array.from(event.changedTouches).find((c) => c.identifier === touch.id);
    if (!t) return;
    const quick = performance.now() - touch.t < 450;
    touch.id = null;
    if (touch.moved || !quick) return;
    if (touchOnUi(event)) return;
    event.preventDefault();
    clockState.playing ? firePlayer() : play();
  }, { passive: false });
  addEventListener("touchcancel", () => { touch.id = null; });
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
