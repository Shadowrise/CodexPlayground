import {knightPosition,type KnightActor,type KnightBattle,type KnightPoint} from './meta-knight-battle';
import {knightCosmicAlly} from './meta-knight-cosmic-ally';
import {knightDefeatPose} from './meta-knight-defeat';
import {duetActive,duetBossPosition} from './meta-knight-duet';
import {helperPosition} from './meta-knight-helper';
import {knightCelebration} from './meta-knight-celebration';
import {cosmicHeight} from './meta-knight-cosmic';
import {refugeAngle,refugePlanet,COSMIC_REFUGE} from './meta-knight-cosmic-refuge';

/** These are encounter shots, shared by the helper and every other participant. */
export function knightFormationFrame(s:KnightBattle|undefined,actors:readonly KnightActor[],now:number){
 if(!s)return;
 const points:KnightPoint[]=[],body=(p:KnightPoint,r:number,h:number)=>{for(const x of [-r,r])for(const z of [-r,r])for(const y of [0,h])points.push([p[0]+x,p[1]+y,p[2]+z]);};
 let yaw=0,elevation=.60,kind:string;
 const defeated=knightDefeatPose(s,'boss',now),celebration=knightCelebration(s,'boss',now),duet=duetActive(s),allies=Object.keys(s.players).map(id=>({id,pose:knightCosmicAlly(s,id,now)})).filter(a=>a.pose);
 if(defeated){kind='defeat';yaw=defeated.yaw;body(defeated.p,7,10);for(const id of Object.keys(s.defeat!.helpers)){const p=knightDefeatPose(s,id,now);if(p)body(p.p,1.6,4.8);}}
 else if(celebration){kind='celebration';yaw=0;body(celebration.p,6.4,10);for(const id of Object.keys(s.celebration!.helpers)){const p=knightCelebration(s,id,now);if(p)body(p.p,1.6,4.5);}}
 else if(duet){kind='duet';const d=s.duet!,p=duetBossPosition(s,now)!;body(p,6.4,15);const h=s.players[d.owner]?.helper,small=h&&helperPosition(h,now);if(small)body(small,1.6,5);
  // Keep the five overlapping waves and their lightning inside the same shot.
  body([0,d.floor!,0],43,32);elevation=.75;
 }
 else if(allies.length){const planet=allies[0].pose!.kind==='planet';kind=planet?'planet':'ascent';yaw=planet?refugeAngle(s,now):0;elevation=planet ? .85 : .60;body(knightPosition(s,now),6.4,15);for(const a of allies)body(a.pose!.p,1.6,5);
  if(planet&&['cosmic-planet-draw','cosmic-planet-sweep'].includes(s.stage)){const p=refugePlanet(s,now),r=COSMIC_REFUGE.planetRadius;body([p[0],p[1]-r,p[2]],r,r*2);}
 }
 else return;
 const actorPoint=(a:KnightActor):KnightPoint=>[a.p[0],s.phase===4?cosmicHeight(s,now):a.p[1],a.p[2]];
 for(const a of actors){const p=s.players[a.id];if(!a.available||!p||p.withdrawn||p.side==='boss')continue;body(actorPoint(a),1.6,4.5);}
 // Solo clients have no network roster for the three authoritative AI opponents.
 for(const [id,a] of Object.entries(s.opponents??{}))if(!actors.some(p=>p.id===id)&&!s.players[id]?.withdrawn)body(a.p,1.6,4.5);
 return {kind,yaw:yaw+.12,elevation,points};
}

/** Fit every body and raised blade inside the HUD insets at any screen aspect. */
export function fitKnightFormationCamera(frame:NonNullable<ReturnType<typeof knightFormationFrame>>,width:number,height:number,yaw=frame.yaw,rightInset=0,topInset=120){
 width=Math.max(1,width);height=Math.max(1,height);const fov=height>width?70:55,tan=Math.tan(fov*Math.PI/360),aspect=width/height,upper=1-2*Math.min(topInset,height*.60)/height,lower=-1+2*Math.min(132,height*.22)/height,verticalMiddle=(upper+lower)/2,verticalHalf=(upper-lower)/2;
 const leftLimit=-.88,rightLimit=Math.min(.88,1-2*Math.min(width*.4,Math.max(0,rightInset))/width),horizontalMiddle=(leftLimit+rightLimit)/2,horizontalHalf=(rightLimit-leftLimit)/2;
 const sn=Math.sin(yaw),cs=Math.cos(yaw),se=Math.sin(frame.elevation),ce=Math.cos(frame.elevation),right=[cs,0,-sn],up=[-sn*se,ce,-cs*se],out=[sn*ce,se,cs*ce],dot=(a:readonly number[],b:readonly number[])=>a.reduce((n,v,i)=>n+v*b[i],0);
 const projected=frame.points.map(p=>[dot(p,right),dot(p,up),dot(p,out)]),mid=(i:number)=>(Math.min(...projected.map(p=>p[i]))+Math.max(...projected.map(p=>p[i])))/2,centre=[mid(0),mid(1),mid(2)];
 let distance=24;
 for(const p of projected){const x=p[0]-centre[0],y=p[1]-centre[1],z=p[2]-centre[2];distance=Math.max(distance,(x+rightLimit*tan*aspect*z)/(tan*aspect*horizontalHalf),(-x-leftLimit*tan*aspect*z)/(tan*aspect*horizontalHalf),(y+upper*tan*z)/(tan*verticalHalf),(-y-lower*tan*z)/(tan*verticalHalf));}
 distance+=1.2;centre[0]-=horizontalMiddle*tan*aspect*distance;centre[1]-=verticalMiddle*tan*distance;
 const focus=right.map((v,i)=>v*centre[0]+up[i]*centre[1]+out[i]*centre[2]) as KnightPoint,position=focus.map((v,i)=>v+out[i]*distance) as KnightPoint;
 return {focus,position,fov};
}
