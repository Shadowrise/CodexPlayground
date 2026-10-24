import {drawLocalizedText,localizedCanvasTexture} from './localized-sign';
import { LeafPile } from './leaf-pile';
import {treehouseModelWork} from './treehouse-model';
import {prepareTreeBark} from './tree-bark';
import {startupWork} from './startup-tasks';
import { awardFirst } from './score';
import * as T from 'three';
import type { CharacterController, Input } from './controller';
import {TREEHOUSE_LOCATION,TREEHOUSE_DECK_HEIGHT,TREEHOUSE_BALCONY} from './treehouse-site';

export const TREEHOUSE_SITE=new T.Vector3(TREEHOUSE_LOCATION.x,0,TREEHOUSE_LOCATION.z);
export type TreehouseSound='ladder'|'creak'|'leaves'|'cheer';
type Activity='climb'|'deck'|'dive'|'land'|'swing';
export const TREEHOUSE_HEIGHT_SCALE=2;
const DECK=TREEHOUSE_DECK_HEIGHT/TREEHOUSE_HEIGHT_SCALE;
const SWING_SEAT_Y=-5.7,SWING_SEAT_THICKNESS=.18;
const idle={forward:false,left:false,right:false};

/** A crafted oak lookout with static batched details and one moving swing. */
export class Treehouse {
  readonly group=new T.Group();
  readonly swing=new T.Group();
  private rider?:CharacterController;
  private activity:Activity='climb';
  private elapsed=0;
  private clock=0;
  private soundAfter=0;
  private from=new T.Vector3();
  private leafPile=new LeafPile();
  private swingAngle=0;
  get active(){return !!this.rider;}
  get canSit(){return !!this.rider && this.activity==='deck';}
  onBalcony(character:CharacterController){return this.rider===character&&this.activity==='deck';}
  constructor(private sound:(kind:TreehouseSound)=>void=()=>{},deferred=false) {if(!deferred)for(const _ of this.build()){};}
  static async create(sound:(kind:TreehouseSound)=>void=()=>{}){await prepareTreeBark();const tree=new Treehouse(sound,true);await startupWork(tree.build());return tree;}
  private *build() {
    const root=this.group;root.name='Oak treehouse, lookout, swing and leaf pile';root.position.copy(TREEHOUSE_SITE);
    this.swing.name='Prepared swing source';
    root.add(yield* treehouseModelWork(this.swing));
    this.leafPile.group.position.set(8,0,13);root.add(this.leafPile.group);
    if(typeof document!=='undefined'){
      const canvas=document.createElement('canvas');canvas.width=768;canvas.height=192;const ctx=canvas.getContext('2d');
      if(ctx){ctx.fillStyle='#365f51';ctx.fillRect(0,0,768,192);ctx.strokeStyle='#e8c58a';ctx.lineWidth=10;ctx.strokeRect(8,8,752,176);ctx.textAlign='center';ctx.fillStyle='#fff1cb';ctx.font='bold 62px sans-serif';ctx.textBaseline='middle';drawLocalizedText(ctx,'ДОМИК НА ДЕРЕВЕ',384,96);
        const sign=new T.Mesh(new T.PlaneGeometry(3.58,.64),new T.MeshBasicMaterial({map:localizedCanvasTexture(canvas)}));sign.position.set(0,22.1,.65);root.add(sign);}
    }
  }
  networkSwing(angle:number){if(!this.rider||this.activity!=='swing'){this.swingAngle=angle;this.swing.rotation.x=angle;}}
  networkKey(position:T.Vector3){
    if(!this.prompt(position))return;
    return (this.rider?this.activity==='swing':position.x-TREEHOUSE_SITE.x<-7)?'swing:0':'tree:0';
  }
  get outlineSwing(){return this.swing;}
  prompt(position:T.Vector3) {
    if(this.rider)return this.activity==='deck'?'E — прыгнуть в листья':this.activity==='swing'?'E — слезть с качелей':this.activity==='climb'?'Поднимаемся к домику…':'Прыжок в мягкие листья!';
    const p=position.clone().sub(TREEHOUSE_SITE);
    if(p.y>1)return '';
    if(p.distanceTo(new T.Vector3(-4,0,11))<3.5)return 'E — подняться в домик на дереве';
    if(p.distanceTo(new T.Vector3(-11,0,3))<4)return 'E — покачаться на качелях';
    return '';
  }
  interact(character:CharacterController) {
    if(this.rider){if(this.activity==='deck')this.dive();else if(this.activity==='swing')this.finish();return;}
    if(!this.prompt(character.actor.position) || character.flight.active)return;
    this.activity=this.networkKey(character.actor.position)==='swing:0'?'swing':'climb';
    this.rider=character;this.elapsed=0;this.soundAfter=0;this.from.copy(character.actor.position);
    character.setActivity(this.activity==='climb'?'Climb':'Swing');
  }
  private dive(){this.activity='dive';this.elapsed=0;this.from.copy(this.rider!.actor.position);this.rider!.setActivity('LeafDive');this.sound('cheer');}
  cancel(){this.rider?.setActivity('Idle');this.rider=undefined;}
  private finish(){const c=this.rider!;c.actor.position.copy(TREEHOUSE_SITE).add(new T.Vector3(this.activity==='swing'?-11:8,0,this.activity==='swing'?9:13));c.actor.rotation.set(0,0,0);c.yaw=0;c.setActivity('Idle');this.rider=undefined;}
  constrain(position:T.Vector3,size:number){const dx=position.x-TREEHOUSE_SITE.x,dz=position.z-(TREEHOUSE_SITE.z-6),r=2.4+.65*size,d=Math.hypot(dx,dz);if(d<r){position.x=TREEHOUSE_SITE.x+(d>.001?dx/d:1)*r;position.z=TREEHOUSE_SITE.z-6+(d>.001?dz/d:0)*r;}}
  update(dt:number,input:Input=idle,jump=false) {
    this.clock+=dt;this.leafPile.update(dt);this.elapsed+=dt;
    const swinging=this.rider && this.activity==='swing';
    this.swingAngle=T.MathUtils.damp(this.swingAngle,Math.sin(this.clock*1.65)*(swinging?.55:.07),4,dt);this.swing.rotation.x=this.swingAngle;
    const c=this.rider;if(!c)return;
    c.mixer.update(dt);const size=c.actor.scale.x;
    const armL=c.hasNativeAnimations?undefined:c.actor.getObjectByName('Left_shoulder'),armR=c.hasNativeAnimations?undefined:c.actor.getObjectByName('Right_shoulder');
    const footL=c.hasNativeAnimations?undefined:c.actor.getObjectByName('Left_foot_pivot'),footR=c.hasNativeAnimations?undefined:c.actor.getObjectByName('Right_foot_pivot');
    if(this.activity==='climb'){
      const u=Math.min(1,this.elapsed/5.2),s=u*u*(3-2*u);
      const base=TREEHOUSE_SITE.clone().add(new T.Vector3(-4,0,11));
      if(u<.12)c.actor.position.lerpVectors(this.from,base,u/.12);
      else c.actor.position.copy(base).add(new T.Vector3(0,DECK*TREEHOUSE_HEIGHT_SCALE*(s-.039744)/.960256,-4*(s-.039744)/.960256));
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
      if(c.hasNativeAnimations && c.state!=='Sitting')c.setActivity(movement?(movement>0?'Walk':'WalkBackward'):'Lookout');
      c.actor.position.x=T.MathUtils.clamp(c.actor.position.x+Math.sin(c.yaw)*movement,TREEHOUSE_BALCONY.minX,TREEHOUSE_BALCONY.maxX);
      c.actor.position.z=T.MathUtils.clamp(c.actor.position.z+Math.cos(c.yaw)*movement,TREEHOUSE_BALCONY.minZ,TREEHOUSE_BALCONY.maxZ);
      if(footL)footL.rotation.x=movement?Math.sin(this.clock*10)*.3:0;if(footR)footR.rotation.x=movement?-Math.sin(this.clock*10)*.3:0;
    }else if(this.activity==='dive'){
      const u=Math.min(1,this.elapsed/2.0),target=TREEHOUSE_SITE.clone().add(new T.Vector3(8,.35,13));
      c.actor.position.lerpVectors(this.from,target,u);c.actor.position.y=this.from.y+(target.y-this.from.y)*u*u+5*Math.sin(Math.PI*u);
      c.yaw=Math.atan2(target.x-this.from.x,target.z-this.from.z);c.actor.rotation.y=c.yaw;
      if(armL)armL.rotation.z=-1.1;if(armR)armR.rotation.z=1.1;
      if(!c.hasNativeAnimations)c.animationRoot.rotation.x=-.3*Math.sin(Math.PI*u);
      if(u===1){awardFirst(c,'leaves');this.activity='land';this.elapsed=0;this.leafPile.burst();this.sound('leaves');}
    }else if(this.activity==='land'){
      const u=Math.min(1,this.elapsed/.7),squash=Math.sin(u*Math.PI)*.28;
      c.actor.position.y=.35*(1-u);
      c.animationRoot.scale.set(1+squash,1-squash,1+squash);c.animationRoot.rotation.x=0;
      if(u===1)this.finish();
    }else{
      this.swing.updateWorldMatrix(true,false);
      const seatY=c.isPigeon?SWING_SEAT_Y+SWING_SEAT_THICKNESS/2:-5.58;
      const seat=this.swing.localToWorld(new T.Vector3(0,seatY,0));
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
