import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {DEPOT_PLATFORM,DEPOT_STEPS,DEPOT_BENCHES} from './depot-floor';
import {drawLocalizedText,localizedCanvasTexture} from './localized-sign';
import {batchRigidMeshes} from './rigid-batch';
import {makeOakBench} from './bench-model';
import {OAK_TONES as oak,craftedUVs,applyCraftedSurfaces} from './crafted-surfaces';

type Finish='oak'|'stone'|'paint'|'iron'|'brass'|'leather'|'ceramic'|'lamp';

/** Open-air station: all fine detail is static, with a clear approach and boarding edge. */
export function makeCoasterDepot(){
 const root=new T.Group();root.name='Handcrafted coaster depot';root.position.z=DEPOT_PLATFORM.z;
 const materials=new Map<string,T.MeshStandardMaterial>(),geometries=new Map<string,T.BufferGeometry>();
 const material=(color:string,finish:Finish)=>{
  const key=color+finish;
  if(!materials.has(key))materials.set(key,new T.MeshStandardMaterial({color,
   roughness:finish==='brass'?.37:finish==='iron'?.52:finish==='ceramic'?.3:finish==='leather'?.78:.88,
   metalness:finish==='brass'?.7:finish==='iron'?.55:finish==='paint'?.16:0,
   ...(finish==='lamp'?{emissive:'#ffd393',emissiveIntensity:.8}:{}),userData:{craftedFinish:finish},
  }));
  return materials.get(key)!;
 };
 const group=(name:string,x=0,y=0,z=0)=>{const g=new T.Group();g.name=name;g.position.set(x,y,z);root.add(g);return g;};
 const mesh=(parent:T.Group,geometry:T.BufferGeometry,color:string,finish:Finish,x:number,y:number,z:number,shadow=true)=>{
  const m=new T.Mesh(geometry,material(color,finish));m.position.set(x,y,z);m.castShadow=shadow;m.receiveShadow=true;parent.add(m);return m;
 };
 const box=(p:T.Group,c:string,f:Finish,x:number,y:number,z:number,w:number,h:number,d:number,r=.025)=>{
  const key=[w,h,d,r].join(',');let geometry=geometries.get(key);
  if(!geometry){geometry=new RoundedBoxGeometry(w,h,d,Math.max(w,h,d)>2?2:1,Math.min(r,w/3,h/3,d/3));craftedUVs(geometry);geometries.set(key,geometry);}
  return mesh(p,geometry,c,f,x,y,z);
 };
 const rod=(p:T.Group,c:string,f:Finish,a:number[],b:number[],radius:number,r2=radius)=>{
  const from=new T.Vector3(...a),to=new T.Vector3(...b),length=from.distanceTo(to),key=['rod',radius,r2,length].join(',');
  let geometry=geometries.get(key);if(!geometry){geometry=new T.CylinderGeometry(r2,radius,length,radius>.5?32:10);geometries.set(key,geometry);}
  const m=mesh(p,geometry,c,f,0,0,0);m.position.copy(from).add(to).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),to.sub(from).normalize());return m;
 };
 const ball=(p:T.Group,c:string,f:Finish,x:number,y:number,z:number,sx:number,sy=sx,sz=sx)=>{
  let geometry=geometries.get('sphere');if(!geometry){geometry=new T.SphereGeometry(1,12,8);geometries.set('sphere',geometry);}
  const m=mesh(p,geometry,c,f,x,y,z);m.scale.set(sx,sy,sz);return m;
 };
 const ring=(p:T.Group,c:string,f:Finish,x:number,y:number,z:number,r:number,t:number)=>mesh(p,new T.TorusGeometry(r,t,6,32),c,f,x,y,z);
 const bolt=(p:T.Group,x:number,y:number,z:number,front=false)=>{
  const m=rod(p,'#b8a06b','brass',[x,y-.014,z],[x,y+.014,z],.037);m.castShadow=false;if(front)m.rotation.x=Math.PI/2;return m;
 };

 // The top surfaces exactly match the shared walking heights; narrow seams add depth.
 const floor=group('Oak platform and dressed stone foundation');
 box(floor,'#908873','stone',0,.245,0,24,.49,10,.07);
 for(let row=0;row<2;row++)for(let i=0;i<12;i++){
  const x=-11+(i+(row%2)*.45)*2;if(x>11.7)continue;
  box(floor,['#aaa08b','#b5aa93','#a69c86'][(i+row)%3],'stone',x,.15+row*.23,-4.91,1.94,.205,.19,.035);
 }
 for(const side of [-1,1])for(let i=0;i<6;i++)box(floor,i%2?'#b4a891':'#a39882','stone',side*11.89,.27,-4.15+i*1.63,.22,.49,1.59,.035);
 // Stagger the joints in long boards instead of repeating a grid of square tiles.
 for(let row=0;row<16;row++){
  const ends=[-11.55,...(row%2?[-8.65,-2.88,2.89,8.66]:[-5.78,0,5.78]),11.55];
  for(let i=0;i<ends.length-1;i++){
   const a=ends[i]+.018,b=ends[i+1]-.018,z=-4.42+row*.55;
   box(floor,oak[(row*3+i)%oak.length],'oak',(a+b)/2,.615,z,b-a,.17,.525,.02);
   for(const x of [a+.13,b-.13])for(const dz of [-.16,.16])bolt(floor,x,.704,z+dz);
  }
 }
 for(const side of [-1,1])box(floor,'#c4b89c','stone',side*11.78,.605,0,.44,.19,10,.035);
 box(floor,'#c7b99a','stone',0,.605,-4.8,23.2,.19,.4,.03);
 box(floor,'#d4c5a5','stone',0,.605,4.68,23.2,.19,.64,.04);
 box(floor,'#c29a4b','brass',0,.704,4.3,23.1,.025,.075,.008);
 for(let i=0;i<46;i++)box(floor,i%2?'#bc9550':'#c7a763','brass',-11.25+i*.5,.706,4.66,.25,.022,.07,.006);
 for(const step of DEPOT_STEPS){
  const z=step.z-DEPOT_PLATFORM.z;
  box(floor,'#a79c84','stone',step.x,(step.height-.08)/2,z,step.width,step.height-.08,step.depth,.025);
  for(let i=0;i<7;i++)box(floor,i%2?'#c8b99b':'#bfb193','stone',i-3,step.height-.04,z,.985,.08,step.depth,.018);
  box(floor,'#c09b55','brass',0,step.height-.008,z-step.depth/2+.09,6.8,.018,.045,.005);
 }
 // Small end-grain inlays break up the broad boards at close range.
 for(const [x,z] of [[-6.1,-3.3],[3.5,-1.65],[-3.4,1.1],[9.4,2.2],[-8.6,3.3],[5.4,-3.85]]){
  const knot=ring(floor,'#946c43','oak',x,.704,z,.085,.009);knot.rotation.x=-Math.PI/2;knot.scale.x=2.4;
 }

 const fittings=group('Riveted teal station ironwork');
 const post=(x:number,z:number,height:number)=>{
  box(fittings,'#b8ac90','stone',x,.87,z,.78,.34,.78,.06);
  box(fittings,'#284f50','iron',x,1.07,z,.61,.1,.61,.018);
  for(const dx of [-.21,.21])for(const dz of [-.21,.21])bolt(fittings,x+dx,1.13,z+dz);
  box(fittings,'#376c69','paint',x,(height+1.12)/2,z,.28,height-1.12,.28,.035);
  for(const y of [1.25,height-.17])box(fittings,'#c4a263','brass',x,y,z,.34,.11,.34,.02);
  ball(fittings,'#c4a263','brass',x,height+.09,z,.17,.2,.17);
 };
 for(const side of [-1,1]){
  for(const z of [-3.6,-.7,2.2])post(side*11.7,z,2.36);
  for(const y of [1.4,2.11])rod(fittings,'#497c73','paint',[side*11.7,y,-3.6],[side*11.7,y,2.2],.055);
  for(let i=0;i<10;i++)rod(fittings,'#4c7b70','paint',[side*11.7,1.4,-3.35+i*.55],[side*11.7,2.1,-3.35+i*.55],.025);
  // A low front rail ends well outside the seven-metre stair opening.
  post(side*4.35,-4.55,2.1);
  for(const y of [1.32,1.88])rod(fittings,'#497c73','paint',[side*4.35,y,-4.55],[side*10.55,y,-4.55],.055);
 }

 // Slatted oak benches, shaped armrests, iron feet and visible brass fasteners.
 for(const site of DEPOT_BENCHES){
  const bench=makeOakBench();bench.name=site.x<0?'West oak waiting bench':'East oak waiting bench';
  bench.position.set(site.x,DEPOT_PLATFORM.height,site.z-DEPOT_PLATFORM.z);root.add(bench);
 }

 // A timber-framed enamel sign sits on detailed piers, with no roof over the rider.
 const arch=group('Depot sign gantry');
 for(const x of [-10.35,10.35]){
  post(x,3.78,11.17);
  box(arch,'#2e5b58','paint',x,5.86,3.78,.45,9.55,.45,.035);
  for(const y of [1.6,6.8,10.84])box(arch,'#b49b60','brass',x,y,3.78,.52,.14,.52,.018);
  for(const face of [-1,1]){
   rod(arch,'#507f72','paint',[x,6.4,3.78+face*.27],[x-Math.sign(x)*2.5,7.7,3.78+face*.27],.07);
   for(const y of [1.5,6.6,10.84])bolt(arch,x,y,3.49,true);
  }
 }
 box(arch,'#315e59','paint',0,10.92,3.78,22.3,.3,.55,.055);
 box(arch,'#ac8653','oak',0,9.0,3.78,21.25,3.6,.46,.08);
 const enamel=box(arch,'#285752','paint',0,9.0,3.78,20.92,3.27,.51,.07);
 (enamel.material as T.MeshStandardMaterial).emissive.set('#285752');
 (enamel.material as T.MeshStandardMaterial).emissiveIntensity=.16;
 for(const face of [-1,1]){
  const z=3.78+face*.28;
  for(const y of [7.47,10.53])box(arch,'#d0ad65','brass',0,y,z,20.55,.065,.06,.015);
  for(const x of [-10.24,10.24])box(arch,'#d0ad65','brass',x,9,z,.065,3.06,.06,.015);
  for(const x of [-9.96,9.96])for(const y of [7.72,10.28])bolt(arch,x,y,z+face*.04,true);
 }
 if(typeof document!=='undefined'){
  const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=320;const ctx=canvas.getContext('2d')!;
  ctx.strokeStyle='#c6ad72';ctx.lineWidth=2;
  for(const x of [260,1788]){ctx.beginPath();ctx.moveTo(x-85,159);ctx.lineTo(x+85,159);ctx.stroke();ctx.beginPath();ctx.arc(x,159,10,0,Math.PI*2);ctx.stroke();}
  ctx.textAlign='center';ctx.fillStyle='#f5e5bb';ctx.font='bold 186px Georgia,serif';drawLocalizedText(ctx,'ДЕПО',1024,197,1390);
  ctx.font='bold 47px sans-serif';ctx.fillStyle='#d4ba7f';drawLocalizedText(ctx,'АМЕРИКАНСКИЕ ГОРКИ',1024,270,1700);
  const texture=localizedCanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
  const labelMaterial=new T.MeshStandardMaterial({map:texture,emissiveMap:texture,emissive:'#ffffff',emissiveIntensity:.65,transparent:true,roughness:.8,depthWrite:false});
  for(const side of [-1,1]){
   const sign=new T.Mesh(new T.PlaneGeometry(20.2,3.02),labelMaterial);sign.name='Depot sign';sign.position.set(0,9,3.78+side*.264);sign.rotation.y=side<0?Math.PI:0;arch.add(sign);
  }
 }

 // A readable station clock uses raised hour markers and fixed ornamental hands.
 const clock=group('Brass station clock',0,11.84,3.78);
 const rim=rod(clock,'#c4a265','brass',[0,0,-.2],[0,0,.2],1.05);rim.castShadow=true;
 rod(clock,'#f0e1bd','ceramic',[0,0,-.225],[0,0,.225],.93);
 for(const face of [-1,1]){
  ring(clock,'#456c60','paint',0,0,face*.235,.85,.018);
  for(let i=0;i<12;i++){
   const a=i*Math.PI/6,tick=box(clock,'#3e6259','paint',Math.sin(a)*.75,Math.cos(a)*.75,face*.239,.045,i%3===0?.18:.11,.025,.006);tick.rotation.z=-a;
  }
  rod(clock,'#315851','paint',[0,0,face*.27],[-face*.35,.35,face*.27],.038);
  rod(clock,'#315851','paint',[0,0,face*.28],[face*.49,.3,face*.28],.026);
  ball(clock,'#bc9252','brass',0,0,face*.29,.082,.082,.025);
 }

 const lantern=(name:string,x:number,y:number,z:number)=>{
  const p=group(name,x,y,z);
  rod(p,'#335c56','iron',[0,0,0],[0,.25,0],.045);
  box(p,'#375f56','iron',0,.27,0,.72,.11,.66,.035);
  box(p,'#f2d5a0','lamp',0,.67,0,.5,.69,.45,.035);
  for(const dx of [-.28,.28])for(const dz of [-.255,.255])rod(p,'#456b58','iron',[dx,.3,dz],[dx,.99,dz],.026);
  for(const h of [.35,.94])box(p,'#b29250','brass',0,h,0,.59,.065,.54,.015);
  const roof=mesh(p,new T.ConeGeometry(.57,.32,4),'#2f5753','paint',0,1.13,0);roof.rotation.y=Math.PI/4;
  ball(p,'#b79c62','brass',0,1.35,0,.08,.12,.08);
 };
 for(const side of [-1,1]){
  post(side*10.7,-4.2,4.0);lantern(side<0?'West platform lantern':'East platform lantern',side*10.7,4,-4.2);
  rod(arch,'#375e54','iron',[side*7.7,7.4,3.78],[side*7.7,6.7,3.78],.035);
  lantern(side<0?'West hanging lantern':'East hanging lantern',side*7.7,5.34,3.78);
 }

 // Travel trunks: separate planks, straps, buckles, edge guards and a curved handle.
 const luggage=(name:string,x:number,y:number,z:number,width:number,height:number,depth:number,color:string)=>{
  const p=group(name,x,y,z);
  box(p,color,'leather',0,height/2,0,width,height,depth,.11);
  for(const side of [-1,1]){
   const sx=side*width*.29;
   box(p,'#bd955a','leather',sx,height/2,-depth/2-.014,.11,height+.015,.035,.012);
   box(p,'#bd955a','leather',sx,height+.01,0,.11,.035,depth,.012);
   box(p,'#c7a267','brass',sx,height*.61,-depth/2-.045,.19,.2,.045,.02);
   box(p,color,'leather',sx,height*.61,-depth/2-.072,.105,.105,.015,.015);
   for(const sy of [.09,height-.09])box(p,'#b79960','brass',side*(width/2-.1),sy,-depth/2-.025,.16,.14,.045,.025);
  }
  box(p,'#a9814c','leather',0,height*.74,-depth/2-.026,width,.035,.04,.008);
  const curve=new T.CatmullRomCurve3([[-.28,height,0],[-.23,height+.18,0],[.23,height+.18,0],[.28,height,0]].map(p=>new T.Vector3(...p)));
  mesh(p,new T.TubeGeometry(curve,16,.041,8,false),'#644a32','leather',0,0,0);
  for(const sx of [-.29,.29])box(p,'#b99d64','brass',sx,height+.02,0,.13,.04,.17,.015);
  // An ivory luggage tag hangs clear of the dark clasp.
  box(p,'#e0cda4','ceramic',.12,height*.47,-depth/2-.05,.25,.33,.025,.035).rotation.z=.15;
  return p;
 };
 luggage('Leather travel trunk',-10.3,.71,.7,1.8,1.12,1.2,'#7c5b40');
 luggage('Teal weekend suitcase',-10.3,1.84,.72,1.55,.72,.85,'#507b70').rotation.y=-.16;
 luggage('Small honey leather case',-10.45,.71,-1.1,1.17,.75,.79,'#a77747').rotation.y=.18;

 const crate=(parent:T.Group,x:number,y:number,z:number,w:number,h:number,d:number)=>{
  for(const side of [-1,1])for(let i=0;i<3;i++){
   box(parent,oak[i],'oak',x,y+.12+i*(h-.2)/3,z+side*d/2,w,.19,d*.06,.015);
   box(parent,oak[(i+2)%6],'oak',x+side*w/2,y+.12+i*(h-.2)/3,z,w*.06,.19,d,.015);
  }
  for(const dx of [-1,1])for(const dz of [-1,1])box(parent,'#927044','oak',x+dx*(w/2-.05),y+h/2,z+dz*(d/2-.05),.13,h,.13,.015);
  for(let i=0;i<4;i++)box(parent,oak[i],'oak',x+(i-1.5)*w/4,y+.04,z,w/4-.018,.08,d,.01);
 };
 const desk=group('Station keeper oak worktable',10.6,0,.2);desk.rotation.y=Math.PI/2;
 for(let i=0;i<4;i++)box(desk,oak[i],'oak',0,1.97,(i-1.5)*.35,3.7,.19,.325,.035);
 for(const x of [-1.5,1.5])for(const z of [-.48,.48]){
  box(desk,'#80603c','oak',x,1.34,z,.19,1.27,.2,.025);
  for(const y of [1.78,1.86])bolt(desk,x,y,z-.115,true);
 }
 for(const z of [-.52,.52])box(desk,'#997747','oak',0,1.76,z,3.22,.24,.13,.018);
 for(let i=0;i<3;i++)box(desk,oak[i],'oak',0,.98,(i-1)*.34,3.25,.1,.31,.02);
 crate(desk,-.65,1.05,0,1.35,.62,.78);
 box(desk,'#d9c79f','ceramic',.7,1.12,.04,.78,.18,.54,.025);
 // Folded route chart with a raised oval circuit, little station dots and a pencil.
 box(desk,'#dfd4b6','ceramic',-.38,2.078,.02,1.48,.025,.85,.012).rotation.y=.08;
 const route=ring(desk,'#5b8d7d','paint',-.38,2.096,.02,.28,.013);route.rotation.x=-Math.PI/2;route.scale.x=1.8;
 for(const x of [-.86,.11])ball(desk,'#b88345','brass',x,2.113,.04,.038,.012,.038);
 rod(desk,'#a16640','oak',[.39,2.11,-.33],[.92,2.11,-.07],.022);
 rod(desk,'#e8d9b8','oak',[.92,2.11,-.07],[1,2.11,-.03],.022,0);
 const cup=mesh(desk,new T.LatheGeometry([[0,0],[.15,0],[.19,.08],[.2,.3],[.18,.33],[.155,.32],[.16,.1],[0,.07]].map(p=>new T.Vector2(...p)),24),'#4e8278','ceramic',1.25,2.07,-.23);
 ring(desk,'#e2c48a','brass',1.25,2.39,-.23,.18,.013).rotation.x=-Math.PI/2;
 ring(desk,'#4e8278','ceramic',1.48,2.24,-.23,.13,.029);
 cup.name='Station keeper enamel mug';
 for(let i=0;i<3;i++)box(desk,'#e7c999','ceramic',.68+i*.11,2.09,.32,.44,.025,.24,.01).rotation.y=-.14+i*.1;

 const signal=group('Mechanical departure signal',5.35,0,2.82);
 box(signal,'#b8ab8c','stone',0,.86,0,.68,.3,.68,.04);
 rod(signal,'#365d56','iron',[0,1,0],[0,3.75,0],.082);
 box(signal,'#355d56','paint',0,3.36,0,.62,.96,.31,.08);
 for(const [y,c] of [[3.58,'#b9795d'],[3.16,'#9ab577']] as const){
  const lens=rod(signal,'#bba16a','brass',[0,y,-.17],[0,y,-.23],.17);lens.castShadow=false;
  rod(signal,c,'ceramic',[0,y,-.234],[0,y,-.26],.13);
 }
 rod(signal,'#536d54','iron',[0,1.27,0],[.45,1.65,0],.038);
 ball(signal,'#b77547','oak',.45,1.65,0,.09,.12,.09);

 // Small flower boxes sit in the front corners, outside the stair and cart lanes.
 for(const side of [-1,1]){
  const p=group(side<0?'West station flower box':'East station flower box',side*8.1,0,-4.18);
  for(let i=0;i<3;i++)box(p,oak[i],'oak',0,.83+i*.17,0,1.94,.15,.71,.018);
  box(p,'#514d34','stone',0,1.27,0,1.76,.045,.55,.015);
  for(const x of [-.72,.72])for(const z of [-.37,.37])box(p,'#4e7360','paint',x,1.01,z,.095,.58,.055,.012);
  for(let i=0;i<7;i++){
   const x=(i-3)*.24,z=Math.sin(i*5)*.17,y=1.6+(i%3)*.1;
   rod(p,'#5c7550','paint',[x,1.25,z],[x,y,z],.017);
   for(const s of [-1,1])ball(p,'#698451','paint',x+s*.07,y-.18,z,.13,.044,.06).rotation.z=s*.55;
   for(let petal=0;petal<5;petal++){const a=petal*Math.PI*2/5;ball(p,i%3?'#d9c596':'#c58a73','ceramic',x+Math.cos(a)*.08,y+.025,z+Math.sin(a)*.08,.07,.04,.065);}
   ball(p,'#b79848','brass',x,y+.047,z,.038,.025,.038);
  }
 }

 // Preserve named prop groups but merge their rigid pieces by material finish.
 const parents:T.Group[]=[];root.traverse(o=>{if(o instanceof T.Group)parents.push(o);});
 for(const parent of parents)batchRigidMeshes(parent);
 applyCraftedSurfaces(root);
 return root;
}
