import type {CharacterController} from './controller';
import type {Vector3} from 'three';
import {BOSS_ARENA as A} from './boss-arena-site';

export type CentipedeBody={x:number;y:number;z:number;rx:number;ry:number;rz:number};
/** Twelve animated ellipsoids, never raycasts or scans of the detailed model. */
export class CentipedeCollision{
 readonly bodies:CentipedeBody[]=Array.from({length:12},()=>({x:0,y:0,z:0,rx:0,ry:0,rz:0}));
 private standing=-1;private lastX=0;private lastZ=0;private lastY=0;
 private base=0;private fall:number|undefined;
 private top(b:CentipedeBody,x:number,z:number,size:number){
  const dx=x-b.x,dz=z-b.z,d=Math.hypot(dx,dz),foot=.63*size;
  if(!b.rx||!b.rz)return undefined;
  // Use the rounded foot envelope. Large kirbies can stand on their visible feet.
  const f=d>.001?Math.max(0,d-foot)/d:0,u=(dx*f/b.rx)**2+(dz*f/b.rz)**2;
  return u<=1?b.y+b.ry*Math.sqrt(Math.max(0,1-u)):undefined;
 }
 apply(c:CharacterController,previous:Vector3,dt:number,enabled=true){
  if(!enabled){this.standing=-1;this.base=0;this.fall=undefined;return;}
  const p=c.actor.position,size=c.actor.scale.x;
  if(this.standing<0&&!this.base&&this.fall===undefined&&Math.hypot(p.x-A.x,p.z-A.z)>A.radius+size)return;
  let previousY=previous.y;
  if(this.standing>=0&&!c.flight.active){
   const b=this.bodies[this.standing],dy=b.y-this.lastY;
   p.x+=b.x-this.lastX;p.z+=b.z-this.lastZ;p.y+=dy;previousY+=dy;
   c.surfaceY=this.base+=dy;
  }
  if(this.fall!==undefined){c.flight.reset();c.cloud.visible=false;this.fall-=24*dt;p.y=previousY+this.fall*dt;}
  let support=-1,height=-Infinity;
  for(let i=0;i<this.bodies.length;i++){
   const h=this.top(this.bodies[i],p.x,p.z,size);if(h===undefined)continue;
   const descending=previousY>=h-.08&&p.y<=h+.08&&p.y<=previousY+.02;
   const walking=this.standing>=0&&!c.flight.active&&Math.abs(h-previousY)<.5;
   if((descending||walking)&&h>height){height=h;support=i;}
  }
  if(support>=0){
   if(c.flight.active)c.setActivity('Idle');
   c.swimming=false;
   p.y=c.surfaceY=this.base=height;this.fall=undefined;this.standing=support;
   const b=this.bodies[support];this.lastX=b.x;this.lastZ=b.z;this.lastY=b.y;
  }else{
   this.standing=-1;
   if(c.flight.active&&this.base>0)c.surfaceY=this.base;
   if(!c.flight.active&&this.base>0&&this.fall===undefined){this.fall=0;c.surfaceY=this.base=0;}
   if(p.y<=0&&this.fall!==undefined){p.y=0;c.surfaceY=0;this.fall=undefined;}
  }
  // Project a standing capsule out of the sides. Two small passes handle joints.
  const foot=.6*size,head=1.8*size;
  for(let pass=0;pass<2;pass++)for(const b of this.bodies){
   if(!b.rx||p.y>=b.y+b.ry-.06||p.y+head<=b.y-b.ry)continue;
   let dx=p.x-b.x,dz=p.z-b.z,rx=b.rx+foot,rz=b.rz+foot,u=Math.hypot(dx/rx,dz/rz);
   if(u>=1)continue;
   if(u<.0001){dx=previous.x-b.x;dz=previous.z-b.z;u=Math.hypot(dx/rx,dz/rz);if(u<.0001){dx=rx;dz=0;u=1;}}
   p.x=b.x+dx/u;p.z=b.z+dz/u;
  }
 }
}
