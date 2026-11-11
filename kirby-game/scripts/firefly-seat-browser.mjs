import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {extname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from 'playwright';

const root=fileURLToPath(new URL('../',import.meta.url)),cache=resolve(root,'.cache'),publicDir=resolve(root,'public'),baseline=process.argv.includes('--baseline');
const output=resolve(cache,'firefly-seat',baseline?'before':'after');await mkdir(output,{recursive:true});
await writeFile(resolve(cache,'firefly-seat-qa.html'),'<html><body style="margin:0"><script type="module" src="./firefly-seat-qa.ts"></script></body></html>');
await writeFile(resolve(cache,'firefly-seat-qa.ts'),`
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {CharacterController} from '../src/controller';
import {NightFireflies} from '../src/night-fireflies';
import {actorState,applyActor} from '../src/network-actors';
const [kirby,pigeon,firefly]=await Promise.all(['kirby','pigeon','firefly'].map(name=>new GLTFLoader().loadAsync('/models/'+name+'-animated.glb')));
const scene=new T.Scene();scene.background=new T.Color('#c5e1ef');scene.add(new T.HemisphereLight('#ffffff','#66824f',2));
const sun=new T.DirectionalLight('#fff4df',3);sun.position.set(8,14,10);scene.add(sun);
const floor=new T.Mesh(new T.PlaneGeometry(2000,2000),new T.MeshLambertMaterial({color:'#88ac70'}));floor.rotation.x=-Math.PI/2;scene.add(floor);
const camera=new T.PerspectiveCamera(40,innerWidth/innerHeight,.1,1500),renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(1);document.body.append(renderer.domElement);
const idle={forward:false,left:false,right:false};let c:CharacterController,peer:CharacterController,world:NightFireflies,other:NightFireflies,frame=0;
function reset(kind:string,size=1){
 if(world)scene.remove(world.group,c.actor);
 const asset=kind==='pigeon'?pigeon:kirby;c=new CharacterController(clone(asset.scene),asset.animations);peer=new CharacterController(clone(asset.scene),asset.animations);c.resizeTo(size,true);
 world=new NightFireflies(firefly);other=new NightFireflies(firefly);frame=0;other.networkBlocked.add(0);const bug=world.bugs[0];world.bugs.forEach((_,i)=>{if(i)world.networkBlocked.add(i);});
 bug.home.set(135,0,140);bug.phase=25;world.update(0,false,bug.home);c.actor.position.copy(bug.home);c.yaw=0;c.actor.rotation.set(0,0,0);if(!world.board(c))throw Error('Board failed');scene.add(world.group,c.actor);return step(90);
}
function step(frames:number,input=idle){for(let i=0;i<frames;i++){
 const dt=1/60;world.moveRider(dt,input);world.syncRider(dt);world.update(dt,false,c.actor.position);
 const state=actorState(c,'Seat QA',c.isPigeon?14:0);state.ride={key:'bug:0',data:world.networkState()[0]};applyActor(peer,state,dt,frame++===0);other.syncRemoteRider(0,peer,state,dt);other.update(dt,false,peer.actor.position);
 }return metrics();}
function metrics(){const b=world.bugs[0];c.actor.updateMatrixWorld(true);b.carrier.updateMatrixWorld(true);
 const body=c.isPigeon?c.actor.getObjectByName('Continuous_pigeon_body'):c.actor.getObjectByName('Body_•_high_resolution_smooth_sphere');
 const bounds=new T.Box3().setFromObject(body,true),seat=(b.backSeat??b.shellSeat).getWorldPosition(new T.Vector3());
 peer.actor.updateMatrixWorld(true);const remoteBody=peer.isPigeon?peer.actor.getObjectByName('Continuous_pigeon_body'):peer.actor.getObjectByName('Body_•_high_resolution_smooth_sphere'),remoteSeat=(other.bugs[0].backSeat??other.bugs[0].shellSeat).getWorldPosition(new T.Vector3()),remoteBounds=new T.Box3().setFromObject(remoteBody,true);
 return {actor:c.actor.position.toArray(),mount:b.carrier.position.toArray(),seat:seat.toArray(),bodyMin:bounds.min.toArray(),bodyMax:bounds.max.toArray(),gap:bounds.min.y-seat.y,remoteGap:remoteBounds.min.y-remoteSeat.y,size:c.actor.scale.x,flying:!b.land};}
function draw(view='side',remote=false){const b=world.bugs[0],p=b.carrier.position,size=c.actor.scale.x;scene.remove(world.group,c.actor,other.group,peer.actor);const current=remote?other:world,rider=remote?peer:c;scene.add(current.group,rider.actor);
 camera.position.set(p.x+(view==='front'?0:9)*size,p.y+4.6*size,p.z+(view==='side'?0:10)*size);camera.lookAt(p.x,p.y+3*size,p.z-.4*size);camera.updateMatrixWorld();current.bugs.forEach((b,i)=>b.carrier.visible=i===0);current.syncInstances(camera);renderer.render(scene,camera);}
(window as any).qa={reset,step,metrics,draw,get c(){return c},get world(){return world},get peer(){return peer},get other(){return other},renderer};reset('pigeon');await renderer.compileAsync(scene,camera);draw();document.body.dataset.ready='true';
`);
const bundle=await build({root,configFile:false,publicDir:false,logLevel:'warn',build:{write:false,minify:false,rollupOptions:{input:resolve(cache,'firefly-seat-qa.html')}}});
const files=new Map(bundle.output.map(f=>['/'+f.fileName,f.type==='asset'?f.source:f.code])),types={'.html':'text/html','.js':'text/javascript','.glb':'model/gltf-binary'};
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--force_high_performance_gpu']});
const report={errors:[],samples:[]};
try{
 const context=await browser.newContext({viewport:{width:1000,height:800}});await context.route('**/*',async route=>{
  const url=new URL(route.request().url()),name=url.pathname==='/'?'/.cache/firefly-seat-qa.html':decodeURIComponent(url.pathname);let body=files.get(name);
  if(body===undefined){const path=resolve(publicDir,'.'+name);if(!path.startsWith(publicDir+sep))return route.abort();try{body=await readFile(path);}catch(error){if(error.code==='ENOENT')return route.fulfill({status:404});throw error;}}
  await route.fulfill({contentType:types[extname(name)]??'application/octet-stream',body});
 });
 const page=await context.newPage();page.on('pageerror',error=>report.errors.push(error.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.goto('http://127.0.0.1:5198/');await page.waitForFunction(()=>document.body.dataset.ready==='true',null,{timeout:90000});
 report.gpu=await page.evaluate(()=>{const gl=qa.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);});
 for(const kind of ['pigeon','kirby'])for(const size of [.3,1,7]){
  await page.evaluate(({kind,size})=>qa.reset(kind,size),{kind,size});
  for(const stage of ['landed','takeoff','flying','turning','landing']){
   const sample=await page.evaluate(stage=>qa.step(stage==='landed'?1:stage==='takeoff'?6:stage==='landing'?300:120,stage==='landed'||stage==='landing'?undefined:{forward:true,left:stage==='turning',right:false}),stage);
   report.samples.push({kind,size,stage,...sample});
   if(size===1)for(const view of ['side','front','three-quarter']){await page.evaluate(view=>qa.draw(view),view);await page.screenshot({path:resolve(output,kind+'-'+stage+'-'+view+'.png')});}
   if(size===1){await page.evaluate(()=>qa.draw('three-quarter',true));await page.screenshot({path:resolve(output,kind+'-'+stage+'-remote.png')});}
   if(!baseline)for(const gap of [sample.gap,sample.remoteGap]){assert(gap>=.02*size,JSON.stringify({kind,size,stage,gap}));assert(gap<.03*size,JSON.stringify({kind,size,stage,gap}));}
  }
 }
 assert.deepEqual(report.errors,[]);await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({output,gpu:report.gpu,samples:report.samples.length,errors:report.errors}));
}finally{await browser.close();}
