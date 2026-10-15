// ══════════════════════════════════════════════════════════════════════
// four.js — Mobleysoft Four
// f(name, interface, rules_over_time, rules_under_recursion)
//
// 18 parameterization spaces forming a complete basis for visual reality.
// 72 floats describe any frame. Parameters in → frames out.
// The first word. The whole language.
// ══════════════════════════════════════════════════════════════════════

const FOUR = (() => {
'use strict';

// ── The 18 Parameterization Spaces ──
// Each is a vec4. Total: 72 floats. Complete basis.
const SPACES = {
  PARAM:        0,  // (time, dt, frame, seed) — base coordinates
  HYPER:        1,  // (adaptRate, decayRate, momentum, temperature) — meta-control
  ORTHO:        2,  // (x, y, z, w) — independent axes, no interference
  TANGENT:      3,  // (velocity, acceleration, jerk, curvature) — derivatives
  NORMAL:       4,  // (c0, c1, c2, c3) — constraints, normalized ranges
  EIGEN:        5,  // (mode0, mode1, mode2, dominance) — principal components
  HAMILTONIAN:  6,  // (kinetic, potential, total, phase) — energy conservation
  FOURIER:      7,  // (freq0, freq1, freq2, bandwidth) — frequency domain
  ENERGY:       8,  // (thermal, kinetic, potential, radiation) — energy states
  PHOTON:       9,  // (wavelength, intensity, scatter, absorption) — light
  PHONON:      10,  // (vibFreq, vibAmp, vibPhase, damping) — vibration
  TACTILE:     11,  // (roughness, metalness, subsurface, displacement) — material
  LAGRANGIAN:  12,  // (action, constraint, multiplier, variation) — least action
  MOBLEYAN:    13,  // (aesthetic, mood, style, vision) — creative axis
  MOBIUS:      14,  // (loopPhase, fixedPoint, orientation, twist) — self-reference
  INFZERO:     15,  // (limit, approach, asymptote, epsilon) — limits
  VOID:        16,  // (darkness, silence, absence, entropy) — negative space
  SINGULAR:    17,  // (convergence, criticalPoint, phaseDelta, bifurcation) — phase transitions
};

const SPACE_NAMES = Object.keys(SPACES);
const N_SPACES = 18;
const N_FLOATS = N_SPACES * 4; // 72

// ── Parameter Buffer ──
// 72 floats packed as 18 vec4s for GPU upload
class ParamBuffer {
  constructor() {
    this.data = new Float32Array(N_FLOATS);
    this.dirty = true;
    // Set defaults
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
// Differential equations that evolve parameters each frame
class TimeRules {
  constructor() {
    this.rules = []; // [{space, component, fn(t, dt, params)}]
  }

  add(space, component, fn) {
    this.rules.push({ space, component, fn });
    return this;
  }

  // Evolve: dx/dt for each rule
  tick(params, t, dt) {
    for (const r of this.rules) {
      const cur = params.data[r.space * 4 + r.component];
      const next = r.fn(t, dt, cur, params);
      params.setComponent(r.space, r.component, next);
    }
    // Always update base time
    params.set(SPACES.PARAM, t, dt, params.data[2] + 1, params.data[3]);
  }

  // Hamiltonian conservation: dq/dt = dH/dp, dp/dt = -dH/dq
  hamiltonian(H) {
    const eps = 1e-4;
    this.add(SPACES.HAMILTONIAN, 0, (t, dt, q, p) => {
      // kinetic = dH/dp → velocity
      const pp = p.get(SPACES.HAMILTONIAN);
      const Hp = H(q, pp[1] + eps) - H(q, pp[1] - eps);
      return q + (Hp / (2*eps)) * dt;
    });
    this.add(SPACES.HAMILTONIAN, 1, (t, dt, pp, p) => {
      // potential = -dH/dq → force
      const qq = p.get(SPACES.HAMILTONIAN);
      const Hq = H(qq[0] + eps, pp) - H(qq[0] - eps, pp);
      return pp - (Hq / (2*eps)) * dt;
    });
    return this;
  }

  // Fourier: evolve frequencies with overtone generation
  fourier(baseFreq) {
    this.add(SPACES.FOURIER, 0, (t) => baseFreq * (1 + 0.1 * Math.sin(t * 0.3)));
    this.add(SPACES.FOURIER, 1, (t) => baseFreq * 2 * (1 + 0.05 * Math.sin(t * 0.7)));
    this.add(SPACES.FOURIER, 2, (t) => baseFreq * 4 * (1 + 0.02 * Math.cos(t * 1.1)));
    return this;
  }

  // Mobleyan: aesthetic oscillation — the creative heartbeat
  mobleyan(period) {
    this.add(SPACES.MOBLEYAN, 0, (t) => 0.5 + 0.5 * Math.sin(t / period));
    this.add(SPACES.MOBLEYAN, 1, (t) => 0.5 + 0.3 * Math.cos(t / period * 1.618)); // golden ratio modulation
    return this;
  }

  // Mobius: self-referential loop — output feeds back as input
  mobius(loopPeriod) {
    this.add(SPACES.MOBIUS, 0, (t, dt, cur, p) => {
      // Loop phase advances, wraps at 2pi
      return (cur + dt / loopPeriod * Math.PI * 2) % (Math.PI * 2);
    });
    this.add(SPACES.MOBIUS, 3, (t, dt, cur, p) => {
      // Twist accumulates from Mobleyan aesthetic
      const aesthetic = p.data[SPACES.MOBLEYAN * 4];
      return cur + aesthetic * dt * 0.1;
    });
    return this;
  }

  // Void: darkness breathes with inverse energy
  void_breathing() {
    this.add(SPACES.VOID, 0, (t, dt, cur, p) => {
      const energy = p.data[SPACES.ENERGY * 4 + 3]; // radiation
      return Math.max(0, Math.min(1, 1 - energy));
    });
    return this;
  }

  // Singular: phase transitions at critical thresholds
  singular(threshold) {
    this.add(SPACES.SINGULAR, 0, (t, dt, cur, p) => {
      const energy = p.data[SPACES.HAMILTONIAN * 4 + 2]; // total energy
      return energy > threshold ? Math.min(1, cur + dt * 2) : Math.max(0, cur - dt);
    });
    return this;
  }
}

// ── Rules Under Recursion ──
// Self-referential parameter feedback: output modifies input
class RecursionRules {
  constructor() {
    this.maps = []; // [{from: [space, component], to: [space, component], fn}]
  }

  // Map one param to another through a transform
  map(fromSpace, fromComp, toSpace, toComp, fn) {
    this.maps.push({ from: [fromSpace, fromComp], to: [toSpace, toComp], fn });
    return this;
  }

  // Apply all recursive mappings
  apply(params) {
    for (const m of this.maps) {
      const input = params.data[m.from[0] * 4 + m.from[1]];
      const output = m.fn(input, params);
      params.setComponent(m.to[0], m.to[1], output);
    }
  }

  // Photon → Tactile: light reveals material
  lightRevealsMatter() {
    this.map(SPACES.PHOTON, 1, SPACES.TACTILE, 0, (intensity) => {
      return 0.3 + 0.7 * Math.min(1, intensity);
    });
    return this;
  }

  // Energy → Photon: energy radiates as light
  energyRadiates() {
    this.map(SPACES.ENERGY, 0, SPACES.PHOTON, 1, (thermal) => thermal * 2);
    this.map(SPACES.ENERGY, 3, SPACES.PHOTON, 2, (radiation) => radiation * 0.1);
    return this;
  }

  // Mobius → Eigen: the loop's phase selects dominant modes
  loopSelectsModes() {
    this.map(SPACES.MOBIUS, 0, SPACES.EIGEN, 3, (phase) => {
      return 0.5 + 0.5 * Math.cos(phase);
    });
    return this;
  }

  // Singular → Void: at phase transitions, void opens
  transitionOpensVoid() {
    this.map(SPACES.SINGULAR, 0, SPACES.VOID, 0, (convergence) => {
      return convergence > 0.8 ? 1 - convergence : 0.95;
    });
    return this;
  }

  // Mobleyan → Normal: aesthetic constrains what's allowed
  aestheticConstrains() {
    this.map(SPACES.MOBLEYAN, 0, SPACES.NORMAL, 0, (aesthetic) => aesthetic);
    return this;
  }
}

// ── The Shader (GLSL) ──
// Reads all 18 parameterization spaces from u_p[18]
const SHADER_HEADER = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 O;
uniform vec4 u_p[18]; // THE 72 FLOATS
uniform vec2 u_res;
uniform sampler2D u_txt;

// Unpack parameterization spaces
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

// Semantic accessors
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

#define KINETIC_E     P_HAMILTONIAN.x
#define POTENTIAL_E   P_HAMILTONIAN.y
#define TOTAL_E       P_HAMILTONIAN.z
#define H_PHASE       P_HAMILTONIAN.w

#define FREQ0         P_FOURIER.x
#define FREQ1         P_FOURIER.y
#define FREQ2         P_FOURIER.z
#define BANDWIDTH     P_FOURIER.w

#define WAVELENGTH    P_PHOTON.x
#define INTENSITY     P_PHOTON.y
#define SCATTER       P_PHOTON.z
#define ABSORPTION    P_PHOTON.w

#define VIB_FREQ      P_PHONON.x
#define VIB_AMP       P_PHONON.y
#define VIB_PHASE     P_PHONON.z
#define DAMPING       P_PHONON.w

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

#define PI 3.14159265
`;

const SHADER_LIB = `
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float noise(vec3 p){
  vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float fbm(vec3 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*noise(p);p*=2.1;a*=.5;}return v;}
float sdBox(vec3 p,vec3 b){vec3 q=abs(p)-b;return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.);}

// Spectral wavelength → RGB (simplified Planckian)
vec3 wavelengthToRGB(float wl) {
  // Normalize 380-780nm to 0-1
  float t = clamp((wl - 380.0) / 400.0, 0.0, 1.0);
  vec3 c;
  if (t < 0.25) c = mix(vec3(0.3,0,0.5), vec3(0,0,1), t*4.0);
  else if (t < 0.5) c = mix(vec3(0,0,1), vec3(0,1,0), (t-0.25)*4.0);
  else if (t < 0.75) c = mix(vec3(0,1,0), vec3(1,1,0), (t-0.5)*4.0);
  else c = mix(vec3(1,1,0), vec3(1,0,0), (t-0.75)*4.0);
  return c;
}

// Fourier-modulated value — sum of harmonics
float fourierMod(float x, float f0, float f1, float f2) {
  return sin(x*f0) + 0.5*sin(x*f1+PI*0.25) + 0.25*sin(x*f2+PI*0.5);
}

// Mobius transform on 2D point — non-orientable remap
vec2 mobiusTransform(vec2 p, float phase, float twist) {
  float a = phase + twist;
  float r = length(p);
  float theta = atan(p.y, p.x) + a;
  // Half-twist: after going around once, you're on the other side
  float s = sign(sin(theta * 0.5 + twist));
  return vec2(r * cos(theta), r * sin(theta) * s);
}

// Hamiltonian potential — shapes the energy landscape
float potential(vec3 p) {
  return length(p) * POTENTIAL_E + fbm(p * 0.05) * KINETIC_E;
}

// Lagrangian action density — integrand of least action
float actionDensity(vec3 p, vec3 v) {
  float T = 0.5 * dot(v, v); // kinetic
  float V = potential(p);     // potential
  return T - V;               // Lagrangian = T - V
}
`;

// ── Prime Universe Scene ──
// The first 42 primes as fundamental particles of a simulated cosmos.
// Each prime is a world: mass=prime, orbit=Keplerian(prime), color=spectrum(index).
// The universe begins as CRT broadcast fuzz and resolves into being.
const PRIME_UNIVERSE_SCENE = `
const float PRIMES[42] = float[42](
  2.,3.,5.,7.,11.,13.,17.,19.,23.,29.,31.,37.,41.,43.,47.,
  53.,59.,61.,67.,71.,73.,79.,83.,89.,97.,101.,103.,107.,109.,113.,
  127.,131.,137.,139.,149.,151.,157.,163.,167.,173.,179.,181.
);
const float GOLDEN_ANGLE = 2.39996323;

vec3 primePos(int i, float t) {
  float fi = float(i);
  float prime = PRIMES[i];
  float phi = acos(clamp(1.0 - 2.0*(fi+0.5)/42.0, -1.0, 1.0));
  float theta = fi * GOLDEN_ANGLE;
  float r = 18.0 + log(prime) * 7.0;
  float speed = 0.055 / pow(r/22.0, 1.5) * (1.0 + KINETIC_E*0.5);
  float orbit = theta + t * speed;
  float yScale = 0.22 + MOOD * 0.55;
  return vec3(r*sin(phi)*cos(orbit), r*cos(phi)*yScale, r*sin(phi)*sin(orbit));
}

vec3 primeColor(int i) {
  float wl = 400.0 + float(i)/41.0 * 340.0;
  vec3 c = wavelengthToRGB(wl);
  return c * (0.5 + 0.5*(1.0-float(i)/41.0) + INTENSITY*0.5);
}

float crtFuzz(vec2 uv, float t) {
  float resolve = smoothstep(0.0, 5.0, t);
  float scan = sin(uv.y*u_res.y*2.0 + t*60.0) * 0.025 * (1.0-resolve*0.92);
  float st = hash(vec3(floor(uv*u_res*0.5), floor(t*15.0)));
  return scan + st*(1.0-resolve)*0.65;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 p = (gl_FragCoord.xy - u_res*0.5) / u_res.y;
  float t = TIME;

  float camAngle = t*0.038*(1.0+VELOCITY*0.5) + H_PHASE;
  float camElev  = 0.18 + sin(t*0.023+LOOP_PHASE)*0.22;
  float camDist  = 88.0 + POTENTIAL_E*32.0;
  vec3 ro = camDist * vec3(cos(camAngle)*cos(camElev), sin(camElev), sin(camAngle)*cos(camElev));
  vec3 ww = normalize(-ro);
  vec3 uu = normalize(cross(ww, vec3(0,1,0)));
  vec3 vv = cross(uu, ww);
  vec3 rd = normalize(p.x*uu + p.y*vv + (1.5+VISION*0.4)*ww);

  vec3 col = vec3(0.003,0.002,0.007) * (0.5+DARKNESS*0.5);

  float sf = hash(floor(rd*480.0));
  if (sf > 0.9955) {
    float tw = 0.5+0.5*sin(t*FREQ0*0.15+sf*137.0);
    col += vec3(0.72,0.8,1.0)*smoothstep(0.9955,1.0,sf)*tw;
  }

  for (int i = 0; i < 42; i++) {
    float prime = PRIMES[i];
    vec3 ppos = primePos(i, t);
    vec3 pcol = primeColor(i);
    float pradius = 1.0 + log(prime)*0.62;

    vec3 oc = ro - ppos;
    float b  = dot(oc, rd);
    float c2 = dot(oc, oc) - pradius*pradius;
    float disc = b*b - c2;
    if (disc > 0.0) {
      float dist = -b - sqrt(disc);
      if (dist > 0.0) {
        vec3 hp = ro + rd*dist;
        vec3 n  = normalize(hp - ppos);
        float diff = max(dot(n, normalize(-ppos)), 0.1);
        float rim  = pow(1.0-max(dot(n,-rd),0.0), 2.5)*0.5;
        col = mix(col, pcol*diff*1.9 + pcol*rim, 0.9);
        col += pcol*0.45;
      }
    }

    float closest = length(cross(oc, rd));
    float glowR = pradius*(2.4+SCATTER*3.5);
    float glow  = exp(-closest*closest/(glowR*glowR));
    glow *= 0.11 / (1.0 + length(ppos)*0.0015);
    col += pcol*glow;
  }

  float fog = 0.0;
  for (int s = 0; s < 5; s++) {
    float sd = 14.0 + float(s)*20.0;
    col += mix(vec3(0.04,0.01,0.08), vec3(0.01,0.04,0.1), MOOD*0.6)
           * fbm((ro+rd*sd)*0.011 + t*0.006) * 0.045 * (0.4+SCATTER);
  }

  col += crtFuzz(uv, t);

  col  = col / (1.0 + col);
  col  = mix(col, col*vec3(0.92+AESTHETIC*0.08, 1.0, 1.0+AESTHETIC*0.06), 0.25);
  col *= 1.0 - (0.28+DARKNESS*0.18)*dot(p,p);
  col += hash(vec3(gl_FragCoord.xy, TIME))*(0.012+ENTROPY*0.014);
  col  = pow(max(col, vec3(0.0)), vec3(1.0/2.2));
  O = vec4(col, 1.0);
}
`;


// ── Vertex Shader ──
const VS = `#version 300 es
in vec2 a;out vec2 v_uv;void main(){v_uv=a*.5+.5;gl_Position=vec4(a,0,1);}`;

// ── Renderer ──
class Renderer {
  constructor(canvas, textCanvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2', { antialias: false, alpha: false });
    if (!this.gl) throw new Error('WebGL2 not available');
    this.params = new ParamBuffer();
    this.timeRules = new TimeRules();
    this.recursionRules = new RecursionRules();
    this.startTime = 0;
    this.running = false;
    this.onFade = null;

    const gl = this.gl;

    // Text texture
    if (textCanvas) {
      this.txtTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.txtTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textCanvas);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }

    // Compile
    const fs = SHADER_HEADER + SHADER_LIB + PRIME_UNIVERSE_SCENE;
    this.prog = this._link(VS, fs);
    if (!this.prog) throw new Error('Shader compile failed');

    this.u_p = gl.getUniformLocation(this.prog, 'u_p');
    this.u_res = gl.getUniformLocation(this.prog, 'u_res');
    this.u_txt = gl.getUniformLocation(this.prog, 'u_txt');

    // Quad
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
    c.width = innerWidth * devicePixelRatio;
    c.height = innerHeight * devicePixelRatio;
    c.style.width = '100%'; c.style.height = '100%';
    this.gl.viewport(0, 0, c.width, c.height);
  }

  frame(now) {
    if (!this.startTime) this.startTime = now;
    const t = (now - this.startTime) / 1000;
    const dt = 1/60;
    const gl = this.gl;

    // Tick time rules
    this.timeRules.tick(this.params, t, dt);
    // Apply recursion rules
    this.recursionRules.apply(this.params);

    // Upload
    gl.useProgram(this.prog);
    this.params.upload(gl, this.u_p);
    gl.uniform2f(this.u_res, this.canvas.width, this.canvas.height);
    if (this.txtTex) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.txtTex);
      gl.uniform1i(this.u_txt, 0);
    }

    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Fade callback
    if (t > 20 && this.onFade && !this._faded) {
      this._faded = true;
      this.onFade();
    }

    if (this.running) requestAnimationFrame(n => this.frame(n));
  }

  start() {
    this.running = true;
    this.resize();
    addEventListener('resize', () => this.resize());
    requestAnimationFrame(n => this.frame(n));
  }

  skip() {
    this.startTime = performance.now() - 20500;
  }
}

// ── f() — The Language ──
// f(name, interface, rules_over_time, rules_under_recursion)
function f(name, iface, timeRules, recursionRules) {
  return { name, interface: iface, timeRules, recursionRules };
}

// ── Presets ──
const presets = {
  earth() {
    const p = new ParamBuffer();
    const tr = new TimeRules();
    const rr = new RecursionRules();

    // Void starts high (deep space), clears as we approach Earth
    tr.add(SPACES.VOID, 0, (t) => t < 2 ? 0.98 : Math.max(0.05, 0.98 - (t-2) * 0.23));
    // Photon intensity rises with sunrise over Earth's limb
    tr.add(SPACES.PHOTON, 1, (t) => t < 2 ? 0.1 : Math.min(1.8, 0.1 + (t-2) * 0.34));
    // Fourier frequencies — atmosphere scattering (bluer, warmer)
    tr.fourier(1.2);
    // Mobleyan aesthetic breathes (Earth's living pulse)
    tr.mobleyan(16);
    // Mobius loop — orbital path
    tr.mobius(25);
    // Energy radiates — atmospheric glow
    tr.add(SPACES.ENERGY, 3, (t) => 0.08 + t * 0.015);

    // Recursion: light reveals matter (continents), energy radiates (atmosphere), loop selects modes
    rr.lightRevealsMatter();
    rr.energyRadiates();
    rr.loopSelectsModes();

    return f('earth', p, tr, rr);
  },

  monolith() {
    const p = new ParamBuffer();
    const tr = new TimeRules();
    const rr = new RecursionRules();

    p.set(SPACES.PHOTON, 580, 1.2, 0.02, 0.001);
    p.set(SPACES.TACTILE, 0.3, 0.8, 0.05, 0);
    p.set(SPACES.VOID, 0.3, 0.5, 0.2, 0.05);

    tr.fourier(0.5);
    tr.mobleyan(15);
    tr.mobius(25);

    rr.lightRevealsMatter();
    rr.energyRadiates();
    rr.aestheticConstrains();

    return f('monolith', p, tr, rr);
  }
};

// ── Export ──
return {
  SPACES,
  SPACE_NAMES,
  N_SPACES,
  N_FLOATS,
  ParamBuffer,
  TimeRules,
  RecursionRules,
  Renderer,
  f,
  presets,
  SHADER_HEADER,
  SHADER_LIB,
  PRIME_UNIVERSE_SCENE,
  VS,
};
})();

// Make available globally
if (typeof window !== 'undefined') window.FOUR = FOUR;
if (typeof module !== 'undefined') module.exports = FOUR;

// Auto-initialize on #blackhole-canvas — grabs the canvas before bg.js
if (typeof window !== 'undefined') {
  const _fourInit = () => {
    const canvas = document.getElementById('blackhole-canvas');
    if (!canvas) return;
    try {
      const r = new FOUR.Renderer(canvas);
      r.timeRules.fourier(1.2);
      r.timeRules.mobleyan(20);
      r.timeRules.mobius(30);
      r.start();
      window._fourRenderer = r;
      console.log('[four] Prime Universe initialized — 42 particles, CRT fuzz resolving');
    } catch (e) {
      console.warn('[four] init failed:', e);
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _fourInit);
  } else {
    _fourInit();
  }
}
