export type PushCandidate={id:string;p:readonly number[];s:number;state:string};
export function canPush(state:string){return ['Idle','Run','Walk','WalkBackward','RotateLeft','RotateRight','Jump','Fly','Push','Attack','Eat','Swim','Hello','Joy','Fear','Anger','Sad','FireflyRide'].includes(state)||state.startsWith('FireflyRide:')||state.startsWith('FireflyApproach:');}
/** Shared targeting for solo and authoritative online pushes, including airborne riders. */
export function pushTarget(p:readonly number[],yaw:number,scale:number,candidates:readonly PushCandidate[]){
 let chosen:PushCandidate|undefined,best=3.1*scale;
 for(const c of candidates){if(!canPush(c.state))continue;const dx=c.p[0]-p[0],dz=c.p[2]-p[2],distance=Math.hypot(dx,dz);
  const riding=c.state.startsWith('FireflyRide');if(Math.abs(c.p[1]-p[1])>(riding?7:3)*Math.max(scale,c.s))continue;
  if(distance<best&&(distance<.1||(dx*Math.sin(yaw)+dz*Math.cos(yaw))/distance>=.5)){best=distance;chosen=c;}
 }return chosen;
}
