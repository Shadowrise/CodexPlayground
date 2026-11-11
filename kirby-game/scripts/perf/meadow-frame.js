// Meadow: live frame cost in five views, draw calls by scene root, material/program counts, matrix update time.
const out=[];
for(const id of ['spawn','nw','ne','se','sw']){await __view(__VIEWS[id]);
 const a=await __live(3000),b=await __live(3000);
 window.__freeze=true;await __sleep(100);const inv=__inventory();window.__freeze=false;
 out.push(id.padEnd(6)+' fps '+a.fps+'/'+b.fps+' update '+a.updateMs+'/'+b.updateMs+' render '+a.renderMs+'/'+b.renderMs+' | frozen calls '+inv.calls+' tris '+(inv.triangles/1e6).toFixed(2)+'M');
 if(id==='nw'){const m=new Map();for(const r of inv.groups){const e=m.get(r.name)??[0,0];e[r.pass==='colour'?0:1]+=r.calls;m.set(r.name,e);}for(const [k,e] of [...m].sort((x,y)=>(y[1][0]+y[1][1])-(x[1][0]+x[1][1])).slice(0,10))out.push('     '+String(e[0]).padStart(4)+' col '+String(e[1]).padStart(3)+' shd  '+k);}}
{let mats=new Set();__api.scene.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])mats.add(m);});out.push('materials '+mats.size+' programs '+__api.renderer.info.programs.length);}
{const w=__api.worldMatrices;const t=performance.now();for(let i=0;i<200;i++)w.update();out.push('worldMatrices.update ms '+((performance.now()-t)/200).toFixed(3));}
return out.join('\n');
