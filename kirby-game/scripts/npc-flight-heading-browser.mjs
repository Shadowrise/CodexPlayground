import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const output=new URL('../node_modules/.cache/npc-flight-heading/',import.meta.url);await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined),headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1000,height:700}});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/npc-flight-heading-check',route=>route.fulfill({contentType:'text/html',body:'<style>body{margin:0;background:#edf3df}canvas{display:block}</style>'}));
 await page.goto(new URL('/npc-flight-heading-check',process.env.GAME_URL||'http://127.0.0.1:5173/').href);
 const report=await page.evaluate(async()=>{
  const T=await import('/node_modules/.vite/deps/three.js');
  const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
  const {clone}=await import('/node_modules/three/examples/jsm/utils/SkeletonUtils.js');
  const {CharacterController}=await import('/src/controller.ts'),{KirbyNpc}=await import('/src/npcs.ts'),{KIRBY_VARIANTS}=await import('/src/variants.ts');
  const {NightFireflies}=await import('/src/night-fireflies.ts'),{actorState,applyActor}=await import('/src/network-actors.ts');
  const loader=new GLTFLoader(),[kirby,firefly]=await Promise.all(['kirby','firefly'].map(n=>loader.loadAsync(`/models/${n}-animated.glb`)));
  const scene=new T.Scene();scene.background=new T.Color('#d4e8eb');scene.add(new T.HemisphereLight('#ffffff','#74964b',3));const light=new T.DirectionalLight('#fff4d3',3);light.position.set(6,12,8);scene.add(light);
  const ground=new T.Mesh(new T.PlaneGeometry(80,80),new T.MeshStandardMaterial({color:'#88ad66',roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.01;scene.add(ground);
  const world=new NightFireflies(firefly),local=new CharacterController(clone(kirby.scene),kirby.animations),remote=new CharacterController(clone(kirby.scene),kirby.animations),bug=world.bugs[0];
  bug.home.set(0,0,0);bug.phase=25;world.update(0,false,bug.home);world.bugs.forEach((b,i)=>{if(i)b.carrier.visible=false;});world.instances.enabled=false;
  remote.yaw=Math.PI;remote.actor.rotation.set(0,Math.PI,0);remote.setActivity('FireflyRide');const state=actorState(remote,'Remote',0);state.ride={key:'bug:0',data:world.networkState()[0]};world.networkBlocked.add(0);world.syncRemoteRider(0,remote,state,.1);world.networkBlocked.clear();world.update(0,false,bug.home);
  local.actor.position.copy(bug.home);if(!world.board(local))throw Error('Local boarding failed');scene.add(world.group,local.actor);
  const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1000,700);document.body.append(renderer.domElement);const camera=new T.PerspectiveCamera(45,1000/700,.1,100);let worstHeading=1,worstTravel=1;
  for(let frame=0;frame<260;frame++){
   const previous=local.actor.position.clone();world.moveRider(1/60,{forward:true,left:true,right:false});world.syncRider(1/60);world.update(1/60,false,local.actor.position);world.syncInstances();scene.updateMatrixWorld(true);
   const nose=new T.Vector3(0,0,1).transformDirection(bug.firefly.object.getObjectByName('Motion').matrixWorld),facing=new T.Vector3(0,0,1).transformDirection(local.actor.matrixWorld),travel=local.actor.position.clone().sub(previous).setY(0).normalize();
   worstHeading=Math.min(worstHeading,nose.dot(facing));worstTravel=Math.min(worstTravel,nose.dot(travel));
   camera.position.copy(local.actor.position).add(new T.Vector3(9,6,11));camera.lookAt(local.actor.position);renderer.render(scene,camera);
  }
  const host=new KirbyNpc(kirby.scene,kirby.animations,0,KIRBY_VARIANTS[1]),peer=new KirbyNpc(kirby.scene,kirby.animations,1,KIRBY_VARIANTS[2]);host.actor.position.set(0,.4,0);host.surfaceY=.4;host.networkAnimate('Fly',0);host.flight.press();for(let i=0;i<28;i++)host.update(.05,[]);
  applyActor(peer,actorState(host,'NPC',1),0,true);peer.networkApplyLife(host.networkLife());let maxHeightError=0,landed=false;
  for(let i=0;i<240;i++){host.update(1/60,[]);peer.update(1/60,[]);maxHeightError=Math.max(maxHeightError,Math.abs(host.actor.position.y-peer.actor.position.y));if(!peer.flight.active){landed=true;break;}}
  return {worstHeading,worstTravel,maxHeightError,landed,landingY:peer.actor.position.y,turnRadians:local.yaw};
 });
 await page.screenshot({path:fileURLToPath(new URL('mounted-turn.png',output))});
 assert(report.worstHeading>.99999);assert(report.worstTravel>.99999);assert(report.maxHeightError<.0011);assert(report.landed);assert(Math.abs(report.landingY-.4)<.0011);assert.deepEqual(errors,[]);
 await writeFile(new URL('checks.json',output),JSON.stringify({report,errors},null,2));console.log(JSON.stringify({report,errors}));
}finally{await browser.close();}
