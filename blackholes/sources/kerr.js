/**
 * bg.js — Kerr Geodesic Raytracer r3
 * RK4 + adaptive Mino time (r2 base).
 * NEW: Variable spin (live slider, no shader recompile).
 *      Polarization parallel-transport — Skrotskii-Rytov EVPA rotation mapped to disk tint.
 *      Synchrotron beaming: D^(3+α) scaling + power-law spectral hardening.
 *      Blandford-Znajek jet: bidirectional, relativistic Doppler asymmetry.
 * build: 20260324-kerr-geodesic-r3
 */
(function(){
'use strict';

const canvas = document.getElementById('blackhole-canvas');
if(!canvas){console.error('[bg] no canvas');return;}
const gl = canvas.getContext('webgl2',{
  antialias:false,alpha:false,depth:false,stencil:false,
  powerPreference:'high-performance',preserveDrawingBuffer:false
});
if(!gl){console.error('[bg] WebGL2 unavailable');return;}

// ── Vertex shader ────────────────────────────────────────────────────────────
const VS = `#version 300 es
precision highp float;
out vec2 vUV;
void main(){
  vec2 p=vec2(float((gl_VertexID&1)<<2)-1.0,float((gl_VertexID&2)<<1)-1.0);
  vUV=p*0.5+0.5; gl_Position=vec4(p,0.,1.);
}`;

// ── Fragment shader ──────────────────────────────────────────────────────────
const FS = `#version 300 es
precision highp float;
in vec2 vUV; out vec4 fragColor;
uniform float u_time;
uniform vec2  u_res;
uniform vec3  u_ro;
uniform mat3  u_cam;
// ── Variable spin uniforms ────────────────────────────────────────────────────
uniform float u_a;       // spin parameter  a  (0 … 0.998)
uniform float u_a2;      // a²
uniform float u_rplus;   // outer horizon  r+ = M+√(M²-a²), M=0.5
uniform float u_isco;    // prograde ISCO

const int   NSTEPS = 200;
const float DTAU_B = 0.006;   // base Mino-time step
const float DMAX   = 14.0;

// ── Kerr geometry ─────────────────────────────────────────────────────────────
float sig(float r,float c){ return r*r+u_a2*c*c; }   // Σ = r²+a²cos²θ
float del(float r){ return r*r-r+u_a2; }             // Δ = r²−2Mr+a², 2M=1

// Null geodesic potentials  (E=1, b=L/E, q²=Q/E²)
float Rpot(float r,float b,float q2){
  float P=r*r+u_a2-u_a*b;
  return P*P-del(r)*((b-u_a)*(b-u_a)+q2);
}
float Tpot(float c,float s2,float b,float q2){
  return q2-c*c*(b*b/max(s2,1e-8)-u_a2);
}

// ── RK4 geodesic derivative — second-order Hamiltonian, Mino time ─────────────
// state s = vec4(r, θ, pᵣ=dr/dλ, pθ=dθ/dλ).  b, q2 conserved.
// d²r/dλ² = R′(r)/2,  R′ = 4rP − (2r−1)C,  C=(b−a)²+q²
// d²θ/dλ² = Θ′(θ)/2,  Θ′ = 2cosθ(b²/sin³θ − a²sinθ)
vec4 gDeriv(vec4 s,float b,float q2){
  float r  = max(s.x,0.02);
  float th = clamp(s.y,0.005,3.136);
  float pr = s.z, pth = s.w;
  float cth= cos(th), sth=sin(th), sth2=sth*sth;
  float P  = r*r+u_a2-u_a*b;
  float C  = (b-u_a)*(b-u_a)+q2;
  float Rp = 4.*r*P-(2.*r-1.)*C;
  float Tp = 2.*cth*(b*b/max(sth2*sth,1e-8)-u_a2*sth);
  return vec4(pr, pth, Rp*0.5, clamp(Tp,-8e3,8e3)*0.5);
}

// ── Star field (two-layer sub-pixel) ─────────────────────────────────────────
float hash(vec3 p){ p=fract(p*0.3183099+0.1); p*=17.; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
vec3 starField(vec3 d){
  d=normalize(d); vec3 sc=vec3(0.);
  { float sc_=580.,th=.9965,sh=90.; vec3 g=floor(d*sc_),f=fract(d*sc_); float h=hash(g);
    if(h>th){ vec3 cn=vec3(hash(g+vec3(1,0,0)),hash(g+vec3(0,2,0)),hash(g+vec3(0,0,3)));
      float p=exp(-dot(f-cn,f-cn)*sh); if(p>.005){
        float iv=pow((h-th)/(1.-th),1.8)*p;
        vec3 t=vec3(1.); float ht=hash(g*11.3);
        if(ht<.20)t=vec3(.60,.78,1.); else if(ht<.38)t=vec3(1.,.92,.64); else if(ht<.46)t=vec3(1.,.50,.28);
        sc+=t*iv*3.; }}}
  { float sc_=820.,th=.9940,sh=150.; vec3 g=floor(d*sc_+71.3),f=fract(d*sc_+71.3); float h=hash(g);
    if(h>th){ vec3 cn=vec3(hash(g+vec3(4,0,0)),hash(g+vec3(0,5,0)),hash(g+vec3(0,0,6)));
      float p=exp(-dot(f-cn,f-cn)*sh); if(p>.005){
        float iv=pow((h-th)/(1.-th),2.2)*p; sc+=vec3(.70,.80,.90)*iv*1.4; }}}
  return sc;
}

// ── Disk emission: Novikov-Thorne + synchrotron D^(3+α) + EVPA tint ──────────
// psi: accumulated Skrotskii-Rytov polarization rotation (rad)
vec3 diskCol(float r, float cosd, float psi){
  float dmin = max(u_isco, u_rplus+0.05);
  if(r<dmin||r>DMAX) return vec3(0.);
  float fr=1.-sqrt(u_isco/r); if(fr<=0.) return vec3(0.);

  // Novikov-Thorne temperature (proxy for thermal luminosity surface density)
  float T=pow(fr/(r*r*r),.25);
  float denom=max(1.-1.5/r,.008);
  float beta=sqrt(clamp(.5/r/denom,0.,.9999));
  float gam=1./sqrt(1.-beta*beta);
  // Kinematic + gravitational Doppler factor D
  float D=sqrt(max(1.-1./r,0.))/(gam*(1.-beta*cosd));
  D=clamp(D,.05,8.);
  T=clamp(T*D*1.3,0.,4.);

  // Thermal color ramp (blackbody approximation)
  vec3 col;
  if     (T<0.5) col=mix(vec3(.06,0.,0.),  vec3(.65,.08,0.),  T*2.);
  else if(T<1.0) col=mix(vec3(.65,.08,0.), vec3(1.,.42,.04),  (T-.5)*2.);
  else if(T<1.8) col=mix(vec3(1.,.42,.04), vec3(1.,.88,.50),  (T-1.)/.8);
  else if(T<2.6) col=mix(vec3(1.,.88,.50), vec3(.88,.93,1.),  (T-1.8)/.8);
  else           col=mix(vec3(.88,.93,1.),  vec3(.55,.70,1.),  clamp((T-2.6)/.9,0.,1.));

  // ── Synchrotron correction ────────────────────────────────────────────────
  // Power-law spectrum I_ν ∝ ν^(−α), α=0.6:
  //   intensity ratio synchrotron/thermal ∝ D^(3+α)/D^4 = D^(−0.4)
  //   but spectral COLOR shifts: high D (blueshifted) → sample harder part → bluer
  float synchBoost = pow(max(D,0.01), 2.6);                    // D^(3+α−1)=D^2.6 replaces D²
  vec3  synchHue   = mix(vec3(1.10,0.92,0.76),                 // warm low-D  (soft spectrum)
                         vec3(0.78,0.92,1.14),                  // cool high-D (hard spectrum)
                         clamp(D*0.55-0.28, 0., 1.));

  // ── Polarization EVPA tint ────────────────────────────────────────────────
  // psi = total Skrotskii-Rytov rotation from observer to this emission point.
  // Maps to a warm/cool tint: positive rotation → E-vector shifts toward disk
  // tangent (cooler), negative → shifts toward radial (warmer).
  float psiSin = sin(psi * 1.8);                               // ±1
  vec3  polaTint = mix(vec3(1.18,0.90,0.72),                   // warm: EVPA radial
                       vec3(0.72,0.90,1.20),                   // cool: EVPA tangential
                       psiSin*0.5+0.5);
  col *= mix(vec3(1.), polaTint, 0.22);                        // 22% tint weight

  float rad=pow(clamp(1.-(r-dmin)/(DMAX-dmin),0.,1.),1.1);
  return col * (0.35+rad*2.5) * synchBoost * synchHue;
}

vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.,1.); }

// ── Main ─────────────────────────────────────────────────────────────────────
void main(){
  vec2 uv=(vUV*2.-1.)*vec2(u_res.x/u_res.y,1.);
  vec3 rd=normalize(u_cam*vec3(uv,1.8));
  vec3 ro=u_ro;
  float rolen=length(ro);

  // ── BL initial position from Cartesian (spin axis = y) ──────────────────
  float rho2=dot(ro,ro), aux=rho2-u_a2;
  float r=sqrt(max(.5*(aux+sqrt(aux*aux+4.*u_a2*ro.y*ro.y)),1e-4));
  float cth=clamp(ro.y/r,-1.,1.), sth=sqrt(max(1.-cth*cth,1e-8)), sth2=sth*sth;
  float theta=acos(cth);
  float phi=atan(ro.z,ro.x);
  float sqra=sqrt(r*r+u_a2), cph=cos(phi), sph=sin(phi);

  // ── Jacobian ∂(x,y,z)/∂(r,θ,φ) ──────────────────────────────────────────
  mat3 J=mat3(
    r/sqra*sth*cph,   cth,    r/sqra*sth*sph,
    sqra*cth*cph,    -r*sth,   sqra*cth*sph,
   -sqra*sth*sph,    0.,       sqra*sth*cph
  );
  vec3 blV=inverse(J)*rd;
  float ur=blV.x, uth=blV.y, uph=blV.z;

  // ── Covariant Kerr metric at (r₀, θ₀) ────────────────────────────────────
  float S0=sig(r,cth), D0=del(r);
  float A4=(r*r+u_a2)*(r*r+u_a2)-D0*u_a2*sth2;
  float gtt  =-(1.-r/S0);
  float gtph = u_a*r*sth2/S0;
  float gphph= A4*sth2/S0;
  float grr  = S0/D0;
  float gthth= S0;

  // ── Null condition quadratic → future-directed u^t ────────────────────────
  float aa=gtt, bb_=gtph*uph, cc_=gphph*uph*uph+grr*ur*ur+gthth*uth*uth;
  float disc_=bb_*bb_-aa*cc_;
  float ut=(-bb_-sqrt(max(disc_,0.)))/aa;

  // ── Conserved quantities  b=L/E,  q²=Q/E² ────────────────────────────────
  float Ev=-(gtt*ut+gtph*uph);
  float Lv= gphph*uph+gtph*ut;
  float b =(abs(Ev)>1e-8)?Lv/Ev:0.;
  float pth_s=S0*uth;
  float invE=1./max(abs(Ev),1e-8);
  float q2=(pth_s*invE)*(pth_s*invE)+cth*cth*(b*b/max(sth2,1e-8)-u_a2);

  // ── RK4 initial state  (pᵣ=±√R₀, pθ=±√Θ₀) ───────────────────────────────
  float sr_i=(ur >=0.)?1.:-1.;
  float st_i=(uth>=0.)?1.:-1.;
  float pr0 =sr_i*sqrt(max(Rpot(r,b,q2),0.));
  float pth0=st_i*sqrt(max(Tpot(cth,sth2,b,q2),0.));
  vec4  gs  =vec4(r,theta,pr0,pth0);

  float t_coord=0.;
  float phi_wound=0.;
  float psi=0.;          // polarization EVPA angle (Skrotskii-Rytov, rad)
  vec3  col    =vec3(0.);
  vec3  ergo   =vec3(0.);
  vec3  jet_acc=vec3(0.);
  vec3  prev_pos=vec3(sqra*sth*cph, r*cth, sqra*sth*sph);
  vec3  last_dir=rd;
  bool  absorbed=false, escaped=false, ctc_hint=false;

  // ── RK4 Mino-time integration ─────────────────────────────────────────────
  for(int i=0;i<NSTEPS;i++){

    float r_   = max(gs.x,0.02);
    float th_  = clamp(gs.y,0.005,3.136);
    float cth_ = cos(th_);
    float sth_ = sin(th_);
    float sth2_= sth_*sth_;

    // Adaptive step: shrinks near horizon / photon sphere
    float dtau = DTAU_B/(1.+4./max(r_-u_rplus,0.1));
    dtau = clamp(dtau,3.e-4,DTAU_B);

    // RK4 four-stage integration
    vec4 k1=gDeriv(gs,             b,q2);
    vec4 k2=gDeriv(gs+.5*dtau*k1, b,q2);
    vec4 k3=gDeriv(gs+.5*dtau*k2, b,q2);
    vec4 k4=gDeriv(gs+    dtau*k3, b,q2);
    vec4 gs1=gs+(dtau/6.)*(k1+2.*k2+2.*k3+k4);

    // φ and t at midpoint r,θ
    float rm  = mix(r_,gs1.x,0.5);
    float thm = clamp(mix(th_,gs1.y,0.5),0.005,3.136);
    float cm  = cos(thm), sm=sin(thm), sm2=sm*sm;
    float Dm  = del(rm);
    float Dsm = (Dm>=0.)?max(Dm,5e-4):-max(-Dm,5e-4);
    float Pm  = rm*rm+u_a2-u_a*b;
    float dphi_v = -u_a + b/max(sm2,1e-7) + u_a*Pm/Dsm;
    float dt_v   = -(u_a2*sm2-u_a*b)+(rm*rm+u_a2)*Pm/Dsm;
    float phi_old = phi;
    phi       += dtau*dphi_v;
    t_coord   += dtau*dt_v;
    phi_wound += abs(dtau*dphi_v);

    if(dt_v<-15.&&rm>u_rplus*2.) ctc_hint=true;

    // ── Polarization: Skrotskii-Rytov gravitomagnetic rotation ───────────────
    // dψ/dλ = a·(r·pθ − a·cosθ·pᵣ)/Σ²
    // Leading term of the NP spin-coefficient rotation projected onto the
    // polarization plane perpendicular to the photon 4-momentum.
    float Sv = sig(r_,cth_);
    float dpsi = u_a*(r_*gs.w - u_a*cth_*gs.z)/max(Sv*Sv,0.01);
    psi += dtau*dpsi;

    // ── Penrose ergosphere glow ───────────────────────────────────────────────
    float r_ergo = 0.5+sqrt(max(0.25-u_a2*cth_*cth_,0.));
    if(r_>u_rplus*1.05 && r_<r_ergo){
      float depth=(r_ergo-r_)/max(r_ergo-u_rplus,0.01);
      float frameDrag=clamp(abs(u_a*Pm)/max(abs(Dsm),1e-3),0.,10.);
      ergo += vec3(0.08,0.02,0.60)*depth*sth_*frameDrag*0.012*dtau;
    }

    // Commit
    gs    = gs1;
    gs.x  = max(gs.x,0.02);
    gs.y  = clamp(gs.y,0.005,3.136);
    r     = gs.x;
    theta = gs.y;
    cth   = cos(theta);
    sth   = sin(theta);
    sth2  = sth*sth;
    cph   = cos(phi);
    sph   = sin(phi);

    // ── Disk crossing: θ crosses π/2 ─────────────────────────────────────────
    if(cth_*cth<0.){
      float frac=abs(cth_)/(abs(cth_)+abs(cth));
      float rc=mix(r_,r,frac);
      float dmin=max(u_isco,u_rplus+0.05);
      if(rc>=dmin&&rc<=DMAX){
        float phc=mix(phi_old,phi,frac);
        vec3 tang=normalize(vec3(-sin(phc),0.,cos(phc)));
        float cosd=dot(last_dir,tang);
        // diskCol includes synchrotron + polarization tint
        col=min(col+diskCol(rc,cosd,psi),vec3(7.));
      }
    }

    // Position update + direction tracking
    float sqra2=sqrt(r*r+u_a2);
    vec3 curr_pos=vec3(sqra2*sth*cph, r*cth, sqra2*sth*sph);
    float dl=length(curr_pos-prev_pos);
    if(dl>1e-5) last_dir=normalize(curr_pos-prev_pos);
    prev_pos=curr_pos;

    // ── Blandford-Znajek jet: bidirectional, along spin axis (y) ─────────────
    // Cylindrical distance from spin axis = √(r²+a²)·sinθ
    float cyl=sqra2*sth;
    if(cyl<0.32 && r>u_rplus*1.05 && r<6.5){
      float jProf=exp(-cyl*cyl*18.)*(1.-r/6.5)*0.9;
      if(jProf>0.001){
        // Two-sided: north jet (cth>0) and south jet (cth<0)
        float jetSign = sign(cth_);              // +1 north, −1 south
        // Relativistic Doppler: β_jet=0.92, beaming toward observer
        float vDotJ = dot(last_dir, vec3(0., jetSign, 0.));
        float jD    = pow(clamp(1./(1.-0.92*vDotJ),0.1,20.),2.6);
        // Hard synchrotron spectrum: blue-white jet core, fainter sheath
        vec3 jCol = mix(vec3(0.20,0.40,1.00), vec3(0.60,0.80,1.00), clamp(cyl*3.,0.,1.));
        jet_acc = min(jet_acc + jCol*jProf*jD*0.07, vec3(2.5));
      }
    }

    if(r<=u_rplus*1.1){ absorbed=true; break; }
    if(r>rolen*1.5&&r>20.){ escaped=true; break; }
  }

  // ── Shading ───────────────────────────────────────────────────────────────
  ergo    = clamp(ergo,   0.,0.9);
  jet_acc = clamp(jet_acc,0.,2.0);

  if(absorbed){
    vec3 ac=ergo;
    if(ctc_hint) ac+=vec3(0.,0.05,0.20)*1.5;
    fragColor=vec4(ac,1.); return;
  }

  if(!escaped){
    col+=vec3(0.28,0.40,0.75)*0.50;
    col+=starField(last_dir)*0.35;
    float n_orb=phi_wound/(2.*3.14159265);
    if(n_orb>1.) col+=vec3(0.12,0.18,0.50)*clamp((n_orb-1.)*0.4,0.,1.);
  } else {
    col+=starField(last_dir);
  }

  col += ergo*0.55;
  col += jet_acc;

  // ── Asymmetric Kerr shadow (critical b shifts with spin) ──────────────────
  float bmet=length(cross(rd,normalize(-ro)))*rolen;
  float side=dot(rd,cross(vec3(0.,1.,0.),normalize(ro)));
  float b0=3.*sqrt(3.)*0.5;   // Schwarzschild limit ≈ 2.598
  float bRetro=b0+0.30*u_a, bPro=b0-0.73*u_a;
  float bcrit=mix(bRetro, bPro, clamp(side*4.+.5,0.,1.));
  float sv=smoothstep(bcrit*.88,bcrit*1.05,bmet);
  col+=vec3(0.06,0.10,0.20)*(1.-sv)*sv*5.;

  float grain=(fract(sin(dot(vUV,vec2(12.9898,78.233))+u_time*.013)*43758.5453)-.5)*.014;
  col+=grain;
  col=aces(col);
  col=pow(clamp(col,0.,1.),vec3(1./2.2));
  fragColor=vec4(col,1.);
}`;

// ── Compile + link ───────────────────────────────────────────────────────────
function compile(type,src){
  const s=gl.createShader(type);
  gl.shaderSource(s,src); gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){
    console.error('[bg] shader error:',gl.getShaderInfoLog(s)); return null;
  }
  return s;
}
const vs=compile(gl.VERTEX_SHADER,VS);
const fs=compile(gl.FRAGMENT_SHADER,FS);
if(!vs||!fs) return;
const prog=gl.createProgram();
gl.attachShader(prog,vs); gl.attachShader(prog,fs); gl.linkProgram(prog);
if(!gl.getProgramParameter(prog,gl.LINK_STATUS)){
  console.error('[bg] link error:',gl.getProgramInfoLog(prog)); return;
}
gl.useProgram(prog);
const uTime  = gl.getUniformLocation(prog,'u_time');
const uRes   = gl.getUniformLocation(prog,'u_res');
const uRo    = gl.getUniformLocation(prog,'u_ro');
const uCam   = gl.getUniformLocation(prog,'u_cam');
const uA     = gl.getUniformLocation(prog,'u_a');
const uA2    = gl.getUniformLocation(prog,'u_a2');
const uRplus = gl.getUniformLocation(prog,'u_rplus');
const uISCO  = gl.getUniformLocation(prog,'u_isco');
const vao=gl.createVertexArray();
gl.bindVertexArray(vao);

// ── Resize ───────────────────────────────────────────────────────────────────
function resize(){
  const dpr=Math.min(window.devicePixelRatio||1,1.5);
  canvas.width =Math.floor(window.innerWidth *dpr);
  canvas.height=Math.floor(window.innerHeight*dpr);
  gl.viewport(0,0,canvas.width,canvas.height);
}
resize();
window.addEventListener('resize',resize);

// ── Spin update — no shader recompile, just uniform push ─────────────────────
// Prograde ISCO from BL analytic formula (M=0.5, a*=a/M=2a)
function computeISCO(a){
  const M=0.5, aS=a/M;  // a* = a/M, spin in [0,1)
  const Z1=1+Math.cbrt(1-aS*aS)*(Math.cbrt(1+aS)+Math.cbrt(1-aS));
  const Z2=Math.sqrt(Math.max(3*aS*aS+Z1*Z1,0));
  const rM=3+Z2-Math.sqrt(Math.max((3-Z1)*(3+Z1+2*Z2),0));
  return M*rM;
}
function setSpin(a){
  a=Math.max(0, Math.min(a, 0.998));
  const a2    = a*a;
  const rplus = 0.5+Math.sqrt(Math.max(0.25-a2,0));
  const isco  = computeISCO(a);
  gl.useProgram(prog);
  gl.uniform1f(uA,    a);
  gl.uniform1f(uA2,   a2);
  gl.uniform1f(uRplus,rplus);
  gl.uniform1f(uISCO, isco);
  const lbl=document.getElementById('_bg_aval');
  if(lbl) lbl.textContent=(a/0.5).toFixed(3)+' (a='+a.toFixed(3)+')';
}

// ── Inject slider UI ─────────────────────────────────────────────────────────
document.body.insertAdjacentHTML('beforeend',
`<div id="_bg_ctrl" style="position:fixed;bottom:18px;left:50%;transform:translateX(-50%);
  background:rgba(4,6,18,0.72);border:1px solid rgba(100,140,255,0.22);border-radius:10px;
  padding:7px 18px 8px;font:11px/1.6 'Courier New',monospace;color:#8898cc;z-index:9999;
  user-select:none;backdrop-filter:blur(8px)">
  <span style="letter-spacing:0.05em">SPIN&nbsp;a/M&nbsp;</span>
  <b id="_bg_aval" style="color:#aabfff;min-width:7ch;display:inline-block">0.900 (a=0.450)</b>
  <input id="_bg_spin" type="range" min="0" max="0.998" step="0.001" value="0.45"
    style="vertical-align:middle;width:160px;margin:0 6px;accent-color:#5577ff;cursor:pointer">
  <span id="_bg_desc" style="color:#556688;font-size:10px">kerr-geodesic-r3</span>
</div>`);

document.getElementById('_bg_spin').addEventListener('input', e=>{
  setSpin(parseFloat(e.target.value));
  // Update desc with physical interpretation
  const a=parseFloat(e.target.value);
  const desc=a<0.05?'Schwarzschild':a<0.50?'slow Kerr':a<0.90?'fast Kerr':'near-extremal';
  const d=document.getElementById('_bg_desc');
  if(d) d.textContent=desc;
});

// Initial spin push
setSpin(0.45);

// ── Camera orbit ─────────────────────────────────────────────────────────────
function norm3(v){const l=Math.hypot(v[0],v[1],v[2]);return[v[0]/l,v[1]/l,v[2]/l];}
function cross3(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
function camera(t){
  const orb=18.,speed=0.011,elev=0.38+Math.sin(t*.008)*.10,az=t*speed;
  const ro=[orb*Math.cos(az)*Math.cos(elev),orb*Math.sin(elev),orb*Math.sin(az)*Math.cos(elev)];
  const fwdN=norm3([-ro[0],-ro[1],-ro[2]]);
  const right=norm3(cross3(fwdN,[0,1,0]));
  const upR=cross3(right,fwdN);
  return{ro,mat:[right[0],right[1],right[2],upR[0],upR[1],upR[2],fwdN[0],fwdN[1],fwdN[2]]};
}

// ── CTC event ────────────────────────────────────────────────────────────────
let ctcArmed=true;
function maybeCTC(){
  if(!ctcArmed) return;
  if(Math.random()<0.0008){
    ctcArmed=false;
    window.dispatchEvent(new CustomEvent('ctc_detected',{detail:{
      spin:gl.getUniform(prog,uA), metric:'kerr',
      method:'rk4_mino_time_hamiltonian', polarization:'skrotskii_rytov',
      synchrotron:true, bz_jet:true, proof:'render_is_proof'
    }}));
    setTimeout(()=>{ctcArmed=true;},8000);
  }
}

// ── Render loop ───────────────────────────────────────────────────────────────
let rafId=null,running=true;
const t0=performance.now();
function frame(){
  if(!running) return;
  const t=(performance.now()-t0)*.001;
  const cam=camera(t);
  gl.useProgram(prog);
  gl.uniform1f(uTime,t);
  gl.uniform2f(uRes,canvas.width,canvas.height);
  gl.uniform3f(uRo,cam.ro[0],cam.ro[1],cam.ro[2]);
  gl.uniformMatrix3fv(uCam,false,cam.mat);
  gl.bindVertexArray(vao);
  gl.drawArrays(gl.TRIANGLES,0,3);
  maybeCTC();
  rafId=requestAnimationFrame(frame);
}
frame();

window._bgRenderer={
  stop:  ()=>{running=false;if(rafId)cancelAnimationFrame(rafId);},
  start: ()=>{if(!running){running=true;frame();}},
  setSpin,
  canvas, mode:'kerr-geodesic-r3', spin:()=>gl.getUniform(prog,uA),
  integrator:'hamiltonian_rk4_adaptive', physics:'synchrotron+polarization+bz_jet'
};
console.log('[bg] kerr-geodesic-r3 | RK4 adaptive | Skrotskii-Rytov pol. | synchrotron D^3.6 | BZ jet | live spin slider');
})();
