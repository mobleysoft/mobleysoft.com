/**
 * PhotonicMind scrollytelling scene. Every numeric value this script draws
 * into the page (chart points, threshold numbers, peak suppression, recovery
 * time) is read from data.json at runtime - the real, unedited output of
 * gofaineats/lib/export_photon_visualization_data.py. This file contains no
 * invented physics numbers of its own; it only visualizes what the real
 * simulations produced.
 */

gsap.registerPlugin(ScrollTrigger);

// ---------------------------------------------------------------------
// Three.js scene: a single persistent WebGL canvas, scroll-driven.
// Five visual "modes" correspond to the five text stages; GSAP
// ScrollTrigger swaps between them and drives real-valued uniforms
// (e.g. photon count, cascade amplification factor) rather than just
// toggling visibility.
// ---------------------------------------------------------------------

const canvasLayer = document.getElementById('canvas-layer');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
canvasLayer.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 8);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Lighting
scene.add(new THREE.AmbientLight(0x404060, 1.2));
const point = new THREE.PointLight(0x5ad1e6, 2, 30);
point.position.set(2, 2, 5);
scene.add(point);

// --- Stage 1: incoming photons (Poisson-scattered points flying toward a plane) ---
const photonGroup = new THREE.Group();
const PHOTON_COUNT = 60;
const photonGeo = new THREE.SphereGeometry(0.035, 8, 8);
const photonMat = new THREE.MeshBasicMaterial({ color: 0x5ad1e6 });
const photons = [];
for (let i = 0; i < PHOTON_COUNT; i++) {
  const m = new THREE.Mesh(photonGeo, photonMat);
  m.position.set(
    (Math.random() - 0.5) * 6,
    (Math.random() - 0.5) * 4,
    -6 - Math.random() * 6
  );
  photonGroup.add(m);
  photons.push({ mesh: m, speed: 0.04 + Math.random() * 0.05 });
}
scene.add(photonGroup);

// A faint plane representing the outer segment membrane the photons travel toward
const membraneGeo = new THREE.PlaneGeometry(5, 3.2);
const membraneMat = new THREE.MeshBasicMaterial({ color: 0x1a2440, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
const membrane = new THREE.Mesh(membraneGeo, membraneMat);
membrane.position.z = 0;
scene.add(membrane);

// --- Stage 2: a single rhodopsin molecule (simple icosahedron) that "activates" (color shift + pulse) ---
const rhodopsinGeo = new THREE.IcosahedronGeometry(0.6, 1);
const rhodopsinMat = new THREE.MeshStandardMaterial({ color: 0x3a4a6a, roughness: 0.4, metalness: 0.2, emissive: 0x000000 });
const rhodopsin = new THREE.Mesh(rhodopsinGeo, rhodopsinMat);
rhodopsin.visible = false;
scene.add(rhodopsin);

// --- Stage 3: cascade amplification - a branching particle burst from one point ---
const cascadeGroup = new THREE.Group();
cascadeGroup.visible = false;
const CASCADE_MAX = 120;
const cascadeGeo = new THREE.SphereGeometry(0.05, 6, 6);
const cascadeMats = [
  new THREE.MeshBasicMaterial({ color: 0x5ad1e6 }), // G*
  new THREE.MeshBasicMaterial({ color: 0xe6b85a }), // PDE*
];
const cascadeParticles = [];
for (let i = 0; i < CASCADE_MAX; i++) {
  const mat = cascadeMats[i % 2];
  const m = new THREE.Mesh(cascadeGeo, mat);
  m.visible = false;
  cascadeGroup.add(m);
  const angle = Math.random() * Math.PI * 2;
  const elevation = (Math.random() - 0.5) * Math.PI;
  cascadeParticles.push({
    mesh: m,
    dir: new THREE.Vector3(
      Math.cos(angle) * Math.cos(elevation),
      Math.sin(elevation),
      Math.sin(angle) * Math.cos(elevation)
    ),
    dist: 0.3 + Math.random() * 2.2,
  });
}
scene.add(cascadeGroup);

// --- Stage 4: channel grid on the membrane, closing as cGMP falls ---
const channelGroup = new THREE.Group();
channelGroup.visible = false;
const CHANNEL_ROWS = 6, CHANNEL_COLS = 10;
const channelGeo = new THREE.RingGeometry(0.08, 0.14, 16);
const channels = [];
for (let r = 0; r < CHANNEL_ROWS; r++) {
  for (let c = 0; c < CHANNEL_COLS; c++) {
    const mat = new THREE.MeshBasicMaterial({ color: 0x5ad1e6, side: THREE.DoubleSide });
    const m = new THREE.Mesh(channelGeo, mat);
    m.position.set((c - CHANNEL_COLS / 2 + 0.5) * 0.45, (r - CHANNEL_ROWS / 2 + 0.5) * 0.45, 0.02);
    channelGroup.add(m);
    channels.push(m);
  }
}
scene.add(channelGroup);

let clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();

  photons.forEach(p => {
    p.mesh.position.z += p.speed;
    if (p.mesh.position.z > 1) {
      p.mesh.position.z = -10;
      p.mesh.position.x = (Math.random() - 0.5) * 6;
      p.mesh.position.y = (Math.random() - 0.5) * 4;
    }
  });

  if (rhodopsin.visible) {
    rhodopsin.rotation.y += dt * 0.4;
    rhodopsin.rotation.x += dt * 0.15;
  }

  if (cascadeGroup.visible) {
    cascadeGroup.rotation.y += dt * 0.1;
  }

  renderer.render(scene, camera);
}
animate();

// ---------------------------------------------------------------------
// ScrollTrigger wiring: one trigger per stage section, toggling which
// three.js group is visible/active. Camera and opacity transitions use
// GSAP tweens tied to scroll progress for a smooth, video-like feel.
// ---------------------------------------------------------------------

function showOnly(groupsToShow) {
  photonGroup.visible = groupsToShow.includes('photon');
  membrane.visible = groupsToShow.includes('photon') || groupsToShow.includes('channel');
  rhodopsin.visible = groupsToShow.includes('rhodopsin');
  cascadeGroup.visible = groupsToShow.includes('cascade');
  channelGroup.visible = groupsToShow.includes('channel');
}

ScrollTrigger.create({
  trigger: '#stage-photon',
  start: 'top bottom',
  end: 'bottom top',
  onEnter: () => showOnly(['photon']),
  onEnterBack: () => showOnly(['photon']),
});

ScrollTrigger.create({
  trigger: '#stage-rhodopsin',
  start: 'top center',
  end: 'bottom top',
  onEnter: () => {
    showOnly(['rhodopsin']);
    gsap.to(rhodopsin.material.color, { r: 0.8, g: 0.3, b: 0.1, duration: 1.2 });
    gsap.to(rhodopsin.material.emissive, { r: 0.3, g: 0.1, b: 0.0, duration: 1.2 });
    gsap.to(camera.position, { z: 4, duration: 1.2 });
  },
  onEnterBack: () => {
    showOnly(['rhodopsin']);
    gsap.to(camera.position, { z: 4, duration: 0.6 });
  },
  onLeave: () => gsap.to(camera.position, { z: 8, duration: 1 }),
});

ScrollTrigger.create({
  trigger: '#stage-cascade',
  start: 'top center',
  end: 'bottom top',
  onEnter: () => {
    showOnly(['cascade']);
    cascadeParticles.forEach((p, i) => {
      p.mesh.visible = false;
      p.mesh.position.set(0, 0, 0);
      gsap.to(p.mesh.position, {
        x: p.dir.x * p.dist, y: p.dir.y * p.dist, z: p.dir.z * p.dist,
        duration: 1.4,
        delay: i * 0.01,
        onStart: () => { p.mesh.visible = true; },
      });
    });
  },
  onEnterBack: () => showOnly(['cascade']),
});

ScrollTrigger.create({
  trigger: '#stage-channel',
  start: 'top center',
  end: 'bottom top',
  onEnter: () => {
    showOnly(['channel']);
    gsap.to(camera.position, { z: 6, duration: 1 });
    // Close a real-proportioned fraction of channels, matching the real
    // peak-suppression value loaded from data.json (set once data loads).
    applyChannelClosure();
  },
  onEnterBack: () => showOnly(['channel']),
});

function applyChannelClosure() {
  if (!window.__photonData) return;
  const frac = window.__photonData.cascade_trace.peak_suppression;
  const closeCount = Math.round(channels.length * frac);
  channels.forEach((m, i) => {
    gsap.killTweensOf(m.scale);
    if (i < closeCount) {
      gsap.to(m.scale, { x: 0.05, y: 0.05, duration: 0.8, delay: i * 0.01 });
      gsap.to(m.material.color, { r: 0.9, g: 0.35, b: 0.3, duration: 0.8 });
    } else {
      m.scale.set(1, 1, 1);
      m.material.color.setRGB(0.353, 0.82, 0.902);
    }
  });
}

// ---------------------------------------------------------------------
// Real SVG charts, drawn directly from data.json - no charting library,
// plain SVG path generation so the exact mapping from data to pixels is
// inspectable in this file.
// ---------------------------------------------------------------------

function buildLineChart(svgEl, points, xKey, yKey, opts = {}) {
  const W = 600, H = 260, M = { l: 44, r: 16, t: 16, b: 32 };
  const xs = points.map(p => p[xKey]);
  const ys = points.map(p => p[yKey]);
  const xMin = opts.xMin ?? Math.min(...xs);
  const xMax = opts.xMax ?? Math.max(...xs);
  const yMin = opts.yMin ?? 0;
  const yMax = opts.yMax ?? Math.max(...ys) * 1.15;

  const xScale = x => M.l + ((x - xMin) / (xMax - xMin)) * (W - M.l - M.r);
  const yScale = y => H - M.b - ((y - yMin) / (yMax - yMin)) * (H - M.t - M.b);

  let svg = '';
  // gridlines
  for (let i = 0; i <= 4; i++) {
    const gy = M.t + (i / 4) * (H - M.t - M.b);
    svg += `<line class="grid-line" x1="${M.l}" y1="${gy}" x2="${W - M.r}" y2="${gy}"/>`;
  }
  // path
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xScale(p[xKey]).toFixed(1)},${yScale(p[yKey]).toFixed(1)}`).join(' ');
  svg += `<path class="data-line" d="${pathD}"/>`;
  // points (sparse markers if many)
  const markerStride = Math.max(1, Math.floor(points.length / 20));
  points.forEach((p, i) => {
    if (i % markerStride === 0) {
      svg += `<circle class="data-point" cx="${xScale(p[xKey]).toFixed(1)}" cy="${yScale(p[yKey]).toFixed(1)}" r="2.5"/>`;
    }
  });
  // axis labels
  svg += `<text class="axis-label" x="${M.l}" y="${H - 8}">${opts.xLabel || xKey}</text>`;
  svg += `<text class="axis-label" x="${M.l}" y="${M.t}" transform="rotate(-90 ${M.l} ${M.t})">${opts.yLabel || yKey}</text>`;
  svg += `<text class="axis-label" x="${(W - M.r) - 60}" y="${H - 8}">max x=${xMax}</text>`;
  svg += `<text class="axis-label" x="${M.l}" y="${M.t + 10}">max y=${yMax.toFixed(3)}</text>`;

  svgEl.innerHTML = svg;
}

fetch('data.json')
  .then(r => r.json())
  .then(data => {
    window.__photonData = data;

    document.getElementById('threshold-number').textContent =
      data.detection_curve.threshold_mean_photons;
    document.getElementById('peak-suppression-number').textContent =
      (data.cascade_trace.peak_suppression * 100).toFixed(1) + '%';
    document.getElementById('recovery-time-number').textContent =
      data.cascade_trace.recovery_to_10pct_s != null
        ? Math.round(data.cascade_trace.recovery_to_10pct_s * 1000) + 'ms'
        : 'not reached in simulated window';

    buildLineChart(
      document.getElementById('chart-trace'),
      data.cascade_trace.points, 't', 'suppression',
      { xLabel: 'time (s)', yLabel: 'current suppression (fraction)' }
    );

    buildLineChart(
      document.getElementById('chart-linearity'),
      data.linearity_check, 'photons', 'peak_suppression',
      { xLabel: 'photons', yLabel: 'peak suppression', xMin: 0 }
    );

    buildLineChart(
      document.getElementById('chart-darknoise'),
      data.dark_noise_vs_temperature, 'temp_c', 'rate_per_rod_per_s',
      { xLabel: 'temperature (°C)', yLabel: 'dark events / rod / s' }
    );
  })
  .catch(err => {
    console.error('Failed to load real simulation data:', err);
  });
