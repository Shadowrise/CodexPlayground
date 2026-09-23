import { awardFirst } from './score';
import * as T from 'three';
import type { CharacterController } from './controller';
import { MAZE_SITE, mazeLayout, farthestMazeCell } from './maze-layout';

export class MazeTrampoline {
  readonly group=new T.Group();
  readonly position:T.Vector3;
  readonly landing:T.Vector3;
  private mat=new T.Mesh(new T.CylinderGeometry(1.45,1.45,.09,40),new T.MeshStandardMaterial({color:'#465c93',roughness:.8}));
  private leaves:T.InstancedMesh;
  private player?:CharacterController;
  private from=new T.Vector3();
  private elapsed=0;
  private burst=10;
  private dummy=new T.Object3D();
  get active(){return !!this.player;}
  savePosition(c:CharacterController){return this.player===c?this.position.clone():undefined;}
  constructor(private sound:(kind:'bounce'|'leaves')=>void=()=>{}){
    const layout=mazeLayout(),cell=farthestMazeCell(layout),reward=new T.Vector3(-30+cell%7*10,0,-30+Math.floor(cell/7)*10);
    const entrance=layout[cell].findIndex(w=>!w),direction=[new T.Vector3(0,0,-1),new T.Vector3(1,0,0),new T.Vector3(0,0,1),new T.Vector3(-1,0,0)][entrance];
    this.position=reward.clone().addScaledVector(direction,-2.4).add(new T.Vector3(MAZE_SITE.x,0,MAZE_SITE.z));
    const exit=reward.clone();if(Math.abs(exit.x)>Math.abs(exit.z)){exit.x=Math.sign(exit.x||1)*44;exit.z=T.MathUtils.clamp(exit.z,-20,20);}else{exit.z=Math.sign(exit.z||1)*44;exit.x=T.MathUtils.clamp(exit.x,-20,20);}
    this.landing=exit.add(new T.Vector3(MAZE_SITE.x,0,MAZE_SITE.z));this.group.name='Star reward trampoline and soft leaves';
    const frame=new T.Group();frame.position.copy(this.position);this.group.add(frame);
    const metal=new T.MeshStandardMaterial({color:'#7e929b',metalness:.7,roughness:.3});
    const rim=new T.Mesh(new T.TorusGeometry(1.68,.19,10,48),new T.MeshStandardMaterial({color:'#eeb945',roughness:.55}));rim.rotation.x=Math.PI/2;rim.position.y=.65;frame.add(rim);
    this.mat.position.y=.6;frame.add(this.mat);
    for(let i=0;i<8;i++){const a=i*Math.PI/4,x=Math.cos(a)*1.53,z=Math.sin(a)*1.53;const leg=new T.Mesh(new T.CylinderGeometry(.065,.08,.6,8),metal);leg.position.set(x,.3,z);frame.add(leg);}
    for(let i=0;i<24;i++){const a=i*Math.PI/12,points=[];for(let j=0;j<=24;j++){const t=j/24;points.push(new T.Vector3((1.4+t*.25)*Math.cos(a)+Math.sin(t*Math.PI*8)*.035,.6+Math.cos(t*Math.PI*8)*.035,(1.4+t*.25)*Math.sin(a)));}frame.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),24,.012,4,false),metal));}
    const pile=new T.Mesh(new T.SphereGeometry(1,20,10),new T.MeshStandardMaterial({color:'#bb8437',roughness:1}));pile.position.copy(this.landing).y=.35;pile.scale.set(4,.7,3.7);this.group.add(pile);
    const leafGeometry=new T.SphereGeometry(1,6,4),leafMaterial=new T.MeshStandardMaterial({color:'#ffffff',roughness:.9});
    const bed=new T.InstancedMesh(leafGeometry,leafMaterial,260),color=new T.Color();
    for(let i=0;i<260;i++){const a=i*2.399,r=Math.sqrt((i+.5)/260);this.dummy.position.copy(this.landing).add(new T.Vector3(Math.cos(a)*3.9*r,.15+.85*(1-r*r),Math.sin(a)*3.6*r));this.dummy.scale.set(.28,.055,.15);this.dummy.rotation.set(.2*Math.sin(i),i,.3);this.dummy.updateMatrix();bed.setMatrixAt(i,this.dummy.matrix);bed.setColorAt(i,color.set(['#dba346','#e9c459','#b86b32','#ac893a'][i%4]));}bed.computeBoundingSphere();this.group.add(bed);
    this.leaves=new T.InstancedMesh(leafGeometry,new T.MeshStandardMaterial({color:'#e4b14a'}),48);this.leaves.visible=false;this.leaves.frustumCulled=false;this.group.add(this.leaves);
    this.group.traverse(o=>{if(o instanceof T.Mesh)o.castShadow=o.receiveShadow=true;});
  }
  prompt(c:CharacterController){return this.active?'Прыжок из лабиринта!':c.starBlessed && c.actor.position.distanceTo(this.position)<3.8?'E — прыгнуть на батут · Пробел — тоже прыгнуть':'';}
  start(c:CharacterController){if(this.active || !this.prompt(c) || c.actor.position.y>.5)return false;this.player=c;this.from.copy(c.actor.position);this.elapsed=0;c.setActivity('Trampoline');return true;}
  update(dt:number){
    this.burst+=dt;this.leaves.visible=this.burst<1.8;
    if(this.leaves.visible){for(let i=0;i<48;i++){const t=this.burst,a=i*2.399;this.dummy.position.copy(this.landing).add(new T.Vector3(Math.cos(a)*(1+t*(1+i%3)),Math.max(.1,.7+(3+i%4*.4)*t-3*t*t),Math.sin(a)*(1+t*(1+i%3))));this.dummy.scale.set(.25*Math.min(1,(1.8-t)*2),.05,.15);this.dummy.rotation.set(i+t*4,i+t*2,t*3);this.dummy.updateMatrix();this.leaves.setMatrixAt(i,this.dummy.matrix);}this.leaves.instanceMatrix.needsUpdate=true;}
    const c=this.player;if(!c)return;const previous=this.elapsed;this.elapsed+=dt;const t=this.elapsed;c.mixer.update(dt);
    if(t<.5){const u=t/.5;c.actor.position.lerpVectors(this.from,this.position,u*u*(3-2*u));c.actor.position.y=.6*u+Math.sin(u*Math.PI)*1.3;}
    else if(t<.8){const u=(t-.5)/.3,press=Math.sin(u*Math.PI);this.mat.position.y=.6-.3*press;c.actor.position.copy(this.position);c.actor.position.y=this.mat.position.y;c.animationRoot.scale.set(1+press*.15,1-press*.2,1+press*.15);}
    else if(t<4){
      if(previous<.8)this.sound('bounce');this.mat.position.y=.6;c.animationRoot.scale.setScalar(1);
      const u=(t-.8)/3.2,h=T.MathUtils.clamp((u-.18)/.6,0,1),blend=h*h*(3-2*h);
      c.actor.position.lerpVectors(this.position,this.landing,blend);c.actor.position.y=.6*(1-u)+(18+c.actor.scale.x*2)*Math.sin(Math.PI*u);
      c.yaw=Math.atan2(this.landing.x-this.position.x,this.landing.z-this.position.z);c.actor.rotation.y=c.yaw;
      for(const side of ['Left','Right']){const arm=c.actor.getObjectByName(`${side}_shoulder`);if(arm)arm.rotation.z=(side==='Left'?-1:1)*(1+.12*Math.sin(t*12));const foot=c.actor.getObjectByName(`${side}_foot_pivot`);if(foot)foot.rotation.x=.35*Math.sin(u*Math.PI);}
    }else{
      if(previous<4){this.sound('leaves');this.burst=0;}
      c.actor.position.copy(this.landing);const u=Math.min(1,(t-4)/.65),s=Math.sin(u*Math.PI)*.26;c.animationRoot.scale.set(1+s,1-s,1+s);
      if(u===1){awardFirst(c,'trampoline');c.setActivity('Idle');this.player=undefined;}
    }
  }
}
