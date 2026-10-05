import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {KirbyHome} from '../src/kirby-home';
import {Watermill} from '../src/watermill';
import {Treehouse} from '../src/treehouse';
import {prepareSurfaceTextures} from '../src/texture-filtering';

test('all three detailed roofs have no overlapping nearly coplanar tile faces',()=>{
 const roofs=[{root:new KirbyHome().group,colors:['b9516b','c7687d','a94764']},
  {root:new Watermill().group,colors:['ad563b','bc6847','c77a50','a6533d']},
  {root:new Treehouse().group,colors:['386653','49755b','567c5b']}];
 for(const {root,colors} of roofs){
  const tiles:{p:T.Vector3;n:T.Vector3;x:T.Vector3;z:T.Vector3;hx:number;hz:number}[]=[];
  root.updateMatrixWorld(true);
  root.traverse(o=>{
   if(!(o instanceof T.InstancedMesh)||!(o.material instanceof T.MeshStandardMaterial)||!colors.includes(o.material.color.getHexString()))return;
   for(let i=0;i<o.count;i++){
    const m=new T.Matrix4();o.getMatrixAt(i,m);m.premultiply(o.matrixWorld);
    const p=new T.Vector3(0,.5,0).applyMatrix4(m),scale=new T.Vector3().setFromMatrixScale(m);
    tiles.push({p,n:new T.Vector3(0,1,0).transformDirection(m),x:new T.Vector3(1,0,0).transformDirection(m),z:new T.Vector3(0,0,1).transformDirection(m),hx:scale.x/2,hz:scale.z/2});
   }
  });
  assert(tiles.length>=200);
  for(let i=0;i<tiles.length;i++)for(let j=i+1;j<tiles.length;j++){
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
