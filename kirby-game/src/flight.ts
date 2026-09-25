import { AnimationClip, Euler, Group, Object3D, Quaternion, QuaternionKeyframeTrack, Sprite, VectorKeyframeTrack } from 'three';
import { makeFruitMist } from './fruit-mist';

export const FLIGHT_HEIGHT=2.9;
const FLIGHT_GRAVITY=24;
const FLIGHT_HOVER_SECONDS=2;
export class Flight {
  height=0;
  active=false;
  private level=0;
  private target=0;
  private hold=0;
  private dash=0;
  private velocity=0;
  private rising=false;
  networkState(){return [this.height,Number(this.active),this.level,this.target,this.hold,this.dash,this.velocity,Number(this.rising)];}
  networkApply(v:number[]){this.height=v[0];this.active=!!v[1];this.level=v[2];this.target=v[3];this.hold=v[4];this.dash=v[5];this.velocity=v[6];this.rising=!!v[7];}
  get gliding() {return this.dash>0;}
  get atTop() {return this.height>=FLIGHT_HEIGHT-.08;}
  press() {
    this.active=true;
    if(this.level<2){this.level++;this.target=this.level*FLIGHT_HEIGHT/2;}
    else {this.target=FLIGHT_HEIGHT;this.dash=.8;}
    this.hold=FLIGHT_HOVER_SECONDS;
    this.velocity=Math.sqrt(2*FLIGHT_GRAVITY*Math.max(0,this.target-this.height));
    this.rising=this.velocity>0;
  }
  reset() {this.height=this.level=this.target=this.hold=this.dash=this.velocity=0;this.active=this.rising=false;}
  update(dt:number) {
    if(!this.active)return;
    this.dash=Math.max(0,this.dash-dt);
    // Consume each phase separately so the arc and hover duration do not depend on FPS.
    let remaining=dt;
    while(remaining>0 && this.active) {
      if(this.rising) {
        const toApex=this.velocity/FLIGHT_GRAVITY;
        const step=Math.min(remaining,toApex);
        this.height+=this.velocity*step-.5*FLIGHT_GRAVITY*step*step;
        this.velocity-=FLIGHT_GRAVITY*step;
        remaining-=step;
        if(step===toApex){this.height=this.target;this.velocity=0;this.rising=false;}
      } else if(this.hold>0) {
        const step=Math.min(remaining,this.hold);
        this.hold-=step;remaining-=step;
      } else {
        this.height=Math.max(0,this.height+this.velocity*remaining-.5*FLIGHT_GRAVITY*remaining*remaining);
        this.velocity-=FLIGHT_GRAVITY*remaining;remaining=0;
        if(this.height===0)this.reset();
      }
    }
  }
}

/** Three wing beats per cycle, with both feet tucking and pushing downward. */
export function flightClip(idle:AnimationClip,model:Object3D,name='Fly') {
  const clip=idle.clone();clip.name=name;clip.duration=1.6;
  for(const [label,side] of [['Left',-1],['Right',1]] as const) {
    const arm=model.getObjectByName(`${label}_shoulder`)??model.getObjectByName(`${label} shoulder`);
    if(!arm)continue;
    clip.tracks=clip.tracks.filter(t=>!t.name.startsWith(`${arm.name}.quaternion`));
    const times:number[]=[],values:number[]=[],q=new Quaternion();
    for(let i=0;i<=96;i++) {
      const t=i/96*1.6;times.push(t);
      q.setFromEuler(new Euler(-.18,0,side*(.7+.38*Math.cos(t/1.6*Math.PI*6))));values.push(q.x,q.y,q.z,q.w);
    }
    clip.tracks.push(new QuaternionKeyframeTrack(`${arm.name}.quaternion`,times,values));
    const foot=model.getObjectByName(`${label}_foot_pivot`)??model.getObjectByName(`${label} foot pivot`);
    if(foot) {
      clip.tracks=clip.tracks.filter(t=>t.name!==`${foot.name}.quaternion` && t.name!==`${foot.name}.position`);
      const footTimes=[0,.12,.26,.45,.8,1.3,1.6],angles=[0,-.45,.5,-.2,-.12,-.08,0],heights=[0,.09,-.1,.07,.035,.02,0];
      const rotations:number[]=[],positions:number[]=[];
      footTimes.forEach((_,i)=>{
        q.setFromEuler(new Euler(angles[i],0,side*.035));rotations.push(q.x,q.y,q.z,q.w);
        positions.push(foot.position.x,foot.position.y+heights[i],foot.position.z);
      });
      clip.tracks.push(new QuaternionKeyframeTrack(`${foot.name}.quaternion`,footTimes,rotations),new VectorKeyframeTrack(`${foot.name}.position`,footTimes,positions));
    }
  }
  return clip;
}

export function flightCloud() {
  const cloud=new Group();
  cloud.name='Flight cloud';cloud.position.set(0,.05,-.25);cloud.visible=false;
  // Overlapping puffs occupy real depth rather than a single flat billboard.
  const puffs=[
    [0,-.3,0,3.8,2.4],[-.95,-.3,0,2.5,2], [.95,-.35,.15,2.6,2.1],
    [0,-.4,.9,2.7,2.2],[.1,-.5,-.9,2.8,2.3],
    [-.35,-1.05,.2,2.6,2.4],[.35,-1.6,-.15,1.9,1.9],
  ];
  for(const [x,y,z,width,height] of puffs) {
    const puff=makeFruitMist(0);puff.material=puff.material.clone();
    puff.material.color.set('#b5bbc5');puff.material.opacity=0;
    puff.position.set(x,y,z);puff.scale.set(width,height,1);cloud.add(puff);
  }
  return cloud;
}

export function updateFlightCloud(cloud:Group,flight:Flight) {
  const progress=Math.min(1,Math.max(0,flight.height/(FLIGHT_HEIGHT/2)));
  const density=progress*progress*(3-2*progress);
  cloud.visible=flight.active && density>0;
  for(const puff of cloud.children as Sprite[])puff.material.opacity=.58*density;
}
