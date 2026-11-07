import * as T from 'three';
import {pidgeyAirHeight} from '../src/knight-boss';
import {PIDGEY_MOUTH_LOCAL,PIDGEY_SPIN_EXIT as EXIT} from '../src/metapidgie-cosmic-emitter';

export const LATE_BOSS_CLIPS=[
 ['Boss_shot-warn',1.76],['Boss_shot-recharge',1.56],['Boss_shot',1.8],
 ['Boss_transition-phase3',1.5],['Boss_transition-phase4',1.5],
 ['Boss_star-rise',1.2],['Boss_cross-warn',3],['Boss_cross',.45],['Boss_ricochet-warn',1.55],['Boss_ricochet',.95],['Boss_star-warn',1.55],['Boss_star-fall',1.1],['Boss_shield',2.4],['Boss_crystal-break',1],
 ['Boss_cosmic-charge',2.8],['Boss_cosmic-strike',.85],['Boss_cosmic-surge',1.9],['Boss_cosmic-lift',1.05],['Boss_cosmic-rise',5.6],['Boss_cosmic-flight',.9],
 ['Boss_cosmic-spin-warn',2.8],['Boss_cosmic-spin',.9],['Boss_cosmic-open',2.4],['Boss_cosmic-hit',1],['Boss_cosmic-recover',.8],['Boss_cosmic-descent',3],
 ['Boss_cosmic-meteor-draw',1.5],['Boss_cosmic-meteor-cast',1],['Boss_cosmic-meteor-return',.65],['Boss_cosmic-meteor-gap',.65],['Boss_cosmic-meteor-settle',.8],
 ['Boss_cosmic-star-draw',2.4],['Boss_cosmic-star-open',2.4],['Boss_cosmic-planet-draw',2.4],['Boss_cosmic-planet-sweep',2.4],['Boss_cosmic-planet-break',.8],
 ['Boss_cosmic-star-strike',.65],['Boss_cosmic-star-stun',1],['Boss_cosmic-star-retreat',1.2],['Boss_cosmic-planet-release',1],
] as const;
export const LOOPED_LATE_CLIPS=new Set(['Boss_shield','Boss_cosmic-flight','Boss_cosmic-spin','Boss_cosmic-open','Boss_cosmic-star-open','Boss_cosmic-planet-sweep']);
const ease=(t:number)=>{t=T.MathUtils.clamp(t,0,1);return t*t*t*(t*(t*6-15)+10);};
type Frame={p:T.Vector3;q:T.Quaternion;s:T.Vector3;m?:number[]};
/** Complete native poses: the wing skeleton, volume and armour morphs are sampled together.
 * New bends affect the whole-bird pivot, neck, head, tail and the existing jaw hinge. */
export function createMetapidgieLateClips(root:T.Group,native:T.AnimationClip[],early:T.AnimationClip[]){
 const mixer=new T.AnimationMixer(root),clips=new Map([...native,...early].map(c=>[c.name,c])),nodes=new Map<string,T.Object3D>();
 for(const c of clips.values())for(const track of c.tracks){const b=T.PropertyBinding.parseTrackName(track.name);if(b.nodeName.startsWith('Phase1_'))continue;const n=T.PropertyBinding.findNode(root,b.nodeName);if(n instanceof T.Object3D)nodes.set(n.name,n);}
 const motion=root.getObjectByName('Motion')!,neck=root.getObjectByName('Neck')!,head=root.getObjectByName('Head')!,tail=root.getObjectByName('Tail')!,jaw=root.getObjectByName('Lower_beak')!,beak=root.getObjectByName('Beak')!;
 const capture=()=>new Map([...nodes.values()].map(n=>[n,{p:n.position.clone(),q:n.quaternion.clone(),s:n.scale.clone(),m:n instanceof T.Mesh?n.morphTargetInfluences?.slice():undefined}]));
 const rest=capture();
 function restore(frame:Map<T.Object3D,Frame>){for(const [n,r] of frame){n.position.copy(r.p);n.quaternion.copy(r.q);n.scale.copy(r.s);if(n instanceof T.Mesh&&r.m)for(const [name,i] of Object.entries(n.morphTargetDictionary??{}))if(/Flight_wing_volume|Fitted_pauldron_seat/.test(name))n.morphTargetInfluences![i]=r.m[i];}}
 function sample(name:string,u:number){mixer.stopAllAction();restore(rest);const c=clips.get(name);if(!c)throw Error('Missing approved pose '+name);const a=mixer.clipAction(c).play();a.paused=true;a.time=T.MathUtils.clamp(u,0,1)*c.duration;mixer.update(0);motion.position.y-=name==='Fly'?.55:name.startsWith('Boss_')?pidgeyAirHeight(name.slice(5),u):0;return capture();}
 function blend(a:Map<T.Object3D,Frame>,b:Map<T.Object3D,Frame>,t:number){for(const [n,r] of a){const q=b.get(n)!;n.position.lerpVectors(r.p,q.p,t);n.quaternion.slerpQuaternions(r.q,q.q,t);n.scale.lerpVectors(r.s,q.s,t);if(n instanceof T.Mesh&&r.m&&q.m)r.m.forEach((v,i)=>n.morphTargetInfluences![i]=T.MathUtils.lerp(v,q.m![i],t));}}
 const ready=sample('Boss_get-up',1),raised=sample('Boss_intro',.5),planted=sample('Boss_open-land',0),tired=sample('Boss_stunned',1);
 const q=new T.Quaternion(),pivot=new T.Vector3(0,.9,0),point=new T.Vector3();
 function tilt(pitch:number,bank=0){q.setFromEuler(new T.Euler(pitch,0,bank,'YXZ'));motion.quaternion.premultiply(q);motion.position.applyQuaternion(q).add(pivot.clone().sub(pivot.clone().applyQuaternion(q)));}
 function flight(u:number,seconds:number){restore(sample('Fly',(.125+u*Math.max(1,Math.round(seconds/.9)))%1));neck.rotateX(-.045);head.rotateX(-.04);tail.rotateX(-.08);return capture();}
 function spit(u:number){flight(u,.9);jaw.rotation.x=.46;root.updateMatrixWorld(true);beak.localToWorld(point.fromArray(PIDGEY_MOUTH_LOCAL));root.worldToLocal(point);motion.position.add(new T.Vector3(0,EXIT.height/EXIT.scale,EXIT.radius/EXIT.scale).sub(point));}
 function pose(name:string,u:number,seconds:number){
  const hovering=flight(u,seconds),pulse=Math.sin(Math.PI*u)**2;
  switch(name){
   case 'Boss_shot-warn':case 'Boss_shot-recharge':{restore(sample(name,u));const wind=ease(u/.75);tilt(-.16*wind);neck.rotateX(-.24*wind);head.rotateX(-.23*wind);motion.position.y+=pidgeyAirHeight(name.slice(5),u);break;}
   case 'Boss_shot':{restore(sample(name,u));const time=u*seconds,nod=ease(time/.22),recover=ease((time-.22)/.55),lean=T.MathUtils.lerp(-.16,.22,nod)*(1-recover);tilt(lean);neck.rotateX(T.MathUtils.lerp(-.24,.24,nod)*(1-recover));head.rotateX(T.MathUtils.lerp(-.23,.34,nod)*(1-recover));jaw.rotation.x+=.18*Math.sin(Math.PI*ease(time/.45))**2;motion.position.y+=pidgeyAirHeight(name.slice(5),u);break;}
   case 'Boss_transition-phase3':case 'Boss_transition-phase4':blend(ready,raised,ease(u/.65));jaw.rotation.x=.12*pulse;break;
   case 'Boss_star-rise':blend(ready,hovering,ease(u/.6));tilt(-.12*ease(u));break;
   case 'Boss_cross-warn':blend(hovering,raised,.65*ease(u/.3));head.rotateX(-.22*ease(u/.5));neck.rotateX(-.12*ease(u/.5));jaw.rotation.x=.12*ease(u);break;
   case 'Boss_cross':blend(hovering,raised,.65);head.rotateX(-.22);neck.rotateX(-.12);jaw.rotation.x=.18+.06*pulse;break;
   case 'Boss_ricochet-warn':restore(hovering);tilt(.20*ease(u),-.08*pulse);break;
   case 'Boss_ricochet':restore(hovering);tilt(.25+.30*pulse,.16*Math.sin(2*Math.PI*u));tail.rotateX(-.12*pulse);break;
   case 'Boss_star-warn':restore(hovering);tilt(-.24*ease(u),.13*pulse);head.rotateX(-.10*ease(u));break;
   case 'Boss_star-fall':{const diving=sample('Boss_jump',.45+.55*u);restore(diving);break;}
   case 'Boss_shield':{restore(planted);for(const [n,r] of hovering){if(/^(Left|Right)_wing/.test(n.name)){n.position.copy(r.p);n.quaternion.copy(r.q);n.scale.copy(r.s);}if(n instanceof T.Mesh&&r.m)r.m.forEach((v,i)=>n.morphTargetInfluences![i]=v);}head.rotateX(.012*Math.sin(u*Math.PI*2));break;}
   case 'Boss_crystal-break':blend(planted,tired,ease(u/.4));break;
   case 'Boss_cosmic-charge':blend(raised,raised,0);neck.rotateX(-.23*ease(u/.8));head.rotateX(-.25*ease(u/.8));jaw.rotation.x=.15*ease(u);break;
   case 'Boss_cosmic-strike':{const high=sample('Boss_intro',.5);neck.rotateX(-.23);head.rotateX(-.25);const wind=capture();blend(wind,planted,ease((u-.12)/.52));break;}
   case 'Boss_cosmic-surge':restore(planted);jaw.rotation.x=.06;break;
   case 'Boss_cosmic-lift':blend(planted,raised,ease(u));neck.rotateX(-.23*ease(u));head.rotateX(-.25*ease(u));break;
   case 'Boss_cosmic-rise':blend(raised,hovering,ease(u/.18));tilt(-.16*Math.sin(Math.PI*u));break;
   case 'Boss_cosmic-flight':restore(hovering);break;
   case 'Boss_cosmic-spin-warn':{const start=capture();spit(.125);const end=capture();blend(start,end,ease(u/.78));jaw.rotation.x=.46*ease((u-.25)/.5);break;}
   case 'Boss_cosmic-spin':spit(u);break;
   case 'Boss_cosmic-open':blend(hovering,tired,.68);jaw.rotation.x=.18+.045*Math.sin(u*Math.PI*2);break;
   case 'Boss_cosmic-hit':case 'Boss_cosmic-star-stun':blend(hovering,tired,.75*ease(u/.22));tilt(-.07*pulse,.045*Math.sin(u*Math.PI*4)*(1-u));break;
   case 'Boss_cosmic-recover':blend(tired,hovering,ease(u));break;
   case 'Boss_cosmic-descent':{const release=ease(u/.13),brace=ease((u-.65)/.14);blend(hovering,tired,release);tilt(.24*release*(1-brace),.08*Math.sin(u*Math.PI*5)*(1-brace));if(u>.793){const before=capture();blend(before,tired,ease((u-.793)/.207));}break;}
   case 'Boss_cosmic-meteor-draw':blend(hovering,raised,.60*ease(u/.6));neck.rotateX(-.18*ease(u));head.rotateX(-.15*ease(u));jaw.rotation.x=.16*ease(u);tilt(-.06*ease(u),-.10*pulse);break;
   case 'Boss_cosmic-meteor-cast':restore(hovering);neck.rotateX(.20*pulse);head.rotateX(.18*pulse);jaw.rotation.x=.30*pulse;tilt(.12*pulse);break;
   case 'Boss_cosmic-meteor-return':blend(hovering,tired,.45*ease(u));break;
   case 'Boss_cosmic-meteor-gap':case 'Boss_cosmic-meteor-settle':restore(hovering);break;
   case 'Boss_cosmic-star-draw':case 'Boss_cosmic-planet-draw':blend(hovering,raised,.70*ease(u/.55));neck.rotateX(-.20*ease(u/.5));head.rotateX(-.22*ease(u/.5));jaw.rotation.x=.18*ease(u);break;
   case 'Boss_cosmic-star-open':case 'Boss_cosmic-planet-sweep':blend(hovering,raised,.70);neck.rotateX(-.20);head.rotateX(-.22);jaw.rotation.x=.18;break;
   case 'Boss_cosmic-planet-break':case 'Boss_cosmic-star-strike':restore(hovering);tilt(-.12*pulse);jaw.rotation.x=.12;break;
   case 'Boss_cosmic-star-retreat':case 'Boss_cosmic-planet-release':restore(hovering);head.rotateX(-.08*pulse);break;
  }
  root.updateMatrixWorld(true);
 }
 const result=LATE_BOSS_CLIPS.map(([name,seconds])=>{
  const count=Math.ceil(seconds*90),times=Array.from({length:count+1},(_,i)=>seconds*i/count),rows=[...nodes.values()].map(n=>({n,p:[] as number[],q:[] as number[],s:[] as number[],m:[] as number[]}));
  for(let i=0;i<=count;i++){pose(name,i/count,seconds);for(const r of rows){r.n.position.toArray(r.p,r.p.length);r.n.quaternion.toArray(r.q,r.q.length);r.n.scale.toArray(r.s,r.s.length);if(r.n instanceof T.Mesh&&r.n.morphTargetInfluences)r.m.push(...r.n.morphTargetInfluences);}}
  const tracks:T.KeyframeTrack[]=[];for(const r of rows){const n=T.PropertyBinding.sanitizeNodeName(r.n.name);tracks.push(new T.VectorKeyframeTrack(n+'.position',times,r.p),new T.QuaternionKeyframeTrack(n+'.quaternion',times,r.q),new T.VectorKeyframeTrack(n+'.scale',times,r.s));if(r.m.length)tracks.push(new T.NumberKeyframeTrack(n+'.morphTargetInfluences',times,r.m));}
  return new T.AnimationClip(name,seconds,tracks).optimize();
 });
 mixer.stopAllAction();mixer.uncacheRoot(root);restore(rest);return result;
}
