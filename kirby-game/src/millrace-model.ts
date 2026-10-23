import * as T from 'three';
import {CraftedProps} from './crafted-props';

const oak=['#977044','#a67b49','#b48c56','#a17a48'],stone=['#a2a38c','#b2b198','#969b85','#bdb99d'];
const iron='#455653',brass='#c2a16a';

/** The channel floor stays below y=7.05 and its outlet stays at z=-2.65. */
export function makeMillrace(){
 const b=new CraftedProps();
 const timber=(x:number,y:number,z:number,w:number,h:number,d:number,c=oak[0],round=false)=>b.box(c,x,y,z,w,h,d,'oak',round);
 const brace=(a:number[],c:number[],width:number)=>{
  const from=new T.Vector3(...a),to=new T.Vector3(...c),mid=from.clone().add(to).multiplyScalar(.5);
  const m=timber(mid.x,mid.y,mid.z,width,from.distanceTo(to),width,'#88613e',true);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),to.sub(from).normalize());
 };
 const bolt=(x:number,y:number,z:number)=>{const m=b.cylinder(brass,x,y,z,.047,.047,.035,'metal',6);m.rotation.z=Math.PI/2;};
 // A broad, stepped stone spring pier with bonded masonry and a framed spout.
 b.box('#8a927b',10.8,.2,-14.2,3.8,.4,2.8,'stone',true);
 b.box('#c0bba0',10.8,.47,-14.2,3.5,.16,2.57,'stone',true);
 for(let row=0;row<9;row++){
  const y=.88+row*.59;
  for(const side of [-1,1]){
   for(let col=0;col<3;col++)b.box(stone[(row+col)%4],9.79+col*1.01,y,-14.2+side*.91,.97,.55,.36,'stone',true);
   for(let col=0;col<2;col++)b.box(stone[(row+col+2)%4],10.8+side*1.35,y,-14.61+col*.83,.32,.55,.79,'stone',true);
  }
 }
 b.box('#8c947d',10.8,6.02,-14.2,3.13,.22,2.28,'stone',true);
 b.box('#c4bfa2',10.8,6.22,-14.2,3.42,.17,2.52,'stone',true);
 b.box('#a5aa91',10.8,6.73,-14.2,2.65,.84,1.95,'stone',true);
 for(let i=0;i<9;i++){
  const a=(i+.5)*Math.PI/9,m=b.box(stone[i%4],10.8+Math.cos(a)*.69,6.71+Math.sin(a)*.69,-13.18,.27,.34,.24,'stone',true);m.rotation.z=a-Math.PI/2;
 }
 for(const x of [10.11,11.49])b.box('#beb99b',x,6.52,-13.18,.29,.48,.24,'stone',true);
 b.box('#c9c2a2',10.8,7.55,-14.2,2.91,.19,2.22,'stone',true);
 const pipe=b.mesh(new T.CylinderGeometry(.43,.43,1.12,20,1,true),'#657e70',10.8,7,-13.22,1,1,1,'metal');pipe.rotation.x=Math.PI/2;
 for(const z of [-13.59,-12.68]){
  b.ring(iron,10.8,7,z,.45,.055);
  for(let i=0;i<8;i++){const a=i*Math.PI/4;b.ball(brass,10.8+Math.cos(a)*.46,7+Math.sin(a)*.46,z+.04,.035,.035,.024,'metal');}
 }
 // Five continuous floor planks, with recessed seams rather than overlaps.
 for(let i=0;i<5;i++)timber(10.8+(i-2)*.405,6.9,-7.875,.39,.2,10.45,oak[i%4]);
 for(let section=0;section<5;section++){
  const z=-12.05+section*1.675;
  for(const x of [9.68,11.92]){
   for(let row=0;row<2;row++)timber(x,7.16+row*.28,z,.17,.255,1.645,oak[(section+row)%4],true);
   timber(x,7.6,z,.235,.1,1.65,'#c09a63',true);
  }
 }
 // Lower outlet cheeks leave the sheet of water unobstructed above the wheel.
 for(const x of [9.68,11.92]){
  timber(x,7.16,-3.65,.17,.47,1.96,'#ae8753',true);timber(x,7.43,-3.65,.235,.08,1.98,'#c09a63',true);
 }
 for(const z of [-12.85,-11.2,-9.52,-7.84,-6.16,-4.52,-2.85]){
  timber(10.8,6.69,z,2.65,.23,.24,'#70523b',true);
  for(const side of [-1,1]){
   b.box(iron,10.8+side*1.226,7.2,z,.035,.69,.105,'metal');
   for(const y of [6.98,7.42])bolt(10.8+side*1.253,y,z);
  }
 }
 // Trestles have individual footings, shouldered posts and knee braces.
 for(const z of [-12.1,-8.9,-5.5]){
  for(const side of [-1,1]){
   const x=10.8+side*1.1;
   b.box('#8f9680',x,.2,z,.76,.4,.78,'stone',true);b.box('#bcb69a',x,.46,z,.62,.15,.65,'stone',true);
   timber(x,3.5,z,.3,6,.32,'#795739',true);
   for(const y of [.69,6.3])b.box(iron,x,y,z,.334,.12,.35,'metal');
   brace([x,5.04,z],[x,6.55,z+.78],.2);brace([x,5.04,z],[x,6.55,z-.78],.2);
   for(const y of [.7,5.15,6.3])bolt(x+side*.19,y,z);
  }
  timber(10.8,6.43,z,2.72,.27,.37,'#88613e',true);
  brace([9.72,1.05,z],[11.88,4.6,z],.14);
 }
 // Sluice guide posts echo the dark structural timbers of the mill facade.
 for(const x of [9.6,12]){
  timber(x,7.65,-5.4,.23,2,.28,'#624631',true);
  b.box(iron,x,7.08,-5.4,.28,.15,.33,'metal');b.box(iron,x,8.43,-5.4,.28,.13,.33,'metal');
 }
 for(const x of [9.77,11.83])b.box(iron,x,7.67,-5.4,.065,1.77,.22,'metal');
 timber(10.8,8.6,-5.4,2.83,.24,.38,'#765039',true);
 for(const x of [9.6,12]){const peg=b.cylinder(brass,x,8.6,-5.19,.065,.065,.045,'metal',8);peg.rotation.x=Math.PI/2;}
 // Restrained moss gathers in the cool joints at the spring's foot.
 for(let i=0;i<12;i++){const a=i*2.4;b.ball(i%3?'#6e8255':'#83915f',10.8+Math.sin(a)*1.58,.18+(i%3)*.08,-14.2+Math.cos(a)*1.04,.24,.1,.18,'leaf');}
 return b.finish('Masonry spring and oak millrace');
}

export function makeMillraceGate(){
 const b=new CraftedProps();
 for(let i=0;i<5;i++)b.box(oak[i%4],0,-.32+i*.17,0,1.96,.15,.18,'oak',true);
 for(const x of [-.73,.73])for(const side of [-1,1]){
  b.box(iron,x,.02,side*.106,.075,.79,.035,'metal');
  for(const y of [-.27,.31])b.ball(brass,x,y,side*.132,.04,.04,.022,'metal');
 }
 b.cylinder(iron,0,.78,0,.054,.054,1.6,'metal');
 for(let i=0;i<14;i++){const r=b.ring(brass,0,.51+i*.072,0,.063,.012);r.rotation.x=Math.PI/2;}
 return b.finish('Oak sluice gate and threaded stem');
}
