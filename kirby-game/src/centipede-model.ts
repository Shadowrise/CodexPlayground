import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {CENTIPEDE_CLIPS,CENTIPEDE_MARKERS,type CentipedeClip} from './centipede-clips';

const COUNT=12,STEP=1.35;
const PALETTE=['#ffbd69','#f47568','#f49b42','#e9c747','#9ac957','#43b995','#41baca','#5a98dd','#8970cd','#bd73bb','#ec8da9','#efb956'];
const BOOTS=['#55488a','#237b99','#b84d77','#375f98','#c06a37','#7c428f'];
const SOFT=new T.MeshStandardMaterial({vertexColors:true,roughness:.57});
const GOLD=new T.MeshStandardMaterial({vertexColors:true,metalness:.55,roughness:.29});
SOFT.name='Topotushka satin colours';GOLD.name='Warm brass bells';
const sphere=new T.SphereGeometry(1,18,12),smallSphere=new T.SphereGeometry(1,12,8);
const up=new T.Vector3(0,1,0),xAxis=new T.Vector3(1,0,0);
const smooth=(u:number)=>T.MathUtils.smoothstep(u,0,1);

type Rig={node:T.Group;position:T.Vector3;rotation:T.Quaternion;scale:T.Vector3};
/** Procedural master asset. Rigid coloured parts merge per animated pivot. */
export function createCentipede(){
 const root=new T.Group();root.name='Topotushka';
 root.userData={forward:'+Z',units:'metres',bodySegments:COUNT,phaseMarkers:CENTIPEDE_MARKERS,notes:'In-place animation; move the actor along the gameplay path. TailTarget and BackTarget are interaction anchors.'};
 const rigs:Rig[]=[],parts=new Map<T.Object3D,Map<T.Material,T.BufferGeometry[]>>();
 const group=(parent:T.Object3D,name:string,p:T.Vector3|number[]=[0,0,0])=>{const g=new T.Group();g.name=name;g.position.fromArray(p instanceof T.Vector3?p.toArray():p);parent.add(g);rigs.push({node:g,position:g.position.clone(),rotation:g.quaternion.clone(),scale:g.scale.clone()});return g;};
 function add(parent:T.Object3D,geometry:T.BufferGeometry,color:string,position:number[],scale=[1,1,1],rotation=[0,0,0],metal=false){
  const g=geometry.clone();g.applyMatrix4(new T.Matrix4().compose(new T.Vector3(...position),new T.Quaternion().setFromEuler(new T.Euler(...rotation)),new T.Vector3(...scale)));
  const rgb=new T.Color(color),colors=new Float32Array(g.getAttribute('position').count*3);for(let i=0;i<colors.length;i+=3){colors[i]=rgb.r;colors[i+1]=rgb.g;colors[i+2]=rgb.b;}g.setAttribute('color',new T.BufferAttribute(colors,3));
  const m=metal?GOLD:SOFT;if(!parts.has(parent))parts.set(parent,new Map());const batches=parts.get(parent)!;if(!batches.has(m))batches.set(m,[]);batches.get(m)!.push(g);
 }
 const ell=(p:T.Object3D,c:string,pos:number[],s:number[],small=false)=>add(p,small?smallSphere:sphere,c,pos,s);
 function tube(p:T.Object3D,c:string,points:number[][],radius:number,metal=false){const geometry=new T.TubeGeometry(new T.CatmullRomCurve3(points.map(a=>new T.Vector3(...a))),12,radius,5,false);add(p,geometry,c,[0,0,0],[1,1,1],[0,0,0],metal);geometry.dispose();}
 function ring(p:T.Object3D,c:string,pos:number[],radius:number,thickness:number,rotation=[0,0,0],metal=false){const g=new T.TorusGeometry(radius,thickness,6,24);add(p,g,c,pos,[1,1,1],rotation,metal);g.dispose();}
 const motion=group(root,'Motion');
 const segments=Array.from({length:COUNT},(_,i)=>group(motion,`Segment_${i}`));
 const legs:{node:T.Group;stem:T.Group;boot:T.Group;segment:number;side:number}[]=[];
 for(let i=1;i<COUNT;i++){
  const segment=segments[i],taper=1-(i/COUNT)*.25,color=PALETTE[i];
  ell(segment,color,[0,0,0],[.9*taper,.79*taper,.81]);
  ell(segment,'#ffdfa5',[0,-.35*taper,.08],[.69*taper,.45*taper,.72]);
  ring(segment,'#e7bd76',[0,0,-.52],.59*taper,.055,[0,0,0]);
  // Raised dorsal freckles sit against the carapace, with a tiny physical offset.
  for(const side of [-1,1])for(let j=0;j<3;j++){
   const x=side*(.24+j*.09)*taper,z=(j-1)*.29,y=.79*taper*Math.sqrt(Math.max(.1,1-(x/(.9*taper))**2-(z/.81)**2));
   ell(segment,'#ffe7b2',[x,y+.008,z],[.09,.036,.13],true);
  }
  for(const side of [-1,1]){
   const leg=group(segment,`Leg_${i}_${side<0?'L':'R'}`,[side*.58*taper,-.12,0]);
   const stem=group(leg,`Shin_${i}_${side}`),bootRig=group(leg,`Boot_${i}_${side}`);legs.push({node:leg,stem,boot:bootRig,segment:i,side});
   tube(stem,'#f6c787',[[0,0,0],[side*.21,-.32,-.04],[side*.51,-.65,.05],[side*.59,-.78,.16]],.105);
   const x=side*.59,boot=BOOTS[(i+(side>0?1:0))%BOOTS.length];
   ell(bootRig,'#344354',[x,-.91,.22],[.49,.13,.68]);
   ell(bootRig,'#ffe8bd',[x,-.83,.22],[.49,.065,.67]);
   ell(bootRig,boot,[x,-.62,.22],[.43,.29,.59]);
   ell(bootRig,boot,[x,-.66,.56],[.43,.23,.35]);
   ring(bootRig,'#f0d6a4',[x,-.42,.04],.225,.045,[Math.PI/2,0,0]);
   for(let lace=0;lace<3;lace++)tube(bootRig,'#fff4d6',[[x-.17,-.366-lace*.015,.22+lace*.105],[x,-.335-lace*.015,.22+lace*.105],[x+.17,-.366-lace*.015,.22+lace*.105]],.024);
   ell(bootRig,'#ffc34f',[x+side*.423,-.61,.22],[.025,.1,.12],true);
  }
 }
 const head=group(segments[0],'Head');
 ell(head,PALETTE[0],[0,0,0],[1.16,1.02,1.08]);
 ell(head,'#ffe4b2',[0,-.2,.81],[.88,.65,.42]);
 for(const side of [-1,1]){
  ell(head,'#f68f88',[side*.77,-.23,.85],[.29,.17,.17]);
  for(let j=0;j<3;j++)ell(head,'#cc7068',[side*(.68+j*.08),-.21+(j%2)*.07,1.001],[.028,.025,.012],true);
 }
 ell(head,'#efa957',[0,.01,1.17],[.15,.12,.17]);
 const eyes: T.Group[]=[],brows:T.Group[]=[],antennas:T.Group[]=[];
 for(const side of [-1,1]){
  const eye=group(head,`Eye_${side<0?'L':'R'}`,[side*.43,.34,.86]);eyes.push(eye);
  ell(eye,'#fff9e7',[0,0,0],[.325,.435,.19]);
  ell(eye,'#2f9dac',[-side*.02,-.03,.155],[.219,.287,.086]);
  ell(eye,'#202b46',[-side*.035,-.024,.211],[.13,.22,.045]);
  ell(eye,'#ffffff',[-.063,.086,.25],[.073,.087,.017],true);ell(eye,'#cef7ff',[.048,-.12,.252],[.034,.038,.012],true);
  const brow=group(head,`Brow_${side<0?'L':'R'}`,[side*.43,.82,.69]);brows.push(brow);
  tube(brow,'#936147',[[-.23,-.015,0],[0,.07,.035],[.23,.025,0]],.066);
  const antenna=group(head,`Antenna_${side<0?'L':'R'}`,[side*.62,.81,-.2]);antennas.push(antenna);
  tube(antenna,'#88617d',[[0,0,0],[side*.16,.38,-.07],[side*.34,.82,-.02],[side*.43,.95,.13]],.067);
  ell(antenna,side<0?'#54d5c7':'#f58cb0',[side*.43,.95,.13],[.245,.245,.245]);
  ring(antenna,'#ffe4ab',[side*.43,.95,.13],.241,.024,[.25,.25,0]);
  ell(antenna,'#fff4d3',[side*.37,1.045,.31],[.064,.07,.026],true);
 }
 const mouth=group(head,'Mouth',[0,-.4,1.14]);
 ell(mouth,'#784858',[0,0,0],[.44,.24,.084]);ell(mouth,'#f293a1',[0,-.087,.069],[.26,.085,.028]);
 for(const side of [-1,1])ell(mouth,'#fff5df',[side*.09,.145,.072],[.084,.058,.027],true);
 // A soft neckerchief gives the long silhouette an unmistakable front end.
 ring(segments[0],'#ca4d67',[0,-.6,-.65],.64,.16,[0,0,0]);
 ell(segments[0],'#ee7687',[.47,-.57,-.73],[.24,.23,.24]);
 for(const side of [-1,1])ell(segments[0],'#ce5271',[.47+side*.2,-.77,-.75],[.13,.3,.09]);
 function bell(parent:T.Object3D,name:string,position:number[],size:number){
  const pivot=group(parent,name,position);pivot.userData.interaction=name==='TailBell'?'tail':'back';
  ring(pivot,'#ffe5a2',[0,.43*size,0],.17*size,.055*size,[0,0,0],true);
  add(pivot,sphere,'#ffc65b',[0,0,0],[.47*size,.41*size,.47*size],[0,0,0],true);
  ring(pivot,'#ffdf87',[0,-.12*size,0],.445*size,.032*size,[Math.PI/2,0,0],true);
  tube(pivot,'#84522d',[[-.29*size,-.27*size,.2*size],[0,-.39*size,.14*size],[.29*size,-.27*size,.2*size]],.024*size);
  ell(pivot,'#543c49',[0,-.26*size,.35*size],[.095*size,.07*size,.035*size],true);
  const anchor=new T.Object3D();anchor.name=name==='TailBell'?'TailTarget':'BackTarget';pivot.add(anchor);return pivot;
 }
 tube(segments[COUNT-1],'#8a657d',[[0,.25,-.45],[0,.61,-.87],[0,.4,-1.12]],.09);
 const tailBell=bell(segments[COUNT-1],'TailBell',[0,-.12,-1.12],1.3);
 ell(segments[3],'#fff0bb',[0,.77,0],[.61,.08,.54]);
 const backBell=bell(segments[3],'BackBell',[0,1.34,0],1.28);
 for(const [parent,batches] of parts)for(const [material,list] of batches){
  const geometry=mergeGeometries(list,false);list.forEach(g=>g.dispose());
  const mesh=new T.Mesh(geometry,material);mesh.name=`${parent.name}_${material===GOLD?'brass':'colours'}`;mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);
 }
 // Animation poses are absolute and share tracks across every clip, so crossfades
 // never retain an old wheel transform or a hidden eye from the previous phase.
 function linePose(i:number,phase:number,wave=.24){
  return {p:new T.Vector3(Math.sin(i*.58+phase)*wave,i===0?1.64:1.15+(COUNT-1-i)*.008,(COUNT-1)*STEP/2-i*STEP),q:new T.Quaternion().setFromEuler(new T.Euler(0,Math.cos(i*.58+phase)*wave*.35,0))};
 }
 // Integrate segment tangents instead of interpolating unrelated positions.
 // A growing convex arc preserves spacing throughout folding and unfolding.
 function arcPoses(amount:number,vertical=false){
  const bend=(vertical?Math.PI*2/COUNT:.47)*amount;
  const heading=vertical?
   (COUNT-1)*bend/2+(.3-(COUNT-1)*Math.PI/COUNT)*T.MathUtils.smoothstep(amount,.5,1):-.32*amount;
  const positions=[new T.Vector3()];
  for(let i=1;i<COUNT;i++){
   const mid=heading+(vertical?-1:1)*(i-.5)*bend;
   positions.push(positions[i-1].clone().add(vertical?
    new T.Vector3(0,Math.sin(mid)*STEP,-Math.cos(mid)*STEP):
    new T.Vector3(-Math.sin(mid)*STEP,0,-Math.cos(mid)*STEP)));
  }
  const center=positions.reduce((sum,p)=>sum.add(p),new T.Vector3()).multiplyScalar(1/COUNT);
  return positions.map((p,i)=>{
   const q=new T.Quaternion().setFromAxisAngle(vertical?xAxis:up,heading+(vertical?-1:1)*i*bend);
   const lift=i===0?.49:(COUNT-1-i)*.008;
   p.sub(center).add(new T.Vector3(0,1.15*(vertical?1-amount:1),0));
   p.add(new T.Vector3(0,lift*(vertical?1-amount:1),0).applyQuaternion(q));
   return {p,q};
  });
 }
 function turningPoses(u:number,sign:number){
  const radius=4.3,arcLength=radius*Math.PI/2,travel=smooth(u)*((COUNT-1)*STEP+arcLength);
  const result=segments.map((_,i)=>{
   const distance=travel-i*STEP,angle=T.MathUtils.clamp(distance/radius,0,Math.PI/2);
   const p=distance<0?new T.Vector3(0,0,distance):distance>arcLength?
    new T.Vector3(sign*(radius+distance-arcLength),0,radius):
    new T.Vector3(sign*radius*(1-Math.cos(angle)),0,radius*Math.sin(angle));
   return {p,q:new T.Quaternion().setFromAxisAngle(up,sign*angle)};
  });
  const center=result.reduce((sum,pose)=>sum.add(pose.p),new T.Vector3()).multiplyScalar(1/COUNT);
  result.forEach((pose,i)=>{pose.p.sub(center);pose.p.y=i===0?1.64:1.15+(COUNT-1-i)*.008;});
  return result;
 }
 function stairPose(i:number){const pose=linePose(i,0,.12);pose.p.y=i===0?2.4:1.15+Math.max(0,9-i)*.22;return pose;}
 function pose(name:CentipedeClip,time:number,duration:number){
  const u=time/duration,phase=u*Math.PI*2,one=Math.sin(Math.PI*u),isWheel=['CurlWheel','WheelRoll','WheelDizzy','WheelHit','Uncurl'].includes(name);
  for(const r of rigs){r.node.position.copy(r.position);r.node.quaternion.copy(r.rotation);r.node.scale.copy(r.scale);}
  let gait=0,wave=.14,wheel=0,arena=0,stairs=0;
  if(['Walk','Run','Charge'].includes(name)){gait=name==='Walk'?.23:name==='Run'?.4:.52;wave=name==='Charge'?.06:.4;}
  if(name==='TurnLeft'||name==='TurnRight'){wave=.15;gait=.22*Math.sin(Math.PI*u);}
  if(name==='CoilArena')arena=smooth(u);
  if(name==='Stomp')arena=1;
  if(name==='LowerBack'){arena=1-smooth(u);stairs=smooth(u);}
  if(name==='BackVulnerable'||name==='BellHit')stairs=1;
  if(name==='Rise'){stairs=1-smooth(u);arena=smooth(u);}
  if(name==='CurlWheel')wheel=smooth(u);
  if(name==='Uncurl')wheel=1-smooth(u);
  if(['WheelRoll','WheelDizzy','WheelHit'].includes(name))wheel=1;
  motion.position.y=4.05*wheel;
  if(name==='WheelRoll')motion.rotation.x=-phase;
  if(name==='WheelDizzy')motion.rotation.z=Math.sin(phase)*.095;
  if(name==='WheelHit'){motion.scale.set(1+one*.14,1-one*.12,1+one*.1);motion.position.y+=one*.6;}
  const arenaTransition=['CoilArena','Stomp','LowerBack','Rise'].includes(name);
  const curve=isWheel?arcPoses(wheel,true):arenaTransition?arcPoses(arena):null;
  const turn=name==='TurnLeft'||name==='TurnRight'?turningPoses(u,name==='TurnLeft'?1:-1):null;
  for(let i=0;i<COUNT;i++){
   const node=segments[i],line=linePose(i,phase,wave),step=stairPose(i);
   node.position.copy(line.p);node.quaternion.copy(line.q);
   if(curve){node.position.copy(curve[i].p);node.quaternion.copy(curve[i].q);}
   if(stairs){node.position.y=T.MathUtils.lerp(node.position.y,step.p.y,stairs);node.position.x=curve?node.position.x+step.p.x*stairs:step.p.x;node.quaternion.slerp(step.q,stairs);}
   if(turn){node.position.copy(turn[i].p);node.quaternion.copy(turn[i].q);}
   if(!isWheel){
    if(gait)node.position.y+=.06*(1+Math.sin(phase*2-i*.7));
    if(name==='Idle')node.scale.set(1,1+.022*Math.sin(phase-i*.4),1);
    if(name==='ChargeAnticipation'){node.position.y+=one*(i===0?.65:-.15);node.position.z-=one*.12*i;node.rotateX(i===0?-.25*one:0);}
    if(name==='Exhausted'){node.position.y-=i===0?.35:.08;node.scale.y=1+.045*Math.sin(phase*2-i*.2);if(i===0)node.rotateX(.16);}
    if(name==='TailTickle'){const bounce=Math.max(0,Math.sin((u-.045*(COUNT-1-i))*Math.PI*2));node.position.y+=bounce*.6*one;node.rotateZ(Math.sin(phase*2-i*.55)*.1*one);}
    if(name==='Stomp'){const beat=(u*2)%1,raise=Math.sin(Math.PI*T.MathUtils.clamp(beat/.6,0,1));node.position.y+=raise*.24;node.rotateZ(Math.sin(phase*2)*.04);}
    if(name==='BellHit'){node.position.y+=one*.22;node.rotateZ(Math.sin(phase*3-i*.7)*one*.11);}
    if(name==='Sneeze'){const inhale=T.MathUtils.smoothstep(u,0,.48)*(1-T.MathUtils.smoothstep(u,.52,.65));node.scale.setScalar(1+inhale*.045);node.rotateX(i===0?-.25*inhale+Math.sin(Math.PI*T.MathUtils.clamp((u-.52)/.22,0,1))*.48:0);}
    if(name==='Celebrate'){node.position.y+=.14*(1+Math.sin(phase*2-i*.65));node.rotateZ(.08*Math.sin(phase*2-i*.65));}
   }
  }
  for(const {node,stem,boot,side,segment} of legs){
   const extension=stairs*Math.max(0,stairPose(segment).p.y-linePose(segment,0).p.y);
   stem.scale.y=1+extension/.78;boot.position.y=-extension;
   const step=Math.sin(phase*2-segment*.9+(side>0?Math.PI:0));
   node.rotation.x=step*gait;node.position.y+=Math.max(0,step)*gait*.65;
   node.rotation.z=side*wheel*.9;
   if(name==='Stomp'){const beat=(u*2)%1,raise=Math.sin(Math.PI*T.MathUtils.clamp(beat/.6,0,1));node.rotation.z=side*raise*.72;node.position.y+=raise*.2;}
   if(name==='TailTickle'||name==='Celebrate')node.rotation.z+=side*.25*Math.abs(Math.sin(phase*2-segment*.65))*(name==='TailTickle'?one:1);
   if(name==='WheelHit')node.rotation.z-=side*one*.85;
  }
  head.rotation.y=.055*Math.sin(phase);head.rotation.z=.025*Math.sin(phase*2);
  if(name==='WheelDizzy')head.rotation.z+=.18*Math.sin(phase*2);
  antennas.forEach((node,i)=>{node.rotation.z=(i?1:-1)*(.09*Math.sin(phase*2+i)+(name==='ChargeAnticipation'?one*.3:0));node.rotation.x=.07*Math.sin(phase+i)+wheel*1.45;});
  const blink=1-.94*Math.max(0,1-Math.abs(u-.72)/.035);
  eyes.forEach(eye=>eye.scale.y=name==='Sneeze'&&u>.48&&u<.76?.08:name==='Celebrate'?.7:blink);
  brows.forEach((node,i)=>{node.rotation.z=(i?1:-1)*(name==='ChargeAnticipation'?-.18*one:name==='WheelDizzy'?.16:0);});
  mouth.scale.y=name==='Exhausted'?1+.28*Math.sin(phase*2):name==='Sneeze'?1+.65*one:1;
  tailBell.rotation.z=.15*Math.sin(phase*2)+(name==='TailTickle'?.6*one*Math.sin(phase*4):0);
  backBell.rotation.z=name==='BellHit'?.65*Math.sin(phase*5)*one:.035*Math.sin(phase);
  // Bake ground contact into wheel clips offline; no vertex scans in the game.
  if(wheel>0){
   root.updateMatrixWorld(true);let bottom=Infinity;const v=new T.Vector3();
   root.traverse(o=>{if(o instanceof T.Mesh){const positions=o.geometry.getAttribute('position');for(let j=0;j<positions.count;j++){v.fromBufferAttribute(positions,j).applyMatrix4(o.matrixWorld);bottom=Math.min(bottom,v.y);}}});
   motion.position.y+=.03-bottom;
  }
 }
 const clips=CENTIPEDE_CLIPS.map(meta=>{
  const frames=Math.ceil(meta.duration*24),times=Array.from({length:frames+1},(_,i)=>meta.duration*i/frames);
  const samples=rigs.map(()=>({position:[] as number[],quaternion:[] as number[],scale:[] as number[]}));
  times.forEach(t=>{pose(meta.name,t,meta.duration);rigs.forEach((r,i)=>{r.node.position.toArray(samples[i].position,samples[i].position.length);r.node.quaternion.toArray(samples[i].quaternion,samples[i].quaternion.length);r.node.scale.toArray(samples[i].scale,samples[i].scale.length);});});
  const tracks:T.KeyframeTrack[]=[];
  rigs.forEach((r,i)=>{for(const channel of ['position','quaternion','scale'] as const){const values=samples[i][channel],stride=channel==='quaternion'?4:3,constant=values.every((v,j)=>Math.abs(v-values[j%stride])<1e-7),ts=constant?[0,meta.duration]:times,vs=constant?[...values.slice(0,stride),...values.slice(0,stride)]:values;tracks.push(channel==='quaternion'?new T.QuaternionKeyframeTrack(`${r.node.name}.${channel}`,ts,vs):new T.VectorKeyframeTrack(`${r.node.name}.${channel}`,ts,vs));}});
  const clip=new T.AnimationClip(meta.name,meta.duration,tracks);clip.optimize();return clip;
 });
 pose('Idle',0,4);root.updateMatrixWorld(true);
 return {root,clips};
}
