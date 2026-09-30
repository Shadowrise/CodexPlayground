export type PushCandidate={id:string;p:readonly number[];s:number;state:string};
const BODY=.9,MARGIN=.6;
export function pushRadius(scale:number){return (BODY+MARGIN)*scale;}
export function canPush(state:string){return ['Idle','Run','Walk','WalkBackward','RotateLeft','RotateRight','Jump','Fly','Push','Attack','Eat','Swim','Hello','Joy','Fear','Anger','Sad','FireflyRide'].includes(state)||state.startsWith('FireflyRide:')||state.startsWith('FireflyApproach:');}
function pushReaches(p:readonly number[],yaw:number,scale:number,target:PushCandidate){
 const radius=pushRadius(target.s),reach=3.1*scale;
 const fx=Math.sin(yaw),fz=Math.cos(yaw);
 const y=p[1]+BODY*scale,ty=target.p[1]+BODY*target.s;
 const vx=target.p[0]-p[0],vy=ty-y,vz=target.p[2]-p[2];
 const len2=reach*reach;
 let t=len2>0?(vx*fx*reach+vz*fz*reach)/len2:0;
 if(t<0)t=0;else if(t>1)t=1;
 const ex=vx-fx*reach*t,ey=vy,ez=vz-fz*reach*t;
 return ex*ex+ey*ey+ez*ez<=radius*radius;
}
/** Shared targeting for solo and authoritative online pushes, including airborne riders. */
export function pushTarget(p:readonly number[],yaw:number,scale:number,candidates:readonly PushCandidate[]){
 let chosen:PushCandidate|undefined,best=Infinity;
 const fx=Math.sin(yaw),fz=Math.cos(yaw);
 for(const c of candidates){
  if(!canPush(c.state))continue;
  const dx=c.p[0]-p[0],dy=c.p[1]-p[1],dz=c.p[2]-p[2],horizontal=Math.hypot(dx,dz);
  const riding=c.state.startsWith('FireflyRide');
  const hit=riding?horizontal<3.1*scale&&Math.abs(dy)<=7*Math.max(scale,c.s)&&(horizontal<.1||(dx*fx+dz*fz)/horizontal>=.5):pushReaches(p,yaw,scale,c);
  const gap=dx*dx+dy*dy+dz*dz;
  if(hit&&gap<best){best=gap;chosen=c;}
 }
 return chosen;
}
