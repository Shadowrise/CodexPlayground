import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {MILL_INTAKE,MILL_BRANCHES,MILL_BAGS,MILL_HOPPER,MILL_COLORS,type MillQuest} from './mill-quest';

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
  this.group.add(batch(pieces));
  const lightsMaterial=new T.MeshStandardMaterial({color:'#ffffff',vertexColors:false,emissive:'#fff2d0',emissiveIntensity:.35,roughness:.25});
  this.lights=new T.InstancedMesh(new T.SphereGeometry(.14,8,5),lightsMaterial,24);
  for(let i=0;i<24;i++){const a=i/24*Math.PI*2;this.dummy.position.set(41.83,3.65+Math.cos(a)*3.24,33+Math.sin(a)*3.24);this.dummy.updateMatrix();this.lights.setMatrixAt(i,this.dummy.matrix);this.lights.setColorAt(i,new T.Color().setHSL(i/24,.85,.58));}this.lights.computeBoundingSphere();this.group.add(this.lights);
  // Unlit soap-film rims remain readable at night without lights or postprocessing.
  const soap=new T.ShaderMaterial({transparent:true,depthWrite:false,
   vertexShader:`varying vec3 vN;varying vec3 vEye;varying vec3 vTint;
    void main(){vec4 p=modelViewMatrix*instanceMatrix*vec4(position,1.0);vN=normalize(normalMatrix*normal);vEye=-p.xyz;vTint=instanceColor;gl_Position=projectionMatrix*p;}`,
   fragmentShader:`varying vec3 vN;varying vec3 vEye;varying vec3 vTint;
    void main(){vec3 n=normalize(vN);float rim=pow(1.0-abs(dot(n,normalize(vEye))),2.0);
     float shine=pow(max(0.0,dot(n,normalize(vec3(-.4,.65,.65)))),32.0);
     vec3 film=mix(vTint,vec3(.78,.92,1.0),.1+.08*sin(n.y*12.0+n.x*6.0));
     gl_FragColor=vec4(mix(film,vec3(1.0),shine*.9),.1+rim*.66+shine*.35);
     #include <tonemapping_fragment>
     #include <colorspace_fragment>
    }`});
  this.bubbles=new T.InstancedMesh(new T.SphereGeometry(1,16,10),soap,this.bubbleCount);
  this.bubbles.name='Mill celebration bubbles';
  this.bubbles.frustumCulled=false;for(let i=0;i<this.bubbleCount;i++)this.bubbles.setColorAt(i,new T.Color().setHSL(i/this.bubbleCount,.95,.48));this.group.add(this.bubbles);
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
  if(this.bubbles.visible){
   const party=q.stage==='running',elapsed=Math.max(0,(now-q.deliveredAt)/1000);
   this.bubbles.count=party?this.bubbleCount:24;
   for(let i=0;i<this.bubbles.count;i++){
    const t=((party?elapsed:seconds)*(.16+(i%5)*.013)+i/this.bubbles.count)%1;
    // Emit beside the delivery funnel at eye level, in front of the facade.
    // The old chimney plume started 12.5m up and disappeared above the camera.
    this.dummy.position.set(MILL_HOPPER[0]+Math.sin(i*2.399+t*2)*(1.5+t*4),1.6+t*7,MILL_HOPPER[2]+1+Math.cos(i*5)*1.2+t*4);
    if(!party){this.dummy.position.set(49+Math.sin(i*8+t*3),.2+Math.sin(t*Math.PI)*1.8,40.5+Math.cos(i*5)*t*2);
     if(splashBranch>=0){const age=(now-q.branches[splashBranch])/900;this.dummy.position.set(MILL_BRANCHES[splashBranch][0]+Math.sin(i*3)*age*1.2,MILL_BRANCHES[splashBranch][1]+Math.sin(age*Math.PI)*(.4+(i%3)*.15),MILL_BRANCHES[splashBranch][2]+Math.cos(i*5)*age+age*.6);}
    }
    const fade=T.MathUtils.smoothstep(t,0,.07)*(1-T.MathUtils.smoothstep(t,.8,1));
    this.dummy.scale.setScalar((party?.28+.075*(i%5):.055)*fade);this.dummy.updateMatrix();this.bubbles.setMatrixAt(i,this.dummy.matrix);
   }
   this.bubbles.instanceMatrix.needsUpdate=true;
  }
 }
}
