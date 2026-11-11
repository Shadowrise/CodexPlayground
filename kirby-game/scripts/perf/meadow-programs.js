// Meadow: why Three re-resolves material programs each frame (run with --three), plus draw calls by scene root.
const out=[];
for(const id of ['spawn','nw','ne']){await __view(__VIEWS[id]);
 window.__gp=new Map();const f0=window.__frames;const live=await __live(3000);const frames=window.__frames-f0,gp=[...window.__gp].sort((a,b)=>b[1]-a[1]);window.__gp=null;
 out.push('\n=== '+id+' '+JSON.stringify(live)+' getProgram/frame '+(gp.reduce((a,[,n])=>a+n,0)/frames).toFixed(1));for(const [k,n] of gp.slice(0,6))out.push('  '+(n/frames).toFixed(2).padStart(6)+' '+k);
 window.__freeze=true;await __sleep(100);const inv=__inventory();window.__freeze=false;
 out.push('  calls '+inv.calls+' tris '+(inv.triangles/1e6).toFixed(2)+'M');const m=new Map();for(const r of inv.groups){const e=m.get(r.name)??[0,0,0,0];if(r.pass==='colour'){e[0]+=r.calls;e[2]+=r.triangles;}else{e[1]+=r.calls;e[3]+=r.triangles;}m.set(r.name,e);}
 for(const [k,e] of [...m].sort((a,b)=>(b[1][0]+b[1][1])-(a[1][0]+a[1][1])).slice(0,14))out.push('  '+String(e[0]).padStart(4)+' col '+String(e[1]).padStart(3)+' shd '+(e[2]/1e3).toFixed(0).padStart(6)+'k '+(e[3]/1e3).toFixed(0).padStart(5)+'k  '+k);}
{let mats=new Set();__api.scene.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])mats.add(m);});out.push('\nmaterials '+mats.size+' programs '+__api.renderer.info.programs.length);}
{const w=__api.worldMatrices;const t=performance.now();for(let i=0;i<200;i++)w.update();out.push('worldMatrices.update ms '+((performance.now()-t)/200).toFixed(3));}
return out.join('\n');
