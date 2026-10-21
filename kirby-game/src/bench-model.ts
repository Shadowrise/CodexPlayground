import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {batchRigidMeshes} from './rigid-batch';
import {OAK_TONES as oak,craftedUVs,applyCraftedSurfaces} from './crafted-surfaces';

export const OAK_BENCH_WIDTH=4.65;
export const OAK_BENCH_SEAT_HEIGHT=.84;
let template:T.Group|undefined;

/** Shared oak-and-teal bench. Its front faces +Z; the origin is on the floor. */
export function makeOakBench(width=OAK_BENCH_WIDTH,seatHeight=OAK_BENCH_SEAT_HEIGHT){
 template??=buildBench();
 const bench=template.clone();bench.name='Oak slat bench';
 bench.scale.set(width/OAK_BENCH_WIDTH,seatHeight/OAK_BENCH_SEAT_HEIGHT,1);
 bench.userData={benchModel:'oak-and-teal',width,seatHeight};return bench;
}

function buildBench(){
 const root=new T.Group(),frame=new T.Group();root.add(frame);frame.rotation.y=Math.PI;frame.position.y=-.7;
 const materials=new Map<string,T.MeshStandardMaterial>();
 const material=(color:string,finish:'oak'|'paint'|'iron'|'brass')=>{
  const key=color+finish;
  if(!materials.has(key))materials.set(key,new T.MeshStandardMaterial({color,
   roughness:finish==='brass'?.37:finish==='iron'?.52:.88,
   metalness:finish==='brass'?.7:finish==='iron'?.55:finish==='paint'?.16:0,userData:{craftedFinish:finish},
  }));return materials.get(key)!;
 };
 const box=(c:string,f:Parameters<typeof material>[1],x:number,y:number,z:number,w:number,h:number,d:number,r=.025)=>{
  const geometry=new RoundedBoxGeometry(w,h,d,Math.max(w,h,d)>2?2:1,Math.min(r,w/3,h/3,d/3));craftedUVs(geometry);
  const m=new T.Mesh(geometry,material(c,f));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;frame.add(m);return m;
 };
 const rod=(c:string,f:Parameters<typeof material>[1],a:number[],b:number[],r:number)=>{
  const start=new T.Vector3(...a),end=new T.Vector3(...b),m=new T.Mesh(new T.CylinderGeometry(r,r,start.distanceTo(end),10),material(c,f));
  m.position.copy(start).add(end).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),end.sub(start).normalize());m.castShadow=m.receiveShadow=true;frame.add(m);return m;
 };
 for(const x of [-1.87,1.87]){
  for(const z of [-.44,.45])rod('#2e5756','iron',[x+Math.sign(x)*.12,.75,z+.11],[x,1.47,z],.07);
  box('#38665f','paint',x,.77,0,.34,.13,1.3,.045);
  rod('#2e5756','iron',[x,.98,.44],[x,2.74,.63],.06);
  rod('#38665f','paint',[x,1.33,-.62],[x,1.33,.62],.055);
  const curve=new T.CatmullRomCurve3([[x,1.45,-.48],[x,1.92,-.57],[x,2.03,-.3],[x,2.03,.42],[x,2.38,.62]].map(p=>new T.Vector3(...p)));
  const arm=new T.Mesh(new T.TubeGeometry(curve,20,.055,8,false),material('#315c57','iron'));arm.castShadow=arm.receiveShadow=true;frame.add(arm);
  box('#b39159','oak',x,2.04,-.05,.2,.11,.8,.045);
 }
 for(let i=0;i<4;i++)box(oak[(i+2)%oak.length],'oak',0,1.45,-.48+i*.3,4.65,.18,.275,.04);
 for(let i=0;i<3;i++){
  const plank=box(oak[i],'oak',0,1.94+i*.29,.57+i*.035,4.65,.245,.13,.035);plank.rotation.x=-.11;
  for(const x of [-1.87,1.87]){const bolt=rod('#b8a06b','brass',[x,1.94+i*.29,.481+i*.035],[x,1.94+i*.29,.509+i*.035],.037);bolt.castShadow=false;}
 }
 rod('#315c57','iron',[-1.87,1.04,.2],[1.87,1.04,.2],.045);
 batchRigidMeshes(frame);applyCraftedSurfaces(root);return root;
}
