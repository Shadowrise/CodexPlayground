import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Mesh,LOD,Vector3,Matrix4,type Object3D} from 'three';
import {createMeadowDecor} from '../src/meadow-decor';
import {dryGround,inWater} from '../src/pond-layout';
import {createLandmarks,sceneryClearance} from '../src/landmarks';
import {createForest} from '../src/forest';

// Smooth, narrow blades add six triangles per tuft, retaining the same 48k
// placement cap. Whole-map totals below include every near cell at once;
// actual rendering still uses regional culling and the existing distance fade.
const grassCurveBudget=48000*6;

// Only one level is drawn at a time. Alternative buffers are shared by every
// shrub instance, so summing all LODs overstates the actual triangle budget.
function trianglesAtLevel(object:Object3D,distantShrubs=false):number{
 if(object instanceof LOD)return trianglesAtLevel(object.levels[distantShrubs&&object.levels.length===4?2:0].object,distantShrubs);
 const own=object instanceof Mesh?(object.geometry.index?.count??object.geometry.attributes.position.count)/3*((object as any).isInstancedMesh?(object as any).count:1):0;
 return own+object.children.reduce((sum,child)=>sum+trianglesAtLevel(child,distantShrubs),0);
}

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
 root.traverse(o=>{if(o instanceof Mesh){assert(!o.castShadow);assert(!o.receiveShadow);}if(o instanceof LOD){assert.equal(o.levels.length,o.name.startsWith('Leafy ')?4:2);assert(o.levels.at(-1)!.distance<=150);assert(o.levels[1].hysteresis>0);}});
 assert(trianglesAtLevel(root)<1600000+grassCurveBudget);assert(trianglesAtLevel(root,true)<1200000+grassCurveBudget);assert(root.userData.placementTriangles<=850000);
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
 const forest=createForest(),trees=forest.userData.treePositions,layout=forest.userData.meadowLayout,root=createMeadowDecor(trees,layout),sites=root.userData.sites;
 const bushes=sites.filter((s:any)=>s.kind==='bush');
 // Young, narrow spruces have shrubs at the drip line; include the shrub's
 // footprint rather than requiring its centre underneath a sub-metre crown.
 const covered=trees.filter((t:any)=>bushes.some((s:any)=>Math.hypot(t.x-s.x,t.z-s.z)<t.crownRadius+s.radius*.65)).length;
 assert(covered>trees.length*.8,`shrubs cover ${covered}/${trees.length} trees`);
 const mature=trees.filter((t:any)=>t.crownRadius>2.5);
 assert(mature.filter((t:any)=>bushes.some((s:any)=>Math.hypot(t.x-s.x,t.z-s.z)<t.crownRadius)).length>mature.length*.8);
 assert(root.userData.trailBushes>100,'shrubs frame the paths as well as the groves');
 for(const axis of ['x','z'])for(const sign of [-1,1])assert(bushes.filter((s:any)=>s[axis]*sign>234).length>60);
 const cells=new Map<string,Vector3[]>(),matrix=new Matrix4(),position=new Vector3();root.updateMatrixWorld(true);
 root.traverse((o:any)=>{
  if(!o.isInstancedMesh)return;
  for(let i=0;i<o.count;i++){
   o.getMatrixAt(i,matrix);matrix.premultiply(o.matrixWorld);position.setFromMatrixPosition(matrix);
   const key=`${Math.floor(position.x/5)},${Math.floor(position.z/5)}`;
   if(!cells.has(key))cells.set(key,[]);cells.get(key)!.push(position.clone());
  }
 });
 let checked=0;
 for(let x=-240;x<=240;x+=10)for(let z=-240;z<=240;z+=10){
  if(!sceneryClearance(x,z,5)||!dryGround(x,z,5)||!layout.clearOfTrails(x,z,3)||trees.some((t:any)=>Math.hypot(t.x-x,t.z-z)<4))continue;
  let nearest=Infinity;
  for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(const p of cells.get(`${Math.floor(x/5)+dx},${Math.floor(z/5)+dz}`)??[])nearest=Math.min(nearest,Math.hypot(p.x-x,p.z-z));
  assert(nearest<4.5,`bare ground at ${x},${z}`);checked++;
 }
 // Denser groves intentionally replace some of the former open grass cells.
 assert(checked>500,`open grass cells checked: ${checked}`);assert(trianglesAtLevel(root)<4200000+grassCurveBudget);assert(trianglesAtLevel(root,true)<1400000+grassCurveBudget);assert.equal(root.userData.grassBlades,144000);
 for(const s of sites)assert(layout.clearOfTrails(s.x,s.z,s.radius),`${s.kind} obstructs a path or its rim`);
});

test('old landmark decoration moves off paths as complete objects onto nearby dry verges',()=>{
 const forest=createForest(),layout=forest.userData.meadowLayout,trees=forest.userData.treePositions;
 const root=createLandmarks(layout,trees),sites=root.userData.scenerySites;
 assert(sites.filter((s:any)=>s.kind==='flower').length>400);
 const moved=sites.filter((s:any)=>s.moved);assert(moved.length>30,'exercise existing flowers crossing the path network');
 for(const s of sites){
  assert(layout.clearOfTrails(s.x,s.z,s.radius),`${s.kind} remains on a path`);
  assert(dryGround(s.x,s.z,s.radius),`${s.kind} moved into water`);
 }
 for(const s of moved){
  assert(Math.hypot(s.x-s.fromX,s.z-s.fromZ)<=24.001,'keep decorations near their original group');
  assert(trees.every((t:any)=>Math.hypot(s.x-t.x,s.z-t.z)>=s.radius+.699));
 }
 const matrix=new Matrix4(),position=new Vector3(),scale=new Vector3();root.updateMatrixWorld(true);let stems=0;
 root.traverse((o:any)=>{
  if(!o.isInstancedMesh||o.geometry.type!=='CylinderGeometry')return;
  for(let i=0;i<o.count;i++){
   o.getMatrixAt(i,matrix);matrix.premultiply(o.matrixWorld);position.setFromMatrixPosition(matrix);scale.setFromMatrixScale(matrix);
   if(Math.abs(scale.x-.025)>.0001&&Math.abs(scale.x-.04)>.0001)continue;
   assert(layout.clearOfTrails(position.x,position.z,scale.x/.025*.32-.0001),'rendered stem is still on a path');
   assert(sites.some((s:any)=>s.kind==='flower'&&Math.hypot(s.x-position.x,s.z-position.z)<.0001));stems++;
  }
 });assert(stems>400);
});
