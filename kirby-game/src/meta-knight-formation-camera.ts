import {type KnightActor,type KnightBattle,type KnightPoint} from './meta-knight-battle';
import {knightCosmicAlly} from './meta-knight-cosmic-ally';
import {knightDefeatPose} from './meta-knight-defeat';
import {duetActive} from './meta-knight-duet';
import {helperPosition} from './meta-knight-helper';
import {knightCelebration} from './meta-knight-celebration';
import {knightGatherYaw,knightFormationSide} from './meta-knight-staging';

export function knightFormationFrame(s:KnightBattle|undefined,actors:readonly KnightActor[],now:number,localId?:string){
 if(!s||s.stage==='won'||s.stage==='cancelled')return;
 const id=localId??actors.find(a=>s.players[a.id]?.side==='boss')?.id,actor=actors.find(a=>a.id===id),player=id?s.players[id]:undefined;
 if(!actor||!player||player.withdrawn)return;
 const defeat=knightDefeatPose(s,id!,now),celebration=knightCelebration(s,id!,now),ally=knightCosmicAlly(s,id!,now),duet=duetActive(s);
 const active=defeat||celebration||duet||Object.keys(s.players).some(id=>knightCosmicAlly(s,id,now));if(!active)return;
 let p:KnightPoint=[...actor.p],heading=actor.yaw,kind='ascent';
 if(defeat){p=defeat.p;heading=defeat.yaw;kind='defeat';}
 else if(celebration){p=celebration.p;heading=celebration.yaw;kind='celebration';}
 else if(duet&&s.duet?.owner===id){const d=s.duet!,h=player.helper;p=h&&helperPosition(h,now)||p;heading=d.stage==='gather'?knightGatherYaw(d.helperFrom!,knightFormationSide(3.3,d.yaw??0,d.floor!),d.yaw??0,(now-d.at!)/Math.max(1,d.gatherUntil!-d.at!)):d.yaw??0;kind='duet';}
 else if(ally){p=ally.p;heading=ally.yaw;kind=ally.kind;}
 // Ordinary opponents keep their own shoulder viewpoint during the same scene.
 return {kind,yaw:heading+Math.PI,anchor:p,points:[p],elevation:.30};
}
/** Bounded shoulder distance: opponents outside the view never force the camera away. */
export function fitKnightFormationCamera(frame:NonNullable<ReturnType<typeof knightFormationFrame>>,width:number,height:number,yaw=frame.yaw,rightInset=0,topInset=120){
 const portrait=height>width,distance=portrait?36:32,sn=Math.sin(yaw),cs=Math.cos(yaw),shoulder=frame.kind==='celebration'?0:3.2;
 // HUD accommodation shifts the composition, not its distance from the player.
 const shift=Math.min(2,Math.max(0,rightInset)/Math.max(1,width)*5),lift=Math.min(3,Math.max(0,topInset)/Math.max(1,height)*6),p=frame.anchor;
 const position:KnightPoint=[p[0]+sn*distance+cs*(shoulder+shift),p[1]+10,p[2]+cs*distance-sn*(shoulder+shift)];
 const focus:KnightPoint=[p[0]-sn*7+cs*(shoulder+shift),p[1]+9.5+lift,p[2]-cs*7-sn*(shoulder+shift)];
 return {focus,position,fov:portrait?76:60};
}
