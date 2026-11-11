// Meadow: program re-resolutions per frame with every visible wild pigeon in close view (run with --three).
const {scene,THREE:T}=__api,out=[];
for(let attempt=0;attempt<20;attempt++){if(scene.children.some(o=>/^Дик/.test(o.name)&&o.visible))break;await __sleep(1000);}
const birds=scene.children.filter(o=>/^Дик/.test(o.name));
out.push('wild pigeons: '+birds.map(b=>b.name+(b.visible?'':' (hidden)')).join(', '));
for(const bird of birds){
 const p=bird.getWorldPosition(new T.Vector3());
 await __view({fixed:{position:[p.x+7,p.y+4,p.z+7],target:[p.x,p.y+1,p.z]},player:[p.x+9,0,p.z+9]},2500);
 const q=bird.getWorldPosition(new T.Vector3());window.__fixed={position:[q.x+7,q.y+4,q.z+7],target:[q.x,q.y+1,q.z]};await __sleep(500);
 window.__gp=new Map();const f0=window.__frames;await __sleep(3000);const frames=window.__frames-f0,gp=[...window.__gp].sort((a,b)=>b[1]-a[1]);window.__gp=null;
 let meshes=0,materials=new Set();bird.traverseVisible(o=>{if(o.isMesh){meshes++;materials.add(o.material);}});
 out.push(bird.name+': visible='+bird.visible+', meshes drawn '+meshes+', materials '+materials.size+', program re-resolutions per frame '+(gp.reduce((a,[,n])=>a+n,0)/frames).toFixed(2));
 for(const [k,n] of gp.slice(0,4))if(n/frames>.05)out.push('    '+(n/frames).toFixed(2)+' '+k);
}
return out.join('\n');
