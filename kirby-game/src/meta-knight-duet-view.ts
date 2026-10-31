import * as T from 'three';
import type {KnightBattle} from './meta-knight-battle';
import type {CharacterController} from './controller';
import type {KnightSound} from './meta-knight-sounds';
import {helperPosition} from './meta-knight-helper';
import {DUET,duetActive,duetBossPosition} from './meta-knight-duet';
import {CosmicLightning} from './meta-knight-cosmic-view';
import {MetaKnightBattleMotion} from './meta-knight-battle-motion';
import {knightWarningGlass,knightWarningCountdown} from './meta-knight-warning-material';
import {softMist,softMistMaterial} from './soft-mist';
import {META_KNIGHT_ARENA as SITE} from './meta-knight-arena-site';

type Rig={c:CharacterController;motion:MetaKnightBattleMotion;materials:Map<T.MeshStandardMaterial,{color:T.Color;intensity:number}>;tinted:boolean};
/** Pooled gold electricity follows the two actual sword tips, joins overhead and branches into each marked strike. */
export class MetaKnightDuetView{
 readonly group=new T.Group();readonly light=new T.PointLight(0xffcb4b,0,85,1.5);private lighting=new T.Group();
 readonly bolts=new CosmicLightning();private rigs=new Map<CharacterController,Rig>();
 private diskMaterial=knightWarningGlass(0xffc541);private edgeMaterial=new T.MeshBasicMaterial({color:0xffd66a,transparent:true,opacity:.95,side:T.DoubleSide,toneMapped:false,depthWrite:false});
 private spots:{group:T.Group;disk:T.Mesh;edge:T.Mesh;timer:ReturnType<typeof knightWarningCountdown>}[]=[];
 private energyMaterial=new T.MeshBasicMaterial({color:new T.Color().setRGB(2.0,1.7,.75),toneMapped:false});private energy=new T.Mesh(new T.IcosahedronGeometry(.65,2),this.energyMaterial);
 private coronaMaterial=softMistMaterial(new T.Color().setRGB(1.6,.75,.08),.45);private coronas:T.Mesh[]=[];
 private ringMaterial=new T.MeshBasicMaterial({color:0xffd86f,transparent:true,opacity:.65,side:T.DoubleSide,blending:T.AdditiveBlending,toneMapped:false,depthWrite:false});private halos:T.Mesh[]=[];
 private particles=new T.InstancedMesh(new T.OctahedronGeometry(.10),new T.MeshBasicMaterial({color:0xffdf82,transparent:true,opacity:.85,toneMapped:false,blending:T.AdditiveBlending,depthWrite:false}),96);
 private a=new T.Vector3();private b=new T.Vector3();private tip=new T.Vector3();private merge=new T.Vector3();private dummy=new T.Object3D();private soundKey='';
 constructor(scene:T.Scene,private cue:(kind:KnightSound)=>void){
  this.group.name='Meta Knight united thunderstorm';this.group.visible=false;this.group.position.x=SITE.x;this.lighting.position.x=SITE.x;this.lighting.name='Persistent united thunderstorm lighting';this.lighting.add(this.light);scene.add(this.group,this.lighting);
  this.diskMaterial.uniforms.baseOpacity.value=.14;this.group.add(this.bolts.group,this.energy,this.particles);this.particles.frustumCulled=false;
  for(let i=0;i<3;i++){
   const group=new T.Group(),disk=new T.Mesh(new T.CircleGeometry(DUET.radius,96),this.diskMaterial),edge=new T.Mesh(new T.RingGeometry(DUET.radius-.11,DUET.radius+.13,96),this.edgeMaterial),timer=knightWarningCountdown(DUET.radius,Math.PI,true);
   for(const mesh of [disk,edge,timer]){mesh.rotation.x=-Math.PI/2;group.add(mesh);}edge.position.y=.015;timer.position.y=.025;group.name='United thunderstorm danger disk '+i;this.spots.push({group,disk,edge,timer});this.group.add(group);
   const halo=new T.Mesh(new T.RingGeometry(1,1.025,128),this.ringMaterial);this.halos.push(halo);this.group.add(halo);
   const mist=softMist(this.coronaMaterial);this.coronas.push(mist);this.group.add(mist);
  }
 }
 private rig(c:CharacterController){let rig=this.rigs.get(c);if(!rig){const materials=new Map<T.MeshStandardMaterial,{color:T.Color;intensity:number}>();c.actor.traverse(o=>{if(o instanceof T.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m instanceof T.MeshStandardMaterial&&!materials.has(m))materials.set(m,{color:m.emissive.clone(),intensity:m.emissiveIntensity});});rig={c,motion:new MetaKnightBattleMotion(c.actor),materials,tinted:false};this.rigs.set(c,rig);}return rig;}
 clear(){for(const rig of this.rigs.values()){rig.motion.clear();if(rig.tinted){for(const [m,p] of rig.materials){m.emissive.copy(p.color);m.emissiveIntensity=p.intensity;}rig.tinted=false;}}}
 update(s:KnightBattle|undefined,now:number,boss:CharacterController|undefined,helper:CharacterController|undefined){
  this.clear();if(boss?.actor.parent&&this.group.parent!==boss.actor.parent)boss.actor.parent.add(this.group);if(this.group.parent&&this.lighting.parent!==this.group.parent)this.group.parent.add(this.lighting);this.light.intensity=0;
  const d=s?.duet,active=duetActive(s)&&d?.stage!=='recover';this.group.visible=active;if(!active||!s||!d)return;
  const clock=(now-d.at!)/1000,f=(now-s.since)/Math.max(1,s.until-s.since),gather=d.stage==='gather',rise=gather?0:Math.min(1,(now-d.gatherUntil!)/DUET.chargeMs),power=gather?0:Math.min(1,rise*1.4),strike=d.stage==='strike';
  this.merge.set(0,d.floor!+19,0);this.bolts.begin(.65+.35*power,clock);this.bolts.setFloor(d.floor!+.04);
  const rigActors=[boss,helper];
  rigActors.forEach((c,index)=>{
   if(!c?.isMetaKnight)return;const rig=this.rig(c),point=index===0?duetBossPosition(s,now):s.players[d.owner]?.helper?helperPosition(s.players[d.owner].helper!,now):undefined;
   if(Array.isArray(point))c.actor.position.set(SITE.x+point[0],point[1],point[2]);
   const toward=Math.atan2((index?3.3:-3.3)-(index?d.helperFrom!:d.bossFrom!)[0],-(index?d.helperFrom!:d.bossFrom!)[2]),turn=T.MathUtils.smoothstep(f,.75,1);c.yaw=gather?toward*(1-turn):0;c.actor.rotation.y=c.yaw;
   const clip=gather?s.phase===4?'Fly':'Run':s.phase===4?'Fly':'Idle';if(c.state!==clip)c.setActivity(clip);c.updateActivity(0);
   if(!gather)rig.motion.applyRaisedSword(rise,clock,s.phase===4);c.updateKnightBladeGlow(now,!gather);
   if(!gather){rig.tinted=true;for(const m of rig.materials.keys()){m.emissive.setHex(0xffb82d);m.emissiveIntensity=.15+.25*power;}}
   if(gather)return;
   const blade=c.actor.getObjectByName('Galaxia')!;blade.localToWorld(this.tip.set(-.315,2.05,0));this.group.worldToLocal(this.tip);
   if(rise>.3)for(let k=0;k<3;k++)this.bolts.arc(this.tip,this.merge,791+index*97+k,.065+.045*power,clock,22,.6+.8*power,[Math.sin(clock+k)*.6,1.2,Math.cos(clock+k)*.6]);
   const p=c.actor.position,scale=c.actor.scale.x;for(let band=0;band<3;band++){
    let previous:T.Vector3|undefined;for(let i=0;i<=20;i++){const t=i/20,a=t*Math.PI*4+clock*(2+band*.3)+band*2.1,r=scale*(.85+.12*Math.sin(a*3));this.a.set(p.x-SITE.x+Math.sin(a)*r,p.y+t*scale*2.8,p.z+Math.cos(a)*r);if(previous)this.bolts.segment(previous.x,previous.y,previous.z,this.a.x,this.a.y,this.a.z,.025+.02*power,.5+.5*power);previous??=new T.Vector3();previous.copy(this.a);}
   }
  });
  this.energy.visible=!gather&&rise>.3;this.energy.position.copy(this.merge);this.energy.scale.setScalar((.7+.3*Math.sin(clock*8)**2)*power);this.energy.rotation.set(clock*.4,clock*.7,clock*.2);
  this.coronas.forEach((mist,i)=>{mist.visible=this.energy.visible;mist.position.copy(this.merge);mist.scale.setScalar((4+i*1.5)*(.8+.2*Math.sin(clock*3+i)));mist.rotation.set(i*Math.PI/3,clock*.3,clock*(i%2?-.15:.15));});
  this.halos.forEach((halo,i)=>{halo.visible=!gather;halo.position.copy(this.merge);halo.rotation.set(Math.PI/2+i*.6,clock*.2,clock*(i%2?-.4:.4));halo.scale.setScalar((2.2+i*1.3)*power);});
  if(!gather&&rise>.6){this.a.copy(this.merge);this.b.set(Math.sin(clock*.4)*1.5,d.floor!+31,Math.cos(clock*.4)*1.5);this.bolts.arc(this.a,this.b,144,.13,clock,26,2.3);}
  this.diskMaterial.uniforms.clock.value=clock;this.diskMaterial.uniforms.tint.value.setHex(strike?0xff423c:0xffc541);this.edgeMaterial.color.setHex(strike?0xff4c3c:0xffd66a);
  this.spots.forEach((spot,i)=>{const p=d.spots[i];spot.group.visible=!!p&&(d.stage==='warn'||strike);if(!spot.group.visible||!p)return;spot.group.position.set(p[0],p[1]+.09,p[2]);spot.timer.material.uniforms.progress.value=strike?1:T.MathUtils.clamp(f,0,1);spot.timer.material.uniforms.direction.value=1;
   if(strike){this.a.set(p[0],p[1]+29,p[2]);this.b.set(p[0],p[1]+.12,p[2]);for(let k=0;k<4;k++)this.bolts.arc(this.a,this.b,433+i*71+k,.12+.10*(1-f),clock,30,2.1,[Math.sin(i+k)*1.5,0,Math.cos(i+k)*1.5]);this.a.copy(this.merge);this.b.set(p[0],p[1]+29,p[2]);this.bolts.arc(this.a,this.b,977+i*31,.09,clock,18,1.1);}
  });
  this.particles.visible=!gather;for(let i=0;i<96;i++){const life=(clock*.35+i/96)%1,angle=i*2.399+clock*.4,r=(1-life)*(4+7*Math.sin(i)**2);this.dummy.position.set(Math.sin(angle)*r,d.floor!+4+life*15,Math.cos(angle)*r);this.dummy.rotation.set(clock,i,angle);this.dummy.scale.setScalar(Math.sin(Math.PI*life)*(.4+.4*power));this.dummy.updateMatrix();this.particles.setMatrixAt(i,this.dummy.matrix);}this.particles.instanceMatrix.needsUpdate=true;
  this.light.position.copy(this.merge);this.light.intensity=gather?0:30*power+(strike?50*Math.exp(-f*5):0);this.bolts.end();
  const key=`${d.at}:${d.stage}:${d.round}`;if(key!==this.soundKey){this.soundKey=key;if(d.stage==='charge')this.cue('cosmic-charge');if(d.stage==='warn')this.cue('warn');if(strike){this.cue('cosmic-impact');this.cue('slam');}}
 }
 dispose(){this.clear();this.bolts.dispose();for(const {group,disk,edge,timer} of this.spots){group.removeFromParent();disk.geometry.dispose();edge.geometry.dispose();timer.geometry.dispose();timer.material.dispose();}this.diskMaterial.dispose();this.edgeMaterial.dispose();this.energy.geometry.dispose();this.energyMaterial.dispose();this.coronaMaterial.dispose();for(const halo of this.halos)halo.geometry.dispose();this.ringMaterial.dispose();this.particles.geometry.dispose();this.particles.material.dispose();this.particles.dispose();this.group.removeFromParent();this.lighting.removeFromParent();this.rigs.clear();}
}
