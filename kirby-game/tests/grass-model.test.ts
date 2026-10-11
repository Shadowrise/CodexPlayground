import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LinearMipmapLinearFilter} from 'three';
import {createGrassGeometry,createGrassMaterial} from '../src/grass-model';

test('slender curved grass stays within a small triangle budget and shares one opaque surface',()=>{
 const geometry=createGrassGeometry(),material=createGrassMaterial(),other=createGrassMaterial();
 assert(geometry.index!.count/3<=15,'curving grass must keep a bounded per-tuft budget');
 const p=geometry.attributes.position,baseVertices=[];
 for(let i=0;i<p.count;i++)if(p.getY(i)===0)baseVertices.push(i);
 for(let i=0;i<baseVertices.length;i+=2){
  const a=baseVertices[i],b=baseVertices[i+1];
  assert(Math.hypot(p.getX(a)-p.getX(b),p.getZ(a)-p.getZ(b))<.065,'blades must be slender');
 }
 assert.equal(geometry.attributes.uv.count,geometry.attributes.position.count);
 assert.equal(material.map,other.map);
 assert(!material.transparent);assert(!material.alphaTest);
 const texture=material.map!,image=texture.image;
 assert(image.width*image.height<=8192);assert(texture.generateMipmaps);
 assert.equal(texture.minFilter,LinearMipmapLinearFilter);
 assert(image.data.every((v:number,i:number)=>i%4!==3||v===255));
 assert(image.data.some((v:number,i:number)=>i%4===0&&v<190),'central rib has readable contrast');
 geometry.dispose();material.dispose();other.dispose();
});
