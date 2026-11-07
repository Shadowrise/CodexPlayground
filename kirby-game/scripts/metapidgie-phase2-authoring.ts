import * as T from 'three';
import {pidgeyAirHeight} from '../src/knight-boss';

export const PHASE_TWO_CLIPS=[
 ['Boss_dash-warn',1.6],['Boss_dash-warn-recharge',1.36],['Boss_dash',.7],['Boss_open-flight',2.625],
 ['Boss_dive-warn',1.92],['Boss_dive',.45],['Boss_transition-phase2',1.5],
 ['Boss_duet-gather',2.2],['Boss_duet-charge',3],['Boss_duet-warn',3.2],['Boss_duet-strike',.65],['Boss_duet-gap',1.2],['Boss_duet-recover',3],
] as const;
const ease=(u:number)=>{u=T.MathUtils.clamp(u,0,1);return u*u*u*(u*(u*6-15)+10);};
type Frame={p:T.Vector3;q:T.Quaternion;s:T.Vector3;m?:number[]};
/** Bake complete poses from approved Idle/Fly/Run and corrected first-phase poses.
 * Wing bones and their volume/armour morphs are always sampled together.
 * Only the whole bird's Motion pivot, neck and tail receive new offsets.
 */
export function createMetapidgiePhaseTwoClips(root:T.Group,native:T.AnimationClip[],phaseOne:T.AnimationClip[]){
 const mixer=new T.AnimationMixer(root),clips=new Map([...native,...phaseOne].map(c=>[c.name,c]));
 const nodes=new Map<string,T.Object3D>();
 for(const clip of clips.values())for(const track of clip.tracks){
  const binding=T.PropertyBinding.parseTrackName(track.name);if(binding.nodeName.startsWith('Phase1_'))continue;
  const node=T.PropertyBinding.findNode(root,binding.nodeName);if(node instanceof T.Object3D)nodes.set(node.name,node);
 }
 const motion=root.getObjectByName('Motion')!,head=root.getObjectByName('Head')!,neck=root.getObjectByName('Neck')!,tail=root.getObjectByName('Tail')!;
 const rest=new Map<T.Object3D,Frame>();for(const node of nodes.values())rest.set(node,{p:node.position.clone(),q:node.quaternion.clone(),s:node.scale.clone(),m:node instanceof T.Mesh?node.morphTargetInfluences?.slice():undefined});
 const snapshot=()=>new Map([...nodes.values()].map(node=>[node,{p:node.position.clone(),q:node.quaternion.clone(),s:node.scale.clone(),m:node instanceof T.Mesh?node.morphTargetInfluences?.slice():undefined}]));
 function restore(frame:Map<T.Object3D,Frame>){for(const [node,row] of frame){node.position.copy(row.p);node.quaternion.copy(row.q);node.scale.copy(row.s);if(node instanceof T.Mesh&&row.m)row.m.forEach((v,i)=>{node.morphTargetInfluences![i]=v;});}}
 function sample(name:string,u:number){
  mixer.stopAllAction();restore(rest);const clip=clips.get(name)!;if(!clip)throw Error('Missing approved source '+name);
  const action=mixer.clipAction(clip).play();action.paused=true;action.time=T.MathUtils.clamp(u,0,1)*clip.duration;mixer.update(0);
  // Keep pivot compensation, remove the source clip's vertical trajectory.
  motion.position.y-=name==='Fly'?.55:name.startsWith('Boss_')?pidgeyAirHeight(name.slice(5),u):0;
  return snapshot();
 }
 const ready=sample('Boss_get-up',1),planted=sample('Boss_open-land',0),raised=sample('Boss_intro',.5),tired=sample('Boss_stunned',1);
 function blend(a:Map<T.Object3D,Frame>,b:Map<T.Object3D,Frame>,u:number){
  for(const [node,first] of a){const last=b.get(node)!;node.position.lerpVectors(first.p,last.p,u);node.quaternion.slerpQuaternions(first.q,last.q,u);node.scale.lerpVectors(first.s,last.s,u);
   if(node instanceof T.Mesh&&first.m&&last.m)first.m.forEach((v,i)=>{node.morphTargetInfluences![i]=T.MathUtils.lerp(v,last.m![i],u);});
  }
 }
 function orient(pitch:number,bank=0){
  const pivot=new T.Vector3(0,.9,0);motion.quaternion.setFromEuler(new T.Euler(pitch,0,bank,'YXZ'));
  motion.position.copy(pivot).sub(pivot.clone().applyQuaternion(motion.quaternion));
 }
 function pose(name:string,u:number,seconds:number){
  const fly=clips.get('Fly')!,cycles=Math.max(1,Math.round(seconds/.85)),wingPhase=(.125+u*cycles)%1;
  const flight=sample('Fly',wingPhase);neck.rotateX(-.045);head.rotateX(-.04);tail.rotateX(-.08);const hovering=snapshot();
  const lean=.32;
  switch(name){
   case 'Boss_dash-warn':blend(ready,hovering,ease(u/.38));orient(lean*ease(u/.65));break;
   case 'Boss_dash-warn-recharge':restore(hovering);orient(lean-.10*Math.sin(Math.PI*u)**2);break;
   case 'Boss_dash':
    restore(hovering);orient(lean+.26*Math.sin(Math.PI*u)**2,.13*Math.sin(Math.PI*2*u)*Math.sin(Math.PI*u));
    neck.rotateX(-.07*Math.sin(Math.PI*u)**2);head.rotateX(-.06*Math.sin(Math.PI*u)**2);tail.rotateX(-.12*Math.sin(Math.PI*u)**2);break;
   case 'Boss_open-flight':
    blend(hovering,ready,ease(u/.42));orient(lean*(1-ease(u/.20))-.055*Math.sin(Math.PI*Math.min(1,u/.42))**2);
    break;
   case 'Boss_dive-warn':{
    const apex=sample('Boss_jump',.45);blend(ready,hovering,ease(u/.34));const lift=snapshot();blend(lift,apex,ease((u-.68)/.32));
    motion.position.y+=pidgeyAirHeight('dive-warn',u);break;
   }
   case 'Boss_dive':{
    // Reuse the tested full-body pitch and ground-peck armour correctives.
    restore(sample('Boss_jump',.45+.55*u));motion.position.y+=pidgeyAirHeight('dive',u);break;
   }
   case 'Boss_transition-phase2':
    blend(ready,raised,ease(u/.35)*(1-ease((u-.72)/.28)));{
     const signal=snapshot();blend(signal,flight,.72*Math.sin(Math.PI*u)**2);orient(-.06*Math.sin(Math.PI*u)**2);
    }break;
   case 'Boss_duet-gather':restore(sample('Run',(u*Math.round(seconds/clips.get('Run')!.duration))%1));break;
   case 'Boss_duet-charge':blend(ready,raised,ease(u/.86));break;
   case 'Boss_duet-warn':case 'Boss_duet-gap':restore(raised);break;
   case 'Boss_duet-strike':restore(raised);head.rotateX(.10*Math.sin(Math.PI*u)**2);neck.rotateX(.06*Math.sin(Math.PI*u)**2);orient(-.055*Math.sin(Math.PI*u)**2);break;
   case 'Boss_duet-recover':blend(raised,tired,ease(u/.25));{const start=snapshot();blend(start,ready,ease((u-.62)/.38));}break;
   default:restore(planted);
  }
  root.updateMatrixWorld(true);
 }
 const result=PHASE_TWO_CLIPS.map(([name,seconds])=>{
  const count=Math.ceil(seconds*90),times=Array.from({length:count+1},(_,i)=>i/count*seconds),rows=[...nodes.values()].map(node=>({node,p:[] as number[],q:[] as number[],s:[] as number[],m:[] as number[]}));
  for(let i=0;i<=count;i++){pose(name,i/count,seconds);for(const row of rows){row.node.position.toArray(row.p,row.p.length);row.node.quaternion.toArray(row.q,row.q.length);row.node.scale.toArray(row.s,row.s.length);if(row.node instanceof T.Mesh&&row.node.morphTargetInfluences)row.m.push(...row.node.morphTargetInfluences);}}
  const tracks:T.KeyframeTrack[]=[];for(const row of rows){
   const n=T.PropertyBinding.sanitizeNodeName(row.node.name);tracks.push(new T.VectorKeyframeTrack(n+'.position',times,row.p),new T.QuaternionKeyframeTrack(n+'.quaternion',times,row.q),new T.VectorKeyframeTrack(n+'.scale',times,row.s));
   if(row.m.length)tracks.push(new T.NumberKeyframeTrack(n+'.morphTargetInfluences',times,row.m));
  }
  return new T.AnimationClip(name,seconds,tracks).optimize();
 });
 mixer.stopAllAction();mixer.uncacheRoot(root);restore(rest);return result;
}
