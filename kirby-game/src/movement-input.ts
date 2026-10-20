export const TURN_RATE = Math.PI * 1.1;

/** Screen directions move immediately while the character turns toward travel. */
export function cameraRelativeMotion(x:number,y:number,cameraYaw:number,yaw:number,dt:number){
 if(Math.hypot(x,y)<.05)return {forward:false,backward:false,left:false,right:false,steer:0};
 const moveYaw=cameraYaw-Math.atan2(x,-y);
 const difference=Math.atan2(Math.sin(moveYaw-yaw),Math.cos(moveYaw-yaw));
 return {forward:true,backward:false,left:false,right:false,moveYaw,
  steer:Math.max(-1,Math.min(1,difference/Math.max(.0001,TURN_RATE*dt)))};
}
