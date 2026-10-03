// Neutral GLB feet span x ±.95 and z -.45…+.81. Use their rounded envelope,
// independent of animation, so a waving foot never makes support flicker.
export function standingFootprint(size:number,yaw:number){
 const sin=Math.sin(yaw),cos=Math.cos(yaw);
 const rx=.95*size,rz=.63*size;
 return {rx,rz,dx:.18*size*sin,dz:.18*size*cos,sin,cos,extentX:Math.hypot(rx*cos,rz*sin),extentZ:Math.hypot(rx*sin,rz*cos)};
}
export type StandingFootprint=ReturnType<typeof standingFootprint>;

/** Ellipse/rectangle overlap, including rounded corners instead of square padding. */
export function footprintOverlapsRect(x:number,z:number,hx:number,hz:number,f:StandingFootprint){
 x+=f.dx;z+=f.dz;
 if(Math.abs(x)<=hx&&Math.abs(z)<=hz)return true;
 if(f.rx<=0||f.rz<=0||Math.abs(x)>hx+f.extentX||Math.abs(z)>hz+f.extentZ)return false;
 // Map the four rectangle edges into the ellipse's unit circle.
 let ax=((-hx-x)*f.cos-(-hz-z)*f.sin)/f.rx;
 let az=((-hx-x)*f.sin+(-hz-z)*f.cos)/f.rz;
 for(let edge=0;edge<4;edge++){
  const px=(edge<2?hx:-hx)-x,pz=(edge===0||edge===3?-hz:hz)-z;
  const bx=(px*f.cos-pz*f.sin)/f.rx,bz=(px*f.sin+pz*f.cos)/f.rz;
  const dx=bx-ax,dz=bz-az,length=dx*dx+dz*dz;
  const t=length?Math.max(0,Math.min(1,-(ax*dx+az*dz)/length)):0;
  if((ax+t*dx)**2+(az+t*dz)**2<=1)return true;
  ax=bx;az=bz;
 }
 return false;
}
