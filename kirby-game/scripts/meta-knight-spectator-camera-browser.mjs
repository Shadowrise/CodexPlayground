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
import {startKnightBattle,setKnightPhase} from '/src/meta-knight-battle';
import {KIRBY_VARIANTS} from '/src/variant-palette';
import '/src/style.css';
const asset=await new GLTFLoader().loadAsync('/models/meta-knight-animated.glb'),make=()=>new CharacterController(clone(asset.scene),asset.animations);
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(1);document.body.append(renderer.domElement);document.body.className='in-meta-knight-arena';
const c=make(),follow=new FollowCamera(),events:any[]=[],variant=KIRBY_VARIANTS.findIndex(v=>v[0]==='Meta Knight');
let battle:any,actors:any[]=[],clock=100000;
const travel=new MetaKnightArenaTravel(renderer,new T.Scene(),follow,()=>{},make,{online:()=>true,state:()=>battle,id:()=>'helper',now:()=>clock,actors:()=>actors,profiles:()=>actors.map(a=>({id:a.id,name:a.id,variant:a.metaKnight?variant:0,location:'meta-knight-arena',p:a.p})),send:action=>events.push(action),win:()=>{},cue:()=>{}});
 await travel.enter(c);
const idle={forward:false,left:false,right:false};
function tick(count=1,horizontal=0,vertical=0,input=idle){for(let i=0;i<count;i++){clock+=1000/60;travel.update(1/60,clock/1000,c,input,horizontal,vertical,false,false);}travel.render();}
function snapshot(){const target=c.actor.getWorldPosition(new T.Vector3()).add(new T.Vector3(0,.9*c.actor.scale.x,0));return {spectating:travel.spectating,helperMode:travel.helperMode,position:travel.camera.position.toArray(),target:target.toArray(),distance:travel.camera.position.distanceTo(target),azimuth:follow.azimuth,elevation:follow.elevation,actor:c.actor.position.toArray(),state:c.state,hp:battle.players.helper.hp,events:[...events],drift:(travel as any).cosmicFrame.position.length()};}
function setup(phase:number,planet=false,hp=0){clock+=100000;events.length=0;actors=[{id:'hero',p:[0,0,-2],yaw:0,available:true},{id:'helper',p:[30,0,9],yaw:.7,available:true,metaKnight:true,side:'boss'},{id:'ally',p:[-20,0,10],yaw:0,available:true,metaKnight:true,side:'boss'}];battle=startKnightBattle(actors,'hero',clock)!;for(const id of Object.keys(battle.opponents??{}))delete battle.players[id];delete battle.opponents;delete battle.sharedOpponents;delete battle.teamHp;battle.players.helper.hp=hp;
setKnightPhase(battle,phase,actors,clock,phase===4?planet?3:1:undefined);if(phase!==4){battle.stage=phase===3?'shield':'rest';battle.until=clock+1e9;if(phase===3)battle.activeCrystal=0;}else for(const a of actors)a.p[1]=180;
c.actor.position.set(2030,phase===4?180:0,9);c.yaw=.7;c.actor.rotation.y=.7;follow.reset(c.yaw);tick(20);return snapshot();}
(window as any).qa={travel,c,setup,snapshot,tick,orbit(dx:number,dy:number){follow.orbit(dx,dy);tick(180);},zoom(delta:number){follow.zoom(delta);tick(180);},tryMove(){tick(60,0,0,{...idle,forward:true,jump:true,attack:true});return snapshot();}};
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
 const alive=await page.evaluate(()=>qa.setup(1,false,5));assert(!alive.spectating&&alive.helperMode,'living helpers keep their ability controls');
 const before=alive.position;await page.evaluate(()=>qa.orbit(-160,60));assert.deepEqual((await page.evaluate(()=>qa.snapshot())).position,before,'the living helper retains the encounter camera');
 assert.deepEqual(errors,[]);await writeFile(output+'report.json',JSON.stringify({report,errors},null,2));
 console.log('PASS: living helper camera and abilities remain active; no browser errors');
}finally{await browser.close();}
