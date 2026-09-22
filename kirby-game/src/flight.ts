import { AnimationClip, Euler, Object3D, Quaternion, QuaternionKeyframeTrack } from 'three';
import { makeFruitMist } from './fruit-mist';

export const FLIGHT_HEIGHT=2.9;
export class Flight {
  height=0;
  active=false;
  private level=0;
  private target=0;
  private hold=0;
  private dash=0;
  get gliding() {return this.dash>0;}
  get atTop() {return this.height>=FLIGHT_HEIGHT-.08;}
  press() {
    this.active=true;
    if(this.level<2){this.level++;this.target=this.level*FLIGHT_HEIGHT/2;this.hold=.65;}
    else {this.target=FLIGHT_HEIGHT;this.hold=.8;this.dash=.8;}
  }
  reset() {this.height=this.level=this.target=this.hold=this.dash=0;this.active=false;}
  update(dt:number) {
    if(!this.active)return;
    this.dash=Math.max(0,this.dash-dt);
    if(this.height<this.target) this.height=Math.min(this.target,this.height+3.7*dt);
    else if(this.hold>0)this.hold=Math.max(0,this.hold-dt);
    else {this.target=0;this.height=Math.max(0,this.height-1.8*dt);if(this.height===0)this.reset();}
  }
}

/** Real looping animation tracks: relaxed 1.6-second wing beats and idle breathing. */
export function flightClip(idle:AnimationClip,model:Object3D,name='Fly') {
  const clip=idle.clone();clip.name=name;clip.duration=1.6;
  for(const [label,side] of [['Left',-1],['Right',1]] as const) {
    const arm=model.getObjectByName(`${label}_shoulder`)??model.getObjectByName(`${label} shoulder`);
    if(!arm)continue;
    clip.tracks=clip.tracks.filter(t=>!t.name.startsWith(`${arm.name}.quaternion`));
    const times:number[]=[],values:number[]=[],q=new Quaternion();
    for(let i=0;i<=32;i++) {
      const t=i/32*1.6;times.push(t);
      q.setFromEuler(new Euler(-.18,0,side*(.7+.38*Math.cos(t/1.6*Math.PI*2))));values.push(q.x,q.y,q.z,q.w);
    }
    clip.tracks.push(new QuaternionKeyframeTrack(`${arm.name}.quaternion`,times,values));
  }
  return clip;
}

export function flightCloud() {
  const cloud=makeFruitMist(0);cloud.material=cloud.material.clone();cloud.material.color.set('#ffffff');cloud.material.opacity=.82;
  cloud.name='Flight cloud';cloud.position.set(0,-.08,0);cloud.scale.set(2.5,.85,1);cloud.visible=false;
  return cloud;
}
