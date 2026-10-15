(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MobleyManualFlight=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const add=(a,b)=>a.map((v,i)=>v+b[i]);const sub=(a,b)=>a.map((v,i)=>v-b[i]);const mul=(a,s)=>a.map(v=>v*s);const dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);const len=a=>Math.hypot(...a);const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
function normalizeStick(x,y,dead=.1){const m=Math.hypot(x,y);if(m<=dead)return{x:0,y:0};const s=(Math.min(1,m)-dead)/(1-dead)/m;return{x:x*s,y:y*s};}
// Closest points on finite segments, including degenerate and parallel cases.
function segmentDistance(a,b,c,d){const u=sub(b,a),v=sub(d,c),w=sub(a,c),aa=dot(u,u),bb=dot(u,v),cc=dot(v,v),dd=dot(u,w),ee=dot(v,w);let s=0,t=0;
if(aa<1e-12&&cc<1e-12)return{distance:len(w),a:[...a],b:[...c]};
if(aa<1e-12)t=clamp(ee/cc,0,1);else if(cc<1e-12)s=clamp(-dd/aa,0,1);else{const denom=aa*cc-bb*bb;s=denom>1e-12?clamp((bb*ee-cc*dd)/denom,0,1):0;t=(bb*s+ee)/cc;if(t<0){t=0;s=clamp(-dd/aa,0,1)}else if(t>1){t=1;s=clamp((bb-dd)/aa,0,1)}}
const pa=add(a,mul(u,s)),pb=add(c,mul(v,t));return{distance:len(sub(pa,pb)),a:pa,b:pb};}
// Continuous conservative advancement. Endpoint motion is linear within a
// fixed 1/120 s step. The Lipschitz speed bound prevents skipping first contact.
function sweepCapsules(a,b,tolerance=.025){const speed=Math.max(len(sub(a.a1,a.a0)),len(sub(a.b1,a.b0)))+Math.max(len(sub(b.a1,b.a0)),len(sub(b.b1,b.b0)));const r=a.radius+b.radius;let t=0;
for(let i=0;i<96;i++){const q=segmentDistance(mix(a.a0,a.a1,t),mix(a.b0,a.b1,t),mix(b.a0,b.a1,t),mix(b.b0,b.b1,t));const gap=q.distance-r;
if(gap<=tolerance){let n=sub(q.a,q.b),m=len(n);if(m<1e-9){n=sub(sub(b.a1,b.a0),sub(a.a1,a.a0));m=len(n)}if(m<1e-9){n=[0,1,0];m=1}return{t,normal:mul(n,1/m),pointA:q.a,pointB:q.b,iterations:i+1};}
if(speed<1e-12)return null;const advance=gap/speed;if(t+advance>1)return null;t+=Math.max(advance,1e-10);}
// Tangencies can converge slowly. Subdivide the remaining interval with a
// conservative distance bound rather than treating an exhausted loop as clear.
const stack=[[t,1,0]];while(stack.length){const [lo,hi,depth]=stack.pop(),mid=(lo+hi)/2,q=segmentDistance(mix(a.a0,a.a1,mid),mix(a.b0,a.b1,mid),mix(b.a0,b.a1,mid),mix(b.b0,b.b1,mid));if(q.distance-r>speed*(hi-lo)/2+tolerance)continue;if(depth>=18||hi-lo<1e-7){const n=sub(q.a,q.b),m=len(n)||1;return{t:lo,normal:m===1&&len(n)===0?[0,1,0]:mul(n,1/m),pointA:q.a,pointB:q.b,conservative:true}}stack.push([mid,hi,depth+1],[lo,mid,depth+1]);}return null;}
function broadSweep(a0,a1,b0,b1,r){const p=sub(a0,b0),v=sub(sub(a1,a0),sub(b1,b0)),c=dot(p,p)-r*r;if(c<=0)return true;const aa=dot(v,v),bb=2*dot(p,v);if(aa<1e-12)return false;const disc=bb*bb-4*aa*c;if(disc<0)return false;const t=(-bb-Math.sqrt(disc))/(2*aa);return t>=0&&t<=1;}
function integrateVelocity(velocity,right,up,forward,input,dt){let v=[...velocity];const desiredX=input.x*44,desiredY=input.y*44;v=add(v,mul(right,(desiredX-dot(v,right))*Math.min(1,7*dt)));v=add(v,mul(up,(desiredY-dot(v,up))*Math.min(1,7*dt)));
if(input.throttle>0)v=add(v,mul(forward,input.throttle*85*dt));if(input.throttle<0){const speed=len(v),next=Math.max(0,speed-190*(-input.throttle)*dt);v=speed?mul(v,next/speed):[0,0,0];}const speed=len(v);if(speed>160)v=mul(v,160/speed);return v;}
function cross(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
function polynomialRoots01(coefficients){
 const c=[...coefficients],scale=Math.max(...c.map(Math.abs),1),epsilon=scale*1e-12;
 while(c.length>1&&Math.abs(c[c.length-1])<=epsilon)c.pop();
 if(c.length===1)return[];
 if(c.length===2){const t=-c[0]/c[1];return t>=-1e-10&&t<=1+1e-10?[clamp(t,0,1)]:[];}
 const derivative=c.slice(1).map((v,i)=>v*(i+1)),stops=[0,...polynomialRoots01(derivative),1].sort((a,b)=>a-b),roots=[];
 const evaluate=t=>c.reduceRight((n,v)=>n*t+v,0);
 for(const t of stops)if(Math.abs(evaluate(t))<=epsilon)roots.push(t);
 for(let i=0;i<stops.length-1;i++){let lo=stops[i],hi=stops[i+1],a=evaluate(lo),b=evaluate(hi);if(a*b>=0)continue;for(let k=0;k<48;k++){const mid=(lo+hi)/2,m=evaluate(mid);if(a*m<=0){hi=mid;b=m}else{lo=mid;a=m}}roots.push((lo+hi)/2);}
 return roots.sort((a,b)=>a-b).filter((t,i,a)=>!i||t-a[i-1]>1e-8);
}
// Continuous point against linearly moving triangle. The signed plane
// equation is cubic in time; roots partition every possible surface crossing.
function sweepTriangle(p0,p1,a0,b0,c0,a1,b1,c1){
 const e1=sub(b0,a0),e2=sub(c0,a0),de1=sub(sub(b1,a1),e1),de2=sub(sub(c1,a1),e2),w=sub(p0,a0),dw=sub(sub(p1,p0),sub(a1,a0));
 const n0=cross(e1,e2),n1=add(cross(de1,e2),cross(e1,de2)),n2=cross(de1,de2);
 const coefficients=[dot(w,n0),dot(dw,n0)+dot(w,n1),dot(dw,n1)+dot(w,n2),dot(dw,n2)];
 const scale=Math.max(1,len(w)*Math.max(len(n0),len(n1),len(n2))),coplanar=coefficients.every(v=>Math.abs(v)<scale*1e-11);
 const candidates=[...polynomialRoots01(coefficients)];
 if(coplanar){
  candidates.push(0,1);const normal=cross(sub(mix(b0,b1,.5),mix(a0,a1,.5)),sub(mix(c0,c1,.5),mix(a0,a1,.5))),axis=normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs))),indices=[0,1,2].filter(i=>i!==axis),cross2=(a,b)=>a[indices[0]]*b[indices[1]]-a[indices[1]]*b[indices[0]];
  for(const [s0,t0,s1,t1]of[[a0,b0,a1,b1],[b0,c0,b1,c1],[c0,a0,c1,a1]]){const edge=sub(t0,s0),change=sub(sub(t1,s1),edge),relative=sub(p0,s0),motion=sub(sub(p1,p0),sub(s1,s0));candidates.push(...polynomialRoots01([cross2(edge,relative),cross2(change,relative)+cross2(edge,motion),cross2(change,motion)]));}
 }
 for(const t of candidates.sort((a,b)=>a-b)){
  const a=mix(a0,a1,t),b=mix(b0,b1,t),c=mix(c0,c1,t),p=mix(p0,p1,t),u=sub(b,a),v=sub(c,a),q=sub(p,a),normal=cross(u,v),area=dot(normal,normal);if(area<1e-18)continue;
  if(Math.abs(dot(q,normal))>Math.sqrt(area)*1e-5)continue;
  const uu=dot(u,u),uv=dot(u,v),vv=dot(v,v),qu=dot(q,u),qv=dot(q,v),denom=uu*vv-uv*uv,s=(qu*vv-qv*uv)/denom,r=(qv*uu-qu*uv)/denom;
  if(s>=-1e-7&&r>=-1e-7&&s+r<=1+1e-7)return{t,point:p};
 }
 return null;
}

return Object.freeze({sweepTriangle,polynomialRoots01,normalizeStick,segmentDistance,sweepCapsules,broadSweep,integrateVelocity,add,sub,mul,dot,len,mix,clamp});});
