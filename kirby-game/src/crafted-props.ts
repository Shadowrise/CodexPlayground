import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {batchRigidMeshes} from './rigid-batch';
import {craftedUVs,applyCraftedSurfaces} from './crafted-surfaces';

type Finish='oak'|'stone'|'paint'|'linen'|'wicker'|'plaster'|'ceramic'|'metal'|'leaf'|'rope';
const roughness:Record<Finish,number>={oak:.86,stone:.93,paint:.72,linen:.98,wicker:.84,plaster:.96,ceramic:.31,metal:.42,leaf:.9,rope:.94};
const shapes=new Map<string,T.BufferGeometry>();
const shape=(key:string,create:()=>T.BufferGeometry)=>{let g=shapes.get(key);if(!g){g=create();craftedUVs(g);shapes.set(key,g);}return g;};

/** Static pieces are merged by finish, then textured once. Templates can be
 * cloned by the scenery instancer without duplicating buffers or textures. */
export class CraftedProps{
 readonly group=new T.Group();
 private materials=new Map<string,T.MeshStandardMaterial>();
 mesh(g:T.BufferGeometry,c:string,x:number,y:number,z:number,sx=1,sy=1,sz=1,finish:Finish='oak'){
  const key=finish+c;let m=this.materials.get(key);
  if(!m){m=new T.MeshStandardMaterial({color:c,roughness:roughness[finish],metalness:finish==='metal'?.65:0});m.userData.craftedFinish=finish;this.materials.set(key,m);}
  const mesh=new T.Mesh(g,m);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=mesh.receiveShadow=true;this.group.add(mesh);return mesh;
 }
 box(c:string,x:number,y:number,z:number,w:number,h:number,d:number,finish:Finish='oak',bevel=false){
  const g=shape(['box',w,h,d,bevel].join(':'),()=>bevel?new RoundedBoxGeometry(w,h,d,1,Math.min(w,h,d)*.16):new T.BoxGeometry(w,h,d));
  return this.mesh(g,c,x,y,z,1,1,1,finish);
 }
 ball(c:string,x:number,y:number,z:number,sx:number,sy:number,sz:number,finish:Finish='leaf'){
  const small=Math.max(sx,sy,sz)<.11;
  return this.mesh(shape(small?'small ball':'ball',()=>new T.SphereGeometry(1,small?8:12,small?5:8)),c,x,y,z,sx,sy,sz,finish);
 }
 cylinder(c:string,x:number,y:number,z:number,top:number,bottom:number,h:number,finish:Finish='oak',sides=12){
  return this.mesh(shape(['cylinder',top,bottom,h,sides].join(':'),()=>new T.CylinderGeometry(top,bottom,h,sides)),c,x,y,z,1,1,1,finish);
 }
 ring(c:string,x:number,y:number,z:number,r:number,tube:number,finish:Finish='metal'){
  const m=this.mesh(shape(['ring',r,tube].join(':'),()=>new T.TorusGeometry(r,tube,4,24)),c,x,y,z,1,1,1,finish);return m;
 }
 lathe(c:string,x:number,y:number,z:number,points:[number,number][],finish:Finish='ceramic'){
  return this.mesh(shape('lathe'+JSON.stringify(points),()=>new T.LatheGeometry(points.map(p=>new T.Vector2(...p)),12)),c,x,y,z,1,1,1,finish);
 }
 leaf(c:string,x:number,y:number,z:number,size:number,yaw=0,tilt=0){
  const g=shape('leaf',()=>{
   const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([0,0,0,-.36,.09,.38,0,.2,.48,.36,.09,.38,0,0,1],3));
   g.setIndex([0,1,2,0,2,3,1,4,2,2,4,3,2,1,0,3,2,0,2,4,1,3,4,2]);g.computeVertexNormals();g.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(10),2));return g;
  });
  const m=this.mesh(g,c,x,y,z,size,size,size,'leaf');m.rotation.set(tilt,yaw,0);return m;
 }
 stem(c:string,a:T.Vector3,b:T.Vector3,r=.025,finish:Finish='leaf'){
  const mesh=this.cylinder(c,(a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2,r,r,a.distanceTo(b),finish,6);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize());return mesh;
 }
 finish(name:string,preserve:ReadonlySet<T.Object3D>=new Set()){
  batchRigidMeshes(this.group,preserve);applyCraftedSurfaces(this.group);this.group.name=name;
  this.group.traverse(o=>{if(o instanceof T.Mesh){o.geometry.computeBoundingSphere();o.userData.craftedProp=true;
   if(o.material instanceof T.MeshStandardMaterial&&['linen','leaf','ceramic','metal'].includes(o.material.userData.craftedFinish))o.castShadow=false;
  }});
  return this.group;
 }
}
