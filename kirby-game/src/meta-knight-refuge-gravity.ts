import * as T from 'three';

/** Tangent approaches continue around an inflated surface; every segment clears the solid planet. */
export function refugeGravityPaths(tip:T.Vector3,center:T.Vector3,radius:number,clock:number,paths:T.Vector3[][]=[]){
 const x=tip.x-center.x,y=tip.y-center.y,z=tip.z-center.z,distance=Math.hypot(x,y,z),length=distance||1,ux=x/length,uy=y/length,uz=z/length;
 const polar=Math.abs(uy)>.9,vLength=(polar?Math.hypot(ux,uy):Math.hypot(ux,uz))||1,vx=(polar?uy:-uz)/vLength,vy=polar?-ux/vLength:0,vz=polar?0:ux/vLength,wx=uy*vz-uz*vy,wy=uz*vx-ux*vz,wz=ux*vy-uy*vx;
 const shell=radius+Math.max(.65,radius*.035),alpha=Math.acos(Math.min(.98,shell/Math.max(shell,distance)));
 for(let strand=0;strand<4;strand++){
  const phi=strand*Math.PI/2+.08*Math.sin(clock*.8),c=Math.cos(phi),s=Math.sin(phi),sx=vx*c+wx*s,sy=vy*c+wy*s,sz=vz*c+wz*s,ca=Math.cos(alpha),sa=Math.sin(alpha),cx=(ux*ca+sx*sa)*shell+center.x,cy=(uy*ca+sy*sa)*shell+center.y,cz=(uz*ca+sz*sa)*shell+center.z,path=paths[strand]??(paths[strand]=[]);
  for(let i=0;i<=16;i++){
   const f=i/16,p=path[i]??(path[i]=new T.Vector3());p.set(tip.x+(cx-tip.x)*f,tip.y+(cy-tip.y)*f,tip.z+(cz-tip.z)*f);const dx=p.x-center.x,dy=p.y-center.y,dz=p.z-center.z,d=Math.hypot(dx,dy,dz);if(d<shell){const scale=shell/Math.max(.0001,d);p.set(center.x+dx*scale,center.y+dy*scale,center.z+dz*scale);}
  }
  for(let i=1;i<=36;i++){
   const f=i/36,a=alpha+f*2.3+.012*Math.sin(clock*19+i*2+strand)*Math.sin(f*Math.PI),r=shell+.08+.13*Math.sin(clock*17+i*3+strand)**2;
   const p=path[16+i]??(path[16+i]=new T.Vector3()),c=Math.cos(a),s=Math.sin(a);p.set((ux*c+sx*s)*r+center.x,(uy*c+sy*s)*r+center.y,(uz*c+sz*s)*r+center.z);
  }
 }
 return paths;
}
