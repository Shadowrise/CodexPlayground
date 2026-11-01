import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url)),output=root+'node_modules/.cache/meta-knight-spectator-camera/';
await mkdir(root+'.cache',{recursive:true});await mkdir(output,{recursive:true});
await writeFile(root+'.cache/knight-spectator-camera-qa.ts',`
import * as T from 'three';
import {CharacterController} from '/src/controller';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {FollowCamera} from '/src/follow-camera';
import {MetaKnightArenaTravel} from '/src/meta-knight-arena-travel';
import {startKnightBattle,setKnightPhase,advanceKnightBattle,knightPosition} from '/src/meta-knight-battle';
import {startHelperAbility} from '/src/meta-knight-helper';
import {beginKnightDuet} from '/src/meta-knight-duet';
import {gamepadCameraZoom,stickSteering} from '/src/gamepad';
import {touchMotion} from '/src/touch-input';
import {TURN_RATE} from '/src/movement-input';
import {KIRBY_VARIANTS} from '/src/variant-palette';
import '/src/style.css';
const asset=await new GLTFLoader().loadAsync('/models/meta-knight-animated.glb'),make=()=>new CharacterController(clone(asset.scene),asset.animations);
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(1);document.body.append(renderer.domElement);document.body.className='in-meta-knight-arena';
const c=make(),follow=new FollowCamera(),events:any[]=[],variant=KIRBY_VARIANTS.findIndex(v=>v[0]==='Meta Knight');
let battle:any,actors:any[]=[],clock=100000,localId='helper',frozen=false;
const travel=new MetaKnightArenaTravel(renderer,new T.Scene(),follow,()=>{},make,{online:()=>true,state:()=>battle,id:()=>localId,now:()=>clock,actors:()=>actors,profiles:()=>actors.map(a=>({id:a.id,name:a.id,variant:a.metaKnight?variant:0,location:'meta-knight-arena',p:a.p})),send:action=>events.push(action),win:()=>{},cue:()=>{}});
await travel.enter(c);
const idle={forward:false,left:false,right:false};
function tick(count=1,horizontal=0,vertical=0,input=idle){for(let i=0;i<count;i++){if(!frozen)clock+=1000/60;travel.update(1/60,clock/1000,c,input,horizontal,vertical,false,false);}travel.render();}
function snapshot(){const target=c.actor.getWorldPosition(new T.Vector3()).add(new T.Vector3(0,.9*c.actor.scale.x,0)),direction=travel.camera.getWorldDirection(new T.Vector3());return {stage:battle.stage,spectating:travel.spectating,helperMode:travel.helperMode,jointCamera:travel.jointCamera,position:travel.camera.position.toArray(),target:target.toArray(),distance:travel.camera.position.distanceTo(target),heading:Math.atan2(-direction.x,-direction.z),pitch:Math.asin(-direction.y),zoom:follow.distance,azimuth:follow.azimuth,elevation:follow.elevation,actor:c.actor.position.toArray(),state:c.state,hp:battle.players[localId].hp,events:[...events],drift:(travel as any).cosmicFrame.position.length()};}
function setup(phase:number,planet=false,hp=0,role='helper'){clock+=100000;localId=role;frozen=false;events.length=0;actors=[{id:'hero',p:[0,0,-2],yaw:0,available:true},{id:'helper',p:[30,0,9],yaw:.7,available:true,metaKnight:true,side:'boss'},{id:'ally',p:[-20,0,10],yaw:0,available:true,metaKnight:true,side:'boss'}];battle=startKnightBattle(actors,'hero',clock)!;for(const id of Object.keys(battle.opponents??{}))delete battle.players[id];delete battle.opponents;delete battle.sharedOpponents;delete battle.teamHp;battle.players.helper.hp=hp;actors[0].p=[-25,0,15];
setKnightPhase(battle,phase,actors,clock,phase===4?planet?3:1:undefined);if(phase!==4){battle.stage=phase===3?'shield':'rest';battle.until=clock+1e9;if(phase===3)battle.activeCrystal=0;}else for(const a of actors)a.p[1]=180;
const actor=actors.find(a=>a.id===localId)!;c.actor.position.set(2000+actor.p[0],actor.p[1],actor.p[2]);c.yaw=actor.yaw;c.actor.rotation.y=c.yaw;follow.reset(c.yaw);tick(20);return snapshot();}
function advance(){clock=battle.until;advanceKnightBattle(battle,actors,clock,'hero');tick();return snapshot();}
function beginAscent(){setKnightPhase(battle,4,actors,clock);frozen=true;tick();return snapshot();}
function scene(kind:string,role='helper'){
 setup(kind==='ground2'?2:kind==='shield'?3:kind==='planet'||kind==='duet-cosmic'||kind==='fall'||kind==='won'?4:1,kind==='planet',5,role);
 if(kind==='transition'||kind.startsWith('cosmic-')){beginAscent();let guard=0;while(kind!=='transition'&&battle.stage!==kind&&guard++<12)advance();if(guard>=12)throw Error('Unknown ascent stage '+kind);}
 if(kind.startsWith('duet')||kind==='other-duet'){if(!startHelperAbility(battle,actors[kind==='other-duet'?2:1],4,clock)||!beginKnightDuet(battle,actors,clock,knightPosition(battle,clock)))throw Error('Duet did not start');advance();}
 if(kind.startsWith('individual-')){const ability=kind==='individual-shot'?1:kind==='individual-dash'?2:3;if(!startHelperAbility(battle,actors[1],ability,clock))throw Error('Individual ability did not start');}
 if(kind==='fall'||kind==='won'){battle.hp=0;battle.stage='cosmic-star-stun';battle.until=clock+1;advance();if(kind==='won')advance();}
 if(kind==='celebration'){battle.stage='lost';battle.celebration={at:clock,facing:.7,boss:[0,0,-9],helpers:{helper:[30,0,9],ally:[-20,0,10]}};}
 frozen=true;if(kind!=='won')clock=battle.since+Math.min(1000,(battle.until-battle.since)/2);tick(30);return snapshot();
}
function steering(scheme:'touch'|'gamepad',x:number,y:number,fps:number,role:string){
 setup(4,false,5,role);frozen=true;const normal=make(),normalCamera=new FollowCamera(),start=c.yaw,dt=1/fps;normal.yaw=start;normalCamera.reset(start);follow.reset(start);
 let difference=0,fastest=0;const motion=(camera:FollowCamera,yaw:number)=>scheme==='touch'?touchMotion(x,y,camera.azimuth,yaw,dt):{forward:y<-.05,backward:y>.05,steer:stickSteering(x,y)};
 for(let i=0;i<fps*3;i++){
  const before=normal.yaw;normal.update(dt,{...idle,...motion(normalCamera,normal.yaw)});normalCamera.update(dt,normal.yaw,before!==normal.yaw,0,0,scheme==='touch'&&Math.hypot(x,y)>.18);
  const previous=c.yaw;travel.update(dt,clock/1000,c,{...idle,...motion(follow,c.yaw),scheme,moveStick:{x,y}},0,0,false,false);
  difference=Math.max(difference,Math.abs((c.yaw-start)-(normal.yaw-start)));fastest=Math.max(fastest,Math.abs(c.yaw-previous)/dt);
 }
 travel.render();const result={scheme,x,y,fps,role,ordinary:(normal.yaw-start)*180/Math.PI,cosmic:(c.yaw-start)*180/Math.PI,difference,fastest,maximum:TURN_RATE};normal.disposeEffects();return result;
}
(window as any).qa={travel,c,setup,scene,advance,beginAscent,snapshot,tick,steering,orbit(dx:number,dy:number){follow.orbit(dx,dy);tick(180);},zoom(delta:number){follow.zoom(delta);tick(180);},padZoom(button:number){for(let i=0;i<60;i++){follow.zoom(gamepadCameraZoom(new Set([button]),travel.helperMode,travel.jointCamera)*10);tick();}},run(){tick(120,1,.2,{...idle,forward:true});return snapshot();},tryMove(){tick(60,0,0,{...idle,forward:true,jump:true,attack:true});return snapshot();}};
document.body.dataset.ready='true';
`);
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),errors=[],report=[];
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 let rejectReady;const failed=new Promise((_,reject)=>{rejectReady=reject;});
 page.on('pageerror',error=>{errors.push(error.stack);console.error(error.stack);rejectReady(error);});
 page.on('console',message=>{if(message.type()==='error')console.error(message.text());});
 page.on('requestfailed',request=>rejectReady(new Error(request.url()+': '+request.failure()?.errorText)));
 await page.routeWebSocket(/^ws:\/\/127\.0\.0\.1:\d+\//,ws=>ws.onMessage(()=>{}));
 await page.route('**/knight-spectator-camera-qa',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body><script type="module" src="/.cache/knight-spectator-camera-qa.ts"></script></body></html>'}));
 await Promise.race([page.goto((process.env.GAME_URL??'http://127.0.0.1:5197')+'/knight-spectator-camera-qa').then(()=>page.waitForFunction(()=>document.body.dataset.ready==='true',{},{timeout:180000})),failed]);
 if(process.env.KNIGHT_STEERING_ONLY){
  for(const role of ['helper','hero'])for(const scheme of ['touch','gamepad'])for(const fps of [30,60,120])for(const [x,y] of [[1,0],[-1,0],[.7,-.7],[-.7,-.7],[0,1],[.2,-1],[0,0]]){
   const result=await page.evaluate(({scheme,x,y,fps,role})=>qa.steering(scheme,x,y,fps,role),{scheme,x,y,fps,role});report.push(result);
   assert(result.difference<1e-7,'ordinary and fourth-phase turn trajectories must match: '+JSON.stringify(result));assert(result.fastest<=result.maximum+1e-7,'turning cannot exceed the ordinary limit');
  }
  assert.deepEqual(errors,[]);await writeFile(output+'steering-report.json',JSON.stringify(report,null,2));console.log('PASS: 84 joystick turn comparisons match ordinary play, both roles, touch and gamepad, 30/60/120 fps');
 }else{
 for(const [phase,planet] of [[1,false],[2,false],[3,false],[4,false],[4,true]]){
  const initial=await page.evaluate(({phase,planet})=>qa.setup(phase,planet),{phase,planet});assert(initial.spectating);assert(!initial.helperMode,'D-pad zoom is available after helper abilities are disabled');
  await page.evaluate(()=>qa.orbit(-160,60));const orbited=await page.evaluate(()=>qa.snapshot());
  assert(Math.abs(orbited.azimuth-initial.azimuth)>.5);assert(orbited.elevation>initial.elevation+.2);assert(Math.hypot(...orbited.position.map((v,i)=>v-initial.position[i]))>3,'the rendered camera responds to orbit');
  await page.evaluate(()=>qa.zoom(-600));const near=await page.evaluate(()=>qa.snapshot());assert(near.distance<orbited.distance*.8,'the rendered camera zooms closer');
  await page.evaluate(()=>qa.zoom(1000));const far=await page.evaluate(()=>qa.snapshot());assert(far.distance>near.distance*1.5,'the rendered camera zooms out');
  await page.evaluate(()=>qa.tick(60,1,-.2));const stick=await page.evaluate(()=>qa.snapshot());assert(Math.abs(stick.azimuth-far.azimuth)>.5,'arrow/gamepad camera input works');
  const stationary=await page.evaluate(()=>qa.tryMove());assert.deepEqual(stationary.actor,stick.actor);assert.equal(stationary.state,'Sitting');assert.equal(stationary.hp,0);assert.deepEqual(stationary.events,[]);
  await page.evaluate(()=>qa.tick(180));const held=await page.evaluate(()=>qa.snapshot());assert(Math.abs(held.azimuth-stationary.azimuth)<.0001,'idle spectating retains the chosen heading');
  if(phase===4){assert(held.drift>100,'the fourth phase uses the travelling world frame');assert(held.distance<25,'the camera remains beside the actual world-space character');}
  report.push({phase,planet,initial,orbited,near,far,held});console.log('PASS: defeated helper orbit, pitch, zoom and immobility in phase '+phase+(planet?' with planetary formation':''));
 }
 await page.screenshot({path:output+'cosmic-spectator.png'});
 const cases=['duet-ground','transition','cosmic-charge','cosmic-strike','cosmic-surge','cosmic-lift','cosmic-rise','cosmic-flight','planet','duet-cosmic'];
 for(const role of ['helper'])for(const kind of cases){
  const initial=await page.evaluate(({kind,role})=>qa.scene(kind,role),{kind,role});
  assert(initial.jointCamera,kind+': only the shared action enables the new camera');
  await page.evaluate(()=>qa.orbit(-160,60));const turned=await page.evaluate(()=>qa.snapshot());
  const turn=Math.atan2(Math.sin(turned.heading-initial.heading),Math.cos(turned.heading-initial.heading));assert(Math.abs(turn)>.5,role+' '+kind+': rendered orbit');assert(turned.pitch>initial.pitch+.15,role+' '+kind+': rendered pitch');
  await page.evaluate(()=>qa.zoom(-600));const near=await page.evaluate(()=>qa.snapshot());assert(near.distance<turned.distance*.8,role+' '+kind+': zoom in');
  await page.evaluate(()=>qa.padZoom(6));const far=await page.evaluate(()=>qa.snapshot());assert(far.distance>near.distance*1.5,role+' '+kind+': trigger zoom out');
  await page.evaluate(()=>qa.tick(60,1,-.2));const stick=await page.evaluate(()=>qa.snapshot());assert(Math.abs(Math.atan2(Math.sin(stick.heading-far.heading),Math.cos(stick.heading-far.heading)))>.5,role+' '+kind+': right stick / arrow orbit');
  if(kind==='duet-ground'||kind==='cosmic-rise')await page.screenshot({path:output+role+'-'+kind+'.png'});
  report.push({role,kind,initial,turned,near,far});console.log('PASS: '+role+' camera orbit, pitch, zoom and controller during '+kind);
 }
 for(const role of ['helper','hero'])for(const kind of role==='helper'?['ground1','ground2','shield','individual-shot','individual-dash','individual-orbs','other-duet','fall','celebration']:['ground1','ground2','shield','duet-ground','duet-cosmic','planet']){
  const initial=await page.evaluate(({kind,role})=>{qa.scene(kind,role);qa.tick(240);return qa.snapshot();},{kind,role});assert(!initial.jointCamera,role+' '+kind+': no shared action camera');
  await page.evaluate(()=>{qa.orbit(-160,60);qa.zoom(-600);qa.padZoom(6);qa.tick(60,1,-.2);});const after=await page.evaluate(()=>qa.snapshot());
  assert(Math.hypot(...after.position.map((value,i)=>value-initial.position[i]))<.01,role+' '+kind+': original camera position is unchanged by manual inputs');
  assert(Math.abs(after.heading-initial.heading)<.001&&Math.abs(after.pitch-initial.pitch)<.001,role+' '+kind+': original camera direction is unchanged');
  report.push({role,kind,initial,after});console.log('PASS: '+role+' retains the original camera during '+kind);
 }
 for(const [role,kind] of [['helper','won'],['hero','won'],['hero','celebration']]){
  const initial=await page.evaluate(({kind,role})=>qa.scene(kind,role),{kind,role});assert(!initial.jointCamera);
  await page.evaluate(()=>qa.zoom(-600));const zoomed=await page.evaluate(()=>qa.snapshot());assert(zoomed.distance<initial.distance*.8,'the original post-fight camera remains available');
 }
 const beforeRun=await page.evaluate(()=>qa.scene('ground1'));const running=await page.evaluate(()=>qa.run());
 assert(Math.hypot(...running.actor.map((value,i)=>value-beforeRun.actor[i]))>1,'the helper really runs in the ordinary combat regression');
 assert(Math.abs(running.heading)<.001&&Math.abs(running.pitch-Math.atan2(.68,.82))<.001,'running keeps the original fixed camera despite camera stick input');
 await page.evaluate(()=>{qa.setup(1,false,5);qa.orbit(-160,60);qa.zoom(-400);});const entry=await page.evaluate(()=>qa.beginAscent());
 assert(Math.abs(entry.zoom-10)<.001&&Math.abs(entry.elevation-.25)<.001,'shared scenes start with their original framing, ignoring inactive camera inputs from ordinary combat');
 await page.evaluate(()=>{qa.orbit(-160,60);qa.zoom(-400);});const chosen=await page.evaluate(()=>qa.snapshot());
 let next=chosen;for(let i=0;i<7;i++){
  assert(Math.abs(next.zoom-chosen.zoom)<.0001,'ascent transitions preserve zoom');assert(Math.abs(next.elevation-chosen.elevation)<.0001,'ascent transitions preserve pitch');
  assert(Math.abs(Math.atan2(Math.sin(next.azimuth-chosen.azimuth),Math.cos(next.azimuth-chosen.azimuth)))<.001,'ascent transitions preserve orbit');
  next=await page.evaluate(()=>qa.advance());
 }
 assert(!next.jointCamera&&Math.abs(next.zoom-10)<.001&&Math.abs(next.elevation-.25)<.001,'after the shared ascent the original combat camera is restored');
 assert.deepEqual(errors,[]);await writeFile(output+'report.json',JSON.stringify({report,errors},null,2));
 console.log('PASS: running retains the original camera; joint actions and defeat spectating allow manual control; no browser errors');
 }
}finally{await browser.close();}
