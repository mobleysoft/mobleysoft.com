// blackhole.js — Three.js gravitational lensing animation
try {
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight,
0.1, 2000);
const renderer = new THREE.WebGLRenderer({ antialias: !isMobile, canvas:
document.getElementById('blackhole-canvas') });
renderer.setSize(innerWidth, innerHeight);
if (isMobile) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
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
scene.add(disk);

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
scene.add(new THREE.Mesh(hGeo, hMat));

// Particle count reduced on mobile for performance
const N = isMobile ? 2000 : 10000, pts = new Float32Array(N*3), vel = new
Float32Array(N*3);
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
const pMat = new THREE.PointsMaterial({ size: 0.1, color: 0xffaa00,
transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending });

function initP(i) {
  const r = Rs*(3+Math.random()*5), t = Math.random()*Math.PI*2;
  pts[i*3]=r*Math.cos(t); pts[i*3+1]=(Math.random()-0.5)*Rs;
pts[i*3+2]=r*Math.sin(t);
  const v = Math.sqrt(G*M/r);
  vel[i*3]=-v*Math.sin(t); vel[i*3+1]=0; vel[i*3+2]=v*Math.cos(t);
}
for (let i=0;i<N;i++) initP(i);
scene.add(new THREE.Points(pGeo, pMat));

camera.position.z = Rs * 2.5;
let time = 0;

function animate() {
  requestAnimationFrame(animate);
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
  camera.position.set(cr*Math.cos(dt*0.1), cr*Math.sin(dt*0.15),
cr*Math.cos(dt*0.2));
  camera.lookAt(0,0,0);
  renderer.render(scene, camera);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  if (isMobile) {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  }
});
animate();
} catch(e) { console.warn('Blackhole animation failed:', e); }
