import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,LinearMipmapLinearFilter} from 'three';
import {createBroadleafTree,treeLeafMaterial,treeWoodMaterial,type TreeBranch} from '../src/broadleaf-tree';
import {createVeinedLeafSurface} from '../src/shrub-model';
import {greatOakBark} from '../src/great-oak';

function distanceToShoot(point:Vector3,branch:TreeBranch){
 let closest=Infinity;
 for(let i=1;i<branch.points.length;i++){
  const from=branch.points[i-1],delta=branch.points[i].clone().sub(from),u=Math.max(0,Math.min(1,point.clone().sub(from).dot(delta)/delta.lengthSq()));
  closest=Math.min(closest,from.clone().addScaledVector(delta,u).distanceTo(point));
 }
 return closest;
}
test('leaves, forks and orchard fruit remain attached to real curved branches at every detail level',()=>{
 for(const kind of ['birch','orchard','autumn','oak'] as const)for(const detail of ['near','middle','far'] as const){
  const tree=createBroadleafTree(kind,2,detail);
  for(const leaf of tree.leavesAttached){assert(distanceToShoot(leaf.anchor,tree.branches[leaf.branch])<1e-8);assert(leaf.base.distanceTo(leaf.anchor)<.32);assert(leaf.tip.distanceTo(leaf.base)>.5);}
  for(const branch of tree.branches.slice(1)){assert(distanceToShoot(branch.anchor!,tree.branches[branch.parent])<1e-8);assert(branch.points[0].distanceTo(branch.anchor!)<1e-8);}
  for(const fruit of tree.fruitAttached){assert(distanceToShoot(fruit.anchor,tree.branches[fruit.branch])<1e-8);assert(Math.abs(fruit.anchor.x-fruit.center.x)<1e-8);assert(Math.abs(fruit.anchor.z-fruit.center.z)<1e-8);assert(fruit.top.y<fruit.anchor.y&&fruit.center.y<fruit.top.y);}
  assert.equal(tree.fruitAttached.length,kind==='orchard'&&detail==='near'?24:0);
  for(const g of [tree.wood,tree.leaves,tree.fruit]){
   assert.equal(g.attributes.position.count,g.attributes.uv.count);
   assert(g.index!.array.every(i=>i<g.attributes.position.count));
   assert(g.attributes.position.array.every(Number.isFinite));
   assert(g.boundingSphere!.equals(tree.wood.boundingSphere!),'wood and leaf LODs switch together');
  }
 }
});
test('cropped leaders finish inside a leafy dome with upward growing shoots, varied crowns and bounded geometry',()=>{
 for(const kind of ['birch','orchard','autumn','oak'] as const){
  const trees=[0,1,2,3].map(v=>createBroadleafTree(kind,v));
  for(const tree of trees){
   const trunk=tree.branches[0],tip=trunk.points.at(-1)!;
   assert(tree.leaves.boundingBox!.max.y>tip.y+1,'no bare pole above the crown');
   assert(tree.branches.some(b=>b.parent===0&&b.points.at(-1)!.y>tip.y+.6&&b.points.at(-1)!.distanceTo(tip)>1),'leafy upward forks');
   assert(trunk.points.slice(1,-1).some(p=>Math.hypot(p.x,p.z)>.08),'an organic trunk rather than a straight pole');
   const leafLimit=kind==='oak'?15000:3200,woodLimit=kind==='oak'?10000:3700;
   assert(tree.leaves.index!.count/3<=leafLimit);assert(tree.wood.index!.count/3<=woodLimit);
   const positions=tree.leaves.attributes.position;for(let i=0;i<positions.count;i++)assert(Math.hypot(positions.getX(i),positions.getZ(i))<(kind==='oak'?13:kind==='birch'?5:4.2));
  }
  assert.notDeepEqual(trees[0].leaves.attributes.position.array,trees[1].leaves.attributes.position.array);
  const mid=createBroadleafTree(kind,0,'middle'),far=createBroadleafTree(kind,0,'far');
  assert(mid.leaves.index!.count<trees[0].leaves.index!.count*.55);assert(far.leaves.index!.count<trees[0].leaves.index!.count*.06);
 }
});
test('bark and vein textures are small, opaque, mipmapped and shared across the forest',()=>{
 const leaves=treeLeafMaterial();assert.equal(leaves.map,createVeinedLeafSurface());assert(!leaves.transparent);assert.equal(leaves.userData.leafLightTransmission,.32);
 for(const birch of [true,false]){const wood=treeWoodMaterial(birch);assert.equal(wood.map,greatOakBark().map);const map=wood.map!;assert(map.image.width*map.image.height<=131072);assert(map.generateMipmaps);assert.equal(map.minFilter,LinearMipmapLinearFilter);assert(map.image.data.every((v:number,i:number)=>i%4!==3||v===255));}
});
