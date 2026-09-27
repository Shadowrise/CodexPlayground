/** Keep mouse-first computers, including touchscreen laptops, on the desktop UI. */
export function wantsTouchControls(touchPoints:number, coarse:boolean, noHover:boolean) {
  return touchPoints>0 && coarse && noHover;
}

export function touchMotion(x:number,y:number,azimuth:number,yaw:number,dt:number) {
  const magnitude=Math.hypot(x,y);
  if(magnitude<.18)return {forward:false,sprint:false,steer:0};
  // The camera looks toward its target; screen-right is the negative yaw direction.
  const target=azimuth+Math.PI-Math.atan2(x,-y);
  const difference=Math.atan2(Math.sin(target-yaw),Math.cos(target-yaw));
  return {forward:Math.abs(difference)<Math.PI*.4,sprint:magnitude>.85,
    steer:Math.max(-1,Math.min(1,difference/Math.max(.0001,Math.PI*.55*dt)))};
}
