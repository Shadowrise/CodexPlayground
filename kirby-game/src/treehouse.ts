import { awardFirst } from './score';
import * as T from 'three';
import type { CharacterController, Input } from './controller';

export const TREEHOUSE_SITE=new T.Vector3(135,0,45);
export type TreehouseSound='ladder'|'creak'|'leaves'|'cheer';
type Activity='climb'|'deck'|'dive'|'land'|'swing';
const DECK=9;
const idle={forward:false,left:false,right:false};

/** A hand-built oak lookout; static repeated details share instanced geometry. */
export class Treehouse {
  readonly group=new T.Group();
  readonly swing=new T.Group();
  private rider?:CharacterController;
  private activity:Activity='climb';
  private elapsed=0;
  private clock=0;
  private soundAfter=0;
  private from=new T.Vector3();
  private leaves:T.InstancedMesh;
  private burstTime=10;
  private dummy=new T.Object3D();
  private swingAngle=0;
  get active(){return !!this.rider;}
  get canSit(){return !!this.rider && this.activity==='deck';}
  constructor(private sound:(kind:TreehouseSound)=>void=()=>{}) {
    const root=this.group;root.name='Oak treehouse, lookout, swing and leaf pile';root.position.copy(TREEHOUSE_SITE);
    const geo={box:new T.BoxGeometry(1,1,1),ball:new T.SphereGeometry(1,16,10),pole:new T.CylinderGeometry(1,1,1,12),leaf:new T.SphereGeometry(1,6,4)};
    const mats=new Map<string,T.MeshStandardMaterial>();
    const part=(parent:T.Group,kind:keyof typeof geo,color:string,x:number,y:number,z:number,sx:number,sy:number,sz:number,rx=0,ry=0,rz=0)=>{
      if(!mats.has(color))mats.set(color,new T.MeshStandardMaterial({color,roughness:.85}));
      const mesh=new T.Mesh(geo[kind],mats.get(color));mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.rotation.set(rx,ry,rz);parent.add(mesh);return mesh;
    };
    const box=(color:string,x:number,y:number,z:number,sx:number,sy:number,sz:number,rx=0,ry=0,rz=0)=>part(root,'box',color,x,y,z,sx,sy,sz,rx,ry,rz);
    const beam=(a:number[],b:number[],radius:number,color:string,parent=root)=>{
      const start=new T.Vector3(...a),end=new T.Vector3(...b),delta=end.clone().sub(start);
      const p=part(parent,'pole',color,...start.clone().add(end).multiplyScalar(.5).toArray(),radius,delta.length(),radius);
      p.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());return p;
    };
    // Buttress roots, ribbed bark, forks and an irregular multilayered crown.
    part(root,'pole','#65432e',0,8,0,2.1,16,1.85);
    for(let i=0;i<18;i++){
      const a=i*Math.PI*2/18;
      beam([Math.cos(a)*1.9,.3,Math.sin(a)*1.8],[Math.cos(a)*5.5,.12,Math.sin(a)*5.5],.33,'#70503a');
      beam([Math.cos(a)*2,1,Math.sin(a)*1.85],[Math.cos(a)*1.85,15,Math.sin(a)*1.7],.09,i%2?'#805b3e':'#503a2c');
    }
    for(let i=0;i<9;i++){
      const a=i*2.4,x=Math.cos(a)*7,z=Math.sin(a)*7;
      beam([0,12+i%3,0],[x,18+i%3,z],.55,'#65432e');
      for(let j=0;j<4;j++)part(root,'ball',['#315d35','#40713c','#4f7b40'][j%3],x+Math.sin(j*3+i)*2.5,19+i%3+Math.cos(j)*1.5,z+Math.cos(j*3+i)*2.2,3.3,2.5,3.1);
    }
    // The oak stands behind the cabin, with clearance for its back wall and roof.
    for(const treePart of root.children)treePart.position.z-=6;
    // Wide plank deck, underfloor joists, diagonal braces and brass nail heads.
    for(let i=0;i<30;i++){
      const x=-5.8+i*.4;box(i%3?'#b68a50':'#c79b60',x,DECK-.13,2, .37,.26,12);
      for(const z of [-3.6,1.8,7.6])part(root,'ball','#675044',x,DECK+.006,z,.036,.016,.036);
    }
    for(const x of [-5,0,5]){box('#684b32',x,8.55,2,.3,.55,12.4);beam([x,8.5,6],[0,4,-6],.18,'#805c37');}
    for(const x of [-6,6])for(let i=0;i<13;i++){
      box('#86633e',x,9.8,-4+i, .12,1.6,.12);
      if(i<12)box('#c99d62',x,10.65,-3.5+i,.22,.18,1.1);
    }
    for(const z of [-4,8])for(let i=0;i<13;i++){
      const x=-6+i;if(z===8 && (x===-4 || x===-3))continue;
      box('#86633e',x,9.8,z,.12,1.6,.12);
      if(x<6 && !(z===8 && (x===-5 || x===-4)))box('#c99d62',x+.5,10.65,z,1.1,.18,.22);
    }
    // Open-front cabin, teal shutters, overlapping moss-green roof shingles.
    for(let i=0;i<15;i++){
      const y=9.3+i*.23;box(i%3?'#bd874c':'#d5a15d',0,y,-3.1,7,.21,.18);
      for(const x of [-3.5,3.5])box('#b58149',x,y,-1.4,.18,.21,3.5);
    }
    for(const x of [-3.5,3.5])for(const z of [-3.15,.4])box('#664830',x,11,z,.24,4,.24);
    box('#755137',0,12.8,.4,7.3,.3,.25);
    for(const side of [-1,1])for(let row=0;row<9;row++)for(let col=0;col<12;col++){
      box(['#386653','#49755b','#567c5b'][(row+col)%3],side*(row+.5)*.43,14.5-row*.22,-3.7+col*.39,.57,.12,.44,0,0,-side*.48);
    }
    beam([0,14.62,-4],[0,14.62,1],.13,'#bb995e');
    for(const x of [-2.1,2.1]){
      box('#345f69',x,11.3,-2.97,1.3,1.6,.08);
      box('#e4c792',x,11.3,-2.88,.07,1.65,.08);box('#e4c792',x,11.3,-2.88,1.4,.07,.08);
      for(const s of [-1,1])for(let j=0;j<5;j++)box('#377c73',x+s*.91,10.65+j*.3,-2.83,.4,.25,.13);
      box('#8b5835',x,10.3,-2.5,1.75,.3,.5);
      for(let j=0;j<7;j++)part(root,'ball',j%2?'#edbb50':'#e89bb9',x-.6+j*.2,10.62,-2.5,.15,.18,.15);
    }
    // Bench, telescope, rug, lanterns and little hanging pennants.
    box('#668775',1,9.03,2,3,.04,2);
    for(let j=0;j<4;j++)box('#be935d',-2,9.65,1+j*.24,2.5,.14,.2);
    for(const x of [-2.9,-1.1])box('#795434',x,9.3,1.4,.16,.6,.9);
    beam([4,9,5],[4,10.3,5],.07,'#595a4c');
    for(let i=0;i<3;i++){const a=i*2.094;beam([4,9.9,5],[4+Math.cos(a)*.7,9,5+Math.sin(a)*.7],.045,'#71573a');}
    beam([4,10.4,4.6],[4,10.8,5.9],.19,'#c6a254');
    for(const x of [-5.5,5.5]){beam([x,10.7,7],[x,11.5,7],.025,'#473c33');box('#edd79a',x,11.15,7,.3,.45,.3);box('#645340',x,11.4,7,.4,.06,.4);}
    for(let i=0;i<15;i++){
      const x=-3.4+i*.48,y=12.65-.35*Math.sin(i/14*Math.PI);
      beam([x,y,.6],[x+.48,12.65-.35*Math.sin((i+1)/14*Math.PI),.6],.015,'#d5c396');
      box(['#d98169','#e8c86d','#689d9a'][i%3],x,y-.17,.6,.23,.3,.035,0,0,.18);
    }
    // Leaning ladder with rope lashings and visible rung grain.
    for(const x of [-4.9,-3.1])beam([x,0,11],[x,9.8,7.3],.11,'#8c6238');
    for(let i=0;i<25;i++){
      const y=.3+i*.37,z=11-y*3.7/9.8;
      beam([-4.95,y,z],[-3.05,y,z],.095,'#c29a60');
      for(const x of [-4.9,-3.1])for(let j=0;j<3;j++)box('#d7c493',x,y-.05+j*.05,z,.25,.024,.25);
    }
    // Branch-mounted rope swing, with a broad rounded wooden seat.
    // Route the supporting bough around the cabin, then across both rope anchors.
    beam([-1,13,-6],[-7,10,-4.8],.5,'#6b4b31');
    beam([-7,10,-4.8],[-9,7.9,3],.43,'#6b4b31');
    beam([-9,7.9,3],[-13,7.9,3],.4,'#6b4b31');
    for(const x of [-12.45,-9.55]){
      const collar=new T.Mesh(new T.TorusGeometry(.44,.055,8,24),new T.MeshStandardMaterial({color:'#655b43',roughness:.6}));
      collar.position.set(x,7.9,3);collar.rotation.y=Math.PI/2;root.add(collar);
      beam([x,7.43,3],[x,7.56,3],.065,'#655b43');
    }
    this.swing.position.set(-11,7.5,3);root.add(this.swing);
    for(const x of [-1.45,1.45])beam([x,0,0],[x,-5.7,0],.043,'#d2ba83',this.swing);
    for(let i=0;i<5;i++)part(this.swing,'box','#b78b53',0,-5.7,-.65+i*.32,3.3,.18,.28);
    for(const x of [-1.45,1.45])part(this.swing,'ball','#dec997',x,-5.68,0,.12,.12,.12);
    // Thick golden leaf bed and scattered individually coloured leaves.
    part(root,'ball','#a87430',8,.35,13,4.5,.7,4);
    for(let i=0;i<330;i++){
      const a=i*2.399,r=Math.sqrt((i+.5)/330),x=8+Math.cos(a)*4.4*r,z=13+Math.sin(a)*3.9*r;
      part(root,'leaf',['#d89f39','#b96431','#ebbc52','#bc8130','#8c7535'][i%5],x,.2+.8*(1-r*r),z,.27,.06,.14,Math.sin(i)*.4,i,.25);
    }
    for(let i=0;i<16;i++)part(root,'ball','#adab91',-4+Math.sin(i*.7)*.3,.045,12+i*.42,.85,.07,.3);
    if(typeof document!=='undefined'){
      const canvas=document.createElement('canvas');canvas.width=768;canvas.height=192;const ctx=canvas.getContext('2d');
      if(ctx){ctx.fillStyle='#365f51';ctx.fillRect(0,0,768,192);ctx.strokeStyle='#e8c58a';ctx.lineWidth=10;ctx.strokeRect(8,8,752,176);ctx.textAlign='center';ctx.fillStyle='#fff1cb';ctx.font='bold 62px sans-serif';ctx.fillText('ДОМИК НА ДЕРЕВЕ',384,85);ctx.font='30px sans-serif';ctx.fillText('Выше облаков • мягче листьев',384,143);
        const sign=new T.Mesh(new T.PlaneGeometry(6.4,1.6),new T.MeshBasicMaterial({map:new T.CanvasTexture(canvas)}));sign.position.set(0,11.45,.65);root.add(sign);}
    }
    for(const parent of [root,this.swing]){
      const batches=new Map<string,T.Mesh[]>();
      for(const p of [...parent.children])if(p instanceof T.Mesh && p.material instanceof T.MeshStandardMaterial){p.updateMatrix();const key=p.geometry.uuid+p.material.uuid;if(!batches.has(key))batches.set(key,[]);batches.get(key)!.push(p);}
      for(const list of batches.values()){const mesh=new T.InstancedMesh(list[0].geometry,list[0].material,list.length);list.forEach((p,i)=>{mesh.setMatrixAt(i,p.matrix);parent.remove(p);});mesh.castShadow=mesh.receiveShadow=true;mesh.computeBoundingSphere();parent.add(mesh);}
    }
    this.leaves=new T.InstancedMesh(geo.leaf,new T.MeshStandardMaterial({color:'#e8ac43',side:T.DoubleSide}),64);
    this.leaves.visible=false;this.leaves.frustumCulled=false;root.add(this.leaves);
  }
  get outlineSwing(){return this.swing;}
  prompt(position:T.Vector3) {
    if(this.rider)return this.activity==='deck'?'E — прыгнуть в листья · W/S — гулять · A/D — повернуться':this.activity==='swing'?'E — слезть с качелей':this.activity==='climb'?'Поднимаемся к домику…':'Прыжок в мягкие листья!';
    const p=position.clone().sub(TREEHOUSE_SITE);
    if(p.y>1)return '';
    if(p.distanceTo(new T.Vector3(-4,0,11))<3.5)return 'E — подняться в домик на дереве';
    if(p.distanceTo(new T.Vector3(-11,0,3))<4)return 'E — покачаться на качелях';
    return '';
  }
  interact(character:CharacterController) {
    if(this.rider){if(this.activity==='deck')this.dive();else if(this.activity==='swing')this.finish();return;}
    if(!this.prompt(character.actor.position) || character.flight.active)return;
    this.rider=character;this.elapsed=0;this.soundAfter=0;this.from.copy(character.actor.position);
    this.activity=character.actor.position.clone().sub(TREEHOUSE_SITE).x<-7?'swing':'climb';
    character.setActivity(this.activity==='climb'?'Climb':'Swing');
  }
  private dive(){this.activity='dive';this.elapsed=0;this.from.copy(this.rider!.actor.position);this.rider!.setActivity('LeafDive');this.sound('cheer');}
  private finish(){const c=this.rider!;c.actor.position.copy(TREEHOUSE_SITE).add(new T.Vector3(this.activity==='swing'?-11:8,0,this.activity==='swing'?9:18));c.actor.rotation.set(0,0,0);c.yaw=0;c.setActivity('Idle');this.rider=undefined;}
  constrain(position:T.Vector3,size:number){const dx=position.x-TREEHOUSE_SITE.x,dz=position.z-(TREEHOUSE_SITE.z-6),r=2.4+.65*size,d=Math.hypot(dx,dz);if(d<r){position.x=TREEHOUSE_SITE.x+(d>.001?dx/d:1)*r;position.z=TREEHOUSE_SITE.z-6+(d>.001?dz/d:0)*r;}}
  update(dt:number,input:Input=idle,jump=false) {
    this.clock+=dt;this.burstTime+=dt;this.elapsed+=dt;
    const swinging=this.rider && this.activity==='swing';
    this.swingAngle=T.MathUtils.damp(this.swingAngle,Math.sin(this.clock*1.65)*(swinging?.55:.07),4,dt);this.swing.rotation.x=this.swingAngle;
    this.leaves.visible=this.burstTime<2;
    if(this.leaves.visible)for(let i=0;i<64;i++){
      const t=this.burstTime,a=i*2.399,speed=1+i%5*.4;
      this.dummy.position.set(8+Math.cos(a)*(1+t*speed),Math.max(.12,.8+(2+i%4*.5)*t-2.6*t*t),13+Math.sin(a)*(1+t*speed));
      this.dummy.rotation.set(t*3+i,t*2+i,Math.sin(i+t*4));this.dummy.scale.set(.25*Math.min(1,(2-t)*2),.055,.13);this.dummy.updateMatrix();this.leaves.setMatrixAt(i,this.dummy.matrix);
    }
    this.leaves.instanceMatrix.needsUpdate=this.leaves.visible;
    const c=this.rider;if(!c)return;
    c.mixer.update(dt);const size=c.actor.scale.x;
    const armL=c.actor.getObjectByName('Left_shoulder'),armR=c.actor.getObjectByName('Right_shoulder');
    const footL=c.actor.getObjectByName('Left_foot_pivot'),footR=c.actor.getObjectByName('Right_foot_pivot');
    if(this.activity==='climb'){
      const u=Math.min(1,this.elapsed/3.6),s=u*u*(3-2*u);
      const base=TREEHOUSE_SITE.clone().add(new T.Vector3(-4,0,11));
      if(u<.12)c.actor.position.lerpVectors(this.from,base,u/.12);
      else c.actor.position.copy(base).add(new T.Vector3(0,DECK*(s-.039744)/.960256,-4*(s-.039744)/.960256));
      c.yaw=Math.PI;c.actor.rotation.y=c.yaw;
      const step=Math.sin(this.elapsed*12);
      if(armL)armL.rotation.x=-1+step*.7;if(armR)armR.rotation.x=-1-step*.7;
      if(footL)footL.rotation.x=step*.5;if(footR)footR.rotation.x=-step*.5;
      if(this.elapsed>=this.soundAfter){this.sound('ladder');this.soundAfter=this.elapsed+.32;}
      if(u===1){awardFirst(c,'treehouse');this.activity='deck';c.setActivity('Lookout');}
    }else if(this.activity==='deck'){
      if(jump){this.dive();return;}
      c.yaw+=(input.steer??(Number(input.left)-Number(input.right)))*1.8*dt;c.actor.rotation.y=c.yaw;
      const movement=(Number(input.forward)-Number(!!input.backward))*2.4*dt;
      c.actor.position.x=T.MathUtils.clamp(c.actor.position.x+Math.sin(c.yaw)*movement,TREEHOUSE_SITE.x-4.8,TREEHOUSE_SITE.x+4.8);
      c.actor.position.z=T.MathUtils.clamp(c.actor.position.z+Math.cos(c.yaw)*movement,TREEHOUSE_SITE.z+2.5,TREEHOUSE_SITE.z+7);
      if(footL)footL.rotation.x=movement?Math.sin(this.clock*10)*.3:0;if(footR)footR.rotation.x=movement?-Math.sin(this.clock*10)*.3:0;
    }else if(this.activity==='dive'){
      const u=Math.min(1,this.elapsed/1.55),target=TREEHOUSE_SITE.clone().add(new T.Vector3(8,.35,13));
      c.actor.position.lerpVectors(this.from,target,u);c.actor.position.y=this.from.y+(target.y-this.from.y)*u*u+5*Math.sin(Math.PI*u);
      c.yaw=Math.atan2(target.x-this.from.x,target.z-this.from.z);c.actor.rotation.y=c.yaw;
      if(armL)armL.rotation.z=-1.1;if(armR)armR.rotation.z=1.1;
      c.animationRoot.rotation.x=-.3*Math.sin(Math.PI*u);
      if(u===1){awardFirst(c,'leaves');this.activity='land';this.elapsed=0;this.burstTime=0;this.sound('leaves');}
    }else if(this.activity==='land'){
      const u=Math.min(1,this.elapsed/.7),squash=Math.sin(u*Math.PI)*.28;
      c.animationRoot.scale.set(1+squash,1-squash,1+squash);c.animationRoot.rotation.x=0;
      if(u===1)this.finish();
    }else{
      this.swing.updateWorldMatrix(true,false);
      const seat=this.swing.localToWorld(new T.Vector3(0,-5.58,0));
      if(this.elapsed>=1.5)awardFirst(c,'swing');
      const mount=Math.min(1,this.elapsed/.65),blend=mount*mount*(3-2*mount);
      c.actor.position.lerpVectors(this.from,seat,blend);
      c.actor.rotation.set(this.swingAngle,0,0);c.yaw=0;
      if(armL)armL.rotation.z=-.7;if(armR)armR.rotation.z=.7;
      if(footL)footL.rotation.x=-.5;if(footR)footR.rotation.x=-.5;
      if(this.elapsed>=this.soundAfter){this.sound('creak');this.soundAfter=this.elapsed+1.9;}
    }
    // Actor size is preserved throughout the attraction.
    c.actor.scale.setScalar(size);
  }
}
