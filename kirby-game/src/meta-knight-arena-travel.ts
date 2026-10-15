import * as T from 'three';
import type {CharacterController,Input} from './controller';
import type {FollowCamera} from './follow-camera';
import type {MetaKnightArenaScene} from './meta-knight-arena';
import {META_KNIGHT_ARENA as SITE,META_KNIGHT_PORTAL,portalLocalFloor,constrainMetaKnightArena} from './meta-knight-arena-site';
import {t} from './i18n';
import {disposeActor} from './actor-lifecycle';
import './meta-knight-arena-travel.css';

const frame=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
type MaterialRestore={mesh:T.Mesh;original:T.Material|T.Material[];copies:T.Material[]};
/** CSM shader hooks belong to the meadow. Isolated copies use the arena's light. */
function arenaMaterials(actor:T.Object3D){
 const restores:MaterialRestore[]=[];actor.traverse(o=>{if(!(o instanceof T.Mesh))return;
  const originals=Array.isArray(o.material)?o.material:[o.material];const copies=originals.map(m=>{const copy=m.clone();copy.onBeforeCompile=T.Material.prototype.onBeforeCompile;copy.customProgramCacheKey=T.Material.prototype.customProgramCacheKey;if(copy instanceof T.MeshStandardMaterial)copy.envMap=null;copy.needsUpdate=true;return copy;});
  restores.push({mesh:o,original:o.material,copies});o.material=Array.isArray(o.material)?copies:copies[0];
 });return ()=>{for(const {mesh,original,copies} of restores){mesh.material=original;copies.forEach(m=>m.dispose());}};
}

export class MetaKnightArenaTravel{
 readonly camera=new T.PerspectiveCamera(55,1,.25,1400);
 readonly overlay=document.createElement('div');
 private title=document.createElement('h2');private detail=document.createElement('p');private spinner=document.createElement('div');
 private back=document.createElement('button');private retry=document.createElement('button');
 private caption=document.createElement('div');
 private current?:MetaKnightArenaScene;private owner?:CharacterController;private restoreMaterials?:()=>void;
 private remoteRestores=new Map<T.Object3D,()=>void>();private generation=0;
 private oldConstraint?:CharacterController['positionConstraint'];
 private knight?:CharacterController;
 private retryModuleUrl?:string;private retryAttempt=0;
 loading=false;
 get active(){return !!this.current&&!this.loading;}
 get scene(){return this.current?.scene;}
 constructor(private renderer:T.WebGLRenderer,private meadow:T.Scene,private follow:FollowCamera,private clearInput:()=>void,private makeKnight?:()=>CharacterController|undefined){
  this.overlay.id='arena-loader';this.overlay.hidden=true;this.overlay.setAttribute('role','status');this.overlay.setAttribute('aria-live','polite');
  this.spinner.className='arena-loading-orbit';this.back.type=this.retry.type='button';
  this.retry.addEventListener('click',()=>{const c=this.owner;this.leave();if(c)void this.enter(c);});
  this.back.addEventListener('click',()=>this.leave());
  const card=document.createElement('div');card.append(this.spinner,this.title,this.detail,this.retry,this.back);this.overlay.append(card);document.body.append(this.overlay);
  this.caption.id='cosmic-arena-caption';this.caption.hidden=true;this.caption.textContent=t('Арена Метакнайта');document.body.append(this.caption);
 }
 async enter(c:CharacterController){
  if(this.loading||this.current)return;
  const generation=++this.generation;this.owner=c;this.loading=true;this.clearInput();
  this.overlay.hidden=false;this.overlay.setAttribute('aria-busy','true');this.spinner.hidden=false;this.retry.hidden=this.back.hidden=true;
  this.title.textContent=t('Открываем космическую арену…');this.detail.textContent=t('Готовим звёзды, портал и площадку.');
  let stage:MetaKnightArenaScene|undefined;
  try{
   await frame();await frame();
   const {createMetaKnightArena}:typeof import('./meta-knight-arena')=await (this.retryModuleUrl?import(/* @vite-ignore */this.retryModuleUrl):import('./meta-knight-arena'));
   if(generation!==this.generation)return;
   stage=createMetaKnightArena(this.renderer);
   this.knight=this.makeKnight?.();if(this.knight){this.knight.actor.name='Meta Knight awaiting a duel';this.knight.actor.position.set(SITE.x,0,-9);this.knight.actor.scale.setScalar(1.4);stage.scene.add(this.knight.actor);}
   this.oldConstraint=c.positionConstraint;this.restoreMaterials=arenaMaterials(c.actor);c.setActivity('Idle');c.swimming=false;c.surfaceY=0;
   stage.scene.add(c.actor);c.actor.userData.location='meta-knight-arena';c.positionConstraint=constrainMetaKnightArena;
   c.actor.position.set(SITE.x,0,SITE.spawnZ);c.yaw=Math.PI;c.actor.rotation.set(0,c.yaw,0);this.follow.reset(c.yaw);this.follow.zoom(550);this.follow.orbit(0,20);
   this.placeCamera(c,1);await this.renderer.compileAsync(stage.scene,this.camera);
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
   this.spinner.hidden=true;this.retry.hidden=this.back.hidden=false;this.retry.textContent=t('Попробовать снова');this.back.textContent=t('Вернуться на поляну');this.overlay.setAttribute('aria-busy','false');this.retry.focus();
  }
 }
 private restorePlayer(){
  const c=this.owner;if(!c||!c.actor.userData.location)return;
  this.restoreMaterials?.();this.restoreMaterials=undefined;this.meadow.add(c.actor);delete c.actor.userData.location;
  c.positionConstraint=this.oldConstraint;c.setActivity('Idle');c.swimming=false;c.surfaceY=0;c.actor.position.set(META_KNIGHT_PORTAL.x,0,META_KNIGHT_PORTAL.z+META_KNIGHT_PORTAL.returnOffset);c.yaw=0;c.actor.rotation.set(0,0,0);this.follow.reset(0);
 }
 leave(){
  ++this.generation;this.restorePlayer();for(const [actor,restore] of this.remoteRestores){restore();this.meadow.add(actor);}this.remoteRestores.clear();
  this.disposeKnight();
  this.current?.dispose();this.current=undefined;this.owner=undefined;this.loading=false;this.overlay.hidden=true;this.caption.hidden=true;this.overlay.setAttribute('aria-busy','false');this.clearInput();
 }
 private disposeKnight(){if(this.knight)disposeActor(this.knight);this.knight=undefined;}
 savePosition(c:CharacterController){return c===this.owner&&c.actor.userData.location?new T.Vector3(META_KNIGHT_PORTAL.x,0,META_KNIGHT_PORTAL.z+META_KNIGHT_PORTAL.returnOffset):undefined;}
 nearExit(c:CharacterController){return this.active&&Math.abs(c.actor.position.y)<.7&&Math.hypot(c.actor.position.x-SITE.x,c.actor.position.z-SITE.exitZ)<Math.max(5,c.actor.scale.x+2);}
 update(dt:number,seconds:number,c:CharacterController,input:Input,horizontal:number,vertical:number,dragging:boolean,paused:boolean){
  if(!this.active)return;
  const previous=c.actor.position.clone();c.fruitBoost.update(dt);c.update(dt,input);constrainMetaKnightArena(c.actor.position,c.actor.scale.x);
  const floor=portalLocalFloor(c.actor.position.x-SITE.x,c.actor.position.z-SITE.exitZ);
  if(c.flight.active)c.actor.position.y+=floor-c.surfaceY;else c.actor.position.y=floor;c.surfaceY=floor;
  this.follow.update(dt,c.yaw,previous.distanceToSquared(c.actor.position)>.00001,horizontal,vertical,dragging);this.placeCamera(c,dt);
  this.current!.update(seconds);
  this.knight?.updateActivity(dt);
  if(!paused&&Math.abs(c.actor.position.y)<.7&&Math.abs(c.actor.position.x-SITE.x)<1.8&&Math.abs(c.actor.position.z-SITE.exitZ)<.65)this.leave();
 }
 private placeCamera(c:CharacterController,_dt:number){
  const f=this.follow,size=c.actor.scale.x,target=c.actor.position.clone().add(new T.Vector3(0,.9*size,0));
  this.camera.fov=innerHeight>innerWidth?75:55;this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();
  this.camera.position.set(target.x+f.distance*size*Math.cos(f.elevation)*Math.sin(f.azimuth),target.y+f.distance*size*Math.sin(f.elevation),target.z+f.distance*size*Math.cos(f.elevation)*Math.cos(f.azimuth));this.camera.lookAt(target);this.camera.updateMatrixWorld();
 }
 routeRemotes(players:Iterable<CharacterController>){
  const living=new Set<T.Object3D>();for(const c of players){living.add(c.actor);const inside=c.actor.userData.location==='meta-knight-arena'&&!!this.current;
   if(inside){if(!this.remoteRestores.has(c.actor))this.remoteRestores.set(c.actor,arenaMaterials(c.actor));this.current!.scene.add(c.actor);c.actor.visible=true;}
   else if(this.remoteRestores.has(c.actor)){this.remoteRestores.get(c.actor)!();this.remoteRestores.delete(c.actor);this.meadow.add(c.actor);}
  }
  for(const [actor,restore] of this.remoteRestores)if(!living.has(actor)){restore();this.remoteRestores.delete(actor);}
 }
 render(){if(this.active)this.renderer.render(this.current!.scene,this.camera);}
}
