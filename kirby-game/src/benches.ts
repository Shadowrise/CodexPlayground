import { awardFirst } from './score';
import { MathUtils, Vector3 } from 'three';
import type { CharacterController } from './controller';
import { LANDMARKS } from './landmarks';
import { TREEHOUSE_SITE, TREEHOUSE_HEIGHT_SCALE } from './treehouse';

export type BenchSeat={position:Vector3;yaw:number;floor:number};
export const BENCH_SEATS:BenchSeat[]=[
  ...LANDMARKS.filter(site=>site.kind===4).flatMap(site=>[[0,4],[-5,-2]].map(([x,z])=>({position:new Vector3(site.x+x,1.07,site.z+z),yaw:Math.PI,floor:0}))),
  {position:TREEHOUSE_SITE.clone().add(new Vector3(-2,9.72*TREEHOUSE_HEIGHT_SCALE,1.36)),yaw:0,floor:9*TREEHOUSE_HEIGHT_SCALE},
];

export class Benches {
  private rider?:CharacterController;
  private seat?:BenchSeat;
  private from=new Vector3();
  private target=new Vector3();
  private yaw=0;
  private previousState='Idle';
  private elapsed=0;
  private leaving=false;
  private startBlend=0;
  private blend=0;
  get active(){return !!this.rider;}
  outlineSeat(position:Vector3){return this.nearby(position);}
  private nearby(position:Vector3) {
    return BENCH_SEATS.filter(seat=>Math.abs(position.y-seat.floor)<.5 && Math.hypot(position.x-seat.position.x,position.z-seat.position.z)<3)
      .sort((a,b)=>a.position.distanceToSquared(position)-b.position.distanceToSquared(position))[0];
  }
  prompt(position:Vector3){return this.active?'E — встать с лавочки':this.nearby(position)?'E — сесть на лавочку':'';}
  interact(character:CharacterController){
    if(this.rider){if(!this.leaving){this.leaving=true;this.elapsed=0;this.startBlend=this.blend;}return;}
    const seat=this.nearby(character.actor.position);if(!seat || character.flight.active)return;
    this.rider=character;this.seat=seat;this.from.copy(character.actor.position);this.yaw=character.yaw;
    this.previousState=character.state==='Lookout'?'Lookout':'Idle';this.elapsed=0;this.leaving=false;this.blend=0;
    this.target.copy(seat.position);this.target.y-=.18*character.actor.scale.x;
    const offset=Math.max(0,character.actor.scale.x-1)*.65;
    this.target.x+=Math.sin(seat.yaw)*offset;this.target.z+=Math.cos(seat.yaw)*offset;
    character.setActivity('Sitting');
  }
  update(dt:number){
    const c=this.rider;if(!c)return;
    this.elapsed+=dt;
    const t=Math.min(1,this.elapsed/(this.leaving?.35:.5)),smooth=t*t*(3-2*t);
    if(!this.leaving && t===1)awardFirst(c,'bench');
    this.blend=this.leaving?this.startBlend*(1-smooth):smooth;
    c.mixer.update(dt);c.actor.position.lerpVectors(this.from,this.target,this.blend);
    const delta=Math.atan2(Math.sin(this.seat!.yaw-this.yaw),Math.cos(this.seat!.yaw-this.yaw));
    c.yaw=this.yaw+delta*this.blend;c.actor.rotation.set(0,c.yaw,0);
    for(const side of ['Left','Right']){
      const foot=c.actor.getObjectByName(`${side}_foot_pivot`),arm=c.actor.getObjectByName(`${side}_shoulder`);
      if(foot)foot.rotation.x=MathUtils.lerp(foot.rotation.x,-.9,this.blend);
      if(arm){arm.rotation.x=MathUtils.lerp(arm.rotation.x,-.3,this.blend);arm.rotation.z=MathUtils.lerp(arm.rotation.z,(side==='Left'?-1:1)*.3,this.blend);}
    }
    if(this.leaving && t===1){c.actor.position.copy(this.from);c.setActivity(this.previousState);this.rider=undefined;}
  }
}
