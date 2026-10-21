import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as T from 'three';
import {makeCollectibleStar} from '../src/collectible-star';

test('collectible is one closed, smooth solid with matching front and back surfaces',()=>{
 const star=makeCollectibleStar(),body=star.getObjectByName('Smooth sculpted star') as T.Mesh,g=body.geometry,p=g.attributes.position,index=g.index!;
 assert.equal(star.children.length,2,'only the smooth body and volume glow');
 const edges=new Map<string,number>();let volume=0;
 const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();
 for(let i=0;i<index.count;i+=3){
  const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)];
  for(let j=0;j<3;j++){const x=ids[j],y=ids[(j+1)%3],key=[Math.min(x,y),Math.max(x,y)].join(':');edges.set(key,(edges.get(key)??0)+1);}
  a.fromBufferAttribute(p,ids[0]);b.fromBufferAttribute(p,ids[1]);c.fromBufferAttribute(p,ids[2]);volume+=a.dot(b.cross(c))/6;
 }
 assert([...edges.values()].every(count=>count===2),'no open seams or detached ornaments');assert(volume>.3,'outward-facing solid has real volume');
 assert(index.count/3<=3000,'smooth silhouette stays within its geometry budget');
 for(let i=0;i<p.count;i++){a.fromBufferAttribute(g.attributes.normal,i);assert(Math.abs(a.length()-1)<1e-5);}
 body.updateMatrixWorld(true);
 for(const side of [-1,1]){
  const hit=new T.Raycaster(new T.Vector3(0,0,side*2),new T.Vector3(0,0,-side)).intersectObject(body)[0];
  assert(hit);assert(Math.abs(hit.point.z-side*.37)<1e-5);
 }
});

test('stars share geometry and material resources, including repeated festival colours',()=>{
 const a=makeCollectibleStar('#ff668f'),b=makeCollectibleStar('#ff668f'),gold=makeCollectibleStar('#ffd35a',1.45);
 for(let i=0;i<2;i++){
  assert.equal((a.children[i] as T.Mesh).geometry,(b.children[i] as T.Mesh).geometry);
  assert.equal((a.children[i] as T.Mesh).geometry,(gold.children[i] as T.Mesh).geometry);
  assert.equal((a.children[i] as T.Mesh).material,(b.children[i] as T.Mesh).material);
 }
 assert.notEqual((a.children[0] as T.Mesh).material,(gold.children[0] as T.Mesh).material);
 assert.equal(gold.scale.x,1.45);a.visible=false;assert(b.visible);
});

test('glow is the firefly volume with real depth, scene occlusion and no extra lights or billboards',()=>{
 const star=makeCollectibleStar(),halo=star.getObjectByName('Collectible star volume glow') as T.Mesh<T.BufferGeometry,T.MeshBasicMaterial>;
 assert.equal(halo.material.customProgramCacheKey(),'soft-volume-mist-v1');assert(halo.material.depthTest);assert(!halo.material.depthWrite);
 assert.equal(halo.material.blending,T.AdditiveBlending);assert(!halo.castShadow);assert(!halo.receiveShadow);
 assert(halo.scale.z>1);halo.geometry.computeBoundingBox();assert(halo.geometry.boundingBox!.max.z-halo.geometry.boundingBox!.min.z>1.5);
 star.traverse(o=>{assert(!(o instanceof T.Sprite));assert(!(o instanceof T.Light));});
});
