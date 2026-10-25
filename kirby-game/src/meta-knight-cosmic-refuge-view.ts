import * as T from 'three';
import type {KnightBattle} from './meta-knight-battle';
import {easeCosmic} from './meta-knight-cosmic';
import {COSMIC_WORLDS} from './meta-knight-cosmic-world';
import {COSMIC_REFUGE as R,cosmicRefugeStage,refugeStar,refugePlanet,refugePlanetAngle,refugeStrike,refugeRebound,refugeForehead,refugeOpen} from './meta-knight-cosmic-refuge';
import {CosmicLightning} from './meta-knight-cosmic-view';
import {CosmicPlasma} from './meta-knight-cosmic-plasma';
import {CentipedeTargetCue} from './centipede-target-cue';
import {refugeGravityPaths} from './meta-knight-refuge-gravity';
import {MetaKnightPlanetBurst} from './meta-knight-planet-burst';
import {makeFruitMist} from './fruit-mist';
import {detailedPlanetGeometry,detailPlanetMaterial} from './meta-knight-planet-detail';
function copyAsset(source:T.Object3D){const copy=source.clone(true);copy.traverse(o=>{if(o instanceof T.Mesh){o.geometry=o.geometry.clone();o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();}else if(o instanceof T.Sprite)o.material=o.material.clone();});return copy;}
function disposeAsset(root:T.Object3D){root.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());}else if(o instanceof T.Sprite)o.material.dispose();});root.removeFromParent();}
/** Existing worlds enter the fight; response effects share the authoritative collision clock. */
export class MetaKnightCosmicRefugeView{
 readonly group=new T.Group();readonly target=new CentipedeTargetCue();readonly gravity=new CosmicLightning(true);readonly burst=new MetaKnightPlanetBurst();readonly trail=new CosmicPlasma();
 readonly dome=new T.Mesh(new T.SphereGeometry(R.domeRadius,56,36),new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,toneMapped:false,uniforms:{clock:{value:0},strength:{value:0}},vertexShader:'varying vec3 p;varying vec3 n;varying vec3 v;void main(){p=position;n=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);v=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',fragmentShader:'uniform float clock;uniform float strength;varying vec3 p;varying vec3 n;varying vec3 v;void main(){float rim=pow(1.-abs(dot(normalize(n),normalize(v))),2.2);float latitude=abs(sin(atan(p.z,p.x)*18.+sin(p.y*2.)*.25)),bands=abs(sin(p.y*4.+clock*.6));float grid=(1.-smoothstep(.035,.095,min(latitude,bands)))*.16;float wave=pow(max(0.,1.-abs(length(p.xz)-mod(clock*2.,5.2))*2.),3.)*.10;gl_FragColor=vec4(mix(vec3(1.,.55,.06),vec3(1.,.91,.42),rim),strength*(.025+rim*.58+grid+wave));}'}));
 private starSource:T.Object3D;readonly star:T.Object3D;private sources:T.Mesh[]=[];private planet?:T.Mesh;private world=-1;private round='';private captured='';private destroyed=new Set<number>();private battleId=0;
 private starStart=new T.Vector3();private planetStart=new T.Vector3();private startRadius=0;private startAngle=0;private initialRadius=0;
 private p=new T.Vector3();private q=new T.Vector3();private tip=new T.Vector3();private sourcePoint=new T.Vector3();
 private foreheadFlash=makeFruitMist(0);
 get chunks(){return this.burst.group;}
 constructor(scene:T.Scene,private blade:T.Object3D){
  this.group.name='Moving refuge star, shared golden dome and rolling planet';
  this.starSource=scene.getObjectByName('Background refuge star')!.parent!;this.star=copyAsset(this.starSource);this.star.name='Interactive moving refuge star';
  this.sources=COSMIC_WORLDS.map(w=>scene.getObjectByName(w.name) as T.Mesh);this.target.group.name='Moving star available hit target';this.target.group.scale.setScalar(1.55);
  this.foreheadFlash.material=this.foreheadFlash.material.clone();this.foreheadFlash.material.color.set('#fff0ad');this.foreheadFlash.material.blending=T.AdditiveBlending;
  this.dome.name='Shared moving golden refuge';this.group.add(this.star,this.dome,this.target.group,this.gravity.group,this.burst.group,this.trail.group,this.foreheadFlash);this.group.visible=false;
 }
 private bindPlanet(index:number){
  if(this.world===index&&this.planet)return;this.planet&&disposeAsset(this.planet);this.world=index;
  this.planet=copyAsset(this.sources[index]) as T.Mesh;this.planet.name='Captured rolling '+COSMIC_WORLDS[index].name;this.group.add(this.planet);
  this.planet.geometry.dispose();this.planet.geometry=detailedPlanetGeometry(index);
  const material=detailPlanetMaterial(this.planet.material as T.ShaderMaterial);this.burst.bindSurface(material,index);material.uniforms.fracture={value:0};
  material.fragmentShader='uniform float fracture;\n'+material.fragmentShader.replace('color+=emission;', 'color+=emission;float split=1.-smoothstep(.006,.025,plateEdge(d*7.3+vec3(seed)));color+=vec3(3.,1.1,.25)*split*fracture;');
 }
 private worldPoint(node:T.Object3D,out:T.Vector3){node.getWorldPosition(out);return this.group.worldToLocal(out);}
 update(s:KnightBattle|undefined,now:number,camera?:T.Camera){
  if(s?.id!==this.battleId||s?.phase!==4){this.destroyed.clear();this.sources.forEach(p=>p.visible=true);this.battleId=s?.id??0;}
  const active=!!s&&!!s.cosmicRefuge&&(cosmicRefugeStage(s)||s.stage==='cosmic-descent'&&s.cosmicRefuge.hitAt!==undefined);this.group.visible=active;
  if(!active){this.starSource.visible=true;this.sources.forEach((p,i)=>p.visible=!this.destroyed.has(i));this.round=this.captured='';return;}
  const r=s.cosmicRefuge!,stage=s.stage,f=Math.max(0,Math.min(1,(now-s.since)/(s.until-s.since))),clock=(now-r.at)/1000,key=`${s.id}:${r.at}`,impact=r.impactAt,age=impact===undefined?-1:now-impact;
  if(this.round!==key){this.round=key;this.worldPoint(this.starSource,this.starStart);this.bindPlanet(r.world);this.captured='';if(s.cycle===0)this.destroyed.delete(r.world);}
  this.starSource.visible=false;this.worldPoint(this.starSource,this.sourcePoint);this.p.fromArray(refugeStar(s,now));let starScale=.55;
  const starAt=(time:number)=>r.hitAt!==undefined&&time>=r.hitAt?refugeRebound(s,time,this.sourcePoint.toArray()):refugeStrike(s,time);
  if(stage==='cosmic-star-draw'){const t=easeCosmic(f);this.p.lerpVectors(this.starStart,this.p,t);starScale=T.MathUtils.lerp(1,.55,t);}
  else if(impact!==undefined){this.p.fromArray(starAt(now));if(r.hitAt!==undefined)starScale=T.MathUtils.lerp(.55,1,easeCosmic((now-r.hitAt)/(R.stunMs+R.retreatMs)));}
  else if(stage==='cosmic-star-retreat'){this.p.lerpVectors(new T.Vector3().fromArray(refugeStar(s,s.since)),this.sourcePoint,easeCosmic(f));starScale=T.MathUtils.lerp(.55,1,easeCosmic(f));}
  this.star.position.copy(this.p);this.star.scale.setScalar(starScale);this.star.rotation.set(.08*Math.sin(clock),clock*1.7,.08*Math.sin(clock*2));
  if(impact!==undefined&&camera){this.star.quaternion.copy(this.group.getWorldQuaternion(new T.Quaternion()).invert()).multiply(camera.getWorldQuaternion(new T.Quaternion()));this.star.rotateZ(clock*4.5);this.star.rotateY(.15*Math.sin(clock*3));}
  const hitAge=r.hitAt===undefined?-1:now-r.hitAt;this.foreheadFlash.visible=hitAge>=0&&hitAge<300;if(this.foreheadFlash.visible){this.foreheadFlash.position.fromArray(refugeForehead(s));this.foreheadFlash.scale.setScalar(3+hitAge*.012);this.foreheadFlash.material.opacity=.7*Math.exp(-hitAge/65);}
  this.target.group.visible=refugeOpen(s);if(this.target.group.visible){this.target.update(this.q.copy(this.p).add(new T.Vector3(0,1.1,0)),now,camera,true,f);this.target.arrow.position.y=2.1+.08*Math.sin(clock*4);}
  const shielding=r.activatedAt!==undefined&&(impact===undefined||age<180)&&!['cosmic-star-retreat','cosmic-star-stun','cosmic-descent'].includes(stage);
  this.dome.visible=shielding;this.dome.position.fromArray(refugeStar(s,impact??now));this.dome.material.uniforms.clock.value=clock;
  this.dome.material.uniforms.strength.value=easeCosmic((now-(r.activatedAt??now))/250)*(impact===undefined?1:Math.max(0,1-age/180));this.dome.scale.setScalar(.94+.06*easeCosmic((now-(r.activatedAt??now))/250));
  const hasPlanet=['cosmic-planet-draw','cosmic-planet-sweep','cosmic-planet-release'].includes(stage);this.planet!.visible=hasPlanet||age>=0&&age<130;
  if(hasPlanet&&this.captured!==key){this.captured=key;this.worldPoint(this.sources[r.world],this.planetStart);this.startRadius=Math.hypot(this.planetStart.x,this.planetStart.z);this.startAngle=Math.atan2(this.planetStart.x,this.planetStart.z);this.initialRadius=COSMIC_WORLDS[r.world].radius;}
  if(hasPlanet||impact!==undefined){
   this.sources[r.world].visible=false;this.q.fromArray(refugePlanet(s,impact??now));let radius:number=R.planetRadius;
   if(stage==='cosmic-planet-draw'){
    const t=easeCosmic(f),endAngle=refugePlanetAngle(s,now),angle=this.startAngle+Math.atan2(Math.sin(endAngle-this.startAngle),Math.cos(endAngle-this.startAngle))*t,d=T.MathUtils.lerp(this.startRadius,R.planetOrbit,t);
    this.q.set(Math.sin(angle)*d,T.MathUtils.lerp(this.planetStart.y,R.starHeight,t),Math.cos(angle)*d);radius=T.MathUtils.lerp(this.initialRadius,R.planetRadius,t);
   }else if(stage==='cosmic-planet-release'){
    this.worldPoint(this.sources[r.world],this.sourcePoint);this.q.lerpVectors(new T.Vector3().fromArray(refugePlanet(s,s.since)),this.sourcePoint,easeCosmic(f));radius=T.MathUtils.lerp(R.planetRadius,this.initialRadius,easeCosmic(f));
   }
   this.planet!.position.copy(this.q);this.planet!.scale.setScalar(radius/COSMIC_WORLDS[r.world].radius);const planetClock=((impact??now)-r.at)/1000;
   this.planet!.rotation.set(planetClock*.14,planetClock*.12,refugePlanetAngle(s,impact??now)*-1.15);
   const material=this.planet!.material as T.ShaderMaterial;material.uniforms.clock.value=clock;material.uniforms.surfaceDetail.value=stage==='cosmic-planet-draw'?easeCosmic(f):1;material.uniforms.fracture.value=impact!==undefined?1:stage==='cosmic-planet-sweep'?easeCosmic((now-s.until+260)/260):0;
  }
  if(impact!==undefined){this.destroyed.add(r.world);this.burst.update(age,new T.Vector3().fromArray(refugePlanet(s,impact)),new T.Vector3().fromArray(refugeStar(s,impact)),r.world,camera,this.planet!.quaternion);}else this.burst.group.visible=false;
  this.trail.begin(clock);if(impact!==undefined&&age>0){for(let i=0;i<12;i++){const b=now-i*16,a=Math.max(impact,b-16);if(b<impact)break;this.p.fromArray(starAt(a));this.q.fromArray(starAt(b));this.trail.add(this.p,this.q,.65*(1-i/15),.75*(1-i/12),i);}}this.trail.end();
  this.gravity.begin(1,clock);this.blade.localToWorld(this.tip.set(-.315,2.05,0));this.group.worldToLocal(this.tip);
  if(stage==='cosmic-star-draw')for(let i=0;i<6;i++){this.p.copy(this.star.position).add(new T.Vector3(Math.sin(clock*4+i)*.5,Math.cos(clock*5+i)*.5,Math.cos(clock*4+i)*.5));this.gravity.arc(this.tip,this.p,821+i,.045,clock,24,2,[0,2,0]);}
  if(stage==='cosmic-planet-draw'||stage==='cosmic-planet-sweep'){
   const radius=COSMIC_WORLDS[r.world].radius*this.planet!.scale.x;
   for(const path of refugeGravityPaths(this.tip,this.planet!.position,radius,clock))for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i];this.gravity.segment(a.x,a.y,a.z,b.x,b.y,b.z,.055+.014*Math.sin(clock*21+i)**2);}
  }this.gravity.end();
 }
 dispose(){this.starSource.visible=true;this.sources.forEach(p=>p.visible=true);disposeAsset(this.star);this.planet&&disposeAsset(this.planet);this.gravity.dispose();this.burst.dispose();this.trail.dispose();this.foreheadFlash.material.dispose();this.target.group.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();(o.material as T.Material).dispose();}});this.dome.geometry.dispose();this.dome.material.dispose();this.group.removeFromParent();}
}
