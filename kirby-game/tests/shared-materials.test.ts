import assert from 'node:assert/strict';
import {test} from 'node:test';
import {DataTexture,Group,Mesh,MeshLambertMaterial,BoxGeometry} from 'three';
import {shareIdenticalMaterials} from '../src/shared-materials';

test('equal surfaces within a root share one material; any differing property keeps them apart',()=>{
 const map=new DataTexture(new Uint8Array(4),1,1),other=new DataTexture(new Uint8Array(4),1,1),box=new BoxGeometry();
 const hook=(tag:string)=>{const m=new MeshLambertMaterial({color:'#8a6',map});m.onBeforeCompile=shader=>{shader.vertexShader+='// '+tag;};m.customProgramCacheKey=()=>tag;return m;};
 const root=new Group(),meshes=[
  new MeshLambertMaterial({color:'#8a6',map}),new MeshLambertMaterial({color:'#8a6',map}),   // equal
  new MeshLambertMaterial({color:'#8a7',map}),                                                  // colour
  new MeshLambertMaterial({color:'#8a6',map:other}),                                            // texture
  hook('wind'),hook('wind'),hook('veins'),                                                      // restored hooks
 ].map(material=>new Mesh(box,material));
 root.add(...meshes);
 const second=new Group();second.add(new Mesh(box,new MeshLambertMaterial({color:'#8a6',map})));
 assert.equal(shareIdenticalMaterials([root,second]),2);
 const [a,b,colour,texture,wind,windAgain,veins]=meshes.map(mesh=>mesh.material);
 assert.equal(a,b);assert.notEqual(a,colour);assert.notEqual(a,texture);
 assert.equal(wind,windAgain,'hooks restored with one program key and source are the same hook');assert.notEqual(wind,veins);assert.notEqual(a,wind);
 assert.notEqual((second.children[0] as Mesh).material,a,'materials are shared within a root only');
});
