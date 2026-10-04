import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {makeBoatWake} from './boat-wake';

export const BOAT_COLORS=['#f16a71','#f4ab38','#6ac980','#50c8cf','#519beb','#a576e8','#ed85bd','#eb7750'];
let hull:T.BufferGeometry|undefined,details:T.BufferGeometry|undefined;
const umbrellas:T.BufferGeometry[]=[];
const woodMaterial=new T.MeshStandardMaterial({vertexColors:true,roughness:.62});
const paints=BOAT_COLORS.map(color=>new T.MeshStandardMaterial({color,roughness:.3,metalness:.12}));

function batch(parts:T.Mesh[]){
 const geometries=parts.map(m=>{
  m.updateMatrix();const g=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();g.applyMatrix4(m.matrix);g.deleteAttribute('uv');
  const c=(m.material as T.MeshStandardMaterial).color,colors=new Float32Array(g.getAttribute('position').count*3);
  for(let i=0;i<colors.length;i+=3)colors.set([c.r,c.g,c.b],i);g.setAttribute('color',new T.BufferAttribute(colors,3));m.geometry.dispose();(m.material as T.Material).dispose();return g;
 });const result=mergeGeometries(geometries)!;geometries.forEach(g=>g.dispose());return result;
}
function build(){
 const n=48,vertices:number[]=[],indices:number[]=[];
 // Rounded pointed bow, rising gunwales and a complete inner shell.
 for(const [radius,y] of [[.72,-.25],[1,.37],[.88,.37],[.64,-.1]])for(let i=0;i<n;i++){
  const a=i/n*Math.PI*2,x=Math.sin(a),z=Math.cos(a);
  vertices.push(x*radius*(1-.19*Math.max(0,z)),y+.12*Math.abs(z)**4,z*2.15*radius);
 }
 for(let band=0;band<3;band++)for(let i=0;i<n;i++){const a=band*n+i,b=band*n+(i+1)%n;indices.push(a,b,b+n,a,b+n,a+n);}
 hull=new T.BufferGeometry();hull.setAttribute('position',new T.Float32BufferAttribute(vertices,3));hull.setIndex(indices);hull.computeVertexNormals();
 const parts:T.Mesh[]=[];
 const add=(g:T.BufferGeometry,color:string,x:number,y:number,z:number,rx=0,ry=0,rz=0)=>{
  const m=new T.Mesh(g,new T.MeshStandardMaterial({color}));m.position.set(x,y,z);m.rotation.set(rx,ry,rz);parts.push(m);return m;
 };
 const box=(color:string,x:number,y:number,z:number,sx:number,sy:number,sz:number)=>add(new T.BoxGeometry(sx,sy,sz),color,x,y,z);
 const beam=(a:T.Vector3,b:T.Vector3,r:number,color:string)=>{const m=add(new T.CylinderGeometry(r,r,a.distanceTo(b),8),color,...a.clone().add(b).multiplyScalar(.5).toArray());m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize());};
 for(let i=0;i<48;i++){
  const point=(j:number)=>{const a=j/n*Math.PI*2,z=Math.cos(a);return new T.Vector3(Math.sin(a)*(1-.19*Math.max(0,z)),.39+.12*Math.abs(z)**4,z*2.15);};
  beam(point(i),point(i+1),.048,'#f7e2ad');
 }
 // A continuous deck above the waterline keeps the river out of the cockpit.
 const deckPoints=[0,.12,0],deckIndices:number[]=[];
 for(let i=0;i<48;i++){const a=i/48*Math.PI*2,z=Math.cos(a);deckPoints.push(Math.sin(a)*.77*(1-.19*Math.max(0,z)),.12,z*2.15*.77);deckIndices.push(0,i+1,(i+1)%48+1);}
 const deck=new T.BufferGeometry();deck.setAttribute('position',new T.Float32BufferAttribute(deckPoints,3));deck.setIndex(deckIndices);deck.computeVertexNormals();add(deck,'#aa7848',0,0,0);
 for(let i=-5;i<=5;i++){const z=i*.26,width=1.46*Math.sqrt(1-((Math.abs(z)+.125)/1.65)**2)*(1-.19*Math.max(0,z)/1.65);box(i%2?'#b87e46':'#d9a763',0,.14,z,width,.035,.245);}
 // Slatted bench, padded seat, backrest, brass fixings and curved armrests.
 for(const x of [-.64,.64]){box('#795231',x,.2,-.38,.09,.6,.55);box('#795231',x,.68,-.67,.08,.9,.09);}
 for(let i=0;i<4;i++)box(i%2?'#e0b16e':'#c79355',0,.48,-.52+i*.14,1.65,.08,.125);
 for(let i=0;i<3;i++)box('#d9a967',0,.73+i*.14,-.69,1.65,.11,.065);
 box('#fff0ce',0,.555,-.27,1.36,.08,.48);
 for(const x of [-.82,.82]){beam(new T.Vector3(x,.52,-.55),new T.Vector3(x,.86,-.55),.045,'#e4c377');beam(new T.Vector3(x,.86,-.55),new T.Vector3(x,.86,.04),.05,'#e4c377');}
 for(const x of [-.65,.65])for(const y of [.75,1.01])add(new T.SphereGeometry(.028,8,5),'#fff0b5',x,y,-.647);
 // Umbrella pole stays behind the passenger, with a winding handle.
 beam(new T.Vector3(0,.1,-1.48),new T.Vector3(0,2.66,-1.48),.035,'#eee0b2');
 beam(new T.Vector3(0,2.66,-1.48),new T.Vector3(0,2.945,-.65),.03,'#eee0b2');
 add(new T.TorusGeometry(.105,.025,6,14,Math.PI),'#bc8640',.105,1.3,-1.48,0,0,Math.PI);
 for(const z of [-1.55,1.6]){box('#d8c99c',0,.46,z,.24,.045,.12);for(const x of [-.08,.08])add(new T.CylinderGeometry(.023,.03,.12,8),'#e8d9b5',x,.49,z);}
 // Two folded oars, orange lifebuoy and a coiled bow rope.
 for(const side of [-1,1]){beam(new T.Vector3(side*.76,.42,-1.1),new T.Vector3(side*.77,.46,1.2),.028,'#977047');box('#cca46e',side*.77,.46,1.22,.16,.065,.36);}
 const buoy=add(new T.TorusGeometry(.23,.072,8,24),'#ff9946',-.83,.38,.6,0,Math.PI/2);buoy.scale.y=.95;
 for(let i=0;i<3;i++)add(new T.TorusGeometry(.08+i*.028,.014,5,22),'#edcc8c',0,.48,1.61,Math.PI/2);
 details=batch(parts);
 for(const paint of BOAT_COLORS){
  const pieces:T.Mesh[]=[];
  for(let sector=0;sector<8;sector++){
   const p:number[]=[],ix:number[]=[];
   for(let ring=0;ring<=4;ring++)for(let j=0;j<=6;j++){
    const r=ring/4*1.26,a=(sector+j/6)/8*Math.PI*2;
    p.push(Math.sin(a)*r,2.97-.46*(r/1.26)**1.4-Math.sin(j/6*Math.PI)*.045*ring/4,Math.cos(a)*r-.65);
   }
   for(let ring=0;ring<4;ring++)for(let j=0;j<6;j++){const a=ring*7+j;ix.push(a,a+7,a+8,a,a+8,a+1);}
   const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(ix);g.computeVertexNormals();pieces.push(new T.Mesh(g,new T.MeshStandardMaterial({color:sector%2?'#fff1d3':paint})));
  }
  // Thin underside ribs and a small golden finial are part of the same batch.
  for(let i=0;i<8;i++){const a=i*Math.PI/4,start=new T.Vector3(0,2.945,-.65),end=new T.Vector3(Math.sin(a)*1.25,2.49,Math.cos(a)*1.25-.65);const mesh=new T.Mesh(new T.CylinderGeometry(.012,.012,start.distanceTo(end),5),new T.MeshStandardMaterial({color:'#e9d5a4'}));mesh.position.copy(start).add(end).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),end.sub(start).normalize());pieces.push(mesh);}
  const tip=new T.Mesh(new T.SphereGeometry(.055,10,6),new T.MeshStandardMaterial({color:'#eac371'}));tip.position.set(0,3.015,-.65);pieces.push(tip);umbrellas.push(batch(pieces));
 }
}
const canopyMaterial=new T.MeshStandardMaterial({vertexColors:true,roughness:.75,side:T.DoubleSide});
export function makeBoat(index:number){
 if(!hull)build();
 const group=new T.Group();group.name=`River boat ${index+1}`;
 const shell=new T.Mesh(hull,paints[index]),trim=new T.Mesh(details,woodMaterial),umbrella=new T.Mesh(umbrellas[index],canopyMaterial);
 group.add(shell,trim,umbrella);group.traverse(o=>{if(o instanceof T.Mesh)o.receiveShadow=true;});group.add(makeBoatWake());return group;
}
