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
  const quality = { scale: 1, slow: 0, fast: 0, shadows: !compact.matches && !window.matchMedia("(pointer: coarse)").matches };
  renderer.shadowMap.enabled = quality.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
  const Core = window.MobleyManualFlight;
  let controls;
  const lasers = [];
  let randomState = 0x417b9edc;

  let hiddenWasPlaying = false;

  renderer.setClearColor(0x010205, 1);
  renderer.outputEncoding = THREE.sRGBEncoding;
  scene.fog = new THREE.FogExp2(0x010308, 0.00072);

  function random() {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 4294967296;
  }

  function resize() {
    const ratio = Math.min(devicePixelRatio || 1, (compact.matches || window.matchMedia("(pointer: coarse)").matches) ? 1 : 1.25) * quality.scale;
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
    const originalView = originalBackground.camera.quaternion.clone();
    originalBackground.camera.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(flight.pitch, flight.yaw, 0, "YXZ")));
    renderer.render(originalBackground.scene, originalBackground.camera);
    originalBackground.camera.quaternion.copy(originalView);
    renderer.clearDepth();
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.render(scene, camera);
  }

  function beveledPrism(points, depth, bevel = .2) {
    const shape = new THREE.Shape(); points.forEach(([x,z],i) => i ? shape.lineTo(x,z) : shape.moveTo(x,z)); shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, steps: 1, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2 });
    geometry.rotateX(Math.PI / 2); geometry.translate(0, depth / 2, 0); return geometry;
  }
  function createShip({ hull, accent, scale = 1, enemy = false }) {
    const ship = new THREE.Group(), meshes = []; ship.userData.engines = [];
    const armor = new THREE.MeshStandardMaterial({ color: hull, metalness: .52, roughness: .36, side: THREE.DoubleSide });
    const edge = new THREE.MeshStandardMaterial({ color: enemy ? 0x8b4131 : 0xb8b2a4, metalness: .7, roughness: .3 });
    const addMesh = (geometry, material, position = [0,0,0]) => { const m = new THREE.Mesh(geometry, material); m.position.fromArray(position); m.castShadow = true; m.receiveShadow = true; meshes.push(m); ship.add(m); return m; };
    addMesh(beveledPrism([[0,-11],[2.9,-4],[3.2,4],[2,9],[-2,9],[-3.2,4],[-2.9,-4]],3,.35),armor);
    for (const side of [-1,1]) {
      addMesh(beveledPrism([[side*1.5,-4],[side*13,7],[side*2,5]],.8,.18),armor,[0,-.3,0]);
      const fin = addMesh(beveledPrism([[side*2.1,4],[side*6.7,7.6],[side*2.1,8]],.65,.12),edge,[0,1,0]);
      fin.rotation.z = -side * .42;
      addMesh(new THREE.CylinderGeometry(.8,.95,3.3,10),armor,[side*1.55,-.2,8.3]).rotation.x = Math.PI/2;
      const core = addMesh(new THREE.CylinderGeometry(.63,.63,.3,10),new THREE.MeshBasicMaterial({color:enemy?0xff683c:0xb5f9ff}),[side*1.55,-.2,10]); core.rotation.x=Math.PI/2;
      const exhaust = new THREE.Mesh(new THREE.ConeGeometry(.8,5,10),new THREE.MeshBasicMaterial({color:enemy?0xff6333:0x57dfff,transparent:true,opacity:.45,blending:THREE.AdditiveBlending,depthWrite:false})); exhaust.rotation.x=Math.PI/2; exhaust.position.set(side*1.55,-.2,12.4); ship.add(exhaust);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture,color:enemy?0xff5428:0x69eaff,transparent:true,opacity:.7,blending:THREE.AdditiveBlending,depthWrite:false}));halo.position.set(side*1.55,-.2,10.4);halo.scale.set(6,6,1);halo.userData.plume=exhaust;ship.add(halo);ship.userData.engines.push(halo);
      const stripe=addMesh(new THREE.BoxGeometry(.32,.12,7),new THREE.MeshStandardMaterial({color:accent,emissive:accent,emissiveIntensity:.18,metalness:.4,roughness:.45}),[side*2.1,1.8,1]);
    }
    const glass=new THREE.MeshPhysicalMaterial({color:enemy?0x591f13:0x174756,metalness:.45,roughness:.17,clearcoat:.85,clearcoatRoughness:.1,emissive:enemy?0x230700:0x03131b,emissiveIntensity:.6});
    const canopy=addMesh(new THREE.IcosahedronGeometry(1.8,2),glass,[0,1.9,-1.8]);canopy.scale.set(.85,.65,2);
    const barrel=addMesh(new THREE.CylinderGeometry(.23,.3,3,8),edge,[0,0,-10.5]);barrel.rotation.x=Math.PI/2;
    ship.scale.setScalar(scale);ship.userData.enemy=enemy;ship.userData.hitMeshes=meshes;return ship;
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
  scene.add(new THREE.HemisphereLight(0x9ac9df, 0x11131b, .8));
  const rimLight = new THREE.DirectionalLight(0x7edfff, 1.8);
  rimLight.position.set(-100, 65, -100); scene.add(rimLight);
  const keyLight = new THREE.DirectionalLight(0xffd8a0, 2.2);
  keyLight.position.set(180, 120, 80);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(512,512);
  Object.assign(keyLight.shadow.camera,{left:-35,right:35,top:35,bottom:-35,near:1,far:200});
  keyLight.shadow.bias=-.0007;keyLight.shadow.normalBias=.04;
  scene.add(keyLight); scene.add(keyLight.target);

  const flight = {
    velocity: new THREE.Vector3(), yaw: 0, pitch: 0, health: 100,
    time: 0, accumulator: 0, shots: 0, hits: 0, collisions: 0,
    damageFlash: 0, hitFlash: 0, nextFire: 0, nextHud: 0, lastHit: null,
    cameraMode: "chase", cameraOccluded: false, droppedProjectiles: 0,
  };
  try { if (localStorage.getItem("mobley-manual-view-v1") === "cockpit") flight.cameraMode = "cockpit"; } catch {}
  const hulls = [
    [[0, 0, -7.7], [0, 0, 5.9], 3.7],
    [[0, 1.45, -3.6], [0, 1.45, 0], 1.1],
    [[0, 0, -12], [0, 0, -9], 0.3],
  ];
  for (const side of [-1, 1]) {
    hulls.push([[0, -.5, -6], [side * 13, -.5, 7], .4]);
    hulls.push([[side * 13, -.5, 7], [side * 2, -.5, 5], .4]);
    hulls.push([[side * 1, -.5, -2], [side * 9, -.5, 5], 1.4]);
    hulls.push([[side * 1.55, -.2, 7], [side * 1.55, -.2, 10], .95]);
    hulls.push([[side * 2.5, 1.2, 5], [side * 5.7, 3.4, 7], 1.2]);
  }
  // Capsules follow the body, gun and wing geometry. Their thin wing margin
  // is conservative; projectile hits use the actual visible mesh triangles.
  for (const ship of [player, ...enemies]) {
    ship.userData.previousPosition = ship.position.clone();
    ship.userData.previousQuaternion = ship.quaternion.clone();
    ship.userData.velocity = new THREE.Vector3();
    ship.userData.health = ship === player ? 100 : 80;
    ship.userData.radius = 17 * ship.scale.x;
    ship.userData.contactAt = -Infinity;
  }
  const debris = [];
  for (const [index, coords] of [[42, -24, -210], [-52, 18, -310], [75, 35, -440], [-120, -90, -460]].entries()) {
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(index === 3 ? 38 : 8 + index * 2, 2), new THREE.MeshPhongMaterial({ color: 0x292a32, flatShading: true, shininess: 3 }));
    mesh.position.fromArray(coords);
    mesh.userData = { obstacle: true, radius: index === 3 ? 38 : 8 + index * 2, health: Infinity, previousPosition: mesh.position.clone(), previousQuaternion: mesh.quaternion.clone(), velocity: new THREE.Vector3(), hitMeshes: [mesh] };
    scene.add(mesh); debris.push(mesh);
  }
  const capital = createShip({ hull: 0x30434c, accent: 0xb8bea2, scale: 5.5 });
  capital.position.set(80, 70, -950);
  Object.assign(capital.userData, { obstacle: true, shipHull: true, radius: 17 * 5.5, health: Infinity, previousPosition: capital.position.clone(), previousQuaternion: capital.quaternion.clone(), velocity: new THREE.Vector3() });
  scene.add(capital); debris.push(capital);
  const localScenery = [...debris];
  for (const t of localScenery) t.userData.initialPosition = t.position.clone();
  const planetSystem = window.MobleyPlanets.create({ THREE, scene, compact: compact.matches || window.matchMedia("(pointer: coarse)").matches });
  debris.push(...planetSystem.bodies);
  const destinationList = window.MobleyDestinations.destinations.filter(window.MobleyDestinations.validate);
  const travel = window.MobleyTravel.create(destinationList, "mobleysoft:planet:aurel");
  const destinationSelect = document.getElementById("flight-destination");
  destinationSelect.replaceChildren(...destinationList.map(d => { const option = document.createElement("option"); option.value = d.id; option.textContent = d.name; return option; }));
  function arrivalCandidate(destination) {
    const point = new THREE.Vector3(...destination.orbitArrival);
    for (const planet of planetSystem.bodies) {
      const offset = point.clone().sub(planet.position), min = planet.userData.radius + 100;
      if (offset.length() < min) point.copy(planet.position).addScaledVector(offset.lengthSq() ? offset.normalize() : new THREE.Vector3(0,0,1), min);
    }
    return point;
  }
  function jumpConditions() {
    const d = window.MobleyDestinations.resolve(travel.state.selectedId);
    const direction = d ? arrivalCandidate(d).sub(player.position).normalize() : new THREE.Vector3();
    const view = camera.getWorldDirection(new THREE.Vector3());
    const clear = allTargets().filter(t => t !== player).every(t => t.position.distanceTo(player.position) > t.userData.radius + 75);
    const arrivalClear = d ? planetSystem.bodies.every(p => arrivalCandidate(d).distanceTo(p.position) >= p.userData.radius + 80) : false;
    return { aligned: document.body.classList.contains("shell-dismissed") && direction.dot(view) > Math.cos(Math.PI / 18), clear, arrivalClear, speed: flight.velocity.length(), throttle: flight.lastInput?.throttle || 0 };
  }
  function requestJump() {
    if (!clockState.playing) return;
    travel.request(jumpConditions()); updateTravelHud();
  }
  function cancelJump(reason = "CHARGE CANCELLED") { travel.cancel(reason); }
  function selectDestination(id) { travel.select(id); updateTravelHud(); }
  function arriveOrbit(id) {
    const d = window.MobleyDestinations.resolve(id), point = arrivalCandidate(d);
    clearLasers();
    player.position.copy(point); flight.velocity.set(0,0,0); controls.reset();
    const radial = point.clone().sub(new THREE.Vector3(...d.position)).normalize();
    const tangent = new THREE.Vector3(0,1,0).cross(radial).normalize();
    const heading = tangent.sub(radial).normalize();
    flight.yaw = Math.atan2(-heading.x, -heading.z); flight.pitch = Math.asin(heading.y); flight.bank = 0;
    player.quaternion.setFromEuler(new THREE.Euler(flight.pitch,flight.yaw,0,"YXZ")); basis();
    let seed=d.seed;const seeded=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    for(const t of localScenery){
      const local=t.userData.initialPosition.clone().sub(new THREE.Vector3(0,0,30));
      t.position.copy(point).addScaledVector(right,local.x+(seeded()-.5)*20).addScaledVector(up,local.y+(seeded()-.5)*15).addScaledVector(forward,-local.z);
      for(const planet of planetSystem.bodies){const r=t.position.clone().sub(planet.position),min=planet.userData.radius+t.userData.radius+40;if(r.length()<min)t.position.copy(planet.position).addScaledVector(r.normalize(),min);}
      t.userData.previousPosition.copy(t.position);
    }
    player.userData.previousPosition.copy(player.position); player.userData.previousQuaternion.copy(player.quaternion);
    enemies.forEach((enemy,i) => { enemy.userData.home.copy(point).addScaledVector(forward,220+i*90).addScaledVector(right,(i-1)*55);patrolPose(enemy,i,flight.time);enemy.userData.health=80;enemy.visible=true;enemy.userData.nextShot=flight.time+4+i;enemy.userData.previousPosition.copy(enemy.position);enemy.userData.previousQuaternion.copy(enemy.quaternion); });
    updateCamera(0,true); updateTravelHud();
  }
  function updateTravelHud() {
    const state = travel.state, conditions = jumpConditions(), button = document.getElementById("flight-jump"), target = window.MobleyDestinations.resolve(state.selectedId);
    for (const option of destinationSelect.options) option.disabled = option.value === state.currentId;
    destinationSelect.value = state.selectedId || ""; destinationSelect.disabled = state.phase !== "local";
    button.textContent = state.phase === "charging" ? "CANCEL " + Math.max(0,state.remaining).toFixed(1) : state.phase === "transit" ? "JUMPING" : travel.blocked(conditions) ? "ALIGN / COAST" : "CHARGE JUMP";
    button.disabled = !clockState.playing || state.phase === "transit";
    button.title = state.phase === "local" ? travel.blocked(conditions) || "Charge three seconds, then jump to safe orbit" : state.reason;
    document.getElementById("flight-nav-status").textContent = state.phase === "local" ? (conditions.speed>30?"LOCAL CRUISE · ":"ORBITAL FLIGHT · ")+(travel.blocked(conditions)||"READY TO CHARGE") : state.reason;
    button.setAttribute("aria-label", state.phase === "charging" ? "Cancel jump charge" : "Charge jump to selected planet. Align marker, coast below forty and clear obstacles.");
    document.querySelector(".flight-transit").classList.toggle("active",state.phase === "transit");
    const marker = document.querySelector(".flight-jump-marker"); marker.style.display = target && state.phase !== "transit" ? "block" : "none";
    if (target) {
      const gate = arrivalCandidate(target), delta = gate.clone().sub(camera.position), projected = gate.clone().project(camera), front = delta.dot(camera.getWorldDirection(new THREE.Vector3())) > 0;
      const x = front ? projected.x : (delta.dot(right) >= 0 ? 1 : -1), y = front ? projected.y : 0;
      marker.style.left = (50 + Core.clamp(x,-.8,.8)*45) + "%"; marker.style.top = (50 - Core.clamp(y,-.5,.5)*42) + "%";
      document.getElementById("flight-jump-label").textContent = target.name + " · " + (delta.length()/1000).toFixed(1) + "k u";
    }
  }

  const tracerMaterials = {
    player: new THREE.LineBasicMaterial({ color: 0x79f4ff, transparent: true, opacity: .95, blending: THREE.AdditiveBlending }),
    enemy: new THREE.LineBasicMaterial({ color: 0xff714c, transparent: true, opacity: .95, blending: THREE.AdditiveBlending }),
  };
  const forward = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3();
  const allTargets = () => [player, ...enemies, ...debris].filter(t => t.userData.health > 0);
  function basis() {
    const view = new THREE.Quaternion().setFromEuler(new THREE.Euler(flight.pitch, flight.yaw, 0, "YXZ"));
    forward.set(0, 0, -1).applyQuaternion(view);
    right.set(1, 0, 0).applyQuaternion(view);
    up.set(0, 1, 0).applyQuaternion(view);
  }
  function clearLasers() {
    lasers.splice(0).forEach(p => { scene.remove(p.line); p.geometry.dispose(); });
  }
  function removeProjectile(index) {
    const p = lasers[index]; scene.remove(p.line); p.geometry.dispose(); lasers.splice(index, 1);
  }
  function spawnBurst(position, color, size, duration = .45) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }));
    sprite.position.copy(position); sprite.scale.setScalar(size); scene.add(sprite);
    bursts.push({ sprite, life: duration, duration, size });
  }
  function fireProjectile(owner, origin, direction) {
    if (lasers.length >= 96) { removeProjectile(0); flight.droppedProjectiles++; }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
    const line = new THREE.Line(geometry, tracerMaterials[owner === player ? "player" : "enemy"]); line.frustumCulled = false; scene.add(line);
    lasers.push({ owner, position: origin.clone(), previous: origin.clone(), velocity: direction.clone().normalize().multiplyScalar(520), life: 2.5, geometry, line });
    spawnBurst(origin, owner === player ? 0x9af6ff : 0xff8050, 2.3, .08);
  }
  function aimSolution() {
    scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
    const direction = camera.getWorldDirection(new THREE.Vector3());
    const ray = new THREE.Raycaster(camera.position, direction, .1, 1200);
    const hits = ray.intersectObjects(allTargets().filter(t => t !== player).flatMap(t => t.userData.hitMeshes), false);
    const muzzle = player.localToWorld(new THREE.Vector3(0, 0, -12));
    const hit = hits.find(h => h.distance > camera.position.distanceTo(muzzle) - 1);
    const point = hit ? hit.point.clone() : camera.position.clone().addScaledVector(direction, 1200);
    const gunDirection = point.clone().sub(muzzle).normalize();
    const probe = new THREE.Raycaster(muzzle, gunDirection, 0, 18);
    const obstructed = probe.intersectObjects(allTargets().filter(t => t !== player).flatMap(t => t.userData.hitMeshes), false).length > 0;
    return { muzzle, direction: gunDirection, point, obstructed };
  }
  function firePlayer() {
    if (!clockState.playing || flight.health <= 0 || flight.time < flight.nextFire) return;
    const aim = aimSolution();
    fireProjectile(player, aim.muzzle, aim.direction);
    flight.nextFire = flight.time + .18; flight.shots++;
  }
  function destroyEnemy(enemy, attacker) {
    if (!enemy.visible) return;
    spawnBurst(enemy.position, 0xffb347, 26); spawnBurst(enemy.position, 0xff4b35, 14);
    enemy.visible = false; enemy.userData.health = 0; enemy.userData.respawnAt = flight.time + 3;
    if (attacker === player) clockState.kills++;
    emitState();
  }
  function damage(target, amount, attacker, point) {
    if (target.userData.obstacle) { spawnBurst(point, 0xd4bc83, 5, .15); return; }
    if (target === player) {
      cancelJump("DAMAGE RECEIVED");
      flight.health = Math.max(0, flight.health - amount); target.userData.health = flight.health; flight.damageFlash = .45;
      if (!flight.health) { spawnBurst(player.position, 0xff8050, 24); flight.velocity.set(0, 0, 0); pause(); }
    } else {
      target.userData.health -= amount; if (target.userData.health <= 0) destroyEnemy(target, attacker);
    }
    spawnBurst(point, target === player ? 0xff7744 : 0xffd48b, 6, .16);
  }
  function hullMotion(target) {
    const transform = (p, q, position) => new THREE.Vector3(...p).multiplyScalar(target.scale.x).applyQuaternion(q).add(position).toArray();
    if (target.userData.obstacle && !target.userData.shipHull) return [{ a0: target.userData.previousPosition.toArray(), b0: target.userData.previousPosition.toArray(), a1: target.position.toArray(), b1: target.position.toArray(), radius: target.userData.radius }];
    return hulls.map(([a, b, radius]) => ({ a0: transform(a, target.userData.previousQuaternion, target.userData.previousPosition), b0: transform(b, target.userData.previousQuaternion, target.userData.previousPosition), a1: transform(a, target.quaternion, target.position), b1: transform(b, target.quaternion, target.position), radius: radius * target.scale.x }));
  }
  function shipContacts() {
    const motion = hullMotion(player), prev = player.userData.previousPosition;
    let earliest = null;
    for (const target of [...enemies, ...debris].filter(t => t.userData.health > 0)) {
      if (!Core.broadSweep(prev.toArray(), player.position.toArray(), target.userData.previousPosition.toArray(), target.position.toArray(), player.userData.radius + target.userData.radius)) continue;
      for (const a of motion) for (const b of hullMotion(target)) {
        const hit = Core.sweepCapsules(a, b);
        if (hit && (!earliest || hit.t < earliest.t)) earliest = { ...hit, target };
      }
    }
    if (!earliest) return;
    const n = new THREE.Vector3(...earliest.normal), target = earliest.target;
    const proposed = player.position.clone();
    player.position.copy(prev).lerp(proposed, Math.max(0, earliest.t - .0001)).addScaledVector(n, .06);
    const relative = flight.velocity.clone().sub(target.userData.velocity), closing = Math.max(0, -relative.dot(n));
    if (closing > 0) flight.velocity.addScaledVector(n, closing * 1.12);
    if (flight.time - player.userData.contactAt > .6 && closing > 1) {
      player.userData.contactAt = flight.time; flight.collisions++;
      const amount = Math.min(55, 8 + closing * .32), point = new THREE.Vector3(...earliest.pointA);
      damage(player, amount, target, point); damage(target, amount, player, point);
      flight.lastHit = { kind: "ship-contact", time: flight.time, point: point.toArray() };
    }
  }
  function projectileContacts(dt) {
    for (let index = lasers.length - 1; index >= 0; index--) {
      const p = lasers[index]; p.previous.copy(p.position); p.position.addScaledVector(p.velocity, dt); p.life -= dt;
      let earliest = null;
      for (const target of allTargets()) {
        if (target === p.owner) continue;
        const hit = window.MobleyMeshSweep.hit(THREE, p.previous, p.position, target, target.userData.previousPosition, target.userData.hitMeshes);
        if (hit && (!earliest || hit.t < earliest.t)) earliest = { ...hit, target };
      }
      if (earliest) {
        damage(earliest.target, p.owner === player ? 40 : 18, p.owner, earliest.point);
        if (p.owner === player && !earliest.target.userData.obstacle) { flight.hits++; flight.hitFlash = .14; }
        flight.lastHit = { kind: "projectile", owner: p.owner === player ? "player" : "enemy", target: earliest.target === player ? "player" : earliest.target.userData.obstacle ? "debris" : "enemy", time: flight.time, point: earliest.point.toArray() };
        removeProjectile(index); continue;
      }
      if (p.life <= 0) { removeProjectile(index); continue; }
      const tail = p.position.clone().addScaledVector(p.velocity, -10 / p.velocity.length());
      const vertices = p.geometry.attributes.position.array; tail.toArray(vertices, 0); p.position.toArray(vertices, 3); p.geometry.attributes.position.needsUpdate = true;
    }
  }
  function setCameraMode(mode) {
    flight.cameraMode = mode === "cockpit" ? "cockpit" : "chase";
    try { localStorage.setItem("mobley-manual-view-v1", flight.cameraMode); } catch {}
    document.body.classList.toggle("flight-cockpit", flight.cameraMode === "cockpit");
    document.getElementById("flight-view").textContent = "VIEW · " + flight.cameraMode.toUpperCase();
    document.getElementById("flight-view").setAttribute("aria-label", "Switch to " + (flight.cameraMode === "chase" ? "cockpit" : "chase") + " view");
    updateCamera(0, true); renderStill();
  }
  function toggleCamera() { setCameraMode(flight.cameraMode === "chase" ? "cockpit" : "chase"); }
  function cameraClearance(desired) {
    const pivot = player.position.clone().addScaledVector(up, 3), segment = desired.clone().sub(pivot), distance = segment.length();
    if (distance < 1e-6) return desired;
    const ray = new THREE.Raycaster(pivot, segment.clone().normalize(), 0, distance + 2);
    const hits = ray.intersectObjects(allTargets().filter(t => t !== player).flatMap(t => t.userData.hitMeshes), false);
    if (hits.length) { flight.cameraOccluded = true; return pivot.addScaledVector(segment.normalize(), Math.max(.5, hits[0].distance - 2)); }
    return desired;
  }
  function updateCamera(dt, instant = false) {
    basis(); scene.updateMatrixWorld(true); flight.cameraOccluded = false;
    if (flight.cameraMode === "cockpit") {
      camera.position.copy(player.position).addScaledVector(up, 2.2).addScaledVector(forward, -1.5);
      camera.quaternion.setFromEuler(new THREE.Euler(flight.pitch, flight.yaw, 0, "YXZ")); player.visible = false;
    } else {
      const rear = Math.max(48, 22 / (Math.tan(camera.fov * Math.PI / 360) * camera.aspect));
      const desired = cameraClearance(player.position.clone().addScaledVector(forward, -rear).addScaledVector(up, rear * .29));
      if (instant) camera.position.copy(desired); else camera.position.lerp(desired, 1 - Math.exp(-8 * dt));
      camera.position.copy(cameraClearance(camera.position.clone()));
      camera.up.copy(up); camera.lookAt(player.position.clone().addScaledVector(forward, 180).addScaledVector(up, 2));
      player.visible = camera.position.distanceTo(player.position) > 13;
    }
    camera.updateMatrixWorld(true);
  }
  function updateHud() {
    document.getElementById("flight-hull").textContent = "HULL " + Math.ceil(flight.health) + " · SPEED " + Math.round(flight.velocity.length());
    const input = flight.lastInput;
    const lever = input?.throttle || 0;
    document.getElementById("flight-throttle-label").textContent = lever > 0 ? "THRUST " + Math.round(lever * 100) + "%" : lever < 0 ? "BRAKE " + Math.round(-lever * 100) + "%" : "NEUTRAL · COAST";
    const blocked = aimSolution().obstructed;
    document.querySelector(".flight-reticle").classList.toggle("blocked", blocked);
    document.getElementById("flight-message").textContent = flight.health <= 0 ? "SHIP LOST · REPLAY" : travel.state.phase === "charging" ? "JUMP CHARGE · " + travel.state.remaining.toFixed(1) : travel.state.phase === "transit" ? "HYPERSPACE" : blocked ? "MUZZLE OBSTRUCTED" : "MANUAL AIM · " + flight.shots + " SHOTS / " + flight.hits + " HITS";
    updateTravelHud();
    const dots = document.querySelectorAll(".flight-radar span");
    enemies.forEach((enemy, i) => { const d = enemy.position.clone().sub(player.position); dots[i].style.left = (50 + Core.clamp(d.dot(right) / 500, -.9, .9) * 45) + "%"; dots[i].style.top = (50 - Core.clamp(d.dot(forward) / 500, -.9, .9) * 45) + "%"; dots[i].style.opacity = enemy.userData.health > 0 ? 1 : 0; });
  }
  function patrolPose(enemy, i, time) {
    const rate = .3 + i * .03, phase = time * rate + i * 2.07;
    enemy.position.copy(enemy.userData.home).add(new THREE.Vector3(Math.sin(phase) * 28, Math.cos(phase * .8) * 12, Math.sin(phase * .65) * 20));
    const velocity = new THREE.Vector3(Math.cos(phase) * 28, -Math.sin(phase * .8) * 9.6, Math.cos(phase * .65) * 13).multiplyScalar(rate);
    enemy.userData.velocity.copy(velocity);
    enemy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), velocity.normalize());
  }
  function resetFlight() {
    Object.assign(flight, { yaw: 0, pitch: 0, health: 100, time: 0, accumulator: 0, shots: 0, hits: 0, collisions: 0, damageFlash: 0, hitFlash: 0, nextFire: 0, nextHud: 0, lastHit: null, droppedProjectiles: 0 });
    travel.reset(); for(const t of localScenery){t.position.copy(t.userData.initialPosition);t.userData.previousPosition.copy(t.position);}
    flight.lastInput = { throttle: 0 };
    flight.pendingMouseX = flight.pendingMouseY = flight.bank = 0;
    flight.velocity.set(0, 0, 0); player.position.set(0, 0, 30); player.quaternion.identity(); player.userData.health = 100; player.userData.contactAt = -Infinity;
    player.userData.previousPosition.copy(player.position); player.userData.previousQuaternion.copy(player.quaternion);
    enemies.forEach((enemy, i) => { enemy.userData.home = new THREE.Vector3((i - 1) * 35, (i % 2 ? -12 : 12), -170 - i * 100); patrolPose(enemy, i, 0); enemy.visible = true; enemy.userData.health = 80; enemy.userData.nextShot = 3.5 + i * 1.5; enemy.userData.previousPosition.copy(enemy.position); enemy.userData.previousQuaternion.copy(enemy.quaternion); });
    controls?.reset(); setCameraMode(flight.cameraMode); updateHud();
  }
  function fixedFlightStep(dt) {
    flight.time += dt;
    const jumpEvent = travel.tick(dt, jumpConditions());
    if(jumpEvent?.type === "depart"){controls.reset();flight.velocity.set(0,0,0);clearLasers();}
    if(jumpEvent?.type === "arrive")arriveOrbit(jumpEvent.destinationId);
    if(travel.state.phase === "transit")return;
    for (const t of [player, ...enemies, ...debris]) { t.userData.previousPosition.copy(t.position); t.userData.previousQuaternion.copy(t.quaternion); }
    const input = controls.sample();
    flight.lastInput = input;
    flight.pendingMouseX = Core.clamp((flight.pendingMouseX || 0) + input.mouseX * .003, -.15, .15);
    flight.pendingMouseY = Core.clamp((flight.pendingMouseY || 0) + input.mouseY * .003, -.15, .15);
    const mx = Core.clamp(flight.pendingMouseX, -1.5 * dt, 1.5 * dt), my = Core.clamp(flight.pendingMouseY, -1.5 * dt, 1.5 * dt);
    flight.pendingMouseX -= mx; flight.pendingMouseY -= my;
    flight.yaw -= input.lookX * 1.5 * dt + mx;
    flight.pitch = Core.clamp(flight.pitch + input.lookY * 1.2 * dt + my, -1.35, 1.35);
    flight.yaw = Math.atan2(Math.sin(flight.yaw), Math.cos(flight.yaw));
    flight.bank += (-input.x * .2 - input.lookX * .12 - flight.bank) * Math.min(1, 8 * dt);
    player.quaternion.setFromEuler(new THREE.Euler(flight.pitch, flight.yaw, flight.bank, "YXZ")); basis();
    flight.velocity.fromArray(Core.integrateVelocity(flight.velocity.toArray(), right.toArray(), up.toArray(), forward.toArray(), input, dt));
    player.position.addScaledVector(flight.velocity, dt); player.userData.velocity.copy(flight.velocity);
    enemies.forEach((enemy, i) => {
      let teleported = false;
      if (enemy.userData.health <= 0) {
        if (flight.time >= enemy.userData.respawnAt) {
          enemy.userData.home = player.position.clone().addScaledVector(forward, 220 + i * 70).addScaledVector(right, (random() - .5) * 100).addScaledVector(up, (random() - .5) * 50);
          enemy.userData.health = 80; enemy.visible = true; enemy.userData.nextShot = flight.time + 2.5; teleported = true;
        } else return;
      }
      if (enemy.position.distanceTo(player.position) > 1100) { enemy.userData.home.copy(player.position).addScaledVector(forward, 350).addScaledVector(right, (i - 1) * 60); teleported = true; }
      patrolPose(enemy, i, flight.time);
      if (teleported) { enemy.userData.previousPosition.copy(enemy.position); enemy.userData.previousQuaternion.copy(enemy.quaternion); }
      if (flight.time >= enemy.userData.nextShot) { const tangent = enemy.userData.velocity.clone().normalize(); fireProjectile(enemy, enemy.position.clone().addScaledVector(tangent, 12 * enemy.scale.x), tangent); enemy.userData.nextShot = flight.time + 2.2 + i * .35; }
    });
    shipContacts(); player.userData.velocity.copy(flight.velocity); scene.updateMatrixWorld(true); projectileContacts(dt);
    warpAperture.visible = false; warpAperture.scale.setScalar(.35 + flight.time * 2.7); warpAperture.material.opacity = Math.max(0, .8 - flight.time / 2);
    player.userData.engines.forEach(engine => { engine.material.opacity = .6 + Math.max(0, input.throttle) * .4; engine.scale.setScalar(5 + flight.velocity.length() * .025 + Math.max(0, input.throttle) * 4); if(engine.userData.plume){engine.userData.plume.scale.y = .7 + Math.max(0,input.throttle) * 1.8;engine.userData.plume.material.opacity=.25+Math.max(0,input.throttle)*.3;} });
    flight.damageFlash = Math.max(0, flight.damageFlash - dt); flight.hitFlash = Math.max(0, flight.hitFlash - dt);
    for (let i = bursts.length - 1; i >= 0; i--) { const burst = bursts[i]; burst.life -= dt; const t = 1 - burst.life / burst.duration; burst.sprite.material.opacity = Math.max(0, 1 - t); burst.sprite.scale.setScalar(burst.size * (1 + t * 1.8)); if (burst.life <= 0) { scene.remove(burst.sprite); burst.sprite.material.dispose(); bursts.splice(i, 1); } }
  }
  function updateQuality(interval) {
    if(interval>.04){quality.slow++;quality.fast=0;}else if(interval<.022){quality.fast++;quality.slow=0;}else{quality.slow=quality.fast=0;}
    if(quality.slow>=12){quality.slow=0;if(renderer.shadowMap.enabled){renderer.shadowMap.enabled=false;quality.shadows=false;}else if(quality.scale>.65){quality.scale=Math.max(.65,quality.scale-.1);resize();}}
    if(quality.fast>=240){quality.fast=0;if(quality.scale<1){quality.scale=Math.min(1,quality.scale+.05);resize();}else if(!compact.matches&&!window.matchMedia("(pointer: coarse)").matches){renderer.shadowMap.enabled=true;quality.shadows=true;}}
  }
  function updateEncounter(delta) {
    flight.accumulator += Math.min(delta, .1); let steps = 0;
    while (flight.accumulator >= 1 / 120 && steps++ < 12 && clockState.playing) { fixedFlightStep(1 / 120); flight.accumulator -= 1 / 120; }
    planetSystem.update(flight.time);
    originalBackground.update(delta); starField.position.copy(player.position); updateCamera(delta);
    keyLight.position.copy(player.position).add(new THREE.Vector3(60,90,55)); keyLight.target.position.copy(player.position); keyLight.target.updateMatrixWorld(true);
    document.querySelector(".flight-damage").style.opacity = String(flight.damageFlash * 1.4);
    document.querySelector(".flight-hit").style.opacity = String(flight.hitFlash > 0 ? 1 : 0);
    if (flight.time >= flight.nextHud) { updateHud(); flight.nextHud = flight.time + .1; }
  }

  function renderStill() {
    if (clockState.playing) return;
    renderComposite();
  }

  function frame(timestamp) {
    if (!clockState.playing) return;
    const rawDelta = Math.max(0, (timestamp - clockState.last) / 1000);
    updateQuality(rawDelta);
    const delta = Math.min(0.05, rawDelta) * clockState.speed;
    clockState.last = timestamp;
    clockState.elapsed += delta;
    updateEncounter(delta);
    renderComposite();
    clockState.frame = clockState.playing ? requestAnimationFrame(frame) : 0;
  }

  function emitState() {
    window.dispatchEvent(new CustomEvent("mobley:blackhole-state", {
      detail: {
        elapsed: clockState.elapsed,
        kills: clockState.kills,
        playing: clockState.playing,
        release: "manual-orbit-20261015-r1",
        speed: clockState.speed,
      },
    }));
  }

  function resetEncounter() {
    cancelAnimationFrame(clockState.frame);
    clockState.elapsed = 0;
    clockState.last = performance.now();
    randomState = 0x417b9edc;
    clearLasers();
    bursts.splice(0).forEach(({ sprite }) => { scene.remove(sprite); sprite.material.dispose(); });
    clockState.kills = 0;
    resetFlight();
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
    controls?.reset();
    cancelJump("PAUSED");
    flight.pendingMouseX = flight.pendingMouseY = 0;
    updateHud();
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

  addEventListener("resize", () => { controls?.reset(); cancelJump("VIEWPORT CHANGED"); flight.pendingMouseX = flight.pendingMouseY = 0; resize(); updateCamera(0, true); renderStill(); }, { passive: true });
  controls = window.MobleyManualInput.create({
    enabled: () => clockState.playing && document.body.classList.contains("shell-dismissed") && travel.state.phase !== "transit",
    onFire: firePlayer,
    onView: toggleCamera,
    onJump: requestJump, onCancel: cancelJump, onSelect: selectDestination,
  });
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
    getDiagnostics: () => ({
      position: player.position.toArray(), velocity: flight.velocity.toArray(), yaw: flight.yaw, pitch: flight.pitch,
      travel: { ...travel.state },
      health: flight.health, shots: flight.shots, hits: flight.hits, collisions: flight.collisions,
      lastHit: flight.lastHit, projectiles: lasers.length, droppedProjectiles: flight.droppedProjectiles,
      quality: { scale: quality.scale, shadows: renderer.shadowMap.enabled },
      camera: flight.cameraMode, cameraDistance: camera.position.distanceTo(player.position), cameraOccluded: flight.cameraOccluded,
      input: controls.diagnostics(), physicsStep: 1 / 120, manualAim: true,
    }),
    setCamera: setCameraMode,
    getState: () => ({ ...clockState }),
    pause,
    play,
    release: "manual-orbit-20261015-r1",
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
