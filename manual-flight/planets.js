(function(root){'use strict';root.MobleyPlanets={create({THREE,scene,compact}){
const bodies=[],geometry=new THREE.SphereGeometry(1,compact?32:64,compact?20:40),light=new THREE.Vector3(1,.35,.8).normalize();
const vertex=`varying vec3 vN,vP,vW;void main(){vP=position;vN=normalize(mat3(modelMatrix)*normal);vec4 w=modelMatrix*vec4(position,1.0);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`;
const noise=`float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}float fbm(vec3 p){float n=0.0,a=.55;for(int i=0;i<4;i++){n+=a*noise(p);p=p*2.03+vec3(13.7,2.1,7.3);a*=.5;}return n;}`;
for(const d of root.MobleyDestinations.destinations.filter(d=>d.enabled)){
 const uniforms={seed:{value:(d.seed%10000)/97},time:{value:0},sun:{value:light},gas:{value:d.palette==='gas'?1:0},rim:{value:new THREE.Color(d.palette==='gas'?0xe3a788:0x6ab9ef)}};
 const surface=new THREE.ShaderMaterial({uniforms,vertexShader:vertex,fragmentShader:`varying vec3 vN,vP,vW;uniform float seed,time,gas;uniform vec3 sun;${noise}void main(){vec3 n=normalize(vN),p=normalize(vP);float land=fbm(p*4.0+seed),detail=fbm(p*18.0+seed);vec3 ocean=mix(vec3(.014,.055,.13),vec3(.025,.22,.29),detail);vec3 ground=mix(vec3(.11,.23,.16),vec3(.56,.48,.30),smoothstep(.48,.72,land));vec3 col=mix(ocean,ground,smoothstep(.48,.52,land));float bands=sin(p.y*32.0+fbm(p*5.0+seed)*5.0)*.5+.5;vec3 giant=mix(vec3(.19,.085,.12),vec3(.74,.46,.29),bands);col=mix(col,giant,gas);float day=smoothstep(-.12,.12,dot(n,sun));float cloudShadow=smoothstep(.54,.7,fbm(p*7.0+seed+time*.003));col*=1.0-cloudShadow*.16;col*=mix(.045,1.15,day);float spec=pow(max(dot(reflect(-sun,n),normalize(cameraPosition-vW)),0.0),36.0)*(1.0-smoothstep(.48,.52,land))*(1.0-gas);col+=vec3(.35,.5,.63)*spec*day;gl_FragColor=vec4(col,1.0);
#include <tonemapping_fragment>
#include <encodings_fragment>
}`});
 const group=new THREE.Group();group.position.fromArray(d.position);group.scale.setScalar(d.radius);const globe=new THREE.Mesh(geometry,surface);group.add(globe);
 const clouds=new THREE.Mesh(geometry,new THREE.ShaderMaterial({uniforms,vertexShader:vertex,transparent:true,depthWrite:false,fragmentShader:`varying vec3 vN,vP,vW;uniform float seed,time,gas;uniform vec3 sun;${noise}void main(){vec3 p=normalize(vP);float clouds=smoothstep(.5,.68,fbm(p*7.0+vec3(time*.006,0,seed)));float day=smoothstep(-.1,.2,dot(normalize(vN),sun));gl_FragColor=vec4(mix(vec3(.8,.88,.94),vec3(.93,.72,.57),gas)*mix(.07,1.0,day),clouds*.57*(1.0-gas*.55));
#include <encodings_fragment>
}`}));clouds.scale.setScalar(1.012);group.add(clouds);
 const atmosphere=new THREE.Mesh(geometry,new THREE.ShaderMaterial({uniforms,vertexShader:vertex,transparent:true,depthWrite:false,side:THREE.BackSide,blending:THREE.AdditiveBlending,fragmentShader:`varying vec3 vN,vP,vW;uniform vec3 rim,sun;void main(){float edge=pow(1.0-abs(dot(normalize(vN),normalize(cameraPosition-vW))),3.0);float light=smoothstep(-.35,.6,dot(normalize(vN),sun));gl_FragColor=vec4(rim*edge*(.2+.8*light),edge*.65);}`}));atmosphere.scale.setScalar(1.045);group.add(atmosphere);
 group.userData={obstacle:true,planet:true,destinationId:d.id,radius:d.radius,health:Infinity,previousPosition:group.position.clone(),previousQuaternion:group.quaternion.clone(),velocity:new THREE.Vector3(),hitMeshes:[globe]};scene.add(group);bodies.push(group);
}
return{bodies,update(time){for(const b of bodies)for(const mesh of b.children)mesh.material.uniforms.time.value=time;}};
}};})(window);
