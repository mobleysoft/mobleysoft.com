(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./core.js'):root.MobleyManualFlight);if(typeof module==='object'&&module.exports)module.exports=api;else root.MobleyMeshSweep=api;})(typeof globalThis==='object'?globalThis:this,function(Core){
'use strict';
// Continuous segment versus every visible hull triangle, including target
// translation and linearly interpolated vertex rotation during the 120 Hz step.
// The renderer's native geometry is authoritative, not a center-hit radius.
function hit(THREE,start,end,target,previousPosition,meshes){
 const radius=target.userData.radius;
 if(radius&&!Core.broadSweep(start.toArray(),end.toArray(),previousPosition.toArray(),target.position.toArray(),radius))return null;
 target.updateMatrixWorld(true);
 const previousRoot=new THREE.Matrix4().compose(previousPosition,target.userData.previousQuaternion||target.quaternion,target.scale);
 const inverse=new THREE.Matrix4().copy(target.matrixWorld).invert();let earliest=null;
 for(const mesh of meshes){
  mesh.updateMatrixWorld(true);
  const relative=new THREE.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld),previousWorld=new THREE.Matrix4().multiplyMatrices(previousRoot,relative),position=mesh.geometry.attributes.position,index=mesh.geometry.index,count=index?index.count:position.count;
  const vertex=(i,matrix)=>new THREE.Vector3().fromBufferAttribute(position,index?index.getX(i):i).applyMatrix4(matrix).toArray();
  for(let i=0;i<count;i+=3){
   const contact=Core.sweepTriangle(start.toArray(),end.toArray(),vertex(i,previousWorld),vertex(i+1,previousWorld),vertex(i+2,previousWorld),vertex(i,mesh.matrixWorld),vertex(i+1,mesh.matrixWorld),vertex(i+2,mesh.matrixWorld));
   if(contact&&(!earliest||contact.t<earliest.t))earliest={t:contact.t,point:new THREE.Vector3(...contact.point),object:mesh};
  }
 }
 return earliest;
}
return Object.freeze({hit});});
