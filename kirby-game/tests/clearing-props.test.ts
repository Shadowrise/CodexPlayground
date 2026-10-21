import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Box3,Mesh,MeshStandardMaterial,Object3D,Texture,Vector3} from 'three';
import {makePicnic,makeRuins} from '../src/clearing-models';
import {makeMazeEntrance} from '../src/maze-entrance-model';
import {KirbyHome} from '../src/kirby-home';

function inventory(root:Object3D){
 const meshes:Mesh[]=[];let triangles=0;
 root.traverse(o=>{assert(!('isLight' in o));assert(!('isSprite' in o));if(o instanceof Mesh){meshes.push(o);triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});
 return {meshes,triangles};
}

test('repeated picnic and ruin sites share finished buffers within a fixed draw and geometry budget',()=>{
 for(const [make,calls,triangles] of [[makePicnic,7,8000],[makeRuins,2,8500]] as const){
  const a=inventory(make()),b=inventory(make());assert(a.meshes.length<=calls);assert(a.triangles<=triangles);
  a.meshes.forEach((mesh,i)=>{assert.equal(mesh.geometry,b.meshes[i].geometry);assert.equal(mesh.material,b.meshes[i].material);assert(mesh.geometry.getAttribute('color'),'part colours survive merging');});
 }
 const blanket=new Box3().setFromObject(makePicnic());assert(blanket.min.x>=-2.5&&blanket.max.x<=2.5);assert(blanket.min.z>=-2&&blanket.max.z<=2,'lunch retains the existing trail and bench clearance');
});

test('maze gateway keeps a clear approach without decorative boulders',()=>{
 const entrance=makeMazeEntrance(),stats=inventory(entrance);assert(stats.meshes.length<=4);assert(stats.triangles<4200);
 assert(!entrance.getObjectByName('Rounded mineral stones at maze entrance'));
 for(const mesh of stats.meshes){const p=mesh.geometry.getAttribute('position');for(let i=0;i<p.count;i++)assert(Math.abs(p.getX(i))<5.9,'the old flanking boulder rows have been removed');}
});

test('home keeps the bed contact and pillow while batching its textured static furnishings',()=>{
 const home=new KirbyHome(),stats=inventory(home.group);assert(stats.meshes.length<=17);assert(stats.triangles<30000);
 const pillow=home.group.getObjectByName('Bed pillow');assert(pillow);const size=new Box3().setFromObject(pillow).getSize(new Vector3());assert(size.x>2&&size.x<3.5);
 const finishes=new Set<string>(),maps=new Map<string,Texture>();
 for(const mesh of stats.meshes){
  if(!(mesh.material instanceof MeshStandardMaterial))continue;
  const m=mesh.material,f=m.userData.craftedFinish;if(!f)continue;finishes.add(f);
  if(['oak','stone','paint','linen','wicker','plaster'].includes(f)){assert(m.map&&m.bumpMap===m.map);assert(m.map.image.width<=256);if(maps.has(f))assert.equal(m.map,maps.get(f));else maps.set(f,m.map);}
 }
 assert(finishes.has('linen')&&finishes.has('wicker')&&finishes.has('oak'));
});
