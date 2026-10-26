import * as T from 'three';
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
import type {CharacterController,Input} from './controller';
import {cameraRelativeMotion} from './movement-input';
import type {FollowCamera} from './follow-camera';
import type {MetaKnightArenaScene} from './meta-knight-arena';
import {META_KNIGHT_ARENA as SITE,META_KNIGHT_ANNEX,META_KNIGHT_PORTAL,arenaPortalFloor,arenaPortalCoordinates,constrainMetaKnightArena} from './meta-knight-arena-site';
import {t} from './i18n';
import {disposeActor} from './actor-lifecycle';
import {arenaMaterials} from './meta-knight-arena-materials';
import {MetaKnightBattleView} from './meta-knight-battle-view';
import {KNIGHT,startKnightBattle,advanceKnightBattle,setKnightPhase,knightAttack,knightPosition,cancelKnightBattle,knightBattleActive,knightPlayerVisible,knightArenaSide,type KnightBattle,type KnightActor} from './meta-knight-battle';
import {constrainKnightBody} from './meta-knight-body';
import type {KnightProfile} from './meta-knight-party-hud';
import {knightArenaActions} from './meta-knight-actions';
import type {KnightSound} from './meta-knight-sounds';
import {constrainKnightShield} from './meta-knight-shield';
import {MetaKnightDazedStars} from './meta-knight-dazed-stars';
import {fitKnightArenaCamera} from './meta-knight-camera-fit';
import {COSMIC,cosmicAirborne,cosmicHeight,cosmicControlsLocked,cosmicPlayerPush,cosmicCombat,cosmicDescent} from './meta-knight-cosmic';
import {cosmicCameraPose} from './meta-knight-cosmic-camera';
import {insideRefuge} from './meta-knight-cosmic-refuge';
import {MetaKnightRefugeGlow} from './meta-knight-refuge-glow';
import {cosmicTravel} from './meta-knight-cosmic-world';
import './meta-knight-arena-travel.css';

const frame=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
type ArenaArrival={x:number;z:number;yaw:number};
type ArenaInput=Input&{cancelDuel?:string;moveStick?:{x:number;y:number}};
export class MetaKnightArenaTravel{
 readonly camera=new T.PerspectiveCamera(55,1,.25,3000);
 readonly overlay=document.createElement('div');
 private title=document.createElement('h2');private detail=document.createElement('p');private spinner=document.createElement('div');
 private back=document.createElement('button');private retry=document.createElement('button');
 private caption=document.createElement('div');
 private current?:MetaKnightArenaScene;private owner?:CharacterController;private restoreMaterials?:()=>void;
 private remoteRestores=new Map<T.Object3D,()=>void>();private generation=0;
 private refugeGlows=new Map<CharacterController,MetaKnightRefugeGlow>();
 private remoteStars=new Map<CharacterController,MetaKnightDazedStars>();
 private arrival?:ArenaArrival;
 private oldConstraint?:CharacterController['positionConstraint'];
 private knight?:CharacterController;
 private battleView?:MetaKnightBattleView;private soloBattle?:KnightBattle;private soloNow=Date.now();private attackHeld=false;private victoryId=0;private life=5;private lastInvulnerable=0;
 private withdrawnBattle=0;
 private soloGodMode=false;
 private cosmicFlying=false;
 private cosmicLaunchAt=-1;private cosmicRemoteLaunch=new WeakMap<T.Object3D,number>();
 private cosmicFrame=new T.Group();private cosmicHeading?:number;private cosmicCameraDrift=new T.Vector3();
 private playerStars?:MetaKnightDazedStars;
 get battle(){return this.battleOptions?.online()?this.battleOptions.state():this.soloBattle;}
 fireflyBuzz(listener:T.Vector3){return this.active?this.battleView?.fireflyBuzz(listener)??0:0;}
 get cancelProgress(){return this.battleView?.cancelProgress??0;}
 get actions(){const c=this.owner,s=this.battle;return c&&this.active?knightArenaActions(s,this.battleOptions?.id()??'solo',s?.id===this.withdrawnBattle,this.nearKnight(c),this.nearExit(c)):[];}
 get primaryActionLabel(){const action=this.actions.find(a=>a.key==='interact');return action?t(action.label):undefined;}
 get secondaryActionLabel(){const action=this.actions.find(a=>a.key==='attack');return action?t(action.label):undefined;}
 controlsHint(interactKey:string,attackKey:string){return this.actions.map(a=>`${a.key==='interact'?interactKey:attackKey} — ${t(a.label)}`).join(', ');}
 interact(){const action=this.actions.find(a=>a.key==='interact')?.action;if(action==='leave')this.leave();else if(action==='finish')this.cancelBattle();else if(action==='start')this.startBattle();}
 get engaged(){const s=this.battle,p=s?.players[this.battleOptions?.id()??'solo'];return knightBattleActive(s)&&!!p&&!p.withdrawn&&s!.id!==this.withdrawnBattle;}
 get duelCommandsAvailable(){return this.active&&!this.battleOptions?.online()&&this.engaged&&(this.battle?.players[this.battleOptions?.id()??'solo']?.hp??0)>0;}
 get godMode(){return this.soloGodMode&&this.duelCommandsAvailable;}
 private setGodMode(enabled:boolean){
  if(this.soloGodMode===enabled)return;this.soloGodMode=enabled;
  this.caption.textContent=t(enabled?'Арена Метакнайта · Неуязвимость':'Арена Метакнайта');
 }
 toggleGodMode(){
  if(!this.duelCommandsAvailable)return;
  if(this.soloGodMode){
   const s=this.soloBattle!,id=this.battleOptions?.id()??'solo';
   // Do not replay a protected contact when invulnerability is switched off.
   if(s.shotContacts?.[id]!==undefined&&s.shotContacts[id]>=0){s.shotContacts[id]=-1;s.revision++;}
  }
  this.setGodMode(!this.soloGodMode);return this.soloGodMode;
 }
 setPhase(phase:1|2|3|4,subphase?:1|2|3){
  if(!this.duelCommandsAvailable||!this.owner||!this.soloBattle)return false;
  this.battleOptions?.stopCosmic?.();return setKnightPhase(this.soloBattle,phase,[this.localActor(this.owner)],this.soloNow,subphase);
 }
 private retryModuleUrl?:string;private retryAttempt=0;
 loading=false;
 get active(){return !!this.current&&!this.loading;}
 get scene(){return this.current?.scene;}
 constructor(private renderer:T.WebGLRenderer,private meadow:T.Scene,private follow:FollowCamera,private clearInput:()=>void,private makeKnight?:()=>CharacterController|undefined,private battleOptions?:{online:()=>boolean;state:()=>KnightBattle|undefined;id:()=>string;now:()=>number;actors:()=>KnightActor[];profiles?:()=>KnightProfile[];send:(action:'start'|'attack'|'cancel')=>void;win:()=>void;cue:(kind:KnightSound)=>void;stopCosmic?:()=>void;chargeAudio?:(level:number)=>void;prepareCosmic?:()=>Promise<void>|void;firefly?:()=>GLTF|undefined;music?:(active:boolean)=>void}){
  this.overlay.id='arena-loader';this.overlay.hidden=true;this.overlay.setAttribute('role','status');this.overlay.setAttribute('aria-live','polite');
  this.spinner.className='arena-loading-orbit';this.back.type=this.retry.type='button';
  this.retry.addEventListener('click',()=>{const c=this.owner,arrival=this.arrival;this.leave();if(c)void this.enter(c,arrival);});
  this.back.addEventListener('click',()=>this.leave());
  const card=document.createElement('div');card.append(this.spinner,this.title,this.detail,this.retry,this.back);this.overlay.append(card);document.body.append(this.overlay);
  this.caption.id='cosmic-arena-caption';this.caption.hidden=true;this.caption.textContent=t('Арена Метакнайта');document.body.append(this.caption);
 }
 async enter(c:CharacterController,arrival?:ArenaArrival){
  if(this.loading||this.current)return;
  const generation=++this.generation;this.owner=c;this.arrival=arrival?{...arrival}:undefined;this.loading=true;this.clearInput();
  this.overlay.hidden=false;this.overlay.setAttribute('aria-busy','true');this.spinner.hidden=false;this.retry.hidden=this.back.hidden=true;
  this.title.textContent=t('Открываем космическую арену…');this.detail.textContent=t('Готовим звёзды, портал и площадку.');
  let stage:MetaKnightArenaScene|undefined;
  try{
   await frame();await frame();
   const {createMetaKnightArena}:typeof import('./meta-knight-arena')=await (this.retryModuleUrl?import(/* @vite-ignore */this.retryModuleUrl):import('./meta-knight-arena'));
   if(generation!==this.generation)return;
   stage=createMetaKnightArena(this.renderer);this.cosmicFrame.name='Cosmic travelling formation';stage.scene.add(this.cosmicFrame);const audio=this.battleOptions?.prepareCosmic?.();
   this.playerStars=new MetaKnightDazedStars('Player golden dizziness stars');stage.scene.add(this.playerStars.group);this.playerStars.group.visible=false;
   this.knight=this.makeKnight?.();if(this.knight){this.knight.actor.name='Meta Knight duel boss';this.knight.actor.position.set(SITE.x,0,-9);this.knight.actor.scale.setScalar(KNIGHT.modelScale);stage.scene.add(this.knight.actor);this.battleView=new MetaKnightBattleView(this.knight,stage.scene,()=>this.cancelBattle(),kind=>this.battleOptions?.cue(kind),()=>this.battleOptions?.stopCosmic?.(),level=>this.battleOptions?.chargeAudio?.(level));const bug=this.battleOptions?.firefly?.();if(bug)this.battleView.setLifeFirefly(bug);}
   this.soloNow=Date.now();this.soloBattle=undefined;this.withdrawnBattle=0;this.attackHeld=false;this.life=5;this.battleOptions?.music?.(false);
   this.oldConstraint=c.positionConstraint;this.restoreMaterials=arenaMaterials(c.actor);c.setActivity('Idle');c.swimming=false;c.surfaceY=0;
   stage.scene.add(c.actor);c.actor.userData.location='meta-knight-arena';c.positionConstraint=(p,size)=>{this.constrainArena(p,size);this.constrainShield(p);};
   c.actor.position.set(arrival?.x??SITE.x+SITE.spawnX,0,arrival?.z??SITE.spawnZ);this.constrainArena(c.actor.position,c.actor.scale.x);
   c.actor.position.y=c.surfaceY=arenaPortalFloor(c.actor.position.x-SITE.x,c.actor.position.z);
   c.yaw=arrival?.yaw??Math.PI+META_KNIGHT_ANNEX.angle;c.actor.rotation.set(0,c.yaw,0);this.follow.reset(c.yaw);this.follow.zoom(550);this.follow.orbit(0,20);
   this.placeCamera(c,1);await Promise.all([this.battleView?this.battleView.prepare(this.renderer,stage.scene,this.camera):this.renderer.compileAsync(stage.scene,this.camera),audio]);
   if(generation!==this.generation){stage.dispose();return;}
   this.current=stage;this.renderer.render(stage.scene,this.camera);await frame();
   if(generation!==this.generation)return;
   this.loading=false;this.overlay.hidden=true;this.caption.hidden=false;this.caption.textContent=t('Арена Метакнайта');this.overlay.setAttribute('aria-busy','false');this.clearInput();this.renderer.domElement.focus();
  }catch(error){
   if(generation!==this.generation){stage?.dispose();return;}
   console.error('Cosmic arena loading failed',error);
   // Native ESM caches a failed fetch. A same-origin retry URL allows recovery
   // without reloading the game or losing the current player's progress.
   const failed=error instanceof Error?error.message.match(/https?:\/\/[^\s'"<>]+/)?.[0]:undefined;
   if(failed){try{const url=new URL(failed);if(url.origin===location.origin&&/meta-knight-arena[^/]*\.(js|ts)$/.test(url.pathname)){url.searchParams.set('arenaRetry',String(++this.retryAttempt));this.retryModuleUrl=url.href;}}catch{/* Non-URL browser diagnostics have no retry address. */}}
   this.restorePlayer();this.disposeKnight();stage?.dispose();this.current=undefined;
   this.title.textContent=t('Не удалось открыть арену');this.detail.textContent=t('Попробуй ещё раз или вернись на поляну.');
   this.spinner.hidden=true;this.retry.hidden=this.back.hidden=false;this.retry.textContent=t('Попробовать снова');this.back.textContent=t('Отмена');this.overlay.setAttribute('aria-busy','false');this.retry.focus();
  }
 }
 private restorePlayer(){
  const c=this.owner;if(!c||!c.actor.userData.location)return;
  c.endDuel();
  c.flight.reset();this.cosmicFlying=false;
  this.restoreMaterials?.();this.restoreMaterials=undefined;this.meadow.add(c.actor);delete c.actor.userData.location;
  c.positionConstraint=this.oldConstraint;c.setActivity('Idle');c.swimming=false;c.surfaceY=0;c.actor.position.set(META_KNIGHT_PORTAL.x,0,META_KNIGHT_PORTAL.z+META_KNIGHT_PORTAL.returnOffset);c.yaw=0;c.actor.rotation.set(0,0,0);this.follow.reset(0);
 }
 leave(){
  if(this.engaged)this.cancelBattle();this.battleOptions?.music?.(false);
  this.clearCosmicFrame();
  ++this.generation;for(const glow of this.refugeGlows.values())glow.dispose();this.refugeGlows.clear();this.restorePlayer();for(const [c,stars] of this.remoteStars){c.clearDuelDazedPose();stars.dispose();}this.remoteStars.clear();for(const [actor,restore] of this.remoteRestores){restore();this.meadow.add(actor);}this.remoteRestores.clear();
  this.disposeKnight();
  this.current?.dispose();this.current=undefined;this.owner=undefined;this.arrival=undefined;this.loading=false;this.overlay.hidden=true;this.caption.hidden=true;this.overlay.setAttribute('aria-busy','false');this.clearInput();
 }
 private disposeKnight(){this.setGodMode(false);this.playerStars?.dispose();this.playerStars=undefined;this.battleView?.dispose();this.battleView=undefined;this.soloBattle=undefined;if(this.knight)disposeActor(this.knight);this.knight=undefined;}
 private constrainShield(p:T.Vector3,previous?:T.Vector3){const local:[number,number,number]=[p.x-SITE.x,p.y,p.z],before:typeof local|undefined=previous?[previous.x-SITE.x,previous.y,previous.z]:undefined,now=this.battleOptions?.online()?this.battleOptions.now():this.soloNow;constrainKnightBody(this.battle,local,now,before,this.owner?.actor.scale.x);constrainKnightShield(this.battle,local,before);p.x=SITE.x+local[0];p.z=local[2];}
 private constrainArena(p:T.Vector3,size:number){constrainMetaKnightArena(p,size,knightArenaSide(this.battle,this.battleOptions?.id()??'solo'));}
 private localActor(c:CharacterController):KnightActor{return {id:this.battleOptions?.id()??'solo',p:[c.actor.position.x-SITE.x,c.actor.position.y,c.actor.position.z],yaw:c.yaw,available:true};}
 nearKnight(c:CharacterController){const p=this.battle?knightPosition(this.battle,this.battleOptions?.online()?this.battleOptions.now():this.soloNow):[0,0,-9];return this.active&&Math.hypot(c.actor.position.x-SITE.x-p[0],c.actor.position.z-p[2])<9;}
 startBattle(){
  const c=this.owner;if(!c||!this.active)return;const s=this.battle,finished=s&&!knightBattleActive(s);
  if(s&&!finished)return;if(!finished&&!this.nearKnight(c))return;
  this.setGodMode(false);
  c.setActivity('Idle');c.beginDuel();c.actor.visible=true;this.life=5;
  if(finished){c.actor.position.set(SITE.x,0,-2);c.yaw=Math.PI;c.actor.rotation.y=Math.PI;}
  this.clearInput();this.attackHeld=false;this.withdrawnBattle=0;
  if(this.battleOptions?.online())this.battleOptions.send('start');else{this.soloBattle=startKnightBattle([this.localActor(c)],this.localActor(c).id,this.soloNow);}
  this.battleOptions?.music?.(true);
 }
 cancelBattle(){
  const c=this.owner,s=this.battle,id=this.battleOptions?.id()??'solo';if(!c||!s||!s.players[id]||s.players[id].withdrawn)return;
  this.withdrawnBattle=s.id;
  this.battleOptions?.stopCosmic?.();c.flight.reset();this.cosmicFlying=false;c.surfaceY=arenaPortalFloor(c.actor.position.x-SITE.x,c.actor.position.z);c.actor.position.y=c.surfaceY;
  this.setGodMode(false);
  if(knightBattleActive(s)){if(this.battleOptions?.online())this.battleOptions.send('cancel');else cancelKnightBattle(s,id,this.soloNow);}
  if(this.current)this.current.scene.add(c.actor);
  c.setActivity('Idle');c.endDuel();c.actor.visible=true;this.life=5;this.attackHeld=false;this.battleOptions?.music?.(false);this.clearInput();this.renderer.domElement.focus();
 }
 savePosition(c:CharacterController){return c===this.owner&&c.actor.userData.location?c.actor.position.clone():undefined;}
 nearExit(c:CharacterController){return this.active&&Math.abs(c.actor.position.y-arenaPortalFloor(c.actor.position.x-SITE.x,c.actor.position.z))<.7&&Math.hypot(c.actor.position.x-SITE.x-SITE.exitX,c.actor.position.z-SITE.exitZ)<Math.max(5,c.actor.scale.x+2);}
 update(dt:number,seconds:number,c:CharacterController,input:ArenaInput,horizontal:number,vertical:number,dragging:boolean,paused:boolean){
  if(!this.active)return;
  if(!paused&&(input.attackPressed||input.attack&&!this.attackHeld)&&this.actions.some(a=>a.key==='attack'&&a.action==='start')){this.startBattle();this.attackHeld=true;return;}
  if(!paused)this.soloNow+=dt*1000;const now=this.battleOptions?.online()?this.battleOptions.now():this.soloNow,id=this.battleOptions?.id()??'solo';let battle=this.battle;
  const player=battle?.players[id],withdrawn=battle?.id===this.withdrawnBattle||!!player?.withdrawn,participating=!!player&&!withdrawn,active=knightBattleActive(battle)&&participating;
  const defeated=participating&&player?.hp===0;
  if(active||defeated)c.beginDuel();else c.endDuel();this.battleOptions?.music?.(active);
  this.syncCosmicFlight(c,battle,now,participating);
  const stopped=paused||defeated||active&&(battle?.stage==='intro'||cosmicControlsLocked(battle));
  const previous=c.actor.position.clone(),previousYaw=c.yaw;c.fruitBoost.update(paused?0:dt);
  let movement:Input=input;
  if(this.engaged&&battle?.phase!==4){
   const direction=this.camera.getWorldDirection(new T.Vector3()),stick=input.moveStick??{x:Number(input.right)-Number(input.left),y:Number(!!input.backward)-Number(input.forward)};
   movement={...input,...cameraRelativeMotion(stick.x,stick.y,Math.atan2(direction.x,direction.z),c.yaw,dt)};
  }
  if(cosmicAirborne(battle)&&participating)movement={...movement,jump:false,jumpPressed:false,movementMultiplier:COSMIC.flightSpeedMultiplier};
  if(stopped){const push=cosmicPlayerPush(battle,id,now),pose=battle?.stage==='lost'||player?.hp===0?'Sitting':cosmicAirborne(battle)&&participating&&!cosmicDescent(battle,now)?.landed?'Fly':push&&push.progress>0&&push.progress<1?'Jump':'Idle';if(!paused&&c.state!==pose)c.setActivity(pose);c.updateActivity(paused?0:dt);}else c.update(dt,movement);this.constrainArena(c.actor.position,c.actor.scale.x);
  if(!stopped&&(input.attackPressed||input.attack&&!this.attackHeld)){if(this.battleOptions?.online())this.battleOptions.send('attack');else if(battle)knightAttack(battle,this.localActor(c),now);}
  if(!paused)this.attackHeld=!!input.attack;
  if(!paused&&battle&&!this.battleOptions?.online())advanceKnightBattle(battle,[this.localActor(c)],now,this.soloGodMode?id:undefined);
  battle=this.battle;
  this.syncCosmicFlight(c,battle,now,participating);
  this.constrainShield(c.actor.position,previous);
  if(!this.duelCommandsAvailable)this.setGodMode(false);
  const life=participating?battle?.players[id]?.hp??5:5,invulnerable=participating?battle?.players[id]?.invulnerable??0:0;if(life<this.life&&invulnerable>this.lastInvulnerable){c.setActivity('Idle');const pos=knightPosition(battle!,now),dx=c.actor.position.x-SITE.x-pos[0],dz=c.actor.position.z-pos[2],d=Math.hypot(dx,dz)||1;c.actor.position.x+=dx/d*1.1;c.actor.position.z+=dz/d*1.1;}this.lastInvulnerable=invulnerable;
  this.life=life;c.actor.visible=knightPlayerVisible(battle,id,now,withdrawn);
  this.updateRefugeGlow(c,!!battle&&participating&&life>0&&insideRefuge(battle,[c.actor.position.x-SITE.x,c.actor.position.y,c.actor.position.z],now),now);
  const dazed=participating&&life===0;if(dazed){c.flight.reset();if(c.state!=='Sitting')c.setActivity('Sitting');c.updateActivity(0);c.actor.visible=true;}
  c.updateDuelDazedPose(now,dazed);
  if(this.playerStars){this.playerStars.group.scale.setScalar(c.actor.scale.x*.38);this.playerStars.update([c.actor.position.x,c.actor.position.y,c.actor.position.z],now,dazed);}
  if(battle?.stage==='won'&&battle.id!==this.victoryId&&participating&&life>0&&((battle.players[id].hits??0)+(battle.players[id].reflects??0)>0)){this.victoryId=battle.id;if(!this.battleOptions?.online())this.battleOptions?.win();}
  this.constrainArena(c.actor.position,c.actor.scale.x);
  const floor=cosmicAirborne(battle)&&participating?cosmicHeight(battle,now):arenaPortalFloor(c.actor.position.x-SITE.x,c.actor.position.z);
  if(c.flight.active)c.actor.position.y+=floor-c.surfaceY;else c.actor.position.y=floor;c.surfaceY=floor;
  this.syncCosmicFrame(c,battle,now,participating&&life>0);
  this.follow.update(dt,c.yaw,previous.distanceToSquared(c.actor.position)>.00001||previousYaw!==c.yaw,horizontal,vertical,dragging);this.placeCamera(c,dt);
  this.current!.updateOcclusion(this.camera,battle?.phase===4&&participating?c.actor.getWorldPosition(new T.Vector3()).add(new T.Vector3(0,1.1*c.actor.scale.x,0)):undefined,dt);
  this.current!.annex.setClosed(knightBattleActive(battle));this.current!.update(seconds,battle,now);
  this.battleView?.update(battle,id,now,paused?0:dt,this.nearKnight(c),input.steer!==undefined?(document.body.classList.contains('touch-ui')?t('Толчок'):'X'):'Q',!paused,withdrawn,input.cancelDuel,this.camera);
  this.battleView?.updateParty(battle,id,this.battleOptions?.profiles?.()??[],!paused);
  const portal=arenaPortalCoordinates(c.actor.position.x-SITE.x,c.actor.position.z);
  if(!paused&&!cosmicAirborne(battle)&&Math.abs(c.actor.position.y-floor)<.7&&Math.abs(portal.across)<1.8&&Math.abs(portal.along)<.65)this.leave();
 }
 private syncCosmicFlight(c:CharacterController,battle:KnightBattle|undefined,now:number,participating:boolean){
  const push=participating?cosmicPlayerPush(battle,this.battleOptions?.id()??'solo',now):undefined;
  if(push&&(cosmicControlsLocked(battle)||this.cosmicLaunchAt!==battle!.cosmicLaunch!.at)){c.actor.position.x=SITE.x+push.point[0];c.actor.position.z=push.point[2];this.cosmicLaunchAt=battle!.cosmicLaunch!.at;}
  if(!battle?.cosmicLaunch)this.cosmicLaunchAt=-1;
  if(push&&cosmicControlsLocked(battle)){c.yaw=Math.atan2(-push.point[0],-push.point[2]);c.actor.rotation.y=c.yaw;}
  const flying=cosmicAirborne(battle)&&!cosmicDescent(battle,now)?.landed&&participating&&knightBattleActive(battle);
  if(flying){if((!this.cosmicFlying||battle?.stage==='cosmic-rise')&&c.state!=='Fly')c.setActivity('Fly');c.flight.holdPlane();c.surfaceY=c.actor.position.y=cosmicHeight(battle,now);c.cloud.visible=false;}
  else if(this.cosmicFlying){c.flight.reset();c.surfaceY=c.actor.position.y=arenaPortalFloor(c.actor.position.x-SITE.x,c.actor.position.z);c.setActivity('Idle');}
  else if(cosmicControlsLocked(battle)&&participating&&knightBattleActive(battle)){c.flight.reset();c.surfaceY=c.actor.position.y=0;}
  this.cosmicFlying=flying;
 }
 private starCameraMix=0;
 private clearCosmicFrame(){
  if(this.current)for(const child of [...this.cosmicFrame.children])this.current.scene.add(child);
  this.cosmicFrame.position.set(0,0,0);this.cosmicHeading=undefined;
 }
 private syncCosmicFrame(c:CharacterController,battle:KnightBattle|undefined,now:number,participating:boolean){
  if(battle?.phase!==4||!knightBattleActive(battle)){this.clearCosmicFrame();return;}
  const lockedHeading=battle.cosmicLaunch?.players[battle.target]?.angle;
  if(lockedHeading!==undefined)this.cosmicHeading=lockedHeading;
  else{
   const target=this.battleOptions?.online()?this.battleOptions.actors().find(a=>a.id===battle.target)?.p:undefined;
   const x=target?.[0]??c.actor.position.x-SITE.x,z=target?.[2]??c.actor.position.z;
   this.cosmicHeading=Math.hypot(x,z)>.01?Math.atan2(x,z):this.follow.azimuth;
  }
  this.cosmicFrame.position.fromArray(cosmicTravel(battle,now,this.cosmicHeading));
  // Logical encounter coordinates stay local; all rendered participants and
  // their sword effects share this continuous world-space displacement.
  for(const object of [this.knight?.actor,this.battleView?.group,participating?c.actor:undefined])if(object&&object.parent!==this.cosmicFrame)this.cosmicFrame.add(object);
  if(!participating&&c.actor.parent===this.cosmicFrame)this.current!.scene.add(c.actor);
 }
 private starFocus=new T.Vector3(SITE.x,3,0);private starDistance=0;private starViewport='';
 private placeCamera(c:CharacterController,_dt:number){
  if(this.camera.view?.enabled)this.camera.clearViewOffset();
  const battle=this.battle,clock=this.battleOptions?.online()?this.battleOptions.now():this.soloNow,local=battle?.players[this.battleOptions?.id()??'solo'],finishing=battle?.phase===4&&battle.stage==='won'&&!!battle.cosmicFall&&clock-battle.since<1400&&!!local&&!local.withdrawn&&battle.id!==this.withdrawnBattle;if(battle&&(this.engaged||finishing)){
   if(battle.phase!==4){this.cosmicCameraHeight=0;this.cosmicCameraDrift.set(0,0,0);this.cosmicFocus.set(SITE.x,3,0);this.cosmicCameraActive=false;}
   if(battle.phase===4){
    if(!this.cosmicCameraActive||battle.stage==='transition'&&this.cosmicIntro!==battle.since){
     c.yaw=Math.atan2(SITE.x-c.actor.position.x,-c.actor.position.z);c.actor.rotation.y=c.yaw;this.follow.reset(c.yaw);this.cosmicCameraActive=true;this.cosmicIntro=battle.since;
    }
    const now=this.battleOptions?.online()?this.battleOptions.now():this.soloNow;
    if(!cosmicCombat(battle)&&(battle.stage!=='cosmic-flight'||now-battle.since<1600)){const boss=knightPosition(battle,now);this.follow.face(Math.atan2(SITE.x+boss[0]-c.actor.position.x,boss[2]-c.actor.position.z));}
    const height=cosmicHeight(battle,now),pose=cosmicCameraPose(battle,now,[c.actor.position.x-SITE.x,c.actor.position.y,c.actor.position.z],innerWidth,innerHeight,this.follow,c.actor.scale.x);
    const drift=this.cosmicFrame.position,target=new T.Vector3(SITE.x+pose.focus[0],pose.focus[1],pose.focus[2]).add(drift),position=new T.Vector3(SITE.x+pose.position[0],pose.position[1],pose.position[2]).add(drift),blend=_dt>0?1-Math.exp(-_dt*8):1;
    // Follow the common altitude exactly. Smooth only the dolly/tilt; smoothing
    // world Y makes the camera trail behind a fast ascent and lose the blade.
    const lift=height-this.cosmicCameraHeight,travel=drift.clone().sub(this.cosmicCameraDrift);this.camera.position.add(travel);this.cosmicFocus.add(travel);this.cosmicCameraDrift.copy(drift);this.camera.position.y+=lift;this.cosmicFocus.y+=lift;this.cosmicCameraHeight=height;
    // The arrival dolly moves closer after the raised blade starts to lower.
    this.camera.position.lerp(position,blend);this.cosmicFocus.lerp(target,blend);this.camera.lookAt(this.cosmicFocus);
    this.camera.fov=pose.fov;this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld();return;
   }
   const now=this.battleOptions?.online()?this.battleOptions.now():this.soloNow,p=knightPosition(battle,now),target=new T.Vector3((c.actor.position.x+SITE.x+p[0])/2,2,(c.actor.position.z+p[2])/2);let d=Math.max(24,Math.hypot(c.actor.position.x-SITE.x-p[0],c.actor.position.z-p[2])*1.15+16)*(innerHeight>innerWidth?1.35:1);
   const wide=battle.phase===3&&battle.stage!=='open';this.starCameraMix+=((wide?1:0)-this.starCameraMix)*(1-Math.exp(-Math.max(0,_dt)/.35));
   if(this.starCameraMix>.001){
    const hud=this.battleView?.hud.getBoundingClientRect(),action=document.getElementById('action-hint')?.getBoundingClientRect();
    const top=hud?.height?hud.bottom+8:96,bottom=action?.height&&action.top>innerHeight*.6?innerHeight-action.top+8:24;
    const points:KnightActor['p'][]=[[p[0]-5,p[1]+7,p[2]],[p[0]+5,p[1]+7,p[2]],[c.actor.position.x-SITE.x,c.actor.position.y+3*c.actor.scale.x,c.actor.position.z]];
    if(battle.stage==='shield'&&battle.activeCrystal!==undefined){const a=battle.activeCrystal*Math.PI/4;points.push([Math.sin(a)*44.6,7,Math.cos(a)*44.6]);}
    const fit=fitKnightArenaCamera(innerWidth,innerHeight,points,top,bottom),focus=new T.Vector3(SITE.x+fit.focus[0],fit.focus[1],fit.focus[2]),distance=fit.distance,blend=_dt>0?1-Math.exp(-_dt/.3):1,viewport=`${innerWidth}:${innerHeight}:${Math.round(top)}:${Math.round(bottom)}`;
    if(!this.starDistance){this.starDistance=d;this.starFocus.copy(target);}
    if(viewport!==this.starViewport){this.starViewport=viewport;this.starFocus.copy(focus);this.starDistance=distance;}else{this.starFocus.lerp(focus,blend);this.starDistance=T.MathUtils.lerp(this.starDistance,distance,blend);}
    d=T.MathUtils.lerp(d,this.starDistance,this.starCameraMix);target.lerp(this.starFocus,this.starCameraMix);
   }
   this.camera.fov=innerHeight>innerWidth?75:55;this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.camera.position.set(target.x,target.y+d*.68,target.z+d*.82);this.camera.lookAt(target);this.camera.updateMatrixWorld();return;
  }
  this.starCameraMix=0;this.starDistance=0;this.starViewport='';this.cosmicCameraHeight=0;this.cosmicCameraDrift.set(0,0,0);this.cosmicFocus.set(SITE.x,3,0);this.cosmicCameraActive=false;
  const f=this.follow,size=c.actor.scale.x,target=c.actor.position.clone().add(new T.Vector3(0,.9*size,0));
  this.camera.fov=innerHeight>innerWidth?75:55;this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();
  this.camera.position.set(target.x+f.distance*size*Math.cos(f.elevation)*Math.sin(f.azimuth),target.y+f.distance*size*Math.sin(f.elevation),target.z+f.distance*size*Math.cos(f.elevation)*Math.cos(f.azimuth));this.camera.lookAt(target);this.camera.updateMatrixWorld();
 }
 private cosmicFocus=new T.Vector3(SITE.x,3,0);private cosmicCameraHeight=0;private cosmicCameraActive=false;private cosmicIntro=-1;
 private updateRefugeGlow(c:CharacterController,safe:boolean,now:number){let glow=this.refugeGlows.get(c);if(safe&&!glow){glow=new MetaKnightRefugeGlow(c.actor);this.refugeGlows.set(c,glow);}glow?.update(now,safe);}
 routeRemotes(players:Iterable<[string,CharacterController]>){
  const battle=this.battle,now=this.battleOptions?.online()?this.battleOptions.now():this.soloNow;
  const living=new Set<T.Object3D>();for(const [id,c] of players){living.add(c.actor);const inside=c.actor.userData.location==='meta-knight-arena'&&!!this.current;
   if(inside){if(!this.remoteRestores.has(c.actor))this.remoteRestores.set(c.actor,arenaMaterials(c.actor));const travelling=battle?.phase===4&&knightBattleActive(battle)&&!!battle.players[id]&&!battle.players[id].withdrawn&&battle.players[id].hp>0;(travelling?this.cosmicFrame:this.current!.scene).add(c.actor);c.actor.visible=knightPlayerVisible(battle,id,now);}
   else if(this.remoteRestores.has(c.actor)){this.remoteRestores.get(c.actor)!();this.remoteRestores.delete(c.actor);this.meadow.add(c.actor);}
   this.updateRefugeGlow(c,!!battle&&inside&&!!battle.players[id]&&!battle.players[id].withdrawn&&battle.players[id].hp>0&&insideRefuge(battle,[c.actor.position.x-SITE.x,c.actor.position.y,c.actor.position.z],now),now);
   const dazed=inside&&battle?.players[id]?.hp===0&&!battle.players[id].withdrawn;
   const remotePlayer=battle?.players[id],push=inside&&remotePlayer&&remotePlayer.hp>0&&!remotePlayer.withdrawn?cosmicPlayerPush(battle,id,now):undefined;
   if(push&&(cosmicControlsLocked(battle)||this.cosmicRemoteLaunch.get(c.actor)!==battle!.cosmicLaunch!.at)){c.actor.position.x=SITE.x+push.point[0];c.actor.position.z=push.point[2];this.cosmicRemoteLaunch.set(c.actor,battle!.cosmicLaunch!.at);if(cosmicControlsLocked(battle)){c.yaw=Math.atan2(-push.point[0],-push.point[2]);c.actor.rotation.y=c.yaw;if(!cosmicAirborne(battle)){c.flight.reset();c.actor.position.y=c.surfaceY=0;const pose=push.progress>0&&push.progress<1?'Jump':'Idle';if(c.state!==pose)c.setActivity(pose);}}}
   if(inside&&cosmicAirborne(battle)&&!cosmicDescent(battle,now)?.landed&&battle?.players[id]&&!battle.players[id].withdrawn&&battle.players[id].hp>0){if(c.state!=='Fly'&&(battle.stage==='cosmic-rise'||c.state!=='Push'&&c.state!=='Dash'))c.setActivity('Fly');c.flight.holdPlane();c.surfaceY=c.actor.position.y=cosmicHeight(battle,now);c.cloud.visible=false;}
   if(inside&&cosmicDescent(battle,now)?.landed&&remotePlayer&&remotePlayer.hp>0&&!remotePlayer.withdrawn){c.flight.reset();c.surfaceY=c.actor.position.y=0;if(c.state==='Fly')c.setActivity('Idle');}
   if(dazed){if(c.state!=='Sitting')c.setActivity('Sitting');c.actor.position.y=arenaPortalFloor(c.actor.position.x-SITE.x,c.actor.position.z);c.actor.visible=true;}
   c.updateDuelDazedPose(now,dazed);
   let stars=this.remoteStars.get(c);if(dazed&&!stars){stars=new MetaKnightDazedStars('Remote player golden dizziness stars');this.current!.scene.add(stars.group);this.remoteStars.set(c,stars);}
   if(stars){stars.group.scale.setScalar(c.actor.scale.x*.38);stars.update([c.actor.position.x,c.actor.position.y,c.actor.position.z],now,dazed);}
  }
  for(const [c,glow] of this.refugeGlows)if(c!==this.owner&&(!living.has(c.actor)||c.actor.userData.location!=='meta-knight-arena')){glow.dispose();this.refugeGlows.delete(c);}
  for(const [actor,restore] of this.remoteRestores)if(!living.has(actor)){restore();this.remoteRestores.delete(actor);}
  for(const [c,stars] of this.remoteStars)if(!living.has(c.actor)||c.actor.userData.location!=='meta-knight-arena'){c.clearDuelDazedPose();stars.dispose();this.remoteStars.delete(c);}
 }
 render(){if(this.active)this.renderer.render(this.current!.scene,this.camera);}
}
