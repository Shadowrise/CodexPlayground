type Point={x:number;z:number};
const mix=(a:Point,b:Point,t:number)=>({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.z-b.z);
const segmentDistance=(p:Point,a:Point,b:Point)=>{
 const dx=b.x-a.x,dz=b.z-a.z,len=dx*dx+dz*dz;
 return distance(p,mix(a,b,len?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/len)):0));
};

/** Startup-only, clearance-tested fillets. Adjacent arcs share the straight
 * span's tangent; obstacles reduce the radius rather than restoring a corner. */
export function roundMeadowPath(source:readonly Point[],free:(x:number,z:number)=>boolean):Point[]{
 if(source.length<3)return [...source];
 const clear=(a:Point,b:Point)=>{
  const n=Math.max(1,Math.ceil(distance(a,b)/.3));
  for(let j=0;j<=n;j++){const p=mix(a,b,j/n);if(!free(p.x,p.z))return false;}return true;
 };
 const points=[source[0]];
 for(let i=0;i<source.length-1;){
  let next=i+1,length=0;
  // Remove tiny grid spurs and fallback zigzags, retaining the broad meanders.
  for(let j=i+1;j<source.length;j++){
   length+=distance(source[j-1],source[j]);if(length>12)break;
   if(source.slice(i+1,j).every(p=>segmentDistance(p,source[i],source[j])<1.2)&&clear(source[i],source[j]))next=j;
  }
  if(distance(points.at(-1)!,source[next])>.001)points.push(source[next]);i=next;
 }
 const result=[points[0]];
 for(let i=1;i<points.length-1;i++){
  const a=points[i-1],p=points[i],b=points[i+1],la=distance(a,p),lb=distance(p,b);
  const cosine=Math.max(-1,Math.min(1,((p.x-a.x)*(b.x-p.x)+(p.z-a.z)*(b.z-p.z))/(la*lb)));
  const angle=Math.acos(cosine);if(angle<.01){result.push(p);continue;}
  let cut=Math.min(6,la*.45,lb*.45),arc:Point[]=[],accepted=false;
  for(let attempt=0;attempt<20;attempt++,cut*=.65){
   const entry=mix(p,a,cut/la),exit=mix(p,b,cut/lb);
   const n=Math.max(3,Math.ceil(cut*2/.65),Math.ceil(angle/(Math.PI/40)));
   arc=Array.from({length:n+1},(_,j)=>mix(mix(entry,p,j/n),mix(p,exit,j/n),j/n));
   if(arc.every(q=>free(q.x,q.z))&&arc.every((q,j)=>!j||clear(arc[j-1],q))){accepted=true;break;}
  }
  if(accepted)result.push(...arc);else result.push(p);
 }
 result.push(points.at(-1)!);
 return result;
}
