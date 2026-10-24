import * as T from 'three';
import type {CharacterController} from './controller';
import {KNIGHT,knightDashHalfWidth,knightPosition,knightProjectile,knightShotOrigin,knightProgress,knightImpactProgress,knightStartCount,knightJumpOpening,knightPressureWave,type KnightBattle,type KnightPoint} from './meta-knight-battle';
import {META_KNIGHT_ARENA as SITE} from './meta-knight-arena-site';
import {t} from './i18n';
import {MetaKnightCrescent,MetaKnightCrescentLaunch} from './meta-knight-crescent';
import {MetaKnightSwordSwing,knightSwordAngle,knightSwordDirection} from './meta-knight-sword-swing';
import {MetaKnightBattleMotion} from './meta-knight-battle-motion';
import {MetaKnightDazedStars} from './meta-knight-dazed-stars';
import {MetaKnightDashSparks} from './meta-knight-dash-sparks';
import {MetaKnightStarAssaultView} from './meta-knight-star-assault-view';
import {starFacing,starOpening} from './meta-knight-star-assault';
import {MetaKnightPressureWave} from './meta-knight-shield-view';
import {SHIELD} from './meta-knight-shield';
import {KnightCancelHold} from './meta-knight-cancel-hold';
import {CentipedeTargetCue} from './centipede-target-cue';
import {crystalPoint} from './meta-knight-shield';
import type {KnightSound} from './meta-knight-sounds';
import {MetaKnightPartyHud,type KnightProfile} from './meta-knight-party-hud';
import {MetaKnightImpactLightning} from './meta-knight-impact-lightning';
import {KNIGHT_WARNING_STYLE} from './meta-knight-warning-style';
import './meta-knight-battle.css';

const AMBER=KNIGHT_WARNING_STYLE.gold,CORAL=KNIGHT_WARNING_STYLE.red,CYAN=0x7ceaff;
const FX=KNIGHT.effectScale;
const material=(color:number,opacity=1)=>new T.MeshBasicMaterial({color,transparent:opacity<1,opacity,side:T.DoubleSide,depthWrite:false,toneMapped:false});
/** Saturated translucent glass: a tinted centre, brighter edges and a soft glint. */
function glass(color:number,lane=false){
 return new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,toneMapped:false,
  uniforms:{tint:{value:new T.Color(color)},activeTint:{value:new T.Color(CORAL)},lane:{value:lane?1:0},clock:{value:0},span:{value:1},width:{value:KNIGHT.laneHalfWidth*2},progress:{value:-1},baseOpacity:{value:KNIGHT_WARNING_STYLE.opacity}},
  vertexShader:'varying vec2 glassUv;void main(){glassUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`varying vec2 glassUv;uniform vec3 tint;uniform vec3 activeTint;uniform float lane;uniform float clock;uniform float span;uniform float width;uniform float progress;uniform float baseOpacity;
  void main(){vec2 p=glassUv*2.-1.;float edge=smoothstep(.12,1.,length(p));float mask=1.;float rim=0.;float timer=0.;float front=0.;
   if(lane>.5){vec2 point=(glassUv-.5)*vec2(width,span+width);float radius=width*.5;
    float distanceToEdge=length(vec2(point.x,max(abs(point.y)-span*.5,0.)))-radius;
    mask=1.-smoothstep(-.015,.015,distanceToEdge);if(mask<.001)discard;
    edge=pow(clamp(1.+distanceToEdge/radius,0.,1.),1.7);rim=1.-smoothstep(.025,.085,abs(distanceToEdge));
    if(progress>=0.){float along=(span*.5+radius-point.y)/(span+width);float ribbon=1.-smoothstep(.12,.20,abs(distanceToEdge+.20));
     timer=ribbon*(1.-smoothstep(progress-.004,progress+.004,along))*step(.0001,progress);front=exp(-pow((along-progress)*45.,2.))*timer;}}
   float glint=1.-smoothstep(.025,.16,abs(glassUv.x*.62+glassUv.y*.38-.54));
   float sheen=.5+.5*sin(glassUv.y*8.+clock*.6);
   vec3 colour=tint+vec3(.07,.055,.025)*glint+vec3(.10,.075,.025)*rim;
   colour=mix(colour,activeTint+vec3(.35,.22,.09)*front,timer);
   gl_FragColor=vec4(colour,max(max(baseOpacity+.25*edge+.065*glint+.025*sheen,rim*.98),timer*.98)*mask);
   #include <colorspace_fragment>
  }`});
}
/** A rounded red ribbon fills the outer arc in the direction of the coming cut. */
function swordCountdown(radius=KNIGHT.slashRadius-.035*FX,half:number=KNIGHT.slashHalfAngle,full=false){
 const width=.14*FX;
 const mesh=new T.Mesh(new T.RingGeometry(radius-width-.04,radius+width+.04,96,1,-half-(full?0:.06),half*2+(full?0:.12)),new T.ShaderMaterial({
  transparent:true,depthWrite:false,side:T.DoubleSide,toneMapped:false,
  uniforms:{progress:{value:0},direction:{value:-1},radius:{value:radius},width:{value:width},halfAngle:{value:half},tint:{value:new T.Color(CORAL)}},
  vertexShader:'varying vec2 arcPoint;void main(){arcPoint=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`varying vec2 arcPoint;uniform float progress;uniform float direction;uniform float radius;uniform float width;uniform float halfAngle;uniform vec3 tint;
   void main(){if(progress<.0001)discard;
    vec2 p=vec2(arcPoint.x,arcPoint.y*direction);float angle=atan(p.y,p.x);float end=mix(-halfAngle,halfAngle,progress);
    float closest=clamp(angle,-halfAngle,end);vec2 centre=radius*vec2(cos(closest),sin(closest));float distanceToArc=length(p-centre);
    distanceToArc=min(distanceToArc,length(p-radius*vec2(cos(-halfAngle),sin(-halfAngle))));
    float mask=1.-smoothstep(width-.025,width+.025,distanceToArc);if(mask<.001)discard;
    float front=exp(-pow((angle-end)*radius/(width*2.8),2.));float rim=smoothstep(width*.25,width,distanceToArc);
    vec3 colour=tint*(.92+.08*rim)+vec3(.40,.21,.12)*front+vec3(.09,.045,.035)*(1.-rim);
    gl_FragColor=vec4(colour,mask*.97);
    #include <colorspace_fragment>
   }`,
 }));
 mesh.name='Meta Knight sword wind-up countdown';mesh.renderOrder=2;return mesh;
}
/** Every mesh is reused; attack paths are the same geometry as the shared rules. */
export class MetaKnightBattleView{
 readonly group=new T.Group();
 readonly hud=document.createElement('section');
 private countdown=document.createElement('div');
 private phase=document.createElement('span');private health=document.createElement('div');private fill=document.createElement('i');private hint=document.createElement('p');
 private party=new MetaKnightPartyHud();private lightning=new MetaKnightImpactLightning();private floorWarnings=new T.Group();
 private partyLayout=new ResizeObserver(()=>this.placeParty());
 private placeParty(){this.party.element.style.setProperty('--knight-hud-bottom',`${Math.ceil(this.hud.getBoundingClientRect().bottom)+12}px`);}
 updateParty(s:KnightBattle|undefined,id:string,profiles:readonly KnightProfile[],visible:boolean){this.party.update(s,id,profiles,visible);}
 private cancelHold=new KnightCancelHold();private events=new AbortController();
 private impactKey='';private impactPoint=new T.Vector3();private impactHilt=new T.Vector3();private impactTip=new T.Vector3();
 get cancelProgress(){return this.cancelHold.progress;}
 private amber=glass(AMBER);private redGlass=glass(CORAL);private amberLane=glass(AMBER,true);private redLane=glass(CORAL,true);private coral=material(CORAL,.95);
 private sector=new T.Mesh(new T.RingGeometry(.1,KNIGHT.slashRadius,48,1,-KNIGHT.slashHalfAngle,KNIGHT.slashHalfAngle*2),this.amber);
 private sectorEdge=new T.Mesh(new T.RingGeometry(KNIGHT.slashRadius-.11*FX,KNIGHT.slashRadius+.025*FX,48,1,-KNIGHT.slashHalfAngle,KNIGHT.slashHalfAngle*2),material(AMBER));
 private sectorSides=[new T.Mesh(new T.PlaneGeometry(.07*FX,KNIGHT.slashRadius),material(AMBER)),new T.Mesh(new T.PlaneGeometry(.07*FX,KNIGHT.slashRadius),material(AMBER))];
 private sectorHalo=new T.Mesh(new T.RingGeometry(KNIGHT.slashRadius-.27*FX,KNIGHT.slashRadius+.16*FX,48,1,-KNIGHT.slashHalfAngle,KNIGHT.slashHalfAngle*2),material(AMBER,.19));
 private sectorCountdown=swordCountdown();
 private impactCountdown=swordCountdown(KNIGHT.impactRadius,Math.PI,true);
 private slash=new T.Mesh(new T.RingGeometry(2*FX,KNIGHT.slashRadius,48,1,-.06,.12),this.coral);
 private lane=new T.Mesh(new T.PlaneGeometry(1,1),this.amberLane);
 private arrows:T.Mesh[]=[];
 private target=new T.Mesh(new T.RingGeometry(KNIGHT.impactRadius-.1*FX,KNIGHT.impactRadius+.025*FX,64),material(AMBER));
 private targetFill=new T.Mesh(new T.CircleGeometry(KNIGHT.impactRadius,64),this.amber);
 private wave=new MetaKnightPressureWave();
 private crescent=new MetaKnightCrescent();private projectile=this.crescent.group;private crescentLaunch=new MetaKnightCrescentLaunch();
 private shadow=new T.Mesh(new T.CircleGeometry(1.25*FX,32),material(0x080b25,.38));
 private dazedStars=new MetaKnightDazedStars();private assault=new MetaKnightStarAssaultView();
 private bossTarget=new CentipedeTargetCue();private crystalTarget=new CentipedeTargetCue();
 private particles=new T.InstancedMesh(new T.OctahedronGeometry(.11*FX),material(CYAN),22);private burstAt=-1e9;private burstPosition=new T.Vector3();
 private lastStage='';private lastHealth=12;private lastLife=5;private lastInvulnerable=0;private lastReflects=0;private lastBattle=0;private lastKey='';
 private shotSoundAt=-1;private lastCount='';
 private lastShieldPulse='';
 private matrix=new T.Matrix4();private position=new T.Vector3();private scale=new T.Vector3();private quaternion=new T.Quaternion();
 private swordSwing:MetaKnightSwordSwing;
 private motion:MetaKnightBattleMotion;
 private dashSparks:MetaKnightDashSparks;
 constructor(private knight:CharacterController,scene:T.Scene,private onCancel:()=>void,private cue:(kind:KnightSound)=>void){
  this.assault.bindCrystals(scene);
  this.swordSwing=new MetaKnightSwordSwing(knight.actor);
  this.motion=new MetaKnightBattleMotion(knight.actor);this.impactCountdown.name='Meta Knight impact countdown';
  this.dashSparks=new MetaKnightDashSparks(knight.actor.getObjectByName('Galaxia')!);
  this.lane.name='Meta Knight dash countdown lane';
  this.group.name='Meta Knight duel telegraphs and effects';this.group.position.x=SITE.x;scene.add(this.group);
  this.floorWarnings.name='Meta Knight floor warnings behind characters';this.floorWarnings.renderOrder=-1;this.group.add(this.floorWarnings);
  for(const mesh of [this.sector,this.sectorEdge,this.sectorHalo,this.sectorCountdown,this.impactCountdown,...this.sectorSides,this.slash,this.lane,this.target,this.targetFill,this.shadow]){mesh.rotation.x=-Math.PI/2;mesh.position.y=.09;this.floorWarnings.add(mesh);}this.group.add(this.wave.group,this.lightning.group);
  // Draw chevrons after the transparent warning glass, within the floor group.
  for(let i=0;i<8;i++){const shape=new T.Shape();shape.moveTo(-.35,-.4);shape.lineTo(0,0);shape.lineTo(.35,-.4);shape.lineTo(.35,-.15);shape.lineTo(0,.25);shape.lineTo(-.35,-.15);shape.closePath();const arrow=new T.Mesh(new T.ShapeGeometry(shape),material(KNIGHT_WARNING_STYLE.arrow,KNIGHT_WARNING_STYLE.arrowOpacity));arrow.renderOrder=3;arrow.name=`Meta Knight danger arrow ${i}`;arrow.rotation.x=-Math.PI/2;this.arrows.push(arrow);this.floorWarnings.add(arrow);}
  this.group.add(this.projectile,this.particles,this.dazedStars.group,this.assault.group,this.bossTarget.group,this.crystalTarget.group,this.crescentLaunch.group);this.particles.frustumCulled=false;
  this.bossTarget.group.name='Meta Knight available hit target';this.crystalTarget.group.name='Violet crystal available hit target';this.bossTarget.group.scale.setScalar(2.7);this.crystalTarget.group.scale.setScalar(2.7);
  this.hud.id='knight-battle-hud';this.hud.dataset.i18nIgnore='';this.hud.setAttribute('aria-label',t('Бой с Метакнайтом'));
  const title=document.createElement('strong');title.textContent=t('Метакнайт');const top=document.createElement('div');top.className='knight-battle-top';top.append(title,this.phase);
  this.health.className='knight-health';this.health.setAttribute('role','progressbar');this.health.setAttribute('aria-label',t('Здоровье Метакнайта'));this.health.setAttribute('aria-valuemin','0');this.health.setAttribute('aria-valuemax','12');this.health.append(this.fill);
  this.hint.className='knight-hint';this.hint.setAttribute('aria-live','polite');
  const clearHold=()=>this.cancelHold.reset();window.addEventListener('blur',clearHold,{signal:this.events.signal});document.addEventListener('visibilitychange',clearHold,{signal:this.events.signal});
  this.hud.append(top,this.health,this.hint);document.body.append(this.hud);this.partyLayout.observe(this.hud);window.addEventListener('resize',()=>this.placeParty(),{signal:this.events.signal});
  this.countdown.id='knight-battle-countdown';this.countdown.hidden=true;this.countdown.dataset.i18nIgnore='';this.countdown.setAttribute('role','status');this.countdown.setAttribute('aria-live','polite');this.countdown.setAttribute('aria-atomic','true');document.body.append(this.countdown);
 }
 private burst(now:number,p:T.Vector3){this.burstAt=now;this.burstPosition.copy(p);}
 update(s:KnightBattle|undefined,id:string,now:number,dt:number,near:boolean,attackKey:string,visible:boolean,withdrawn=false,cancelSource?:string,camera?:T.Camera){
  const participant=!!s?.players[id]&&!s.players[id].withdrawn&&!withdrawn,active=participant&&!!s&&!['won','lost','cancelled'].includes(s.stage);
  const enabled=active&&visible&&!document.hidden&&document.hasFocus();
  const confirmed=this.cancelHold.update(enabled?s?.id:undefined,enabled?cancelSource:undefined,dt);
  if(confirmed){this.onCancel();return;}
  const count=knightStartCount(s,now),label=count==='fight'?t('БОЙ!'):count;
  this.countdown.hidden=!visible||!participant||!label;
  const beat=s&&count?`${s.id}:${count}`:'';
  if(beat&&beat!==this.lastCount&&visible&&participant){this.lastCount=beat;this.cue(count==='fight'?'start':'count');}
  if(label&&this.countdown.textContent!==label){this.countdown.textContent=label;this.countdown.dataset.fight=String(count==='fight');if(!matchMedia('(prefers-reduced-motion: reduce)').matches)this.countdown.animate([{transform:'translate(-50%,-50%) scale(1.15)'},{transform:'translate(-50%,-50%) scale(1)'}],{duration:180,easing:'ease-out'});}
  this.hud.hidden=!visible||withdrawn&&!!s&&['won','lost'].includes(s.stage);this.group.visible=visible;if(!visible){this.dashSparks.update(0,false);this.knight.updateKnightBladeGlow(now,false,false);return;}
  const p:KnightPoint=s?knightPosition(s,now):[0,0,-9],stage=s?.stage??'idle',f=s?knightProgress(s,now):0;
  const landed=!!s&&knightJumpOpening(s),impact=stage==='slam'||landed&&now-s!.since<180;
  const player=s?.players[id],participating=!!player&&!withdrawn&&!player.withdrawn,hp=player?.hp??5,reflects=player?.reflects??0;
  this.knight.actor.position.set(SITE.x+p[0],p[1],p[2]);this.knight.yaw=s?starFacing(s,now):0;this.knight.actor.rotation.y=this.knight.yaw;
  this.motion.clear();if(this.lastBattle!==(s?.id??0))this.swordSwing.reset();else this.swordSwing.clear();
  const clip=['won','open','stunned','crystal-break'].includes(stage)?'Sitting':stage==='get-up'||s&&starOpening(s)?'Idle':stage==='approach'?'Run':stage==='jump'?'Jump':s?.pattern==='star'||['dash','dash-warn','dive','dive-warn','shot','shot-warn','return'].includes(stage)||stage==='rest'&&s?.pattern==='crescent'?'Fly':'Idle';
  if(this.lastStage!==stage||this.lastBattle!==(s?.id??0)){
   this.knight.setActivity(clip);
   if(stage.endsWith('-warn'))this.cue('warn');if(stage==='won')this.cue('win');if(stage==='return')this.cue('reflect');
   if(stage==='slash')this.cue('slash');if(stage==='dash')this.cue('thrust');if(stage==='dive')this.cue('dash');if(stage==='slam'||landed)this.cue('slam');if(stage==='shot')this.cue('slash');if(stage==='transition')this.cue('phase');
   if(stage==='cross')this.cue('crystal');if(stage==='ricochet')this.cue('thrust');if(stage==='star-rise'||stage==='star-fall')this.cue('constellation');if(stage==='shield')this.cue('slam');
   if(stage==='shield')this.cue('shield');if(stage==='crystal-break')this.cue('shatter');
   this.lastStage=stage;
  }
  this.knight.updateActivity(dt);this.knight.actor.scale.setScalar(KNIGHT.modelScale);
  if(s?.stage==='shield'&&now-s.since>=SHIELD.interval){const pulse=`${s.id}:${s.since}:${Math.floor((now-s.since)/SHIELD.interval)}`;if(pulse!==this.lastShieldPulse){this.lastShieldPulse=pulse;this.cue('wave');}}
  if(s){this.swordSwing.apply(s,f);this.motion.apply(s,f);}this.dazedStars.update(p,now,stage==='won'||stage==='stunned'||stage==='crystal-break');
  this.knight.updateDuelDazedPose(now,stage==='won'||stage==='stunned'||stage==='crystal-break',false);
  this.bossTarget.group.visible=stage==='open'&&s?.phase!==3&&!s?.openHit;this.crystalTarget.group.visible=stage==='shield'&&s?.activeCrystal!==undefined;
  if(this.bossTarget.group.visible){this.bossTarget.update([p[0],p[1]+3.2,p[2]],now,camera,true,f);this.bossTarget.arrow.position.y=1.4+.04*Math.sin(now*.003);}
  if(this.crystalTarget.group.visible){const target=crystalPoint(s!.activeCrystal!);target[1]=3.2;this.crystalTarget.update(target,now,camera,true);this.crystalTarget.arrow.position.y=1.4+.04*Math.sin(now*.003);}
  this.dashSparks.update(s?now-s.since:0,stage==='dash'||stage==='ricochet');
  this.knight.updateKnightBladeGlow(now,s?.pattern==='star'&&stage!=='open'||['slash-warn','slash','jump-warn','jump','dash-warn','dash','shot-warn','shot','dive-warn','dive'].includes(stage));
  const blade=this.knight.actor.getObjectByName('Galaxia')!;
  if(s&&(knightJumpOpening(s)||stage==='slam'||stage==='shield')){
   const key=`${s.id}:${s.since}:${stage}`;if(key!==this.impactKey){
    this.impactKey=key;this.motion.clear();this.motion.apply(s,0);
    blade.localToWorld(this.impactTip.set(-.315,2.05,0));blade.getWorldPosition(this.impactHilt);
    const span=this.impactHilt.y-this.impactTip.y;this.impactPoint.copy(this.impactHilt).lerp(this.impactTip,span>.001?T.MathUtils.clamp(this.impactHilt.y/span,0,1):1);this.impactPoint.x-=SITE.x;
    this.motion.clear();this.motion.apply(s,f);
   }
  }
  blade.localToWorld(this.position.set(-.315,2.05,0));this.position.x-=SITE.x;this.assault.update(s,now,this.position);this.lightning.update(s,now,this.impactPoint);this.crescentLaunch.update(s,now,this.position);
  this.shadow.position.set(p[0],.075,p[2]);this.shadow.scale.setScalar(1+Math.max(0,p[1])*.1);
  for(const m of [this.amber,this.redGlass,this.amberLane,this.redLane])m.uniforms.clock.value=now/1000;
  for(const mesh of [this.sector,this.sectorEdge,this.sectorHalo,this.sectorCountdown,this.impactCountdown,...this.sectorSides,this.slash,this.lane,this.target,this.targetFill,this.projectile,...this.arrows])mesh.visible=false;this.wave.group.visible=false;
  if(s){
   const yaw=s.yaw;
   if(stage==='slash-warn'||stage==='slash'){
    const active=stage==='slash',colour=active?CORAL:AMBER;this.sector.material=active?this.redGlass:this.amber;
    const direction=knightSwordDirection(s);this.sectorCountdown.visible=true;this.sectorCountdown.position.set(p[0],.16,p[2]);this.sectorCountdown.rotation.set(-Math.PI/2,0,yaw-Math.PI/2);
    this.sectorCountdown.material.uniforms.progress.value=active?1:f;this.sectorCountdown.material.uniforms.direction.value=direction;
    for(const mesh of [this.sector,this.sectorEdge,this.sectorHalo]){mesh.visible=true;mesh.position.set(p[0],mesh===this.sector ? .09 : .115,p[2]);mesh.rotation.set(-Math.PI/2,0,yaw-Math.PI/2);if(mesh!==this.sector)(mesh.material as T.MeshBasicMaterial).color.setHex(colour);}
    this.sectorSides.forEach((mesh,i)=>{const a=yaw+(i?1:-1)*KNIGHT.slashHalfAngle;mesh.visible=true;mesh.position.set(p[0]+Math.sin(a)*KNIGHT.slashRadius/2,.12,p[2]+Math.cos(a)*KNIGHT.slashRadius/2);mesh.rotation.set(-Math.PI/2,0,a);(mesh.material as T.MeshBasicMaterial).color.setHex(colour);});
    for(let i=0;i<3;i++){const arrow=this.arrows[i],a=yaw-.65+i*.65;arrow.visible=true;arrow.scale.setScalar(1.35*FX);arrow.position.set(p[0]+Math.sin(a)*4.35*FX,.15,p[2]+Math.cos(a)*4.35*FX);arrow.rotation.set(-Math.PI/2,0,a+Math.PI*(1+direction/2));(arrow.material as T.MeshBasicMaterial).color.setHex(colour);}
    if(stage==='slash'){this.slash.visible=true;this.slash.position.set(p[0],this.swordSwing.tip.y,p[2]);this.slash.rotation.set(-Math.PI/2,0,yaw-Math.PI/2+knightSwordAngle(s,f));}
   }
   if(stage==='dash-warn'||stage==='dash'){
    const dx=s.to[0]-s.from[0],dz=s.to[2]-s.from[2],d=Math.hypot(dx,dz),a=Math.atan2(dx,dz),width=knightDashHalfWidth(s)*2;
    this.lane.visible=true;this.lane.position.set((s.from[0]+s.to[0])/2,.1,(s.from[2]+s.to[2])/2);this.lane.rotation.set(-Math.PI/2,0,a);this.lane.scale.set(width,d+width,1);
    const colour=stage==='dash'?CORAL:AMBER;
    for(let i=0;i<this.arrows.length;i++){const arrow=this.arrows[i],t=(i+.5)/this.arrows.length;arrow.visible=true;arrow.scale.setScalar(1.5*FX);arrow.position.set(s.from[0]+dx*t,.15,s.from[2]+dz*t);arrow.rotation.set(-Math.PI/2,0,a+Math.PI);(arrow.material as T.MeshBasicMaterial).color.setHex(colour);}
    this.lane.material=stage==='dash'?this.redLane:this.amberLane;this.lane.material.uniforms.width.value=width;this.lane.material.uniforms.span.value=d;this.lane.material.uniforms.progress.value=stage==='dash'?1:f;
   }
   if(['jump-warn','jump','dive-warn','dive','slam'].includes(stage)||impact){
    this.impactCountdown.visible=true;this.impactCountdown.position.set(s.to[0],.17,s.to[2]);this.impactCountdown.material.uniforms.progress.value=impact?1:knightImpactProgress(s,now);this.impactCountdown.material.uniforms.direction.value=1;
    for(const mesh of [this.target,this.targetFill]){mesh.visible=true;mesh.position.set(s.to[0],mesh===this.target ? .14 : .12,s.to[2]);}this.targetFill.material=impact?this.redGlass:this.amber;
    (this.target.material as T.MeshBasicMaterial).color.setHex(impact?CORAL:AMBER);
    for(let i=0;i<4;i++){const arrow=this.arrows[i],a=i*Math.PI/2;arrow.visible=true;arrow.scale.setScalar(1.1*FX);arrow.position.set(s.to[0]+Math.sin(a)*3.2*FX,.15,s.to[2]+Math.cos(a)*3.2*FX);arrow.rotation.set(-Math.PI/2,0,a);(arrow.material as T.MeshBasicMaterial).color.setHex(AMBER);}
   }
   const wave=knightPressureWave(s,now);if(wave){
    this.wave.update(Math.max(.1,wave.radius),now,KNIGHT.waveHeight/SHIELD.waveHeight);this.wave.group.position.set(wave.origin[0],0,wave.origin[2]);
   }
   const shot=knightProjectile(s,now);if(shot){
    if(stage==='shot'&&this.shotSoundAt!==s.since){this.shotSoundAt=s.since;this.cue('shot');}
    this.projectile.visible=true;this.projectile.position.fromArray(shot);const a=stage==='return'?Math.atan2(s.to[0]-shot[0],s.to[2]-shot[2]):s.yaw;this.projectile.rotation.set(0,a-Math.PI/2,0);this.crescent.update(now,stage==='return');
   }
   if(this.lastBattle===s.id){if(s.hp<this.lastHealth){this.cue('hit');this.burst(now,new T.Vector3(p[0],FX,p[2]));}if(hp<this.lastLife&&participating&&(player?.invulnerable??0)>this.lastInvulnerable)this.cue('hurt');if(reflects>this.lastReflects){const shot=knightProjectile(s,now);this.burst(now,shot?new T.Vector3().fromArray(shot):new T.Vector3(...p));}}
   this.lastHealth=s.hp;this.lastLife=hp;this.lastInvulnerable=player?.invulnerable??0;this.lastReflects=reflects;
  }
  this.lastBattle=s?.id??0;
  this.particles.visible=now-this.burstAt<700;for(let i=0;i<22&&this.particles.visible;i++){const life=(now-this.burstAt)/700,a=i*2.399;this.position.copy(this.burstPosition).add(new T.Vector3(Math.cos(a)*life*2*FX,(life*2-life*life*1.5)*FX,Math.sin(a)*life*2*FX));this.scale.setScalar(1-life);this.matrix.compose(this.position,this.quaternion,this.scale);this.particles.setMatrixAt(i,this.matrix);}this.particles.instanceMatrix.needsUpdate=true;
  const key=[s?.id??0,s?.revision??0,stage,hp,near,withdrawn,attackKey,t('Метакнайт')].join(':');if(key===this.lastKey)return;this.lastKey=key;
  const finished=stage==='won'||stage==='lost'||stage==='cancelled';
  this.hud.querySelector('strong')!.textContent=t('Метакнайт');this.health.setAttribute('aria-label',t('Здоровье Метакнайта'));this.health.hidden=!s||finished;
  this.hud.dataset.phase=String(s?.phase??0);this.phase.textContent=s?t(['Дуэль','Крылья','Звёздный натиск'][s.phase-1]):t('Вызов рыцаря');this.fill.style.width=`${(s?.hp??12)/12*100}%`;this.health.setAttribute('aria-valuenow',String(s?.hp??12));
  const hints:Partial<Record<typeof stage,string>>={'intro':'Увидеть замах → уклониться → ответить','approach':'Следи за мечом и держись рядом','slash-warn':'Выйди из сектора взмаха','slash':'Дождись конца связки','jump-warn':'Выйди из отмеченного круга','jump':'Выйди из отмеченного круга','wave':'Прыгай или перелетай низкую волну','dash-warn':'Уходи поперёк золотой полосы','dash':'Следующий заход готовится отдельно','dive-warn':'Выйди из отмеченного круга','dive':'Пикирование!','shot-warn':'Золотой полумесяц можно отбить атакой','shot':'Нажми {0} перед касанием полумесяца','return':'Отбито! Полумесяц летит в Метакнайта','open':'Защита открыта! Подойди и нажми {0}','transition':'Новая фаза — приготовься','won':'Победа! Метакнайт уважает твоё мастерство','lost':'Попытка окончена. Попробуем ещё раз?'};
  Object.assign(hints,{'star-rise':'Кристаллы пробуждаются — следи за лучами','cross-warn':'Выйди из жёлтых треугольников','cross':'Следующий кристалл уже заряжается','ricochet-warn':'Три прицельных перелёта — уходи с полосы','ricochet':'Уходи с отмеченной полосы','star-warn':'Выйди из круга — рыцарь создаёт щит','star-fall':'Приземление! Купол закроет центр','shield':'Волны идут к щиту! Пройди в разрыв и ударь фиолетовый кристалл · {1}/4','crystal-break':'Кристалл разбит! Приготовься к новому заходу','stunned':'Попадание! Метакнайт потерял здоровье','get-up':'Метакнайт поднимается — приготовься'});
  this.hint.textContent=stage==='cancelled'?t('Дуэль прервана. Ты остаёшься на арене.'):!s?t(near?'Начни дуэль: движение, прыжок и обычная атака':'Подойди к Метакнайту, чтобы начать дуэль'):!participating?t('Идёт дуэль. Дождись следующей попытки'):hp===0&&!finished?t('Сердца закончились. Наблюдай за друзьями'):t(hints[stage]??'Следи за мечом и держись рядом').replace('{0}',attackKey).replace('{1}',String(4-(s?.hp??4)));
 }
 dispose(){this.events.abort();this.partyLayout.disconnect();this.party.dispose();this.lightning.dispose();this.cancelHold.reset();this.motion.clear();this.swordSwing.reset();this.dashSparks.dispose();this.assault.dispose();this.wave.dispose();this.countdown.remove();this.hud.remove();this.dazedStars.dispose();this.crescent.dispose();this.group.removeFromParent();const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();this.group.traverse(o=>{if(o instanceof T.Mesh){geometries.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));}});for(const m of [this.amber,this.redGlass,this.amberLane,this.redLane,this.coral])materials.add(m);geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}
}
