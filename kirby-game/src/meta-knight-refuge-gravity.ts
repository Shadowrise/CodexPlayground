import * as T from 'three';

/** Tangent approaches continue around an inflated surface; every segment clears the solid planet. */
export function refugeGravityPaths(tip:T.Vector3,center:T.Vector3,radius:number,clock:number){
 const toward=tip.clone().sub(center),distance=toward.length(),u=toward.normalize(),up=Math.abs(u.y)>.9?new T.Vector3(0,0,1):new T.Vector3(0,1,0),v=new T.Vector3().crossVectors(u,up).normalize(),w=new T.Vector3().crossVectors(u,v),shell=radius+Math.max(.65,radius*.035),alpha=Math.acos(Math.min(.98,shell/Math.max(shell,distance)));
 return Array.from({length:4},(_,strand)=>{
  const phi=strand*Math.PI/2+.08*Math.sin(clock*.8),side=v.clone().multiplyScalar(Math.cos(phi)).addScaledVector(w,Math.sin(phi)),contact=u.clone().multiplyScalar(Math.cos(alpha)).addScaledVector(side,Math.sin(alpha)).multiplyScalar(shell).add(center),path:T.Vector3[]=[];
  for(let i=0;i<=16;i++){
   const f=i/16,p=tip.clone().lerp(contact,f),offset=p.clone().sub(center),d=offset.length();if(d<shell)p.copy(center).addScaledVector(offset,shell/Math.max(.0001,d));path.push(p);
  }
  for(let i=1;i<=36;i++){
   const f=i/36,a=alpha+f*2.3+.012*Math.sin(clock*19+i*2+strand)*Math.sin(f*Math.PI),r=shell+.08+.13*Math.sin(clock*17+i*3+strand)**2;
   path.push(u.clone().multiplyScalar(Math.cos(a)).addScaledVector(side,Math.sin(a)).multiplyScalar(r).add(center));
  }return path;
 });
}
