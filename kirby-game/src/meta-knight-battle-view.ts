import * as T from 'three';
import type {CharacterController} from './controller';
import {KNIGHT,knightPosition,knightProjectile,knightProgress,type KnightBattle} from './meta-knight-battle';
import {META_KNIGHT_ARENA as SITE} from './meta-knight-arena-site';
import {t} from './i18n';
import {MetaKnightCrescent} from './meta-knight-crescent';
import type {KnightSound} from './meta-knight-sounds';
import './meta-knight-battle.css';

const AMBER=0xffbd32,CORAL=0xff4863,CYAN=0x7ceaff;
const FX=KNIGHT.effectScale;
const material=(color:number,opacity=1)=>new T.MeshBasicMaterial({color,transparent:opacity<1,opacity,side:T.DoubleSide,depthWrite:false,toneMapped:false});
/** Saturated translucent glass: a tinted centre, brighter edges and a soft glint. */
function glass(color:number,lane=false){
 return new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,toneMapped:false,
  uniforms:{tint:{value:new T.Color(color)},lane:{value:lane?1:0},clock:{value:0},span:{value:1},width:{value:KNIGHT.laneHalfWidth*2}},
  vertexShader:'varying vec2 glassUv;void main(){glassUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`varying vec2 glassUv;uniform vec3 tint;uniform float lane;uniform float clock;uniform float span;uniform float width;
  void main(){vec2 p=glassUv*2.-1.;float edge=smoothstep(.12,1.,length(p));float mask=1.;float rim=0.;
   if(lane>.5){vec2 point=(glassUv-.5)*vec2(width,span+width);float radius=width*.5;
    float distanceToEdge=length(vec2(point.x,max(abs(point.y)-span*.5,0.)))-radius;
    mask=1.-smoothstep(-.015,.015,distanceToEdge);if(mask<.001)discard;
    edge=pow(clamp(1.+distanceToEdge/radius,0.,1.),1.7);rim=1.-smoothstep(.025,.085,abs(distanceToEdge));}
   float glint=1.-smoothstep(.025,.16,abs(glassUv.x*.62+glassUv.y*.38-.54));
   float sheen=.5+.5*sin(glassUv.y*8.+clock*.6);
   vec3 colour=mix(tint*.88,tint,edge)+vec3(.07,.055,.025)*glint+vec3(.10,.075,.025)*rim;
   gl_FragColor=vec4(colour,max(.46+.25*edge+.065*glint+.025*sheen,rim*.98)*mask);
   #include <colorspace_fragment>
  }`});
}
/** Every mesh is reused; attack paths are the same geometry as the shared rules. */
export class MetaKnightBattleView{
 readonly group=new T.Group();
 readonly hud=document.createElement('section');readonly actions=document.createElement('div');
 private phase=document.createElement('span');private health=document.createElement('div');private fill=document.createElement('i');private hearts=document.createElement('span');private hint=document.createElement('p');
 private start=document.createElement('button');private cancel=document.createElement('button');
 private amber=glass(AMBER);private redGlass=glass(CORAL);private amberLane=glass(AMBER,true);private redLane=glass(CORAL,true);private coral=material(CORAL,.95);private cyan=material(CYAN,.8);
 private sector=new T.Mesh(new T.RingGeometry(.1,KNIGHT.slashRadius,48,1,-KNIGHT.slashHalfAngle,KNIGHT.slashHalfAngle*2),this.amber);
 private sectorEdge=new T.Mesh(new T.RingGeometry(KNIGHT.slashRadius-.11*FX,KNIGHT.slashRadius+.025*FX,48,1,-KNIGHT.slashHalfAngle,KNIGHT.slashHalfAngle*2),material(AMBER));
 private sectorSides=[new T.Mesh(new T.PlaneGeometry(.07*FX,KNIGHT.slashRadius),material(AMBER)),new T.Mesh(new T.PlaneGeometry(.07*FX,KNIGHT.slashRadius),material(AMBER))];
 private sectorHalo=new T.Mesh(new T.RingGeometry(KNIGHT.slashRadius-.27*FX,KNIGHT.slashRadius+.16*FX,48,1,-KNIGHT.slashHalfAngle,KNIGHT.slashHalfAngle*2),material(AMBER,.19));
 private slash=new T.Mesh(new T.RingGeometry(2*FX,KNIGHT.slashRadius,48,1,-.06,.12),this.coral);
 private lane=new T.Mesh(new T.PlaneGeometry(1,1),this.amberLane);
 private arrows:T.Mesh[]=[];
 private target=new T.Mesh(new T.RingGeometry(KNIGHT.impactRadius-.1*FX,KNIGHT.impactRadius+.025*FX,64),material(AMBER));
 private targetFill=new T.Mesh(new T.CircleGeometry(KNIGHT.impactRadius,64),this.amber);
 private wave=new T.Mesh(new T.TorusGeometry(1,.065,5,96),this.coral);
 private waveGlow=new T.Mesh(new T.TorusGeometry(1,.13,5,96),material(CORAL,.18));
 private crescent=new MetaKnightCrescent();private projectile=this.crescent.group;
 private shadow=new T.Mesh(new T.CircleGeometry(1.25*FX,32),material(0x080b25,.38));
 private opening=new T.Mesh(new T.TorusGeometry(2*FX,.045*FX,5,64),this.cyan);
 private stars:T.Mesh[]=[];private crystals:T.Mesh[]=[];
 private particles=new T.InstancedMesh(new T.OctahedronGeometry(.11*FX),material(CYAN),22);private burstAt=-1e9;private burstPosition=new T.Vector3();
 private lastStage='';private lastHealth=12;private lastLife=5;private lastReflects=0;private lastBattle=0;private lastKey='';
 private matrix=new T.Matrix4();private position=new T.Vector3();private scale=new T.Vector3();private quaternion=new T.Quaternion();
 constructor(private knight:CharacterController,scene:T.Scene,onStart:()=>void,onCancel:()=>void,private cue:(kind:KnightSound)=>void){
  this.group.name='Meta Knight duel telegraphs and effects';this.group.position.x=SITE.x;scene.add(this.group);
  for(const mesh of [this.sector,this.sectorEdge,this.sectorHalo,...this.sectorSides,this.slash,this.lane,this.target,this.targetFill,this.wave,this.waveGlow,this.shadow,this.opening]){mesh.rotation.x=-Math.PI/2;mesh.position.y=.09;this.group.add(mesh);}
  for(let i=0;i<8;i++){const shape=new T.Shape();shape.moveTo(-.35,-.4);shape.lineTo(0,0);shape.lineTo(.35,-.4);shape.lineTo(.35,-.15);shape.lineTo(0,.25);shape.lineTo(-.35,-.15);shape.closePath();const arrow=new T.Mesh(new T.ShapeGeometry(shape),material(AMBER));arrow.rotation.x=-Math.PI/2;this.arrows.push(arrow);this.group.add(arrow);}
  this.group.add(this.projectile,this.particles);this.particles.frustumCulled=false;
  for(let i=0;i<3;i++){const star=new T.Mesh(new T.OctahedronGeometry(.22*FX),this.cyan);this.stars.push(star);this.group.add(star);}
  for(let i=0;i<8;i++){const a=i*Math.PI/4,gem=new T.Mesh(new T.OctahedronGeometry(1.18*FX),material(0xb99cff,.24));gem.position.set(Math.sin(a)*44.6,2.5,Math.cos(a)*44.6);gem.scale.set(.75,1.7,.75);this.crystals.push(gem);this.group.add(gem);}
  this.hud.id='knight-battle-hud';this.hud.dataset.i18nIgnore='';this.hud.setAttribute('aria-label',t('Бой с Метакнайтом'));
  const title=document.createElement('strong');title.textContent=t('Метакнайт');const top=document.createElement('div');top.className='knight-battle-top';top.append(title,this.phase);
  this.health.className='knight-health';this.health.setAttribute('role','progressbar');this.health.setAttribute('aria-label',t('Здоровье Метакнайта'));this.health.setAttribute('aria-valuemin','0');this.health.setAttribute('aria-valuemax','12');this.health.append(this.fill);
  this.hearts.className='knight-hearts';this.hearts.setAttribute('role','status');this.hint.className='knight-hint';this.hint.setAttribute('aria-live','polite');
  this.actions.className='knight-battle-actions';this.start.type=this.cancel.type='button';this.cancel.className='knight-battle-cancel';this.start.addEventListener('click',onStart);this.cancel.addEventListener('click',onCancel);this.cancel.textContent=t('Прервать дуэль');this.actions.append(this.start,this.cancel);this.hud.append(top,this.health,this.hearts,this.hint,this.actions);document.body.append(this.hud);
 }
 private burst(now:number,p:T.Vector3){this.burstAt=now;this.burstPosition.copy(p);}
 update(s:KnightBattle|undefined,id:string,now:number,dt:number,near:boolean,attackKey:string,visible:boolean,withdrawn=false){
  this.hud.hidden=!visible;this.group.visible=visible;if(!visible)return;
  const p=s?knightPosition(s,now):[0,0,-9],stage=s?.stage??'idle',f=s?knightProgress(s,now):0;
  const player=s?.players[id],participating=!!player&&!withdrawn&&!player.withdrawn,hp=player?.hp??5,reflects=player?.reflects??0;
  this.knight.actor.position.set(SITE.x+p[0],p[1],p[2]);this.knight.yaw=s?.yaw??0;this.knight.actor.rotation.y=this.knight.yaw;
  const clip=stage==='won'?'Sitting':stage==='open'?'Sitting':stage==='slash'||stage==='slash-warn'?'Attack':stage==='approach'?'Run':stage==='jump'||stage==='jump-warn'?'Jump':['dash','dash-warn','dive','dive-warn','shot','shot-warn','return'].includes(stage)?'Fly':'Idle';
  if(this.lastStage!==stage||this.lastBattle!==(s?.id??0)){
   this.knight.setActivity(clip);const action=this.knight.actions.get(clip);if(action&&stage==='slash')action.setEffectiveTimeScale(action.getClip().duration/Math.max(.1,(s!.until-s!.since)/1000));
   if(stage.endsWith('-warn'))this.cue('warn');if(stage==='won')this.cue('win');if(stage==='return')this.cue('reflect');
   if(stage==='slash')this.cue('slash');if(stage==='dash'||stage==='dive')this.cue('dash');if(stage==='slam')this.cue('slam');if(stage==='shot')this.cue('shot');if(stage==='transition')this.cue('phase');
   this.lastStage=stage;
  }
  this.knight.updateActivity(dt);this.knight.actor.scale.setScalar(KNIGHT.modelScale);
  if(stage==='slash-warn'){const action=this.knight.actions.get('Attack');if(action){action.time=action.getClip().duration*(.08+f*.1);this.knight.mixer.update(0);}}
  this.shadow.position.set(p[0],.075,p[2]);this.shadow.scale.setScalar(1+Math.max(0,p[1])*.1);
  for(const m of [this.amber,this.redGlass,this.amberLane,this.redLane])m.uniforms.clock.value=now/1000;
  for(const mesh of [this.sector,this.sectorEdge,this.sectorHalo,...this.sectorSides,this.slash,this.lane,this.target,this.targetFill,this.wave,this.waveGlow,this.projectile,this.opening,...this.stars,...this.arrows])mesh.visible=false;
  if(s){
   const yaw=s.yaw;
   if(stage==='slash-warn'||stage==='slash'){
    const active=stage==='slash',colour=active?CORAL:AMBER;this.sector.material=active?this.redGlass:this.amber;
    for(const mesh of [this.sector,this.sectorEdge,this.sectorHalo]){mesh.visible=true;mesh.position.set(p[0],mesh===this.sector ? .09 : .115,p[2]);mesh.rotation.set(-Math.PI/2,0,yaw-Math.PI/2);if(mesh!==this.sector)(mesh.material as T.MeshBasicMaterial).color.setHex(colour);}
    this.sectorSides.forEach((mesh,i)=>{const a=yaw+(i?1:-1)*KNIGHT.slashHalfAngle;mesh.visible=true;mesh.position.set(p[0]+Math.sin(a)*KNIGHT.slashRadius/2,.12,p[2]+Math.cos(a)*KNIGHT.slashRadius/2);mesh.rotation.set(-Math.PI/2,0,a);(mesh.material as T.MeshBasicMaterial).color.setHex(colour);});
    for(let i=0;i<3;i++){const arrow=this.arrows[i],a=yaw-.65+i*.65;arrow.visible=true;arrow.scale.setScalar(1.35*FX);arrow.position.set(p[0]+Math.sin(a)*4.35*FX,.15,p[2]+Math.cos(a)*4.35*FX);arrow.rotation.set(-Math.PI/2,0,a+Math.PI*1.5);(arrow.material as T.MeshBasicMaterial).color.setHex(colour);}
    if(stage==='slash'){this.slash.visible=true;this.slash.position.set(p[0],s.height+FX,p[2]);this.slash.rotation.set(-Math.PI/2,0,yaw-Math.PI/2-KNIGHT.slashHalfAngle+f*KNIGHT.slashHalfAngle*2);}
   }
   if(stage==='dash-warn'||stage==='dash'){
    const dx=s.to[0]-s.from[0],dz=s.to[2]-s.from[2],d=Math.hypot(dx,dz),a=Math.atan2(dx,dz);
    this.lane.visible=true;this.lane.position.set((s.from[0]+s.to[0])/2,.1,(s.from[2]+s.to[2])/2);this.lane.rotation.set(-Math.PI/2,0,a);this.lane.scale.set(KNIGHT.laneHalfWidth*2,d+KNIGHT.laneHalfWidth*2,1);
    const colour=stage==='dash'?CORAL:AMBER;
    for(let i=0;i<this.arrows.length;i++){const arrow=this.arrows[i],t=(i+.5)/this.arrows.length;arrow.visible=true;arrow.scale.setScalar(1.5*FX);arrow.position.set(s.from[0]+dx*t,.15,s.from[2]+dz*t);arrow.rotation.set(-Math.PI/2,0,a+Math.PI);(arrow.material as T.MeshBasicMaterial).color.setHex(colour);}
    this.lane.material=stage==='dash'?this.redLane:this.amberLane;this.lane.material.uniforms.span.value=d;
   }
   if(['jump-warn','jump','dive-warn','dive','slam'].includes(stage)){
    for(const mesh of [this.target,this.targetFill]){mesh.visible=true;mesh.position.set(s.to[0],mesh===this.target ? .14 : .12,s.to[2]);}this.targetFill.material=stage==='slam'?this.redGlass:this.amber;
    (this.target.material as T.MeshBasicMaterial).color.setHex(stage==='slam'?CORAL:AMBER);
    for(let i=0;i<4;i++){const arrow=this.arrows[i],a=i*Math.PI/2;arrow.visible=true;arrow.scale.setScalar(1.1*FX);arrow.position.set(s.to[0]+Math.sin(a)*3.2*FX,.15,s.to[2]+Math.cos(a)*3.2*FX);arrow.rotation.set(-Math.PI/2,0,a);(arrow.material as T.MeshBasicMaterial).color.setHex(AMBER);}
   }
   if(stage==='wave'){
    const r=Math.max(.1,(now-s.since)*KNIGHT.waveSpeed);for(const mesh of [this.wave,this.waveGlow]){mesh.visible=true;mesh.position.set(p[0],.35*FX,p[2]);mesh.scale.set(r,r,FX);}
   }
   const shot=knightProjectile(s,now);if(shot){
    this.projectile.visible=true;this.projectile.position.fromArray(shot);const a=stage==='return'?Math.atan2(s.to[0]-shot[0],s.to[2]-shot[2]):Math.atan2(s.to[0]-s.from[0],s.to[2]-s.from[2]);this.projectile.rotation.y=a-Math.PI/2;this.crescent.update(now,stage==='return');
   }
   if(stage==='open'||stage==='won'){
    this.opening.visible=true;this.opening.position.set(p[0],.18,p[2]);this.opening.scale.setScalar(1+Math.sin(now*.006)*.045);
    this.stars.forEach((star,i)=>{star.visible=true;star.position.set(p[0]+Math.cos(now*.002+i*2.1)*1.3*FX,(3+Math.sin(now*.003+i)*.15)*FX,p[2]+Math.sin(now*.002+i*2.1)*.65*FX);star.rotation.y=now*.002;});
   }
   if(this.lastBattle===s.id){if(s.hp<this.lastHealth){this.cue('hit');this.burst(now,new T.Vector3(p[0],FX,p[2]));}if(hp<this.lastLife&&participating)this.cue('hurt');if(reflects>this.lastReflects){const shot=knightProjectile(s,now);this.burst(now,shot?new T.Vector3().fromArray(shot):new T.Vector3(...p));}}
   this.lastHealth=s.hp;this.lastLife=hp;this.lastReflects=reflects;
  }
  this.lastBattle=s?.id??0;
  this.particles.visible=now-this.burstAt<700;for(let i=0;i<22&&this.particles.visible;i++){const life=(now-this.burstAt)/700,a=i*2.399;this.position.copy(this.burstPosition).add(new T.Vector3(Math.cos(a)*life*2*FX,(life*2-life*life*1.5)*FX,Math.sin(a)*life*2*FX));this.scale.setScalar(1-life);this.matrix.compose(this.position,this.quaternion,this.scale);this.particles.setMatrixAt(i,this.matrix);}this.particles.instanceMatrix.needsUpdate=true;
  this.crystals.forEach((gem,i)=>{(gem.material as T.MeshBasicMaterial).opacity=(s?.phase??1)===3?.42+Math.sin(now*.003+i)*.1:.15;});
  const key=[s?.revision??0,hp,near,withdrawn,attackKey,t('Метакнайт')].join(':');if(key===this.lastKey)return;this.lastKey=key;
  this.hud.querySelector('strong')!.textContent=t('Метакнайт');this.cancel.textContent=t(s?.stage==='won'||s?.stage==='lost'?'Завершить дуэль':'Прервать дуэль');this.health.setAttribute('aria-label',t('Здоровье Метакнайта'));this.hearts.hidden=!participating;
  this.phase.textContent=s?t(['Дуэль','Крылья','Звёздный натиск'][s.phase-1]):t('Вызов рыцаря');this.fill.style.width=`${(s?.hp??12)/12*100}%`;this.health.setAttribute('aria-valuenow',String(s?.hp??12));this.hearts.textContent='♥'.repeat(hp)+'♡'.repeat(5-hp);this.hearts.setAttribute('aria-label',t('Сердца: {0} из 5').replace('{0}',String(hp)));
  const finished=stage==='won'||stage==='lost'||stage==='cancelled';this.start.hidden=!!s&&!finished;this.start.disabled=!near&&!finished;this.start.textContent=t(finished&&stage!=='cancelled'?'Ещё раз':'Начать дуэль');this.cancel.hidden=!participating||stage==='cancelled';this.actions.hidden=this.start.hidden&&this.cancel.hidden;
  const hints:Partial<Record<typeof stage,string>>={'intro':'Увидеть замах → уклониться → ответить','approach':'Следи за мечом и держись рядом','slash-warn':'Выйди из сектора взмаха','slash':'Дождись конца связки','jump-warn':'Выйди из круга, затем перепрыгни волну','jump':'Приготовься перепрыгнуть волну','wave':'Прыгай или перелетай низкую волну','dash-warn':'Уходи поперёк золотой полосы','dash':'Следующий заход готовится отдельно','dive-warn':'Выйди из отмеченного круга','dive':'Пикирование!','shot-warn':'Золотой полумесяц можно отбить атакой','shot':'Нажми {0} перед касанием полумесяца','return':'Отбито! Сближайся для удара','open':'Защита открыта! Подойди и нажми {0}','transition':'Новая фаза — приготовься','won':'Победа! Метакнайт уважает твоё мастерство','lost':'Попытка окончена. Попробуем ещё раз?'};
  this.hint.textContent=stage==='cancelled'?t('Дуэль прервана. Ты остаёшься на арене.'):!s?t(near?'Начни дуэль: движение, прыжок и обычная атака':'Подойди к Метакнайту, чтобы начать дуэль'):!participating?t('Идёт дуэль. Дождись следующей попытки'):hp===0&&!finished?t('Сердца закончились. Наблюдай за друзьями'):t(hints[stage]??'Следи за мечом и держись рядом').replace('{0}',attackKey);
 }
 dispose(){this.hud.remove();this.crescent.dispose();this.group.removeFromParent();const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();this.group.traverse(o=>{if(o instanceof T.Mesh){geometries.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));}});for(const m of [this.amber,this.redGlass,this.amberLane,this.redLane,this.coral,this.cyan])materials.add(m);geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}
}
