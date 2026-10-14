import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';

const output=new URL('../design/meta-knight-rides/',import.meta.url);
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1400,height:900}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 await page.goto(process.env.GAME_URL??'http://127.0.0.1:5173/?perf=1');
 await page.waitForSelector('#startup-loader',{state:'hidden',timeout:120000});
 await page.waitForFunction(()=>window.kirbyPerformance);
 await page.waitForFunction(()=>window.kirbyPerformance?.scene.getObjectByName('Meta Knight river boat')?.getObjectByName('Meta Knight · permanent passenger')&&!document.querySelector('#start-game')?.disabled,null,{timeout:120000});
 const initial=await page.evaluate(()=>{
  const {scene}=window.kirbyPerformance;
  const boat=scene.getObjectByName('Meta Knight river boat'),cart=scene.getObjectByName('Meta Knight coaster cart');
  return {boat:boat.position.toArray(),cart:cart.position.toArray(),boatPassengers:boat.children.filter(o=>o.name==='Meta Knight · permanent passenger').length,cartPassengers:cart.children.filter(o=>o.name==='Meta Knight · permanent passenger').length};
 });
 assert.equal(initial.boatPassengers,1);assert.equal(initial.cartPassengers,1);
 await page.waitForTimeout(1200);
 const movement=await page.evaluate(initial=>{
  const {scene}=window.kirbyPerformance;
  return {boat:scene.getObjectByName('Meta Knight river boat').position.toArray().some((v,i)=>Math.abs(v-initial.boat[i])>.1),cart:scene.getObjectByName('Meta Knight coaster cart').position.toArray().some((v,i)=>Math.abs(v-initial.cart[i])>.1)};
 },initial);
 assert(movement.boat&&movement.cart,'both permanent passengers travel in the actual game scene');
 await page.evaluate(async()=>{
  const T=await import('/node_modules/.vite/deps/three.js');
  const {RoomEnvironment}=await import('/node_modules/three/examples/jsm/environments/RoomEnvironment.js');
  const api=window.kirbyPerformance;api.renderer.setAnimationLoop(null);
  const preview=new T.Scene();preview.background=new T.Color('#dbe7ef');
  const pmrem=new T.PMREMGenerator(api.renderer),room=new RoomEnvironment();
  preview.environment=pmrem.fromScene(room,.06).texture;preview.environmentIntensity=.85;room.dispose();pmrem.dispose();
  preview.add(new T.HemisphereLight('#e0eeff','#59657b',2));
  const light=new T.DirectionalLight('#fff6e8',3.2);light.position.set(-5,9,8);preview.add(light);
  const fill=new T.DirectionalLight('#adc7ff',1.6);fill.position.set(6,5,-4);preview.add(fill);
  const boat=api.scene.getObjectByName('Meta Knight river boat').clone(true);
  const cart=api.scene.getObjectByName('Meta Knight coaster cart').clone(true);
  const assemblies=[boat,cart];
  for(const [i,vehicle] of assemblies.entries()){
   vehicle.visible=true;vehicle.position.set(i===0?-2.8:2.8,0,0);vehicle.rotation.set(0,.4,0);
   vehicle.traverse(o=>{o.visible=true;o.castShadow=false;if(o.name==='Boat wake')o.visible=false;});
   vehicle.getObjectByName('Meta Knight · permanent passenger').visible=true;
   preview.add(vehicle);
  }
  const water=new T.Mesh(new T.CylinderGeometry(3.1,3.1,.1,80),new T.MeshPhysicalMaterial({color:'#5caabb',metalness:.25,roughness:.2,clearcoat:1}));
  water.position.set(-2.8,-.3,0);preview.add(water);
  const platform=new T.Mesh(new T.CylinderGeometry(2.9,2.9,.16,80),new T.MeshStandardMaterial({color:'#b8c9d4',roughness:.65}));
  platform.position.set(2.8,-.25,0);preview.add(platform);
  const ground=new T.Mesh(new T.PlaneGeometry(200,200),new T.MeshStandardMaterial({color:'#dbe7ef',roughness:.8}));ground.rotation.x=-Math.PI/2;ground.position.y=-.36;preview.add(ground);
  const camera=new T.PerspectiveCamera(32,innerWidth/innerHeight,.1,150);camera.position.set(9,6.5,14);camera.lookAt(0,1.4,0);
  api.renderer.shadowMap.enabled=false;api.renderer.toneMapping=T.ACESFilmicToneMapping;api.renderer.toneMappingExposure=1;
  api.renderer.setSize(innerWidth,innerHeight);api.renderer.setPixelRatio(1);
  document.body.append(api.renderer.domElement);
  document.querySelectorAll('body > *').forEach(o=>{if(o!==api.renderer.domElement)o.style.display='none';});
  api.renderer.domElement.style.cssText='position:fixed;inset:0;width:100%;height:100%;visibility:visible';
  const title=document.createElement('div');title.style.cssText='position:fixed;top:32px;left:42px;color:#334564;font:600 28px system-ui;z-index:100';title.textContent='Meta Knight';document.body.append(title);
  api.renderer.render(preview,camera);
  api.renderer.setAnimationLoop(()=>api.renderer.render(preview,camera));
  window.metaKnightRidePreview={preview,camera,renderer:api.renderer,boat,cart};
 });
 await page.screenshot({path:new URL('both-rides.png',output).pathname.replace(/^\/([A-Za-z]:)/,'$1')});
 await page.evaluate(()=>{
  const {preview,camera,renderer,boat,cart}=window.metaKnightRidePreview;
  cart.visible=false;camera.position.set(boat.position.x+5,3.3,6);camera.lookAt(boat.position.x,1.25,0);renderer.render(preview,camera);
 });
 await page.screenshot({path:new URL('boat.png',output).pathname.replace(/^\/([A-Za-z]:)/,'$1')});
 await page.evaluate(()=>{
  const {preview,camera,renderer,boat,cart}=window.metaKnightRidePreview;
  boat.visible=false;cart.visible=true;camera.position.set(cart.position.x+5,4.1,6);camera.lookAt(cart.position.x,1.75,0);renderer.render(preview,camera);
 });
 await page.screenshot({path:new URL('cart.png',output).pathname.replace(/^\/([A-Za-z]:)/,'$1')});
 for(const [side,label] of [[1,'right'],[-1,'left']]){
  await page.evaluate(side=>{
   const {preview,camera,renderer,cart}=window.metaKnightRidePreview;
   cart.rotation.set(0,0,0);camera.position.set(cart.position.x+side*7.8,3,2.1);camera.lookAt(cart.position.x,1.5,0);renderer.render(preview,camera);
  },side);
  await page.screenshot({path:new URL(`cart-${label}-side.png`,output).pathname.replace(/^\/([A-Za-z]:)/,'$1')});
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({initial,movement,errors,output:output.href}));
}finally{await browser.close();}
