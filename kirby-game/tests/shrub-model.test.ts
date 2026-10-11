import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,LinearMipmapLinearFilter} from 'three';
import {createShrubGeometry,createShrubMaterial} from '../src/shrub-model';

test('every leaf petiole starts on a real branch, in all biomes and detail levels',()=>{
 for(const biome of ['spruce','birch','orchard','autumn'] as const)for(const detail of ['near','middle','far'] as const){
  const geometry=createShrubGeometry(biome,detail),branches=geometry.userData.branches,leaves=geometry.userData.attachments;
  assert(leaves.length>=12);assert.equal(branches.length,12);
  for(const leaf of leaves){
   const points:Vector3[]=branches[leaf.branch].points;let closest=Infinity;
   for(let i=1;i<points.length;i++){
    const d=points[i].clone().sub(points[i-1]),u=Math.max(0,Math.min(1,leaf.anchor.clone().sub(points[i-1]).dot(d)/d.lengthSq()));
    closest=Math.min(closest,points[i-1].clone().addScaledVector(d,u).distanceTo(leaf.anchor));
   }
   assert(closest<1e-8,'floating petiole');assert(leaf.base.distanceTo(leaf.anchor)<.08,'excessively long petiole');
  }
  const p=geometry.attributes.position;
  assert.equal(geometry.attributes.uv.count,p.count,'veins follow every leaf at every detail level');
  for(let i=0;i<p.count;i++){assert(Math.hypot(p.getX(i),p.getZ(i))<=1.161);assert(p.getY(i)>=0);}
  assert(geometry.index!.count/3<1500);assert(geometry.index!.array.every(i=>i<p.count));
  geometry.dispose();
 }
});
test('distant shrubs cost less and use one small, opaque, mipmapped vein texture',()=>{
 const levels=['near','middle','far'].map(detail=>createShrubGeometry('birch',detail as 'near'|'middle'|'far'));
 assert(levels[1].index!.count<levels[0].index!.count*.55);assert(levels[2].index!.count<levels[0].index!.count*.2);
 const material=createShrubMaterial({value:0}),other=createShrubMaterial({value:1});assert(!material.transparent);
 assert.equal(material.map,other.map,'all bushes share the vein texture');
 const texture=material.map!,surface=texture.image;
 assert.equal(surface.width,128);assert.equal(surface.height,128);
 assert(texture.generateMipmaps);assert.equal(texture.minFilter,LinearMipmapLinearFilter);
 assert.equal(surface.data[0],255,'wood samples an uncoloured corner');
 assert(surface.data.some((v:number,i:number)=>i%4===0&&v<205),'veins have visible contrast');
 assert(surface.data.every((v:number,i:number)=>i%4!==3||v===255),'no transparency overdraw');
 assert(levels[0].attributes.position.count<levels[0].index!.count*.55,'reuse curved leaf/branch vertices');
 levels.forEach(g=>g.dispose());material.dispose();other.dispose();
});
