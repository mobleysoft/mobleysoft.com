// ══════════════════════════════════════════════════════════════════════
// four_blackhole.js — Mobleysoft Four Blackhole
// C(n(C)) cosmology engine powered by Mobleysoft Four.js
//
// 18 parameterization spaces. 72 floats. One singularity.
// No Three.js. No scene graph. No mesh geometry.
// Pure parametric rendering via raymarching/SDF on a full-screen quad.
// ══════════════════════════════════════════════════════════════════════

const FOUR_BLACKHOLE = (() => {
'use strict';

// ── The 18 Parameterization Spaces ──
const SPACES = {
  PARAM:        0,  // (time, dt, frame, seed)
  HYPER:        1,  // (adaptRate, decayRate, momentum, temperature)
  ORTHO:        2,  // (x, y, z, w)
  TANGENT:      3,  // (velocity, acceleration, jerk, curvature)
  NORMAL:       4,  // (c0, c1, c2, c3)
  EIGEN:        5,  // (mode0, mode1, mode2, dominance)
  HAMILTONIAN:  6,  // (kinetic, potential, total, phase)
  FOURIER:      7,  // (freq0, freq1, freq2, bandwidth)
  ENERGY:       8,  // (thermal, kinetic, potential, radiation)
  PHOTON:       9,  // (wavelength, intensity, scatter, absorption)
  PHONON:      10,  // (vibFreq, vibAmp, vibPhase, damping)
  TACTILE:     11,  // (roughness, metalness, subsurface, displacement)
  LAGRANGIAN:  12,  // (action, constraint, multiplier, variation)
  MOBLEYAN:    13,  // (aesthetic, mood, style, vision)
  MOBIUS:      14,  // (loopPhase, fixedPoint, orientation, twist)
  INFZERO:     15,  // (limit, approach, asymptote, epsilon)
  VOID:        16,  // (darkness, silence, absence, entropy)
  SINGULAR:    17,  // (convergence, criticalPoint, phaseDelta, bifurcation)
};

const SPACE_NAMES = Object.keys(SPACES);
const N_SPACES = 18;
const N_FLOATS = N_SPACES * 4;

// ── Parameter Buffer ──
class ParamBuffer {
  constructor() {
    this.data = new Float32Array(N_FLOATS);
    this.dirty = true;
    this.set(SPACES.PARAM, 0, 0, 0, Math.random());
    this.set(SPACES.HYPER, 0.1, 0.95, 0.9, 0.5);
    this.set(SPACES.ORTHO, 0, 0, 0, 0);
    this.set(SPACES.TANGENT, 0, 0, 0, 0);
    this.set(SPACES.NORMAL, 1, 1, 1, 1);
    this.set(SPACES.EIGEN, 1, 0.5, 0.25, 0.8);
    this.set(SPACES.HAMILTONIAN, 0.5, 0.5, 1.0, 0);
    this.set(SPACES.FOURIER, 1, 2, 4, 10);
    this.set(SPACES.ENERGY, 0.3, 0.5, 0.5, 0.1);
    this.set(SPACES.PHOTON, 580, 1, 0.01, 0.001);
    this.set(SPACES.PHONON, 440, 0, 0, 0.1);
    this.set(SPACES.TACTILE, 0.5, 0, 0.1, 0);
    this.set(SPACES.LAGRANGIAN, 0, 0, 0, 0);
    this.set(SPACES.MOBLEYAN, 0.7, 0.5, 0.5, 1.0);
    this.set(SPACES.MOBIUS, 0, 0, 1, 0);
    this.set(SPACES.INFZERO, 1e6, 0, 0, 1e-6);
    this.set(SPACES.VOID, 0.95, 1, 0.8, 0.1);
    this.set(SPACES.SINGULAR, 0, 0, 0, 0);
  }

  set(space, x, y, z, w) {
    const o = space * 4;
    this.data[o] = x; this.data[o+1] = y;
    this.data[o+2] = z; this.data[o+3] = w;
    this.dirty = true;
  }

  get(space) {
    const o = space * 4;
    return [this.data[o], this.data[o+1], this.data[o+2], this.data[o+3]];
  }

  setComponent(space, idx, val) {
    this.data[space * 4 + idx] = val;
    this.dirty = true;
  }

  upload(gl, loc) {
    if (this.dirty) {
      gl.uniform4fv(loc, this.data);
      this.dirty = false;
    }
  }
}

// ── Rules Over Time ──
class TimeRules {
  constructor() {
    this.rules = [];
  }

  add(space, component, fn) {
    this.rules.push({ space, component, fn });
    return this;
  }

  tick(params, t, dt) {
    for (const r of this.rules) {
      const cur = params.data[r.space * 4 + r.component];
      const next = r.fn(t, dt, cur, params);
      params.setComponent(r.space, r.component, next);
    }
    params.set(SPACES.PARAM, t, dt, params.data[2] + 1, params.data[3]);
  }

  hamiltonian(H) {
    const eps = 1e-4;
    this.add(SPACES.HAMILTONIAN, 0, (t, dt, q, p) => {
      const pp = p.get(SPACES.HAMILTONIAN);
      const Hp = H(q, pp[1] + eps) - H(q, pp[1] - eps);
      return q + (Hp / (2*eps)) * dt;
    });
    this.add(SPACES.HAMILTONIAN, 1, (t, dt, pp, p) => {
      const qq = p.get(SPACES.HAMILTONIAN);
      const Hq = H(qq[0] + eps, pp) - H(qq[0] - eps, pp);
      return pp - (Hq / (2*eps)) * dt;
    });
    return this;
  }

  fourier(baseFreq) {
    this.add(SPACES.FOURIER, 0, (t) => baseFreq * (1 + 0.1 * Math.sin(t * 0.3)));
    this.add(SPACES.FOURIER, 1, (t) => baseFreq * 2 * (1 + 0.05 * Math.sin(t * 0.7)));
    this.add(SPACES.FOURIER, 2, (t) => baseFreq * 4 * (1 + 0.02 * Math.cos(t * 1.1)));
    return this;
  }

  mobleyan(period) {
    this.add(SPACES.MOBLEYAN, 0, (t) => 0.5 + 0.5 * Math.sin(t / period));
    this.add(SPACES.MOBLEYAN, 1, (t) => 0.5 + 0.3 * Math.cos(t / period * 1.618));
    return this;
  }

  mobius(loopPeriod) {
    this.add(SPACES.MOBIUS, 0, (t, dt, cur, p) => {
      return (cur + dt / loopPeriod * Math.PI * 2) % (Math.PI * 2);
    });
    this.add(SPACES.MOBIUS, 3, (t, dt, cur, p) => {
      const aesthetic = p.data[SPACES.MOBLEYAN * 4];
      return cur + aesthetic * dt * 0.1;
    });
    return this;
  }

  void_breathing() {
    this.add(SPACES.VOID, 0, (t, dt, cur, p) => {
      const energy = p.data[SPACES.ENERGY * 4 + 3];
      return Math.max(0, Math.min(1, 1 - energy));
    });
    return this;
  }

  singular(threshold) {
    this.add(SPACES.SINGULAR, 0, (t, dt, cur, p) => {
      const energy = p.data[SPACES.HAMILTONIAN * 4 + 2];
      return energy > threshold ? Math.min(1, cur + dt * 2) : Math.max(0, cur - dt);
    });
    return this;
  }
}

// ── Rules Under Recursion ──
class RecursionRules {
  constructor() {
    this.maps = [];
  }

  map(fromSpace, fromComp, toSpace, toComp, fn) {
    this.maps.push({ from: [fromSpace, fromComp], to: [toSpace, toComp], fn });
    return this;
  }

  apply(params) {
    for (const m of this.maps) {
      const input = params.data[m.from[0] * 4 + m.from[1]];
      const output = m.fn(input, params);
      params.setComponent(m.to[0], m.to[1], output);
    }
  }

  lightRevealsMatter() {
    this.map(SPACES.PHOTON, 1, SPACES.TACTILE, 0, (intensity) => {
      return 0.3 + 0.7 * Math.min(1, intensity);
    });
    return this;
  }

  energyRadiates() {
    this.map(SPACES.ENERGY, 0, SPACES.PHOTON, 1, (thermal) => thermal * 2);
    this.map(SPACES.ENERGY, 3, SPACES.PHOTON, 2, (radiation) => radiation * 0.1);
    return this;
  }

  loopSelectsModes() {
    this.map(SPACES.MOBIUS, 0, SPACES.EIGEN, 3, (phase) => {
      return 0.5 + 0.5 * Math.cos(phase);
    });
    return this;
  }

  transitionOpensVoid() {
    this.map(SPACES.SINGULAR, 0, SPACES.VOID, 0, (convergence) => {
      return convergence > 0.8 ? 1 - convergence : 0.95;
    });
    return this;
  }
}

// ── GLSL Shader Header ──
const SHADER_HEADER = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 O;
uniform vec4 u_p[18];
uniform vec2 u_res;

#define P_PARAM       u_p[0]
#define P_HYPER       u_p[1]
#define P_ORTHO       u_p[2]
#define P_TANGENT     u_p[3]
#define P_NORMAL      u_p[4]
#define P_EIGEN       u_p[5]
#define P_HAMILTONIAN u_p[6]
#define P_FOURIER     u_p[7]
#define P_ENERGY      u_p[8]
#define P_PHOTON      u_p[9]
#define P_PHONON      u_p[10]
#define P_TACTILE     u_p[11]
#define P_LAGRANGIAN  u_p[12]
#define P_MOBLEYAN    u_p[13]
#define P_MOBIUS      u_p[14]
#define P_INFZERO     u_p[15]
#define P_VOID        u_p[16]
#define P_SINGULAR    u_p[17]

#define TIME          P_PARAM.x
#define DT            P_PARAM.y
#define FRAME         P_PARAM.z
#define SEED          P_PARAM.w

#define ADAPT_RATE    P_HYPER.x
#define DECAY         P_HYPER.y
#define MOMENTUM      P_HYPER.z
#define TEMPERATURE   P_HYPER.w

#define VELOCITY      P_TANGENT.x
#define ACCELERATION  P_TANGENT.y
#define JERK          P_TANGENT.z
#define CURVATURE     P_TANGENT.w

#define KINETIC_E     P_HAMILTONIAN.x
#define POTENTIAL_E   P_HAMILTONIAN.y
#define TOTAL_E       P_HAMILTONIAN.z
#define H_PHASE       P_HAMILTONIAN.w

#define FREQ0         P_FOURIER.x
#define FREQ1         P_FOURIER.y
#define FREQ2         P_FOURIER.z
#define BANDWIDTH     P_FOURIER.w

#define THERMAL_E     P_ENERGY.x
#define KINETIC_EN    P_ENERGY.y
#define POTENTIAL_EN  P_ENERGY.z
#define RADIATION     P_ENERGY.w

#define WAVELENGTH    P_PHOTON.x
#define INTENSITY     P_PHOTON.y
#define SCATTER       P_PHOTON.z
#define ABSORPTION    P_PHOTON.w

#define ROUGHNESS     P_TACTILE.x
#define METALNESS     P_TACTILE.y
#define SUBSURFACE    P_TACTILE.z
#define DISPLACEMENT  P_TACTILE.w

#define AESTHETIC     P_MOBLEYAN.x
#define MOOD          P_MOBLEYAN.y
#define STYLE         P_MOBLEYAN.z
#define VISION        P_MOBLEYAN.w

#define LOOP_PHASE    P_MOBIUS.x
#define FIXED_POINT   P_MOBIUS.y
#define M_ORIENT      P_MOBIUS.z
#define TWIST         P_MOBIUS.w

#define DARKNESS      P_VOID.x
#define SILENCE       P_VOID.y
#define ABSENCE       P_VOID.z
#define ENTROPY       P_VOID.w

#define CONVERGENCE   P_SINGULAR.x
#define CRIT_POINT    P_SINGULAR.y
#define PHASE_DELTA   P_SINGULAR.z
#define BIFURCATION   P_SINGULAR.w

#define PI 3.14159265358979
#define TAU 6.28318530717959
`;

// ── GLSL Shader Library ──
const SHADER_LIB = `
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}

float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float hash2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}

float noise(vec3 p){
  vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),
                 mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
                 mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
}

float fbm(vec3 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p*=2.07;a*=.48;}return v;}

vec3 wavelengthToRGB(float wl) {
  float t = clamp((wl - 380.0) / 400.0, 0.0, 1.0);
  vec3 c;
  if (t < 0.25) c = mix(vec3(0.3,0,0.5), vec3(0,0,1), t*4.0);
  else if (t < 0.5) c = mix(vec3(0,0,1), vec3(0,1,0), (t-0.25)*4.0);
  else if (t < 0.75) c = mix(vec3(0,1,0), vec3(1,1,0), (t-0.5)*4.0);
  else c = mix(vec3(1,1,0), vec3(1,0,0), (t-0.75)*4.0);
  return c;
}

float fourierMod(float x, float f0, float f1, float f2) {
  return sin(x*f0) + 0.5*sin(x*f1+PI*0.25) + 0.25*sin(x*f2+PI*0.5);
}

vec2 mobiusTransform(vec2 p, float phase, float twist) {
  float a = phase + twist;
  float r = length(p);
  float theta = atan(p.y, p.x) + a;
  float s = sign(sin(theta * 0.5 + twist));
  return vec2(r * cos(theta), r * sin(theta) * s);
}
`;

// ── Blackhole Scene Shader ──
const BLACKHOLE_SCENE = `

// ═══════════════════════════════════════════════════════════════
// BLACKHOLE — C(n(C)) Cosmology via Four.js Parameterization
// ═══════════════════════════════════════════════════════════════

// ── Constants ──
const float Rs = 1.0;          // Schwarzschild radius (normalized)
const float DISK_INNER = 1.5;  // ISCO
const float DISK_OUTER = 6.0;  // outer accretion disk
const float GM = 1.0;          // gravitational parameter

// ── Hexagonal distance (event horizon cells) ──
float hexDist(vec2 p) {
  p = abs(p);
  return max(dot(p, vec2(0.866025, 0.5)), p.y);
}

vec4 hexCoords(vec2 uv) {
  vec2 r = vec2(1.0, 1.7320508);
  vec2 h = r * 0.5;
  vec2 a = mod(uv, r) - h;
  vec2 b = mod(uv - h, r) - h;
  vec2 gv = dot(a,a) < dot(b,b) ? a : b;
  float x = atan(gv.x, gv.y);
  float y = 0.5 - hexDist(gv);
  vec2 id = uv - gv;
  return vec4(gv.x, gv.y, id.x, id.y);
}

// ── Gravitational lensing — bend ray toward singularity ──
vec3 gravLens(vec3 ro, vec3 rd, float mass) {
  // Simplified geodesic: deflect ray based on impact parameter
  vec3 toCenter = -ro;
  float b = length(cross(rd, toCenter)); // impact parameter
  float deflect = 2.0 * mass / max(b, 0.01);
  vec3 bendDir = normalize(toCenter - dot(toCenter, rd) * rd);
  return normalize(rd + bendDir * deflect * 0.15);
}

// ── Doppler shift factor for orbiting material ──
float dopplerFactor(vec3 pos, vec3 rd) {
  float r = length(pos.xz);
  if (r < 0.01) return 1.0;
  // Orbital velocity (Keplerian)
  float v_orb = sqrt(GM / max(r, Rs));
  // Tangential direction
  vec3 v_dir = normalize(vec3(-pos.z, 0.0, pos.x));
  // Radial velocity component toward observer
  float v_r = dot(v_dir * v_orb, -rd);
  // Relativistic doppler: sqrt((1+beta)/(1-beta))
  float beta = clamp(v_r * 0.3, -0.8, 0.8);
  return sqrt((1.0 + beta) / (1.0 - beta));
}

// ── Accretion disk density (volumetric) ──
float diskDensity(vec3 p) {
  float r = length(p.xz);
  float h = abs(p.y);
  // Radial profile: peaks between ISCO and mid-disk
  float radial = smoothstep(DISK_INNER, DISK_INNER + 0.5, r) *
                 smoothstep(DISK_OUTER, DISK_OUTER - 1.5, r);
  // Vertical profile: thin disk with height ~ r^(-1)
  float diskH = 0.08 + 0.04 * (r - DISK_INNER);
  float vertical = exp(-h * h / (diskH * diskH));
  // Spiral arms via Fourier harmonics
  float theta = atan(p.z, p.x);
  float spiral = 0.6 + 0.4 * fourierMod(
    theta * 2.0 - log(max(r, 0.1)) * 4.0 + TIME * 0.8,
    FREQ0 * 0.5, FREQ1 * 0.25, FREQ2 * 0.125
  );
  // Turbulence
  float turb = fbm(p * 3.0 + vec3(TIME * 0.2, 0, TIME * 0.1));
  return radial * vertical * spiral * (0.7 + 0.3 * turb);
}

// ── Accretion disk temperature → color ──
vec3 diskColor(vec3 p, vec3 rd) {
  float r = length(p.xz);
  // Temperature: hotter near ISCO (T ~ r^-3/4 for thin disk)
  float temp = pow(max(DISK_INNER / r, 0.0), 0.75);
  // Base color from temperature: hot=blue-white, cool=red-orange
  vec3 hotColor = vec3(0.7, 0.8, 1.0);   // inner: blue-white
  vec3 warmColor = vec3(1.0, 0.6, 0.15);  // mid: orange
  vec3 coolColor = vec3(0.8, 0.15, 0.05); // outer: deep red
  vec3 baseCol;
  if (temp > 0.6) baseCol = mix(warmColor, hotColor, (temp - 0.6) / 0.4);
  else baseCol = mix(coolColor, warmColor, temp / 0.6);

  // Doppler shift: blue-shift approaching side, red-shift receding
  float doppler = dopplerFactor(p, rd);
  // Shift the effective wavelength
  float baseWL = mix(700.0, 400.0, temp); // base wavelength from temperature
  float shiftedWL = baseWL / doppler;
  vec3 dopplerCol = wavelengthToRGB(clamp(shiftedWL, 380.0, 780.0));

  // Blend physical color with doppler-shifted color
  baseCol = mix(baseCol, dopplerCol, 0.4);

  // PHOTON space modulation: wavelength tints the disk
  float photonShift = (WAVELENGTH - 580.0) / 200.0;
  baseCol = mix(baseCol, wavelengthToRGB(WAVELENGTH), abs(photonShift) * 0.15);

  // Intensity from PHOTON space and temperature — Gargantua is blazing bright
  float luminance = temp * temp * INTENSITY * 6.0;
  // Doppler beaming: approaching side is brighter (I ~ doppler^4 for Kerr)
  luminance *= pow(doppler, 4.0) * 0.7;

  // MOBLEYAN aesthetic modulation
  baseCol = mix(baseCol, baseCol * vec3(1.0 + AESTHETIC * 0.2, 1.0, 1.0 + MOOD * 0.15), 0.3);

  return baseCol * luminance;
}

// ── Event horizon surface ──
vec3 horizonColor(vec3 p, vec3 n, vec3 rd) {
  // Spherical UV for hexagonal tiling
  float theta = atan(p.z, p.x);
  float phi = acos(clamp(p.y / length(p), -1.0, 1.0));
  vec2 hexUV = vec2(theta / PI, phi / PI) * (6.0 + P_EIGEN.x * 2.0);

  // Hexagonal cells
  vec4 hc = hexCoords(hexUV);
  float cellEdge = smoothstep(0.05, 0.02, hc.y);
  float cellID = hash2(hc.zw);

  // EIGEN modes select which cells glow
  float mode0 = sin(cellID * TAU * P_EIGEN.x + TIME * 0.5);
  float mode1 = cos(cellID * TAU * P_EIGEN.y + TIME * 0.7);
  float mode2 = sin(cellID * TAU * P_EIGEN.z + TIME * 0.3);
  float eigenGlow = (mode0 + mode1 * 0.5 + mode2 * 0.25) * P_EIGEN.w;
  eigenGlow = smoothstep(0.3, 1.2, eigenGlow);

  // MOBIUS: C(n(C)) selects which cells activate
  float mobiusSelect = sin(LOOP_PHASE + cellID * TAU) * 0.5 + 0.5;
  mobiusSelect = pow(mobiusSelect, 2.0 - TWIST);
  eigenGlow *= mobiusSelect;

  // Fresnel rim
  float fresnel = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);

  // SINGULAR: convergence intensifies horizon glow at critical point
  float singularBoost = 1.0 + CONVERGENCE * 2.0;

  // Color: deep orange-gold rim, cells in blue-white
  vec3 rimCol = vec3(1.0, 0.4, 0.08) * fresnel * 1.5 * singularBoost;
  vec3 cellCol = mix(vec3(0.05, 0.1, 0.2), vec3(0.3, 0.6, 1.0), eigenGlow) * cellEdge * 0.8;

  // ROUGHNESS from TACTILE modulates the edge sharpness
  cellCol *= (1.0 - ROUGHNESS * 0.4);

  return rimCol + cellCol * eigenGlow;
}

// ── Particle orbits (computed analytically in the shader) ──
float particleField(vec3 p) {
  float acc = 0.0;
  // Multiple orbital shells driven by HAMILTONIAN/TANGENT
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    float orbitR = DISK_INNER + fi * 0.5 + VELOCITY * 0.2;
    float orbitSpeed = sqrt(GM / orbitR) * (1.0 + ACCELERATION * 0.1);
    float phase = TIME * orbitSpeed + fi * PI * 0.25 + H_PHASE;
    // Particle position on this orbit
    vec3 pp = vec3(orbitR * cos(phase), sin(phase * 1.3 + fi) * 0.05, orbitR * sin(phase));
    float d = length(p - pp);
    // Glow falloff
    acc += 0.003 / (d * d + 0.001);
  }
  // Infalling particles — CURVATURE drives infall rate
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float t = fract(TIME * 0.15 + fi * 0.2) * 0.9 + 0.1;
    float inR = mix(DISK_OUTER, Rs * 1.1, pow(t, 1.5 + CURVATURE));
    float inTheta = TIME * 2.0 + fi * TAU / 5.0 + log(max(inR, 0.1)) * 3.0;
    vec3 ip = vec3(inR * cos(inTheta), (1.0 - t) * 0.3 * sin(fi), inR * sin(inTheta));
    float d = length(p - ip);
    float brightness = (1.0 - t) * 0.5; // dimmer as they fall in
    acc += brightness * 0.002 / (d * d + 0.0005);
  }
  return acc;
}

// ── Singularity void ──
float singularityVoid(vec3 p) {
  float r = length(p);
  // Absolute blackness at center — VOID space controls the depth
  float voidDepth = Rs * (0.8 + DARKNESS * 0.4);
  float voidFalloff = smoothstep(voidDepth, voidDepth * 0.3, r);
  // ABSENCE increases the void radius
  voidFalloff *= (1.0 + ABSENCE * 0.5);
  // ENTROPY adds noise at the boundary
  float boundary = smoothstep(voidDepth * 0.8, voidDepth * 1.2, r);
  float entropyNoise = fbm(normalize(p) * 8.0 + TIME * 0.3) * ENTROPY * boundary;
  return clamp(voidFalloff - entropyNoise * 0.3, 0.0, 1.0);
}

// ── Scene SDF (event horizon sphere) ──
float sdSphere(vec3 p, float r) {
  return length(p) - r;
}

vec3 sphereNormal(vec3 p) {
  return normalize(p);
}

// ── Main raymarching loop ──
void main() {
  vec2 uv = (gl_FragCoord.xy - u_res * 0.5) / u_res.y;

  // MOBIUS self-referential UV distortion via C(n(C))
  if (abs(TWIST) > 0.005) {
    uv = mobiusTransform(uv, LOOP_PHASE * 0.05, TWIST * 0.03);
  }

  // ── Camera setup — near-equatorial Gargantua view ──
  float camDist = 9.0 + sin(TIME * 0.07) * 1.0;
  float camAngle = TIME * 0.06;
  // Near-equatorial: 4-8° above disk plane — this is what makes Gargantua look like Gargantua
  float camY = 0.5 + sin(TIME * 0.04) * 0.15;
  // HAMILTONIAN phase modulates orbit
  camAngle += H_PHASE * 0.3;
  camDist += KINETIC_E * 0.5;

  vec3 ro = vec3(camDist * cos(camAngle), camY, camDist * sin(camAngle));
  vec3 ta = vec3(0.0, 0.0, 0.0); // look at singularity

  // Camera matrix
  vec3 ww = normalize(ta - ro);
  vec3 uu = normalize(cross(ww, vec3(0, 1, 0)));
  vec3 vv = cross(uu, ww);
  float fov = 1.1 + P_EIGEN.w * 0.2;
  vec3 rd = normalize(uv.x * uu + uv.y * vv + fov * ww);

  // ── Gravitational lensing — pre-bend before march ──
  rd = gravLens(ro, rd, GM * (1.0 + POTENTIAL_E * 0.5));

  // ── Background: deep space ──
  vec3 col = vec3(0.0);

  // Stars
  vec3 starDir = normalize(rd);
  float sf = hash(floor(starDir * 500.0));
  if (sf > 0.997) {
    float twinkle = 0.5 + 0.5 * sin(TIME * 1.5 + sf * 100.0);
    col += vec3(0.8, 0.85, 1.0) * smoothstep(0.997, 1.0, sf) * 0.7 * twinkle;
  }

  // ── Raymarching ──
  float t = 0.0;
  float hitHorizon = -1.0;
  vec3 diskAccum = vec3(0.0);   // volumetric disk accumulation
  float diskAlphaAccum = 0.0;
  float particleAccum = 0.0;
  float voidAccum = 0.0;
  bool hitSomething = false;

  for (int i = 0; i < 128; i++) {
    vec3 p = ro + rd * t;
    float r = length(p);

    // ── Check event horizon sphere ──
    float dHorizon = sdSphere(p, Rs);
    if (dHorizon < 0.01 && hitHorizon < 0.0) {
      hitHorizon = t;
    }

    // ── Singularity: if inside Rs, pure void ──
    if (r < Rs * 0.9) {
      voidAccum = 1.0;
      break;
    }

    // ── Accumulate accretion disk (volumetric) ──
    if (r > DISK_INNER * 0.8 && r < DISK_OUTER * 1.3) {
      float density = diskDensity(p);
      if (density > 0.001) {
        vec3 dcol = diskColor(p, rd);
        float alpha = density * 0.15;
        diskAccum += dcol * alpha * (1.0 - diskAlphaAccum);
        diskAlphaAccum += alpha * (1.0 - diskAlphaAccum);
      }
    }

    // ── Accumulate particles ──
    if (r > Rs && r < DISK_OUTER * 1.5) {
      particleAccum += particleField(p) * 0.5;
    }

    // ── Accumulate void near singularity ──
    if (r < Rs * 2.0) {
      voidAccum = max(voidAccum, singularityVoid(p));
    }

    // ── Iterative geodesic bending — ray curves toward BH continuously ──
    // This creates the lensed disk arc visible over the top of the shadow
    if (r < 12.0 && r > Rs * 1.05) {
      float bendStr = GM * 2.0 / (r * r + 0.5);
      vec3 bendDir = -normalize(p);
      rd = normalize(rd + bendDir * bendStr * min(dHorizon * 0.5, 0.15));
    }

    // ── Step size: adaptive — smaller near horizon ──
    float stepSize = max(0.015, min(dHorizon * 0.4, 0.25));
    // Near the disk, step finer
    if (abs(p.y) < 0.6 && r > DISK_INNER * 0.5 && r < DISK_OUTER * 1.5) {
      stepSize = min(stepSize, 0.06);
    }
    t += stepSize;

    if (t > 25.0) break;
    if (diskAlphaAccum > 0.95) break;
  }

  // ── Compose layers ──

  // 1. Accretion disk (additive, volumetric) — Gargantua is BRIGHT
  col += diskAccum * (5.0 + THERMAL_E * 2.0);

  // 2. Event horizon surface — absolute black shadow (no decoration, like Gargantua)
  // The shadow IS the absence of light. Hex patterns are inside the horizon and invisible.
  if (hitHorizon > 0.0) {
    // Pure gravitational shadow — photons cannot escape, shadow is perfect black
    col = mix(col, vec3(0.0), 0.98);
  }

  // 3. Particles (additive glow)
  vec3 particleColor = mix(
    vec3(1.0, 0.6, 0.1),
    vec3(0.4, 0.7, 1.0),
    MOOD
  ) * INTENSITY;
  col += particleColor * min(particleAccum, 3.0);

  // 4. Singularity void — absolute black
  // VOID space: darkness=how black, silence=falloff sharpness
  col = mix(col, vec3(0.0), voidAccum * DARKNESS);

  // 5. Photon ring — razor-sharp bright ring at photon sphere (Gargantua's defining feature)
  {
    vec3 toOrigin = -ro;
    float tClosest = dot(toOrigin, rd);
    vec3 closest = ro + rd * max(tClosest, 0.0);
    float closestR = length(closest);
    float photonR = Rs * 1.5;
    // Narrow, intensely bright ring — Gargantua's photon ring is thin and blazing
    float ringBright = exp(-pow((closestR - photonR) * 20.0, 2.0)) * 6.0;
    ringBright += exp(-pow((closestR - photonR) * 50.0, 2.0)) * 12.0; // inner spike
    // SCATTER modulates
    ringBright *= (0.8 + SCATTER * 30.0);
    // Warm yellow-white — photon ring takes on disk color
    vec3 ringCol = mix(vec3(1.0, 0.88, 0.55), vec3(0.85, 0.92, 1.0), AESTHETIC) * ringBright;
    col += ringCol;
  }

  // 6. Gravitational lensing glow near horizon
  {
    vec3 toOrigin = -ro;
    float tCA = dot(toOrigin, rd);
    vec3 ca = ro + rd * max(tCA, 0.0);
    float caR = length(ca);
    float lensGlow = exp(-pow((caR - Rs * 2.5) * 3.0, 2.0)) * 0.5;
    col += vec3(0.4, 0.2, 0.05) * lensGlow * POTENTIAL_E;
  }

  // ── Post-processing ──

  // Tonemap (ACES-ish)
  col = col * (2.51 * col + 0.03) / (col * (2.43 * col + 0.59) + 0.14);

  // MOBLEYAN aesthetic color grading
  col = mix(col, col * vec3(0.9 + AESTHETIC * 0.15, 1.0, 1.0 + MOOD * 0.1), 0.3);

  // STYLE darkens or lightens the midtones
  col = pow(col, vec3(1.0 / (0.8 + STYLE * 0.4)));

  // Vignette — VOID.darkness deepens it
  float vig = 1.0 - (0.25 + DARKNESS * 0.15) * dot(v_uv - 0.5, v_uv - 0.5) * 2.0;
  col *= max(vig, 0.0);

  // Film grain — ENTROPY controls amount
  float grain = hash(vec3(gl_FragCoord.xy, TIME)) * (0.02 + ENTROPY * 0.015);
  col += grain;

  // SINGULAR.bifurcation: at high bifurcation, add chromatic fringing
  if (BIFURCATION > 0.1) {
    float ca_amount = BIFURCATION * 0.003;
    vec2 ca_offset = (v_uv - 0.5) * ca_amount;
    // Subtle RGB split toward edges
    col.r *= 1.0 + length(ca_offset) * 20.0 * BIFURCATION;
    col.b *= 1.0 - length(ca_offset) * 10.0 * BIFURCATION;
  }

  // Gamma
  col = pow(max(col, vec3(0.0)), vec3(1.0 / 2.2));

  // Final clamp
  col = clamp(col, 0.0, 1.0);

  O = vec4(col, 1.0);
}
`;

// ── Vertex Shader ──
const VS = `#version 300 es
in vec2 a;out vec2 v_uv;void main(){v_uv=a*.5+.5;gl_Position=vec4(a,0,1);}`;

// ── Renderer ──
class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' });
    if (!this.gl) throw new Error('WebGL2 not available');
    this.params = new ParamBuffer();
    this.timeRules = new TimeRules();
    this.recursionRules = new RecursionRules();
    this.startTime = 0;
    this.running = false;

    const gl = this.gl;

    // Compile shader
    const fs = SHADER_HEADER + SHADER_LIB + BLACKHOLE_SCENE;
    this.prog = this._link(VS, fs);
    if (!this.prog) throw new Error('Shader compile failed');

    this.u_p = gl.getUniformLocation(this.prog, 'u_p');
    this.u_res = gl.getUniformLocation(this.prog, 'u_res');

    // Full-screen quad
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  }

  _compile(type, src) {
    const gl = this.gl;
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('FOUR shader error:', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  _link(vs, fs) {
    const gl = this.gl;
    const p = gl.createProgram();
    const v = this._compile(gl.VERTEX_SHADER, vs);
    const f = this._compile(gl.FRAGMENT_SHADER, fs);
    if (!v || !f) return null;
    gl.attachShader(p, v); gl.attachShader(p, f);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error('FOUR link error:', gl.getProgramInfoLog(p));
      return null;
    }
    return p;
  }

  resize() {
    const c = this.canvas;
    const dpr = Math.min(devicePixelRatio, 2);
    c.width = innerWidth * dpr;
    c.height = innerHeight * dpr;
    c.style.width = '100%'; c.style.height = '100%';
    this.gl.viewport(0, 0, c.width, c.height);
  }

  frame(now) {
    if (!this.startTime) this.startTime = now;
    const t = (now - this.startTime) / 1000;
    const dt = 1/60;
    const gl = this.gl;

    this.timeRules.tick(this.params, t, dt);
    this.recursionRules.apply(this.params);

    gl.useProgram(this.prog);
    this.params.upload(gl, this.u_p);
    gl.uniform2f(this.u_res, this.canvas.width, this.canvas.height);

    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    if (this.running) requestAnimationFrame(n => this.frame(n));
  }

  start() {
    this.running = true;
    this.resize();
    addEventListener('resize', () => this.resize());
    requestAnimationFrame(n => this.frame(n));
  }

  stop() {
    this.running = false;
  }
}

// ══════════════════════════════════════════════════════════════════════
// CnC — Command and Control SCADA Bridge
// Polls https://scada.mobleysoft.com/cnc and feeds into ParamBuffer
// ══════════════════════════════════════════════════════════════════════
class CnC {
  constructor(params) {
    this.params = params;
    this.cFunc = 30;
    this.depth = 1;
    this.heads = 0;
    this.scada = 1.0;
    this.sessions = 1;
    this.load = 0.3;
    this.mass = 50;
    this.ventures = 145;
  }

  process() {
    this.depth = 1 + Math.floor(Math.max(0, this.cFunc - 27) / 27);
    this.mass = 50 * (1 + this.depth * 0.15);
    this.load = Math.min(1.0, (this.heads + 1) * this.sessions / 20);

    const p = this.params;

    // cFunc → SINGULAR: convergence + critical point
    // Higher cFunc = closer to singularity convergence
    p.setComponent(SPACES.SINGULAR, 0, Math.min(1.0, this.cFunc / 60));
    p.setComponent(SPACES.SINGULAR, 1, this.cFunc);
    // Bifurcation from load variance
    p.setComponent(SPACES.SINGULAR, 3, this.load > 0.7 ? (this.load - 0.7) * 3.3 : 0);

    // heads → EIGEN: active heads = mode amplitudes
    p.setComponent(SPACES.EIGEN, 0, 1.0 + this.heads * 0.3);
    p.setComponent(SPACES.EIGEN, 1, 0.5 + this.heads * 0.15);
    p.setComponent(SPACES.EIGEN, 2, 0.25 + this.heads * 0.1);
    p.setComponent(SPACES.EIGEN, 3, Math.min(1.0, 0.5 + this.heads * 0.2));

    // scada → MOBLEYAN: system health = aesthetic quality
    p.setComponent(SPACES.MOBLEYAN, 0, this.scada);
    // Mood from scada deviation
    p.setComponent(SPACES.MOBLEYAN, 1, this.scada > 0.8 ? 0.7 : 0.3);
    // Vision = always maximum when scada is healthy
    p.setComponent(SPACES.MOBLEYAN, 3, this.scada);

    // load → ENERGY: system load = energy state
    p.setComponent(SPACES.ENERGY, 0, this.load * 0.8); // thermal
    p.setComponent(SPACES.ENERGY, 1, this.load * 0.6); // kinetic
    p.setComponent(SPACES.ENERGY, 2, (1.0 - this.load) * 0.5); // potential (inverse)
    p.setComponent(SPACES.ENERGY, 3, this.load * 0.4); // radiation

    // sessions → TANGENT: active sessions = velocity/acceleration
    p.setComponent(SPACES.TANGENT, 0, Math.min(2.0, this.sessions * 0.15)); // velocity
    p.setComponent(SPACES.TANGENT, 1, this.sessions > 5 ? 0.3 : 0.1); // acceleration
    p.setComponent(SPACES.TANGENT, 3, Math.min(1.0, this.sessions * 0.1)); // curvature

    // Derived: load affects PHOTON intensity
    p.setComponent(SPACES.PHOTON, 1, 0.8 + this.load * 0.4);
    // Scada health affects PHOTON wavelength (healthy=gold, unhealthy=red)
    p.setComponent(SPACES.PHOTON, 0, this.scada > 0.7 ? 580 : 650);

    // Mass/depth affect HAMILTONIAN potential
    p.setComponent(SPACES.HAMILTONIAN, 1, 0.5 + this.depth * 0.2);
  }

  poll() {
    fetch('https://scada.mobleysoft.com/cnc', { signal: AbortSignal.timeout(3000) })
      .then(r => r.ok ? r.json() : null)
      .then(s => {
        if (!s) return;
        if (s.cFunc !== undefined) this.cFunc = s.cFunc;
        if (s.heads !== undefined) this.heads = s.heads;
        if (s.scada !== undefined) this.scada = s.scada;
        if (s.sessions !== undefined) this.sessions = s.sessions;
        if (s.ventures !== undefined) this.ventures = s.ventures;
        this.process();
      }).catch(() => {});
  }

  start() {
    this.process();
    this.poll();
    setInterval(() => this.poll(), 12000);
  }
}

// ══════════════════════════════════════════════════════════════════════
// initFourBlackhole — Public API
// Sets up the complete Four.js blackhole on the given canvas
// ══════════════════════════════════════════════════════════════════════
function initFourBlackhole(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) throw new Error(`Canvas #${canvasId} not found`);

  const renderer = new Renderer(canvas);
  const params = renderer.params;
  const timeRules = renderer.timeRules;
  const recursionRules = renderer.recursionRules;
  const cnc = new CnC(params);

  // ── Blackhole-specific initial parameter values ──

  // PARAM: base coordinates
  params.set(SPACES.PARAM, 0, 0, 0, Math.random());

  // HAMILTONIAN: singularity gravity well
  // kinetic=orbital energy, potential=gravity, total=sum, phase=orbital angle
  params.set(SPACES.HAMILTONIAN, 0.6, 0.8, 1.4, 0);

  // FOURIER: accretion disk spiral frequencies
  // Three harmonics for the spiral arms + bandwidth
  params.set(SPACES.FOURIER, 2.0, 4.0, 8.0, 12.0);

  // PHOTON: accretion disk light
  // wavelength=580nm (gold), intensity=1.2, scatter=0.02, absorption=0.005
  params.set(SPACES.PHOTON, 580, 1.2, 0.02, 0.005);

  // VOID: the singularity itself
  // darkness=0.98 (near absolute), silence=1, absence=0.9, entropy=0.15
  params.set(SPACES.VOID, 0.98, 1.0, 0.9, 0.15);

  // SINGULAR: event horizon state
  // convergence=0.3, criticalPoint=30 (cFunc), phaseDelta=0, bifurcation=0
  params.set(SPACES.SINGULAR, 0.3, 30, 0, 0);

  // MOBLEYAN: aesthetic (driven by scada health)
  params.set(SPACES.MOBLEYAN, 0.8, 0.6, 0.5, 1.0);

  // MOBIUS: C(n(C)) self-reference
  // loopPhase=0, fixedPoint=0, orientation=1, twist=0
  params.set(SPACES.MOBIUS, 0, 0, 1, 0);

  // ENERGY: blackhole energy states
  // thermal=0.4 (disk temp), kinetic=0.6 (orbital), potential=0.8 (gravity well), radiation=0.2
  params.set(SPACES.ENERGY, 0.4, 0.6, 0.8, 0.2);

  // EIGEN: mode decomposition for hex cells
  params.set(SPACES.EIGEN, 1.0, 0.6, 0.3, 0.8);

  // TANGENT: particle velocities
  params.set(SPACES.TANGENT, 0.5, 0.1, 0, 0.3);

  // TACTILE: event horizon surface
  params.set(SPACES.TACTILE, 0.6, 0.8, 0.2, 0);

  // ── TimeRules: differential equations evolving the blackhole ──

  // 1. Hamiltonian conservation for orbital mechanics
  //    H(q,p) = p^2/2 - GM/q (Kepler potential)
  timeRules.hamiltonian((q, p) => {
    return 0.5 * p * p - 1.0 / Math.max(Math.abs(q), 0.01);
  });

  // 2. Fourier harmonics for accretion disk spiral
  //    Base frequency slowly drifts, overtones track
  timeRules.fourier(2.0);

  // 3. Mobleyan oscillation — aesthetic breathing
  //    Period=12s, golden-ratio modulated mood
  timeRules.mobleyan(12.0);

  // 4. Mobius self-reference — C(n(C)) loop
  //    Period=8s, twist accumulates from aesthetic
  timeRules.mobius(8.0);

  // 5. Void breathing inversely with energy
  timeRules.void_breathing();

  // 6. Singular phase transitions at event horizon
  //    Threshold=0.8 total energy triggers convergence
  timeRules.singular(0.8);

  // Additional blackhole-specific time rules:

  // VOID.entropy oscillates slowly (singularity fluctuations)
  timeRules.add(SPACES.VOID, 3, (t) => {
    return 0.1 + 0.08 * Math.sin(t * 0.13) + 0.03 * Math.cos(t * 0.31);
  });

  // VOID.absence pulses with C(n(C)) depth
  timeRules.add(SPACES.VOID, 2, (t, dt, cur, p) => {
    const convergence = p.data[SPACES.SINGULAR * 4];
    return 0.8 + 0.15 * Math.sin(t * 0.2) + convergence * 0.1;
  });

  // SINGULAR.phaseDelta tracks the rate of change of convergence
  timeRules.add(SPACES.SINGULAR, 2, (t, dt, cur, p) => {
    const convergence = p.data[SPACES.SINGULAR * 4];
    return (convergence - cur) / Math.max(dt, 0.001);
  });

  // ENERGY.radiation oscillates with accretion rate
  timeRules.add(SPACES.ENERGY, 3, (t, dt, cur, p) => {
    const load = p.data[SPACES.ENERGY * 4]; // thermal
    return 0.15 + 0.1 * Math.sin(t * 0.5) + load * 0.3;
  });

  // PHOTON.scatter modulates with disk activity
  timeRules.add(SPACES.PHOTON, 2, (t, dt, cur, p) => {
    const radiation = p.data[SPACES.ENERGY * 4 + 3];
    return 0.01 + radiation * 0.04 + 0.005 * Math.sin(t * 0.7);
  });

  // TANGENT.jerk — tidal forces oscillate
  timeRules.add(SPACES.TANGENT, 2, (t) => {
    return 0.05 * Math.sin(t * 1.3) * Math.cos(t * 0.7);
  });

  // EIGEN.dominance pulses with the Mobius loop
  timeRules.add(SPACES.EIGEN, 3, (t, dt, cur, p) => {
    const loopPhase = p.data[SPACES.MOBIUS * 4];
    return 0.6 + 0.3 * Math.cos(loopPhase);
  });

  // HYPER.temperature from energy state
  timeRules.add(SPACES.HYPER, 3, (t, dt, cur, p) => {
    const thermal = p.data[SPACES.ENERGY * 4];
    return 0.3 + thermal * 0.5 + 0.1 * Math.sin(t * 0.25);
  });

  // ── RecursionRules: self-referential parameter feedback ──

  // 1. Energy radiates as light (accretion glow)
  recursionRules.energyRadiates();

  // 2. Light reveals matter (event horizon cells become visible)
  recursionRules.lightRevealsMatter();

  // 3. Loop selects modes — C(n(C)) selects which hex cells glow
  recursionRules.loopSelectsModes();

  // 4. Transition opens void — at the singularity, void deepens
  recursionRules.transitionOpensVoid();

  // Additional blackhole recursion:

  // HAMILTONIAN.total → PHOTON.intensity: more orbital energy = brighter disk
  recursionRules.map(SPACES.HAMILTONIAN, 2, SPACES.PHOTON, 1, (totalE) => {
    return 0.8 + totalE * 0.5;
  });

  // SINGULAR.convergence → VOID.silence: convergence deepens the silence
  recursionRules.map(SPACES.SINGULAR, 0, SPACES.VOID, 1, (conv) => {
    return 0.7 + conv * 0.3;
  });

  // MOBLEYAN.aesthetic → PHOTON.wavelength: healthy=gold(580nm), stressed=red(650nm)
  recursionRules.map(SPACES.MOBLEYAN, 0, SPACES.PHOTON, 0, (aesthetic) => {
    return 650 - aesthetic * 70; // 580 when healthy, 650 when stressed
  });

  // TANGENT.velocity → FOURIER.bandwidth: faster particles = wider frequency spread
  recursionRules.map(SPACES.TANGENT, 0, SPACES.FOURIER, 3, (vel) => {
    return 8 + vel * 4;
  });

  // ENERGY.thermal → TACTILE.roughness: hotter disk = smoother horizon surface
  recursionRules.map(SPACES.ENERGY, 0, SPACES.TACTILE, 0, (thermal) => {
    return 0.7 - thermal * 0.3;
  });

  // MOBIUS.twist → SINGULAR.bifurcation: accumulated twist = bifurcation potential
  recursionRules.map(SPACES.MOBIUS, 3, SPACES.SINGULAR, 3, (twist) => {
    return Math.abs(Math.sin(twist)) * 0.5;
  });

  // ── Start everything ──
  cnc.start();
  renderer.start();

  // Return control handles
  return {
    renderer,
    params,
    cnc,
    timeRules,
    recursionRules,
    SPACES,
    // Convenience: inject external data
    inject(space, x, y, z, w) { params.set(space, x, y, z, w); },
    // Stop the render loop
    stop() { renderer.stop(); },
  };
}

return { initFourBlackhole, SPACES, ParamBuffer, TimeRules, RecursionRules, Renderer, CnC };

})();

// ── Global export ──
const initFourBlackhole = FOUR_BLACKHOLE.initFourBlackhole;
