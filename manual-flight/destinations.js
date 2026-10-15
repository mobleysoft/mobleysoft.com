(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MobleyDestinations=api;})(typeof globalThis==='object'?globalThis:this,function(){'use strict';
const frame='mobleysoft:system:local-v1';
const destinations=Object.freeze([
 Object.freeze({id:'mobleysoft:planet:aurel',name:'AUREL',seed:0xa4e17,frame,units:'simulation-unit',position:[-450,-220,-1100],radius:350,palette:'ocean',orbitArrival:[-450,-80,-200],enabled:true,surfaceLanding:false}),
 Object.freeze({id:'mobleysoft:planet:nacre',name:'NACRE',seed:0x9ac4e,frame,units:'simulation-unit',position:[2300,600,-2800],radius:430,palette:'gas',orbitArrival:[2200,760,-1750],enabled:true,surfaceLanding:false}),
 Object.freeze({id:'weyland-district',planetId:'weyland:planet:primary',name:'WEYLAND',seed:null,frame:null,units:null,position:null,radius:null,orbitArrival:null,enabled:false,status:'reserved-for-shared-world-contract',surfaceLanding:false})
]);
function validate(d){return Boolean(d&&typeof d.id==='string'&&d.enabled&&typeof d.frame==='string'&&Number.isInteger(d.seed)&&d.radius>0&&[d.position,d.orbitArrival].every(a=>Array.isArray(a)&&a.length===3&&a.every(Number.isFinite)));}
return Object.freeze({schemaVersion:1,destinations,resolve:id=>destinations.find(d=>d.id===id||d.planetId===id),validate});});
