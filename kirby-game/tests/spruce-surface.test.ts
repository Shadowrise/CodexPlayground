import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {NoColorSpace} from 'three';
import {spruceGeometries,spruceParts,spruceNeedleMaterial,spruceBarkMaterial} from '../src/spruce-shape';
import {treeWoodMaterial} from '../src/broadleaf-tree';
import {greatOakBark} from '../src/great-oak';

test('spruce crown vertices and all original protruding parts are restored exactly',()=>{
 const g=spruceGeometries().needles,hash=createHash('sha256');
 for(const a of [g.attributes.position.array,g.attributes.normal.array,g.attributes.uv.array,g.index!.array])hash.update(new Uint8Array(a.buffer,a.byteOffset,a.byteLength));
 // Fingerprints measured from the first model, before the crown experiments.
 assert.equal(hash.digest('hex'),'170f2862955a4d8e054277a1361ffcd1bbcdbf65b354634cceb0b84497e7479f');
 const parts=spruceParts();assert.equal(parts.filter(p=>p.kind==='needles').length,42);assert.equal(parts.filter(p=>p.kind==='wood').length,36);
 assert.equal(createHash('sha256').update(JSON.stringify(parts.map(p=>({...p,matrix:p.matrix.toArray()})))).digest('hex'),'75faae7347894e1228623aa1aa79aad67d81d688f180ab60aa86368e9452db03');
});

test('neutral photographic needles preserve the original tile brightness and shared opaque materials',()=>{
 assert.equal(treeWoodMaterial().map,greatOakBark().map);assert.equal(treeWoodMaterial(true),treeWoodMaterial());
 assert.equal(spruceBarkMaterial().map,greatOakBark().map);assert.equal(spruceBarkMaterial().vertexColors,false,'original spruce cylinders have no vertex colour attribute');
 const material=spruceNeedleMaterial(),map=material.map!;assert.equal(material,spruceNeedleMaterial());assert.equal(map.image.width,512);assert.equal(map.image.height,512);assert.equal(map.colorSpace,NoColorSpace);assert(map.generateMipmaps&&!material.transparent);assert.equal(material.alphaTest,0);assert(map.userData.photographicNeedles);
 const colors=new Set<number>();let sum=0,squared=0;for(let i=0;i<map.image.data.length;i+=4){const d=map.image.data;assert.equal(d[i+3],255);assert.equal(d[i],d[i+1]);assert.equal(d[i+1],d[i+2]);colors.add(d[i]);sum+=d[i];squared+=d[i]**2;}
 const n=map.image.width*map.image.height,mean=sum/n;assert(colors.size>=10&&colors.size<=16);assert(Math.abs(mean-163.55779266357422)<.25,'same average linear brightness as the original tile');assert(Math.abs(Math.sqrt(squared/n-mean**2)-26.073666488266237)<.25,'same contrast as the original tile');
});
