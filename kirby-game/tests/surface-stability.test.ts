import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {OBB} from 'three/addons/math/OBB.js';
import {KirbyHome} from '../src/kirby-home';
import {Watermill} from '../src/watermill';
import {Treehouse} from '../src/treehouse';
import {prepareSurfaceTextures} from '../src/texture-filtering';
import {rigidComponents} from '../src/rigid-batch';

test('all three detailed roofs have disjoint tile volumes, including side faces and ridge',()=>{
 const roofs=[{root:new KirbyHome().group,colors:['b9516b','c7687d','b35b73','bc697d'],count:360},
  {root:new Watermill().group,colors:['ad563b','bc6847','c77a50','a6533d'],count:240},
  {root:new Treehouse().group,colors:['477362','587f65','668b6c','4e7d69'],count:216}];
 for(const {root,colors,count} of roofs){
  const volumes:OBB[]=[];
  const tiles:{p:T.Vector3;n:T.Vector3;x:T.Vector3;z:T.Vector3;hx:number;hz:number}[]=[];
  const record=(g:T.BufferGeometry,m:T.Matrix4)=>{
   assert.equal(g.type,'BoxGeometry',`${root.name}: roof tile volumes come from their actual boxes`);
   g.computeBoundingBox();
   const center=g.boundingBox!.getCenter(new T.Vector3()),half=g.boundingBox!.getSize(new T.Vector3()).multiplyScalar(.5);
   const p=center.clone().add(new T.Vector3(0,half.y,0)).applyMatrix4(m),scale=new T.Vector3().setFromMatrixScale(m);
   volumes.push(new OBB(center.clone(),half.clone()).applyMatrix4(m));
   tiles.push({p,n:new T.Vector3(0,1,0).transformDirection(m),x:new T.Vector3(1,0,0).transformDirection(m),z:new T.Vector3(0,0,1).transformDirection(m),hx:scale.x*half.x,hz:scale.z*half.z});
  };
  root.updateMatrixWorld(true);
  root.traverse(o=>{
   if(!(o instanceof T.Mesh)||!(o.material instanceof T.MeshStandardMaterial))return;
   const components=rigidComponents(o);
   if(components){
    // Batching bakes tile colours into vertices but retains each original box
    // and transform. Inspect those volumes rather than losing merged tiles.
    const color=o.geometry.getAttribute('color');let offset=0;
    for(const part of components){
     if(part.geometry.type==='BoxGeometry'&&colors.includes(new T.Color().fromBufferAttribute(color,offset).getHexString()))record(part.geometry,new T.Matrix4().multiplyMatrices(o.matrixWorld,part.matrix));
     offset+=part.geometry.getAttribute('position').count;
    }
   }else if(o instanceof T.InstancedMesh&&o.geometry.type==='BoxGeometry'&&colors.includes(o.material.color.getHexString()))for(let i=0;i<o.count;i++){
    const m=new T.Matrix4();o.getMatrixAt(i,m);record(o.geometry,m.premultiply(o.matrixWorld));
   }
  });
  assert.equal(tiles.length,count,`${root.name}: every roof tile is inspected`);
  for(let i=0;i<tiles.length;i++)for(let j=i+1;j<tiles.length;j++){
   assert(!volumes[i].intersectsOBB(volumes[j]),`${root.name}: intersecting tile sides ${i}/${j}`);
   const a=tiles[i],b=tiles[j],d=b.p.clone().sub(a.p);
   if(a.n.dot(b.n)<.99999||Math.abs(d.dot(a.n))>.005)continue;
   const overlapX=a.hx+b.hx-Math.abs(d.dot(a.x)),overlapZ=a.hz+b.hz-Math.abs(d.dot(a.z));
   assert(overlapX<.001||overlapZ<.001,`${root.name}: overlapping coplanar tiles ${i}/${j}`);
  }
 }
});

test('surface filtering is smooth, bounded and configured once; targets are untouched',()=>{
 const map=new T.DataTexture(new Uint8Array(16*16*4),16,16),material=new T.MeshStandardMaterial({map});
 prepareSurfaceTextures(material,4);assert.equal(map.magFilter,T.LinearFilter);assert.equal(map.minFilter,T.LinearMipmapLinearFilter);assert(map.generateMipmaps);assert.equal(map.anisotropy,2);
 const version=map.version;prepareSurfaceTextures(material,4);assert.equal(map.version,version);
 const target=new T.WebGLRenderTarget(16,16);material.map=target.texture;const filter=target.texture.minFilter;prepareSurfaceTextures(material,4);assert.equal(target.texture.minFilter,filter);
 const restricted=new T.DataTexture(new Uint8Array(16),2,2);restricted.anisotropy=16;material.map=restricted;prepareSurfaceTextures(material,1);assert.equal(restricted.anisotropy,1);
 target.dispose();
});
