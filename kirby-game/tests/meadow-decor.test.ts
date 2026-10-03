import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Mesh,LOD,Vector3,Matrix4} from 'three';
import {createMeadowDecor} from '../src/meadow-decor';
import {dryGround,inWater} from '../src/pond-layout';
import {createLandmarks,sceneryClearance} from '../src/landmarks';
import {createForest} from '../src/forest';

test('all biomes get distinct, grounded undergrowth within a bounded render budget',()=>{
 const root=createMeadowDecor([{x:120,z:-40,crownRadius:5}]);
 const sites=root.userData.sites;
 for(const biome of ['spruce','birch','orchard','autumn']){
  const plants=sites.filter((s:any)=>s.biome===biome);
  assert(plants.length>100);
  for(const kind of ['mushrooms','bush','stump',biome==='spruce'?'fern':'flowers'])assert(plants.some((s:any)=>s.kind===kind));
 }
 assert(root.userData.grassBlades<=144000);assert(sites.length>1500);
 for(const s of sites){assert(dryGround(s.x,s.z,s.radius),`${s.kind} intersects water`);assert(Math.hypot(s.x-120,s.z+40)>s.radius+.6);}
 let triangles=0;
 root.traverse(o=>{if(o instanceof Mesh){assert(!o.castShadow);assert(!o.receiveShadow);triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3*((o as any).isInstancedMesh?(o as any).count:1);}if(o instanceof LOD){assert.equal(o.levels.length,2);assert(o.levels[1].distance<=150);assert(o.levels[1].hysteresis>0);}});
 assert(triangles<1200000);
});

test('existing landmark flower stems remain on dry ground, including enlarged pond sites',()=>{
 const root=createLandmarks(),matrix=new Matrix4(),position=new Vector3(),scale=new Vector3();root.updateMatrixWorld(true);
 let flowers=0;
 root.traverse((o:any)=>{
  if(!o.isInstancedMesh||o.geometry.type!=='CylinderGeometry')return;
  for(let i=0;i<o.count;i++){
   o.getMatrixAt(i,matrix);matrix.premultiply(o.matrixWorld);position.setFromMatrixPosition(matrix);scale.setFromMatrixScale(matrix);
   // Landmark flower stems have radius .025, possibly scaled 1.6x around a pond.
   if(Math.abs(scale.x-.025)<.0001||Math.abs(scale.x-.04)<.0001){flowers++;assert(!inWater(position.x,position.z));assert(dryGround(position.x,position.z,scale.x/.025*.32));}
  }
 });assert(flowers>400);
});

test('open ground has no large grass gaps, with shrubs under crowns and along every mountain edge',()=>{
 const trees=createForest().userData.treePositions,root=createMeadowDecor(trees),sites=root.userData.sites;
 const bushes=sites.filter((s:any)=>s.kind==='bush');
 assert(trees.filter((t:any)=>bushes.some((s:any)=>Math.hypot(t.x-s.x,t.z-s.z)<t.crownRadius)).length>trees.length*.8);
 for(const axis of ['x','z'])for(const sign of [-1,1])assert(bushes.filter((s:any)=>s[axis]*sign>234).length>60);
 const cells=new Map<string,Vector3[]>(),matrix=new Matrix4(),position=new Vector3();root.updateMatrixWorld(true);
 let triangles=0;
 root.traverse((o:any)=>{
  if(o.isMesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);
  if(!o.isInstancedMesh)return;
  for(let i=0;i<o.count;i++){
   o.getMatrixAt(i,matrix);matrix.premultiply(o.matrixWorld);position.setFromMatrixPosition(matrix);
   const key=`${Math.floor(position.x/5)},${Math.floor(position.z/5)}`;
   if(!cells.has(key))cells.set(key,[]);cells.get(key)!.push(position.clone());
  }
 });
 let checked=0;
 for(let x=-240;x<=240;x+=10)for(let z=-240;z<=240;z+=10){
  if(!sceneryClearance(x,z,5)||!dryGround(x,z,5)||trees.some((t:any)=>Math.hypot(t.x-x,t.z-z)<4))continue;
  let nearest=Infinity;
  for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(const p of cells.get(`${Math.floor(x/5)+dx},${Math.floor(z/5)+dz}`)??[])nearest=Math.min(nearest,Math.hypot(p.x-x,p.z-z));
  assert(nearest<4.5,`bare ground at ${x},${z}`);checked++;
 }
 assert(checked>1000);assert(triangles<1400000);assert.equal(root.userData.grassBlades,144000);
});
