import {InstancedMesh,Mesh,type BufferGeometry,type Object3D} from 'three';
import {clusteredGeometry} from './geometry-detail';

/** Beyond this distance a character's dense sculpts are drawn with the welded
 * geometry its shadow already uses; the wider return distance avoids flicker. */
export const CHARACTER_SIMPLE_DISTANCE=48;
export const CHARACTER_FULL_DISTANCE=40;
const CELLS=24;
const far=new WeakMap<Object3D,boolean>();
const pairs=new WeakMap<Mesh,{full:BufferGeometry;simple:BufferGeometry}>();

/** Rigs, materials, skin weights and morph targets stay live: only the vertex
 * density changes. Meshes whose geometry game code replaced meanwhile are left
 * untouched. Authored bounds are kept so attachment points do not shift. */
export function updateCharacterDetail(root:Object3D,distanceSquared:number){
 const was=far.get(root)??false,now=was?distanceSquared>CHARACTER_FULL_DISTANCE**2:distanceSquared>CHARACTER_SIMPLE_DISTANCE**2;
 if(now===was)return;
 far.set(root,now);
 root.traverse(object=>{
  if(!(object instanceof Mesh)||object instanceof InstancedMesh)return;
  const pair=pairs.get(object);
  if(now){
   const full=pair&&object.geometry===pair.simple?pair.full:object.geometry,simple=clusteredGeometry(full,CELLS);
   if(simple===full)return;
   if(full.boundingBox)simple.boundingBox=full.boundingBox.clone();
   if(full.boundingSphere)simple.boundingSphere=full.boundingSphere.clone();
   pairs.set(object,{full,simple});object.geometry=simple;
  }else if(pair&&object.geometry===pair.simple)object.geometry=pair.full;
 });
}

/** Weld a template's sculpts while the game is still loading. Clones share the
 * template geometry, so the first distant character causes no hitch. */
export function prepareCharacterDetail(root:Object3D){
 root.traverse(object=>{if(object instanceof Mesh&&!(object instanceof InstancedMesh))clusteredGeometry(object.geometry,CELLS);});
}
