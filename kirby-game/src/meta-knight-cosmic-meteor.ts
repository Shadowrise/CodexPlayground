import {COSMIC,easeCosmic} from './meta-knight-cosmic';

export const COSMIC_METEOR={drawMs:1500,releaseMs:300,speed:34,radius:1.15,reflectMs:240,graceMs:90,gapMs:650,returnMs:650,settleMs:800,bend:6,height:1.25,leadMs:1100,leadFactor:.9,velocityCap:8,sampleMs:60,guidanceMs:350,guidanceStepMs:90,guidanceBlendMs:120,finalLockMs:350,maxGuideStep:1.2,maxGuideOffset:4,hold:[11.5,4.1,2.5] as const} as const;
type Point=[number,number,number];
export type CosmicMeteor={index:number;target:string;aim:Point;yaw:number;at:number;tracking?:{at:number;p:Point;v:Point};launched?:boolean;guideChecked?:number;guidance?:{at:number;offset:Point;blendMs:number}[];returned?:{at:number;from:Point;by:string}};
type State={phase:number;stage:string;since:number;until:number;cosmicMeteor?:CosmicMeteor};
export function cosmicMeteorStage(s:Pick<State,'phase'|'stage'>|undefined){return s?.phase===4&&s.stage.startsWith('cosmic-meteor-');}
const mix=(a:readonly number[],b:readonly number[],t:number)=>a.map((v,i)=>v+(b[i]-v)*t) as Point;
export function meteorHold(yaw:number):Point{const [x,y,z]=COSMIC_METEOR.hold,c=Math.cos(yaw),s=Math.sin(yaw);return [x*c+z*s,COSMIC.height+y,z*c-x*s];}
function buildMeteorPath(m:CosmicMeteor){
 const origin=meteorHold(m.yaw),end=m.aim,dx=end[0]-origin[0],dz=end[2]-origin[2],length=Math.hypot(dx,dz)||1;
 const control:Point=[(origin[0]+end[0])*.5+dz/length*COSMIC_METEOR.bend*2,origin[1]+1.1,(origin[2]+end[2])*.5-dx/length*COSMIC_METEOR.bend*2];
 const basePoint=(u:number):Point=>origin.map((v,i)=>(1-u)**2*v+2*(1-u)*u*control[i]+u*u*end[i]) as Point;
 let arc=0,previous=basePoint(0);for(let i=1;i<=32;i++){const p=basePoint(i/32);arc+=Math.hypot(...p.map((v,j)=>v-previous[j]));previous=p;}
 const hitMs=Math.max(400,arc/COSMIC_METEOR.speed*1000),guidance=m.guidance??[],point=(u:number):Point=>{
  const p=basePoint(u);for(const guide of guidance){let t=Math.max(0,Math.min(1,(u*hitMs-guide.at)/guide.blendMs));t=t*t*(3-2*t);for(let i=0;i<3;i++)p[i]+=guide.offset[i]*t;}return p;
 };let exit=1;
 while(exit<6&&Math.hypot(point(exit)[0],point(exit)[2])<58)exit+=.025;
 return {origin,control,end:point(1),point,hitMs,duration:hitMs*exit};
}
const paths=new WeakMap<CosmicMeteor,{aim:Point;yaw:number;guidance:CosmicMeteor['guidance'];path:ReturnType<typeof buildMeteorPath>}>();
export function meteorPath(m:CosmicMeteor){const cached=paths.get(m);if(cached?.aim===m.aim&&cached.yaw===m.yaw&&cached.guidance===m.guidance)return cached.path;const path=buildMeteorPath(m);paths.set(m,{aim:m.aim,yaw:m.yaw,guidance:m.guidance,path});return path;}
export function meteorGuidanceMs(m:CosmicMeteor){const hit=meteorPath(m).hitMs;return Math.max(0,Math.min(COSMIC_METEOR.guidanceMs,hit*.35,hit-COSMIC_METEOR.finalLockMs));}
function sampleTarget(m:CosmicMeteor,p:readonly number[],now:number){
 const old=m.tracking,dt=old?now-old.at:0;if(old&&dt<COSMIC_METEOR.sampleMs)return;
 const raw:Point=old&&dt<=350?[(p[0]-old.p[0])*1000/dt,0,(p[2]-old.p[2])*1000/dt]:[0,0,0],speed=Math.hypot(raw[0],raw[2]);if(speed>COSMIC_METEOR.velocityCap){raw[0]*=COSMIC_METEOR.velocityCap/speed;raw[2]*=COSMIC_METEOR.velocityCap/speed;}
 const blend=1-Math.exp(-dt/90);m.tracking={at:now,p:[p[0],p[1],p[2]],v:old&&dt<=350?mix(old.v,raw,blend):raw};
}
function predictedTarget(m:CosmicMeteor,p:readonly number[],ms:number):Point{
 const v=m.tracking?.v??[0,0,0],seconds=Math.max(0,Math.min(COSMIC_METEOR.leadMs,ms))/1000*COSMIC_METEOR.leadFactor,q:Point=[p[0]+v[0]*seconds,COSMIC.height+COSMIC_METEOR.height,p[2]+v[2]*seconds],r=Math.hypot(q[0],q[2]),limit=COSMIC.rim+3;if(r>limit){q[0]*=limit/r;q[2]*=limit/r;}return q;
}
/** Only the first short part of flight can steer. Recorded smooth offsets never rewrite the flown wake. */
export function updateMeteorTracking(s:State,p:readonly number[],now:number){
 const m=s.cosmicMeteor;if(!m||!['cosmic-meteor-draw','cosmic-meteor-cast'].includes(s.stage))return false;
 const aimAtRelease=()=>{const yaw=Math.atan2(p[0],p[2]),arrival=meteorPath({...m,aim:[p[0],COSMIC.height+COSMIC_METEOR.height,p[2]],yaw,guidance:undefined}).hitMs,aim=predictedTarget(m,p,arrival);if(Math.hypot(aim[0]-m.aim[0],aim[2]-m.aim[2])>.02||Math.abs(yaw-m.yaw)>.002){m.aim=aim;m.yaw=yaw;return true;}return false;};
 if(!m.launched){
  if(now<m.at||now-m.at<=80){sampleTarget(m,p,now);const changed=aimAtRelease();if(now<m.at)return changed;}
  m.launched=true;m.guideChecked=m.at;return true;
 }
 const elapsed=now-m.at,window=meteorGuidanceMs(m);if(elapsed<0||elapsed>=window)return false;
 sampleTarget(m,p,now);if(now-(m.guideChecked??m.at)<COSMIC_METEOR.guidanceStepMs)return false;m.guideChecked=now;
 const path=meteorPath(m),desired=predictedTarget(m,p,m.at+path.hitMs-now),current=path.end,delta:Point=[desired[0]-current[0],0,desired[2]-current[2]],distance=Math.hypot(delta[0],delta[2]);if(distance<.04)return false;
 const scale=Math.min(1,COSMIC_METEOR.maxGuideStep/distance);delta[0]*=scale;delta[2]*=scale;
 const total:Point=[current[0]-m.aim[0]+delta[0],0,current[2]-m.aim[2]+delta[2]],length=Math.hypot(total[0],total[2]);if(length>COSMIC_METEOR.maxGuideOffset){total[0]*=COSMIC_METEOR.maxGuideOffset/length;total[2]*=COSMIC_METEOR.maxGuideOffset/length;delta[0]=m.aim[0]+total[0]-current[0];delta[2]=m.aim[2]+total[2]-current[2];}
 m.guidance=[...(m.guidance??[]),{at:elapsed,offset:delta,blendMs:Math.min(COSMIC_METEOR.guidanceBlendMs,window-elapsed)}];return true;
}
/** The same curved path drives the mesh, tail, reflection and swept contacts. */
export function meteorPoint(s:State,now:number):Point|undefined{
 const m=s.cosmicMeteor;if(!m||!cosmicMeteorStage(s))return;
 if(s.stage==='cosmic-meteor-draw'){
  const hold=meteorHold(m.yaw),c=Math.cos(m.yaw),sn=Math.sin(m.yaw),far:Point=[64*c+28*sn,COSMIC.height+39,28*c-64*sn];
  return mix(far,hold,easeCosmic((now-s.since)/1050));
 }
 if(s.stage==='cosmic-meteor-return'&&m.returned){
  const t=Math.max(0,Math.min(1,(now-m.returned.at)/COSMIC_METEOR.returnMs)),end:Point=[0,COSMIC.height+3.2,0];
  const p=mix(m.returned.from,end,t);p[1]+=Math.sin(Math.PI*t)*2;return p;
 }
 if(s.stage!=='cosmic-meteor-cast')return;
 if(now<m.at)return meteorHold(m.yaw);
 const path=meteorPath(m),elapsed=now-m.at;if(elapsed>path.duration)return;
 return path.point(Math.max(0,elapsed/path.hitMs));
}
export function meteorContact(s:State,p:readonly number[],now:number,previous:number,bodyRadius=.65){
 const m=s.cosmicMeteor;if(!m||s.stage!=='cosmic-meteor-cast'||now<m.at||previous>m.at+meteorPath(m).duration)return false;
 const path=meteorPath(m),start=Math.max(m.at,previous),end=Math.min(now,m.at+path.duration),steps=Math.max(1,Math.ceil((end-start)/12));
 let a=path.point((start-m.at)/path.hitMs);const radius=COSMIC_METEOR.radius+bodyRadius;
 for(let i=1;i<=steps;i++){
  const b=path.point((start+(end-start)*i/steps-m.at)/path.hitMs),d=b.map((v,j)=>v-a[j]),n=d.reduce((v,x)=>v+x*x,0),body=[p[0],p[1]+COSMIC_METEOR.height,p[2]],t=n?Math.max(0,Math.min(1,d.reduce((v,x,j)=>v+(body[j]-a[j])*x,0)/n)):0;
  if(Math.hypot(...body.map((v,j)=>v-a[j]-d[j]*t))<radius)return true;a=b;
 }return false;
}
