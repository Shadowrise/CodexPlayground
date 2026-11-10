import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {extname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from 'playwright';

const root=fileURLToPath(new URL('../',import.meta.url)),publicDir=resolve(root,'public'),cache=resolve(root,'.cache');
const output=resolve(process.env.QA_OUTPUT??resolve(cache,'firefly-drive'));
await mkdir(output,{recursive:true});
await writeFile(resolve(cache,'firefly-drive-qa.html'),'<html><body style="margin:0"><script type="module" src="./firefly-drive-qa.ts"></script></body></html>');
// Real ride/controller/rendering code in an isolated QA entry. No test globals
// or extra scene objects are added to the shipped game.
await writeFile(resolve(cache,'firefly-drive-qa.ts'),`
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {CharacterController} from '../src/controller';
import {NightFireflies} from '../src/night-fireflies';
import {createPlayerModel} from '../src/player-model';
import {KIRBY_VARIANTS} from '../src/variant-palette';
import {actorState,applyActor} from '../src/network-actors';
const [kirby,firefly]=await Promise.all(['kirby','firefly'].map(name=>new GLTFLoader().loadAsync('/models/'+name+'-animated.glb')));
const make=()=>{const m=createPlayerModel(kirby,KIRBY_VARIANTS[0]);return new CharacterController(m.model,m.clips);};
const c=make(),peer=make(),world=new NightFireflies(firefly),remote=new NightFireflies(firefly),bug=world.bugs[0];remote.networkBlocked.add(0);
const scene=new T.Scene();scene.background=new T.Color('#c1e5ec');scene.add(new T.HemisphereLight('#ffffff','#44753b',2.5));
const sun=new T.DirectionalLight('#fff3d5',3);sun.position.set(40,70,30);scene.add(sun);
const ground=new T.Mesh(new T.PlaneGeometry(500,500),new T.MeshLambertMaterial({color:'#72a755'}));ground.rotation.x=-Math.PI/2;scene.add(ground);
const grid=new T.GridHelper(500,100,'#4c8141','#669b4b');grid.position.y=.01;scene.add(grid,world.group,c.actor);
const camera=new T.PerspectiveCamera(48,innerWidth/innerHeight,.1,900),renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(innerWidth,innerHeight);document.body.append(renderer.domElement);
const keys=new Set<string>();addEventListener('keydown',e=>keys.add(e.code));addEventListener('keyup',e=>keys.delete(e.code));
let speed=0,slip=0,now=0;
function draw(){
 camera.position.set(c.actor.position.x+10,c.actor.position.y+9,c.actor.position.z-16);camera.lookAt(c.actor.position.x,c.actor.position.y,c.actor.position.z+3);camera.updateMatrixWorld();
 world.bugs.forEach((b,i)=>b.carrier.visible=i===0);world.syncInstances(camera);renderer.render(scene,camera);
}
function tick(input:any){
 const dt=1/60,before=c.actor.position.clone();c.fruitBoost.update(dt);world.moveRider(dt,input);world.syncRider(dt);world.update(dt,false,c.actor.position);now+=dt;
 const dx=c.actor.position.x-before.x,dz=c.actor.position.z-before.z;speed=Math.hypot(dx,dz)/dt;
 slip=speed>1e-7?Math.atan2(Math.sin(c.yaw-Math.atan2(dx,dz)),Math.cos(c.yaw-Math.atan2(dx,dz))):0;
 const state=actorState(c,'Ride QA',0);state.ride={key:'bug:0',data:world.networkState()[0]};applyActor(peer,state,dt,true);remote.syncRemoteRider(0,peer,state,dt);
 const other=remote.bugs[0].carrier.position;
 // The wire rounds coordinates, and the remote seat height deliberately damps
 // its offset. Horizontal travel and chassis heading must still agree.
 const horizontalError=Math.hypot(other.x-bug.carrier.position.x,other.z-bug.carrier.position.z),headingError=peer.actor.quaternion.angleTo(c.actor.quaternion);
 if(horizontalError>.0015||headingError>.002)throw Error('Remote mount lost its rider: '+JSON.stringify({horizontalError,headingError}));
}
function metrics(){return {p:c.actor.position.toArray(),yaw:c.yaw,speed,slip,land:bug.land,altitude:bug.carrier.position.y,cap:c.speed*2,riding:world.riding,fruitPickup:!!world.fruitPickupPosition};}
(window as any).qa={
 reset(){keys.clear();world.reset();remote.reset();remote.networkBlocked.add(0);c.setActivity('Idle');c.actor.position.set(135,0,140);c.yaw=0;c.actor.rotation.set(0,0,0);bug.home.set(135,0,140);bug.phase=25;world.update(0,false,c.actor.position);if(!world.board(c))throw Error('Boarding failed');speed=slip=now=0;draw();return metrics();},
 step(frames:number,input?:any){for(let i=0;i<frames;i++)tick(input??{forward:keys.has('KeyW'),backward:keys.has('KeyS'),left:keys.has('KeyA'),right:keys.has('KeyD')});draw();return metrics();},
 remount(){world.disembark();c.actor.position.copy(bug.home);c.yaw=Math.PI;c.actor.rotation.set(0,c.yaw,0);if(!world.board(c))throw Error('Remount failed');return metrics();},
 metrics
};
(window as any).qa.reset();document.body.dataset.ready='true';
`);
const bundle=await build({root,configFile:false,publicDir:false,logLevel:'warn',build:{write:false,minify:false,rollupOptions:{input:resolve(cache,'firefly-drive-qa.html')}}});
const files=new Map(bundle.output.map(f=>['/'+f.fileName,f.type==='asset'?f.source:f.code]));
const types={'.html':'text/html','.js':'text/javascript','.glb':'model/gltf-binary'};
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
let page;const report={errors:[],checks:{}};
try{
 const context=await browser.newContext({viewport:{width:1280,height:800}});
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url()),name=url.pathname==='/'?'/.cache/firefly-drive-qa.html':decodeURIComponent(url.pathname);let body=files.get(name);
  if(body===undefined){const path=resolve(publicDir,'.'+name);if(!path.startsWith(publicDir+sep))return route.abort();try{body=await readFile(path);}catch(error){if(error.code==='ENOENT')return route.fulfill({status:404});throw error;}}
  await route.fulfill({contentType:types[extname(name)]??'application/octet-stream',body});
 });
 page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.stack));page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL|shader/i.test(m.text()))report.errors.push(m.text());});
 await page.goto('http://127.0.0.1:5198/',{waitUntil:'commit'});await page.waitForFunction(()=>document.body.dataset.ready==='true',null,{timeout:60000});
 await page.keyboard.down('w');const start=await page.evaluate(()=>qa.step(6));assert(start.speed>0&&start.speed<start.cap*.2);
 const cruise=await page.evaluate(()=>qa.step(54));assert(Math.abs(cruise.speed-cruise.cap)<1e-6);report.checks.acceleration={first100ms:start.speed,at1second:cruise.speed};
 await page.keyboard.down('a');const turning=await page.evaluate(()=>qa.step(60));assert(turning.slip>.2&&turning.slip<.4);assert(Math.abs(turning.speed-turning.cap)<.001);
 await page.screenshot({path:resolve(output,'turning.png')});
 await page.keyboard.up('a');const straight=await page.evaluate(()=>qa.step(40));assert(Math.abs(straight.slip)<.02);report.checks.drift={atSpeedDegrees:turning.slip*180/Math.PI,afterStraightDegrees:straight.slip*180/Math.PI};
 await page.keyboard.up('w');const coasting=await page.evaluate(()=>qa.step(12));assert(coasting.speed>0&&!coasting.land&&!coasting.fruitPickup);
 const stopped=await page.evaluate(()=>qa.step(180));assert(stopped.speed<1e-8&&stopped.land&&stopped.fruitPickup);assert(stopped.p[0]!==coasting.p[0]||stopped.p[2]!==coasting.p[2]);
 await page.screenshot({path:resolve(output,'landed.png')});report.checks.coasting={after200ms:coasting.speed,landed:stopped.land};
 await page.evaluate(()=>qa.reset());await page.keyboard.down('w');await page.evaluate(()=>qa.step(60));await page.keyboard.up('w');await page.keyboard.down('s');
 const braking=await page.evaluate(()=>qa.step(6));assert(braking.speed>0);const reversing=await page.evaluate(()=>qa.step(60));assert(reversing.speed>0&&reversing.speed<4);assert(Math.abs(reversing.slip)>3);await page.keyboard.up('s');
 report.checks.reverse={brakesFirst:true,backwardSpeed:reversing.speed};
 await page.evaluate(()=>qa.remount());const remounted=await page.evaluate(()=>qa.step(60));assert.equal(remounted.speed,0);report.checks.remountClearsMomentum=true;
 await page.evaluate(()=>qa.reset());const analog=await page.evaluate(()=>qa.step(120,{forward:true,left:false,right:false,steer:.65}));assert(analog.slip>.1&&analog.slip<.3);report.checks.analogSteering=true;report.checks.remoteRiderInSync=true;
 assert.deepEqual(report.errors,[]);await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({output,...report}));
}catch(error){if(page)await page.screenshot({path:resolve(output,'failure.png')}).catch(()=>{});console.error(JSON.stringify(report));throw error;}
finally{await browser.close();}
