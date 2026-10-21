import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as T from 'three';
import {bakeShadowProfile,PreparedShadows,characterShadow,restrictShadowCasters,shadowParts,shadowDistanceMask,SHADOW_MASK_SIZE as SIZE} from '../src/prepared-shadows';
import {daylight} from '../src/day-cycle';
import {createShrubGeometry} from '../src/shrub-model';
import {groundShadowOpacity} from '../src/ground-shadow-style';
import {treeShadows,updateTreeShadows} from '../src/tree-shadows';

test('distance fields retain holes and interpolate one moving contour instead of two translucent copies',()=>{
 const size=32,rectangle=(from:number,to:number)=>Uint8Array.from({length:size*size},(_,i)=>i%size>=from&&i%size<=to?255:0);
 const a=shadowDistanceMask(rectangle(4,14),size),b=shadowDistanceMask(rectangle(10,20),size);
 const middle=Array.from({length:size},(_,x)=>(a[size*16+x]+b[size*16+x])/2>=128);
 assert.equal(middle.indexOf(true),7);assert.equal(middle.lastIndexOf(true),17);
 assert(middle.slice(7,18).every(Boolean),'the interpolated shadow has a single filled outline');
 const hollow=rectangle(3,27);for(let y=8;y<24;y++)for(let x=10;x<21;x++)hollow[y*size+x]=0;
 const field=shadowDistanceMask(hollow,size);assert(field[16*size+16]<128);assert(field[16*size+5]>128);
});

test('solid prepared silhouettes and trees use the same density throughout the day/night cycle',()=>{
 const shadows=new PreparedShadows(),trees=treeShadows([new T.Matrix4()]),tree=trees.children[0] as T.InstancedMesh;
 const profile=shadows.geometryProfile(new T.BoxGeometry(2,2,2));shadows.add(profile,new T.Matrix4());shadows.commit();
 const color=new T.Color();(shadows.group.getObjectByName('Prepared scenery cell') as T.InstancedMesh).getColorAt(0,color);assert.equal(color.g,1);
 for(const phase of [0,.01,.125,.25,.49,.5,.75]){
  const time=daylight(phase);shadows.update(time,new T.Vector3());updateTreeShadows(time);
  assert.equal(shadows.material.opacity,groundShadowOpacity(time));assert.equal(shadows.material.opacity,(tree.material as T.Material).opacity);
 }
});

test('eight baked masks preserve directional silhouettes, gaps, and feathered edges',()=>{
 const post=new T.BoxGeometry(.3,3,.3),profile=bakeShadowProfile([{geometry:post,matrix:new T.Matrix4().makeTranslation(0,1.5,0)}]);
 assert.equal(profile.masks.length,8);
 const centroid=(mask:Uint8Array)=>{let mass=0,x=0,z=0;for(let i=0;i<mask.length;i++){mass+=mask[i];x+=i%SIZE*mask[i];z+=Math.floor(i/SIZE)*mask[i];}return [x/mass,z/mass];};
 assert(centroid(profile.masks[0])[1]>centroid(profile.masks[4])[1]+12);
 assert(centroid(profile.masks[2])[0]>centroid(profile.masks[6])[0]+12);
 assert(profile.masks[0].some(x=>x>0&&x<255));
 assert(profile.masks.every(mask=>mask[0]===0&&mask[mask.length-1]===0));
 const left=new T.Matrix4().makeTranslation(-2,0,0),right=new T.Matrix4().makeTranslation(2,0,0),low=new T.BoxGeometry(.5,.1,.5);
 const gap=bakeShadowProfile([{geometry:low,matrix:left},{geometry:low,matrix:right}]);
 assert.equal(gap.masks[0][SIZE/2*SIZE+SIZE/2],0,'disconnected objects must not turn into a filled bounding rectangle');
});

test('only explicitly marked character hierarchies retain ordinary shadow casting',()=>{
 const scene=new T.Scene(),prop=new T.Mesh(new T.BoxGeometry(),new T.MeshBasicMaterial());prop.castShadow=true;scene.add(prop);
 const actor=characterShadow(new T.Group()),body=prop.clone();actor.add(body);scene.add(actor);
 const proxy=new T.Mesh(new T.BoxGeometry(),new T.MeshBasicMaterial({colorWrite:false,depthWrite:false}));proxy.castShadow=true;scene.add(proxy);
 restrictShadowCasters(scene);assert.equal(prop.castShadow,false);assert.equal(body.castShadow,true);assert.equal(proxy.castShadow,false);assert.equal(proxy.visible,false);
});

test('shrub masks follow actual foliage with separated leaf shadows inside the outline',()=>{
 const geometry=createShrubGeometry('birch'),profile=bakeShadowProfile([{geometry,matrix:new T.Matrix4()}]);
 let dividedRows=0;
 for(const mask of profile.masks)for(let y=0;y<SIZE;y++){
  let runs=0,inside=false;
  for(let x=0;x<SIZE;x++){const covered=mask[y*SIZE+x]>100;if(covered&&!inside)runs++;inside=covered;}
  if(runs>=3)dividedRows++;
 }
 assert(dividedRows>20,'real leaves must leave patterned gaps rather than a solid circle');
 assert.notDeepEqual(profile.masks[0],profile.masks[2],'turning the sun changes the asymmetric branching silhouette');
 geometry.dispose();
});

test('baking ignores alternate LODs and character passengers',()=>{
 const root=new T.Group(),lod=new T.LOD(),near=new T.Mesh(new T.BoxGeometry()),far=new T.Mesh(new T.SphereGeometry());lod.addLevel(near,0);lod.addLevel(far,40);root.add(lod);
 const passenger=characterShadow(new T.Group());passenger.add(new T.Mesh(new T.SphereGeometry()));root.add(passenger);
 const parts=shadowParts(root);assert.equal(parts.length,1);assert.equal(parts[0].geometry,near.geometry);
});

test('static matrices stay unchanged; moving silhouettes follow their source and visibility',()=>{
 const scene=new T.Scene(),shadows=new PreparedShadows();scene.add(shadows.group);
 const profile=shadows.geometryProfile(new T.BoxGeometry(2,2,2));shadows.add(profile,new T.Matrix4().makeTranslation(10,0,10));
 shadows.add(profile,new T.Matrix4().makeTranslation(15,0,10),{grass:true});
 const boat=new T.Group();scene.add(boat);boat.position.set(3,-.42,7);shadows.addMoving(boat,profile,()=>-.42);shadows.commit();
 const cell=shadows.group.getObjectByName('Prepared scenery cell') as T.InstancedMesh,original=[...cell.instanceMatrix.array],moving=shadows.group.getObjectByName('Prepared moving object shadows') as T.InstancedMesh;
 shadows.update(daylight(.25),new T.Vector3());const before=[...moving.instanceMatrix.array];boat.position.x+=5;shadows.update(daylight(.75),new T.Vector3());
 assert.deepEqual([...cell.instanceMatrix.array],original);assert.notDeepEqual([...moving.instanceMatrix.array],before);
 boat.rotation.x=Math.PI/2;shadows.update(daylight(.25),new T.Vector3());
 const placement=new T.Matrix4();moving.getMatrixAt(0,placement);assert(placement.elements.every(Number.isFinite));
 assert(Math.abs(placement.elements[0]*placement.elements[10]-placement.elements[2]*placement.elements[8])>.01,'a vertical cart or flat bread must not collapse its ground shadow to a line');
 assert.equal(placement.elements[1],0);assert.equal(placement.elements[9],0);
 const color=new T.Color();moving.getColorAt(0,color);assert(Math.abs(color.b+.42)<1e-6,'the water surface is retained as receiver');
 boat.visible=false;shadows.update(daylight(.25),new T.Vector3());moving.getColorAt(0,color);assert.equal(color.g,0);
 const grass=shadows.grass.children[0];shadows.update(daylight(.25),new T.Vector3(1000,0,1000));assert.equal(grass.visible,false);
 assert.equal(cell.castShadow,false);assert.equal(moving.castShadow,false);assert(shadows.material.map!.generateMipmaps);
 const count=shadows.group.children.length;shadows.commit();assert.equal(shadows.group.children.length,count,'registration must not duplicate batches');
 boat.removeFromParent();shadows.commit();assert(!shadows.group.getObjectByName('Prepared moving object shadows'));
 scene.add(boat);shadows.addMoving(boat,profile);shadows.commit();assert(shadows.group.getObjectByName('Prepared moving object shadows'),'moving shadows can be restored after the last source was removed');
});
