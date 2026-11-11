// Meadow: materials per scene root and families of identical copies.
const {scene}=__api,byRoot=new Map(),sig=new Map(),out=[];
const signature=m=>[m.type,m.name,m.color?.getHexString?.()??'',m.map?.uuid?.slice(0,6)??'',+m.transparent,m.opacity,+m.vertexColors,m.side,m.roughness??'',m.metalness??'',m.emissive?.getHexString?.()??'',m.emissiveIntensity??'',m.customProgramCacheKey?.()??'',m.visible].join('|');
for(const root of scene.children){const name=(root.name||root.type).replace(/^NPC \d+ · .*/,'NPC (all)').replace(/^Дик.*/,'Wild pigeons');const set=byRoot.get(name)??new Set();
 root.traverse(o=>{if(o.isMesh||o.isLine||o.isPoints)for(const m of Array.isArray(o.material)?o.material:[o.material]){set.add(m);const k=name+' :: '+signature(m);const e=sig.get(k)??new Set();e.add(m);sig.set(k,e);}});byRoot.set(name,set);}
out.push('MATERIALS BY ROOT');for(const [k,s] of [...byRoot].sort((a,b)=>b[1].size-a[1].size).slice(0,22))out.push('  '+String(s.size).padStart(4)+'  '+k);
out.push('\nDUPLICATE FAMILIES (identical signature within a root)');let dup=0;
for(const [k,s] of [...sig].sort((a,b)=>b[1].size-a[1].size)){if(s.size<2)break;dup+=s.size-1;if(out.length<70)out.push('  '+String(s.size).padStart(4)+'  '+k.slice(0,150));}
out.push('redundant copies total: '+dup);
return out.join('\n');
