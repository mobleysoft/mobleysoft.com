// ══════════════════════════════════════════════════════════════════════
// bg.js — Mobleysoft Background: Schwarzschild Accretion Disk
// Powered by Mobleysoft Four (FOUR.SHADER_HEADER + SHADER_LIB)
// Low-GPU fullscreen fragment shader — auto-orbiting camera, no controls
// ══════════════════════════════════════════════════════════════════════

(function() {
'use strict';

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
if (isMobile) return; // Skip on mobile — CSS hides canvas anyway

if (typeof FOUR === 'undefined') {
  console.warn('[bg.js] FOUR not loaded — background disabled');
  return;
}

// ── Canvas ──
let canvas = document.getElementById('blackhole-canvas');
if (!canvas) {
  canvas = document.createElement('canvas');
  canvas.id = 'blackhole-canvas';
  canvas.style.cssText = 'display:block;position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;';
  document.body.insertBefore(canvas, document.body.firstChild);
}
canvas.style.display = 'block';

// ── WebGL2 Context ──
const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'low-power' });
if (!gl) { console.warn('[bg.js] WebGL2 unavailable'); return; }

// ── Custom Schwarzschild Accretion Shader ──
const BLACKHOLE_SCENE = `
// Mobleysoft palette
const vec3 GOLD = vec3(0.788, 0.635, 0.153);      // #c9a227
const vec3 GOLD_BRIGHT = vec3(0.941, 0.722, 0.0);  // #f0b800
const vec3 VOID_COL = vec3(0.039, 0.039, 0.078);   // #0a0a14
const vec3 BLUE_ACCENT = vec3(0.15, 0.25, 0.55);

// Star field
float starField(vec3 rd) {
  vec3 p = floor(rd * 600.0);
  float h = hash(p);
  if (h < 0.003) {
    float twinkle = 0.6 + 0.4 * sin(TIME * 0.7 + h * 628.0);
    float brightness = smoothstep(0.003, 0.0, h) * twinkle;
    // Color variation: mostly white, some blue/gold
    vec3 starCol = mix(vec3(0.85, 0.9, 1.0), GOLD_BRIGHT, step(0.0015, h));
    return brightness * 0.6;
  }
  return 0.0;
}

// Gravitational lensing — bends ray direction near the singularity
vec3 gravitationalLens(vec3 ro, vec3 rd, float Rs) {
  vec3 toCenter = -ro;
  float b = dot(toCenter, rd);
  float r = length(ro);
  // Deflection angle ~ 2Rs/b for weak field
  float impact = length(cross(toCenter, rd));
  if (impact < Rs * 1.5) return rd; // Inside photon sphere — absorbed
  float deflection = Rs / (impact * impact) * 2.0;
  vec3 perp = normalize(toCenter - rd * b);
  return normalize(rd + perp * deflection);
}

// Accretion disk — flat disk in xz plane with spiral structure
float accretionDisk(vec3 p, float Rs) {
  float r = length(p.xz);
  float innerEdge = Rs * 3.0;  // ISCO
  float outerEdge = Rs * 12.0;

  // Disk thickness — thin, flared at edges
  float diskH = mix(0.1, 0.4, smoothstep(innerEdge, outerEdge, r));
  float inDisk = smoothstep(diskH, 0.0, abs(p.y));

  // Radial falloff
  float radial = smoothstep(innerEdge * 0.8, innerEdge * 1.2, r)
               * (1.0 - smoothstep(outerEdge * 0.8, outerEdge * 1.2, r));

  // Spiral arms — logarithmic spiral
  float angle = atan(p.z, p.x);
  float spiral = sin(angle * 3.0 - log(r + 1.0) * 4.0 + TIME * 0.3) * 0.5 + 0.5;
  spiral = spiral * 0.6 + 0.4; // Don't go fully dark

  // Fine structure — turbulent filaments
  float turb = noise(vec3(p.xz * 0.5, TIME * 0.1)) * 0.3;

  return inDisk * radial * spiral + turb * inDisk * radial * 0.5;
}

// Doppler beaming — approaching side brighter
vec3 dopplerShift(vec3 baseCol, vec3 p, float Rs) {
  float r = length(p.xz);
  float orbitalV = sqrt(Rs / (2.0 * max(r, Rs * 3.0)));
  float angle = atan(p.z, p.x);
  // Velocity direction is tangential
  vec2 vel = vec2(-sin(angle), cos(angle)) * orbitalV;
  // Observer direction (camera roughly along +z)
  float doppler = 1.0 + vel.y * 0.8;
  // Blue-shift approaching, red-shift receding
  vec3 shifted = baseCol;
  shifted = mix(shifted, shifted * vec3(0.7, 0.8, 1.3), max(0.0, doppler - 1.0));
  shifted = mix(shifted, shifted * vec3(1.3, 0.9, 0.6), max(0.0, 1.0 - doppler));
  return shifted * (0.5 + doppler * 0.5);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - u_res * 0.5) / u_res.y;

  float t = TIME;
  float Rs = 1.0; // Schwarzschild radius

  // ── Auto-orbiting camera ──
  float camR = Rs * 18.0;
  float camSpeed = 0.04;
  float camY = Rs * 4.0 + sin(t * 0.02) * Rs * 2.0;
  vec3 ro = vec3(
    camR * cos(t * camSpeed),
    camY,
    camR * sin(t * camSpeed)
  );
  vec3 ta = vec3(0.0, -Rs * 0.3, 0.0); // Look slightly below center

  // Camera matrix
  vec3 ww = normalize(ta - ro);
  vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
  vec3 vv = cross(uu, ww);
  vec3 rd = normalize(uv.x * uu + uv.y * vv + 1.8 * ww);

  // ── Gravitational lensing ──
  rd = gravitationalLens(ro, rd, Rs);

  // ── Background: deep void + stars ──
  vec3 col = VOID_COL * 0.3;
  col += vec3(starField(rd)) * vec3(0.85, 0.9, 1.0);

  // ── Black hole shadow ──
  // Check if ray passes near singularity
  vec3 oc = ro;
  float b_param = dot(oc, rd);
  float c_param = dot(oc, oc);
  float impact = length(cross(oc, rd));

  // Photon sphere shadow
  float shadowR = Rs * 2.6; // Shadow radius (photon capture)
  float shadow = smoothstep(shadowR * 1.1, shadowR * 0.9, impact);
  col *= (1.0 - shadow * 0.98);

  // ── Accretion disk via ray-plane intersection ──
  // Disk in y=0 plane
  if (abs(rd.y) > 0.001) {
    float tHit = -ro.y / rd.y;
    if (tHit > 0.0) {
      vec3 hitP = ro + rd * tHit;
      float r = length(hitP.xz);

      if (r > Rs * 2.5 && r < Rs * 14.0) {
        float diskVal = accretionDisk(hitP, Rs);

        // Temperature gradient: hotter (bluer/whiter) near center, cooler (gold/red) at edge
        float tempGrad = smoothstep(Rs * 12.0, Rs * 3.0, r);
        vec3 hotCol = vec3(1.0, 0.95, 0.85);          // Near-white hot
        vec3 warmCol = GOLD_BRIGHT;                     // Gold
        vec3 coolCol = vec3(0.6, 0.25, 0.08);          // Deep amber/red

        vec3 diskCol = mix(coolCol, warmCol, smoothstep(0.0, 0.5, tempGrad));
        diskCol = mix(diskCol, hotCol, smoothstep(0.5, 1.0, tempGrad));

        // Doppler beaming
        diskCol = dopplerShift(diskCol, hitP, Rs);

        // Gravitational redshift near horizon
        float redshift = 1.0 - Rs / max(r, Rs * 2.6);
        diskCol *= redshift;

        // Emission intensity — brighter near ISCO
        float emission = diskVal * (0.4 + tempGrad * 0.8);

        // Additive blend
        col += diskCol * emission * 1.2;
      }
    }

    // Check second intersection (disk seen through/behind hole)
    // Only if first intersection was behind us or missed
    float tHit2 = -ro.y / rd.y;
    // We only have one plane intersection, but lensed rays may curve.
    // The gravitational lensing already handles bent-around-disk visibility.
  }

  // ── Photon ring — bright ring at the photon sphere ──
  float ringBright = exp(-pow((impact - Rs * 2.6) / (Rs * 0.15), 2.0));
  vec3 ringCol = mix(GOLD_BRIGHT, vec3(1.0, 0.9, 0.7), 0.5);
  col += ringCol * ringBright * 0.4;

  // ── Subtle particle streams (spiraling infall) ──
  // Volumetric spiral near the black hole
  float spiralAcc = 0.0;
  for (int i = 0; i < 8; i++) {
    float s = float(i) / 8.0;
    vec3 sp = ro + rd * (s * Rs * 20.0);
    float sr = length(sp.xz);
    float sa = atan(sp.z, sp.x);
    float stream = sin(sa * 5.0 - log(sr + 0.5) * 6.0 + t * 0.5) * 0.5 + 0.5;
    stream *= exp(-abs(sp.y) * 2.0); // Confined near disk plane
    stream *= smoothstep(Rs * 1.5, Rs * 3.0, sr) * smoothstep(Rs * 8.0, Rs * 5.0, sr);
    spiralAcc += stream * 0.02;
  }
  col += GOLD * spiralAcc;

  // ── Post-processing ──
  // Subtle blue/gold tint from Mobleysoft palette
  col = mix(col, col * vec3(0.9, 0.92, 1.05), 0.2);

  // Vignette
  float vig = 1.0 - 0.4 * length(uv);
  col *= vig;

  // Very subtle film grain
  col += (hash(vec3(gl_FragCoord.xy, TIME)) - 0.5) * 0.015;

  // Tonemap (ACES-like)
  col = col / (1.0 + col);

  // Gamma
  col = pow(max(col, vec3(0.0)), vec3(1.0 / 2.2));

  O = vec4(col, 1.0);
}
`;

// ── Vertex Shader ──
const VS = FOUR.VS;

// ── Fragment Shader Assembly ──
const FS = FOUR.SHADER_HEADER + FOUR.SHADER_LIB + BLACKHOLE_SCENE;

// ── Compile & Link ──
function compileShader(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error('[bg.js] Shader error:', gl.getShaderInfoLog(s));
    return null;
  }
  return s;
}

function linkProgram(vsSrc, fsSrc) {
  const prog = gl.createProgram();
  const v = compileShader(gl.VERTEX_SHADER, vsSrc);
  const f = compileShader(gl.FRAGMENT_SHADER, fsSrc);
  if (!v || !f) return null;
  gl.attachShader(prog, v);
  gl.attachShader(prog, f);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error('[bg.js] Link error:', gl.getProgramInfoLog(prog));
    return null;
  }
  return prog;
}

const prog = linkProgram(VS, FS);
if (!prog) { console.error('[bg.js] Shader compilation failed — background disabled'); return; }

const u_p = gl.getUniformLocation(prog, 'u_p');
const u_res = gl.getUniformLocation(prog, 'u_res');

// ── Fullscreen Quad ──
const buf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
const vao = gl.createVertexArray();
gl.bindVertexArray(vao);
gl.enableVertexAttribArray(0);
gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

// ── Four Parameter System ──
const params = new FOUR.ParamBuffer();
const timeRules = new FOUR.TimeRules();
const recursionRules = new FOUR.RecursionRules();

// Configure for ambient space scene
params.set(FOUR.SPACES.PHOTON, 520, 0.8, 0.005, 0.001);  // Dim, low scatter
params.set(FOUR.SPACES.TACTILE, 0.3, 0.1, 0.05, 0);      // Smooth, low metalness
params.set(FOUR.SPACES.MOBLEYAN, 0.8, 0.7, 0.6, 1.0);    // High aesthetic, moody
params.set(FOUR.SPACES.VOID, 0.95, 0.8, 0.3, 0.05);      // Deep void, high darkness

// Slow evolution rules — background should breathe, not distract
timeRules.mobleyan(40);   // Very slow aesthetic oscillation
timeRules.mobius(60);      // Very slow loop phase
timeRules.void_breathing();

// Recursion — void and light interplay
recursionRules.loopSelectsModes();

// ── Resize ──
function resize() {
  // Use reduced resolution for low GPU usage
  const scale = 0.65; // Render at 65% res
  canvas.width = Math.floor(innerWidth * devicePixelRatio * scale);
  canvas.height = Math.floor(innerHeight * devicePixelRatio * scale);
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  gl.viewport(0, 0, canvas.width, canvas.height);
}
resize();
addEventListener('resize', resize);

// ── Render Loop ──
let startTime = 0;
let running = true;

function frame(now) {
  if (!running) return;
  if (!startTime) startTime = now;
  const t = (now - startTime) / 1000;
  const dt = 1/60;

  // Tick parameter evolution
  timeRules.tick(params, t, dt);
  recursionRules.apply(params);

  // Upload & draw
  gl.useProgram(prog);
  params.upload(gl, u_p);
  gl.uniform2f(u_res, canvas.width, canvas.height);
  gl.bindVertexArray(vao);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

// ── Public API for Mission Control toggle ──
window._bgRenderer = {
  stop: function() { running = false; canvas.style.display = 'none'; },
  start: function() { running = true; canvas.style.display = 'block'; requestAnimationFrame(frame); },
  canvas: canvas
};

})();
