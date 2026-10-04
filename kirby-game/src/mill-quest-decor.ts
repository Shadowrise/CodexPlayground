import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {MILL_INTAKE,MILL_BRANCHES,MILL_BAGS,MILL_HOPPER,MILL_COLORS,MILL_COLOR_NAMES,type MillQuest} from './mill-quest';

/** Batched, low-poly props; only the three twigs, sacks and small finale move. */
export class MillQuestDecor {
 readonly group=new T.Group();
 readonly bags:T.Mesh[]=[];
 readonly branches:T.Mesh[]=[];
 readonly hopper:T.Mesh;
 private bubbles:T.InstancedMesh;
 private lights:T.InstancedMesh;
 private needle:T.Mesh;
 private dummy=new T.Object3D();
 private label?:T.CanvasTexture;
 private signature='';
 private scratch=new T.Vector3();
 private readonly bubbleCount=96;
 constructor(){
  this.group.name='Rainbow mill quest';
  const pieces:T.Mesh[]=[];
  const part=(list:T.Mesh[],g:T.BufferGeometry,color:string,p:number[],scale=[1,1,1])=>{const m=new T.Mesh(g,new T.MeshStandardMaterial({color}));m.position.fromArray(p);m.scale.fromArray(scale);list.push(m);return m;};
  const box=(list:T.Mesh[],c:string,p:number[],s:number[])=>part(list,new T.BoxGeometry(1,1,1),c,p,s);
  const ball=(list:T.Mesh[],c:string,p:number[],s:number[])=>part(list,new T.SphereGeometry(1,10,6),c,p,s);
  const rod=(list:T.Mesh[],c:string,a:number[],b:number[],r:number)=>{const from=new T.Vector3(...a),to=new T.Vector3(...b);const m=part(list,new T.CylinderGeometry(r,r,from.distanceTo(to),8),c,from.clone().add(to).multiplyScalar(.5).toArray());m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),to.sub(from).normalize());return m;};
  const ring=(list:T.Mesh[],c:string,p:number[],r:number,t=.05)=>{const m=part(list,new T.TorusGeometry(r,t,6,20),c,p);m.rotation.x=Math.PI/2;return m;};
  const batch=(list:T.Mesh[])=>{
   const gs=list.map(m=>{m.updateMatrix();const g=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();g.applyMatrix4(m.matrix);g.deleteAttribute('uv');const c=(m.material as T.MeshStandardMaterial).color,colors=new Float32Array(g.attributes.position.count*3);for(let i=0;i<colors.length;i+=3){colors[i]=c.r;colors[i+1]=c.g;colors[i+2]=c.b;}g.setAttribute('color',new T.BufferAttribute(colors,3));m.geometry.dispose();(m.material as T.Material).dispose();return g;});
   const geometry=mergeGeometries(gs)!;gs.forEach(g=>g.dispose());const mesh=new T.Mesh(geometry,new T.MeshStandardMaterial({vertexColors:true,roughness:.7}));mesh.receiveShadow=true;return mesh;
  };
  // Tailrace starts beneath the wheel, just above the pond, and drains downstream.
  const [intakeX,,intakeZ]=MILL_INTAKE;
  box(pieces,'#758b88',[intakeX,-.49,intakeZ],[2.6,.22,11.6]);
  for(const x of [intakeX-1.35,intakeX+1.35])for(let j=0;j<12;j++)box(pieces,j%2?'#9baba1':'#879b96',[x,-.23,intakeZ-5.2+j*.95],[.26,.46,.85]);
  const stream=new T.Mesh(new T.PlaneGeometry(2.45,11.2),new T.MeshStandardMaterial({color:'#49b3c3',roughness:.23,metalness:.18,transparent:true,opacity:.86}));stream.rotation.x=-Math.PI/2;stream.position.set(intakeX,-.31,intakeZ);this.group.add(stream);
  for(let i=0;i<3;i++){
   const twig:T.Mesh[]=[];rod(twig,'#89603d',[-1.15,0,-.17],[1.15,.12,.17],.13);
   rod(twig,'#a57b4c',[-.25,.05,0],[.32,.19,.65],.065);rod(twig,'#a57b4c',[.4,.09,.08],[.75,.26,-.55],.057);
   for(let j=0;j<7;j++)ball(twig,j%2?'#dfab46':'#a4b353',[-.2+j*.15,.16,.35+Math.sin(j)*.12],[.14,.025,.23]);
   for(const x of [-1.15,1.15])ball(twig,'#dbbd85',[x,.07,x*.147],[.035,.11,.115]);
   const branch=batch(twig);branch.position.fromArray(MILL_BRANCHES[i]);this.group.add(branch);this.branches.push(branch);
   const sack:T.Mesh[]=[];
   const profile=[new T.Vector2(.15,0),new T.Vector2(.49,.08),new T.Vector2(.63,.38),new T.Vector2(.53,.78),new T.Vector2(.25,1.08),new T.Vector2(.19,1.2),new T.Vector2(.3,1.32)];
   part(sack,new T.LatheGeometry(profile,24),MILL_COLORS[i],[0,0,0]);
   ring(sack,'#ffe4a0',[0,1.12,0],.23,.045);
   for(const side of [-1,1]){const bow=ring(sack,'#fff0c9',[side*.15,1.21,.1],.14,.035);bow.rotation.set(Math.PI/3,0,side*.4);rod(sack,'#ffe4a0',[side*.05,1.14,.23],[side*.22,.91,.37],.025);}
   for(let j=0;j<12;j++){const y=.16+j*.065;ball(sack,'#ffe9bd',[.12,y,Math.sqrt(Math.max(.06,.56**2-(y-.48)**2))],[.05,.014,.016]);}
   const badge=part(sack,new T.CylinderGeometry(.2,.2,.026,20),'#fff2ca',[0,.57,.586]);badge.rotation.x=Math.PI/2;
   for(let j=0;j<=i;j++)ball(sack,MILL_COLORS[i],[(j-i/2)*.09,.57,.615],[.031,.075,.022]);
   const bag=batch(sack);bag.position.fromArray(MILL_BAGS[i]);this.group.add(bag);this.bags.push(bag);
   // A small woven mat marks the return position of each sack.
   box(pieces,'#b89868',[MILL_BAGS[i][0],.02,MILL_BAGS[i][2]],[1.6,.05,1.6]);
   for(let j=0;j<7;j++)box(pieces,'#d8bd87',[MILL_BAGS[i][0]-.65+j*.22,.052,MILL_BAGS[i][2]],[.04,.02,1.5]);
  }
  const hopperParts:T.Mesh[]=[];
  for(const x of [-.72,.72])for(const z of [-.6,.6])rod(hopperParts,'#86613f',[x,0,z],[x,1.35,z],.1);
  part(hopperParts,new T.CylinderGeometry(1.05,.28,.9,16,1,true),'#82b7ab',[0,1.45,0]);ring(hopperParts,'#f2d18b',[0,1.9,0],1.06,.08);
  part(hopperParts,new T.CylinderGeometry(.25,.25,.65,12),'#aa9a6a',[0,.69,0]);
  for(let i=0;i<12;i++){const a=i*Math.PI/6;ball(hopperParts,'#ffe3a6',[Math.sin(a)*.8,1.67,Math.cos(a)*.8],[.04,.04,.04]);}
  this.hopper=batch(hopperParts);(this.hopper.material as T.MeshStandardMaterial).side=T.DoubleSide;this.hopper.position.fromArray(MILL_HOPPER);this.group.add(this.hopper);
  // Gauge with three distinct coloured zones, a pointer and a framed illustrated board.
  const gaugePos=new T.Vector3(50.7,1.5,40.5);
  for(let i=0;i<3;i++){box(pieces,['#77aadc','#78d9a0','#f18578'][i],[gaugePos.x+(i-1)*.35,gaugePos.y,gaugePos.z],[.32,.72,.18]);}
  this.needle=new T.Mesh(new T.ConeGeometry(.12,.27,3),new T.MeshStandardMaterial({color:'#fff4c9'}));this.needle.rotation.z=Math.PI;this.needle.position.copy(gaugePos).add(new T.Vector3(0,.58,.12));this.group.add(this.needle);
  box(pieces,'#725239',[58,2.5,35],[4.9,2.5,.18]);
  for(const x of [56,60])rod(pieces,'#725239',[x,0,35],[x,3.6,35],.075);
  if(typeof document!=='undefined'){
   const canvas=document.createElement('canvas');canvas.width=896;canvas.height=448;this.label=new T.CanvasTexture(canvas);this.label.colorSpace=T.SRGBColorSpace;
   const label=new T.Mesh(new T.PlaneGeometry(4.65,2.32),new T.MeshBasicMaterial({map:this.label}));label.position.set(58,2.5,35.11);this.group.add(label);
  }
  this.group.add(batch(pieces));
  const lightsMaterial=new T.MeshStandardMaterial({color:'#ffffff',vertexColors:false,emissive:'#fff2d0',emissiveIntensity:.35,roughness:.25});
  this.lights=new T.InstancedMesh(new T.SphereGeometry(.14,8,5),lightsMaterial,24);
  for(let i=0;i<24;i++){const a=i/24*Math.PI*2;this.dummy.position.set(41.83,3.65+Math.cos(a)*3.24,33+Math.sin(a)*3.24);this.dummy.updateMatrix();this.lights.setMatrixAt(i,this.dummy.matrix);this.lights.setColorAt(i,new T.Color().setHSL(i/24,.85,.58));}this.lights.computeBoundingSphere();this.group.add(this.lights);
  this.bubbles=new T.InstancedMesh(new T.SphereGeometry(1,10,6),new T.MeshStandardMaterial({color:'#d7f5f6',roughness:.12,metalness:.15,transparent:true,opacity:.46,depthWrite:false}),this.bubbleCount);
  this.bubbles.frustumCulled=false;for(let i=0;i<this.bubbleCount;i++)this.bubbles.setColorAt(i,new T.Color().setHSL(i/this.bubbleCount,.8,.7));this.group.add(this.bubbles);
 }
 update(q:MillQuest,now:number,owner?:T.Object3D){
  const seconds=now/1000;
  // Attach the sack handle to the right palm, following animation and growth.
  const arm=owner?.getObjectByName('Right_arm') as T.Mesh|undefined;
  if(q.carried>=0&&owner&&q.stage==='bags'){
   const shoulder=owner.getObjectByName('Right_shoulder');if(shoulder)shoulder.rotation.set(-.38,-.3,.24);
   owner.updateWorldMatrix(true,true);
  }
  this.branches.forEach((b,i)=>{const age=q.branches[i]?(now-q.branches[i])/1000:0;b.visible=q.stage!=='idle'&&(!q.branches[i]?q.stage==='clear':age<1.3);b.position.set(MILL_BRANCHES[i][0]+Math.sin(age*8)*age*.15,MILL_BRANCHES[i][1]-Math.min(.35,age*.3),MILL_BRANCHES[i][2]+age*1.6);b.rotation.set(age*.4,age*.9,0);b.scale.setScalar(q.branches[i]?Math.max(0,1-age/1.3):1);});
  this.bags.forEach((b,i)=>{
   const dropping=q.delivered>0&&q.order[q.delivered-1]===i&&now-q.deliveredAt<650;
   b.visible=dropping||q.stage==='bags'&&!q.order.slice(0,q.delivered).includes(i);b.position.fromArray(MILL_BAGS[i]);b.rotation.set(0,0,0);b.scale.setScalar(1);
   if(q.carried===i&&owner){
    const size=Math.max(1,owner.scale.x),bagSize=Math.max(.65,size*.55);
    b.scale.setScalar(bagSize);b.quaternion.copy(owner.quaternion);
    if(arm?.geometry){
     if(!arm.geometry.boundingBox)arm.geometry.computeBoundingBox();
     const bounds=arm.geometry.boundingBox!;bounds.getCenter(this.scratch);this.scratch.x=bounds.max.x-.06;
     arm.localToWorld(this.scratch);this.group.worldToLocal(this.scratch);b.position.copy(this.scratch);b.position.y-=1.19*bagSize;
    }else{this.scratch.set(1.3*size,.8*size,.25*size).applyQuaternion(owner.quaternion);b.position.copy(owner.position).add(this.scratch);}
   }
   else if(dropping){const t=(now-q.deliveredAt)/650;b.position.set(MILL_HOPPER[0],2.9-t*2,MILL_HOPPER[2]);b.scale.setScalar(1-t*.85);b.rotation.y=t*2;}
   else if(q.rejected===i&&now-q.rejectedAt<1100){const t=(now-q.rejectedAt)/1100;b.position.lerpVectors(new T.Vector3(...MILL_HOPPER),new T.Vector3(...MILL_BAGS[i]),t);b.position.y=1.6*(1-t)+Math.sin(t*Math.PI)*2;b.rotation.z=Math.sin(t*12)*.4;}
  });
  this.needle.position.x=T.MathUtils.damp(this.needle.position.x,50.7+(q.gate===0?-1:q.gate===2?1:0)*.35,1,1);
  const splashBranch=q.branches.findIndex(t=>t>0&&now-t<900);
  this.lights.visible=q.stage==='running';this.bubbles.visible=q.stage==='running'||q.stage==='flow'&&q.gate===2||splashBranch>=0;
  if(this.bubbles.visible){for(let i=0;i<this.bubbleCount;i++){const t=(seconds*(.13+(i%5)*.015)+i/this.bubbleCount)%1,party=q.stage==='running';this.dummy.position.set((party?52:49)+Math.sin(i*8+t*3)*(party?2+t*4:1),party?12.5+t*8:.2+Math.sin(t*Math.PI)*1.8,(party?31:40.5)+Math.cos(i*5)*t*(party?5:2));if(!party&&splashBranch>=0){const age=(now-q.branches[splashBranch])/900;this.dummy.position.set(MILL_BRANCHES[splashBranch][0]+Math.sin(i*3)*age*1.2,MILL_BRANCHES[splashBranch][1]+Math.sin(age*Math.PI)*(.4+(i%3)*.15),MILL_BRANCHES[splashBranch][2]+Math.cos(i*5)*age+age*.6);}
    this.dummy.scale.setScalar((party?.28:.055)*Math.sin(Math.PI*t)*(1+(i%4)*.3));this.dummy.updateMatrix();this.bubbles.setMatrixAt(i,this.dummy.matrix);}this.bubbles.instanceMatrix.needsUpdate=true;}
  const wrong=q.rejectedAt>0&&now-q.rejectedAt<1800;
  const signature=JSON.stringify([q.stage,q.branches.map(Boolean),q.gate,q.delivered,q.order,q.carried,wrong]);
  if(this.label&&signature!==this.signature){this.signature=signature;const canvas=this.label.image as HTMLCanvasElement,ctx=canvas.getContext('2d')!;ctx.fillStyle='#203f43';ctx.fillRect(0,0,896,448);ctx.strokeStyle='#eed39a';ctx.lineWidth=8;ctx.strokeRect(8,8,880,432);ctx.textAlign='center';ctx.fillStyle='#fff0c9';ctx.font='bold 45px sans-serif';ctx.fillText('РАДУЖНАЯ МЕЛЬНИЦА',448,72);ctx.font='32px sans-serif';
   const lines=q.stage==='idle'?['Запусти квест у рычага','Расчисти · настрой · загрузи','Награда: 6 очков']:q.stage==='clear'?['1 / 4 · Освободи ручей','Толкни три застрявшие веточки',`${q.branches.filter(Boolean).length} / 3`]:q.stage==='flow'?['2 / 4 · Настрой шлюз','Рычаг меняет силу потока','Удержи указатель в зелёной зоне']:q.stage==='bags'?['3 / 4 · Цветные мешочки',wrong?'Не тот цвет — мешочек возвращён':`Сейчас нужен ${MILL_COLOR_NAMES[q.order[q.delivered]]}`,`Загружено: ${q.delivered} / 3`]:['4 / 4 · Ура, мельница работает!','Пузыри для всей полянки','Скоро можно будет начать снова'];
   lines.forEach((line,i)=>ctx.fillText(line,448,142+i*52));
   if(q.stage==='bags')q.order.forEach((color,i)=>{ctx.fillStyle=MILL_COLORS[color];ctx.beginPath();ctx.arc(300+i*148,352,42,0,Math.PI*2);ctx.fill();ctx.fillStyle='#183338';ctx.font='bold 32px sans-serif';ctx.fillText(i<q.delivered?'✓':String(i+1),300+i*148,364);if(i===q.delivered){ctx.strokeStyle='#ffffff';ctx.lineWidth=6;ctx.beginPath();ctx.arc(300+i*148,352,49,0,Math.PI*2);ctx.stroke();}});this.label.needsUpdate=true;
  }
 }
}
