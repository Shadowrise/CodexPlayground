import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const output=new URL('../design/meta-knight-rides/lighting/',import.meta.url);await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1200,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://127.0.0.1:8787/**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({count:0,occupiedVariants:[]})}));
 await page.route('**/src/main.ts*',async route=>{
  const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.knightLighting={scene,camera,renderer,shadows,celestialLighting,get reflections(){return metaKnightReflections;}};'});
 });
 await page.goto(process.env.GAME_URL??'http://127.0.0.1:5176/');
 await page.waitForFunction(()=>window.knightLighting?.reflections&&!document.querySelector('#start-game')?.disabled,null,{timeout:120000});
 await page.evaluate(async()=>{
  const T=await import('/node_modules/.vite/deps/three.js'),{daylight}=await import('/src/day-cycle.ts');
  const api=window.knightLighting;api.renderer.setAnimationLoop(null);
  const cart=api.scene.getObjectByName('Meta Knight coaster cart').clone(true);
  api.scene.children.forEach(o=>{if(!o.isLight)o.visible=false;});
  cart.traverse(o=>o.visible=true);cart.position.set(0,0,0);cart.rotation.set(0,.25,0);api.scene.add(cart);
  const floor=new T.Mesh(new T.PlaneGeometry(100,100),new T.MeshStandardMaterial({color:'#b8c9d4',roughness:.8}));
  floor.rotation.x=-Math.PI/2;floor.position.y=-.2;floor.receiveShadow=true;api.scene.add(floor);
  api.shadows.setupMaterial(floor.material);api.celestialLighting.setupMaterial(floor.material);
  api.scene.fog=null;api.camera.fov=32;api.camera.aspect=innerWidth/innerHeight;api.camera.position.set(5,3.7,7);api.camera.lookAt(0,1.8,0);api.camera.updateProjectionMatrix();api.camera.updateMatrixWorld();api.shadows.updateFrustums();
  const surfaces=new Map();cart.traverse(o=>{if(o.isMesh)for(const material of Array.isArray(o.material)?o.material:[o.material])if(material.envMap)surfaces.set(material,material.envMap);});
  api.setLighting=(phase,reflections)=>{
   const time=daylight(phase);api.celestialLighting.update(time);api.reflections.update(time);api.shadows.update();
   for(const [material,map] of surfaces){const next=reflections?map:null;if(material.envMap!==next){material.envMap=next;material.needsUpdate=true;}}
   api.scene.background=new T.Color(time.day>.5?'#b3d9ef':'#0b1428');api.renderer.toneMappingExposure=1+time.day*.2;
  };
  api.render=()=>api.renderer.render(api.scene,api.camera);
  api.renderer.setPixelRatio(1);api.renderer.setSize(innerWidth,innerHeight);
  document.body.append(api.renderer.domElement);document.querySelectorAll('body > *').forEach(o=>{if(o!==api.renderer.domElement)o.style.display='none';});api.renderer.domElement.style.cssText='position:fixed;inset:0;visibility:visible';
  api.cart=cart;api.floor=floor;
  api.sampleMetal=(kind,phase,reflections)=>{
   api.setLighting(phase,reflections);
   const saved=[],selected=[];cart.traverse(o=>{if(o.isMesh){saved.push([o,o.visible,o.material]);const mats=Array.isArray(o.material)?o.material:[o.material];o.visible=mats.some(m=>kind==='mask'?m.name.startsWith('Mask'):m.name.startsWith('Galaxia')&&m.metalness>.9);if(o.visible)selected.push(o);}});
   const background=api.scene.background;api.scene.background=new T.Color('#000000');floor.visible=false;
   const white=new T.MeshBasicMaterial({color:'#ffffff',toneMapped:false});selected.forEach(o=>o.material=white);api.render();
   const gl=api.renderer.getContext(),width=api.renderer.domElement.width,height=api.renderer.domElement.height,mask=new Uint8Array(width*height*4),pixels=new Uint8Array(mask.length);
   gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,mask);
   for(const [o,,material] of saved)o.material=material;api.render();gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
   let sum=0,count=0;for(let i=0;i<mask.length;i+=4)if(mask[i]>128){sum+=.2126*pixels[i]+.7152*pixels[i+1]+.0722*pixels[i+2];count++;}
   saved.forEach(([o,visible,material])=>{o.visible=visible;o.material=material;});white.dispose();floor.visible=true;api.scene.background=background;
   return {mean:sum/count,pixels:count};
  };
 });
 const samples={};
 for(const [label,phase,reflections] of [['day-before',.25,false],['day-after',.25,true],['night-after',.75,true]]){
  samples[label]=await page.evaluate(({phase,reflections})=>{
   const api=window.knightLighting;const mask=api.sampleMetal('mask',phase,reflections),blade=api.sampleMetal('blade',phase,reflections);
   api.setLighting(phase,reflections);api.render();api.renderer.setAnimationLoop(()=>api.render());return {mask,blade,sceneEnvironment:api.scene.environment===null,calls:api.renderer.info.render.calls,triangles:api.renderer.info.render.triangles};
  },{phase,reflections});
  await page.screenshot({path:fileURLToPath(new URL(label+'.png',output))});
  await page.evaluate(()=>window.knightLighting.renderer.setAnimationLoop(null));
 }
 for(const kind of ['mask','blade']){
  assert(samples['day-after'][kind].pixels>500);assert(samples['day-after'][kind].mean>samples['day-before'][kind].mean*1.2,`${kind} reflects daylight even when direct highlights miss it`);
  assert(samples['night-after'][kind].mean<samples['day-after'][kind].mean*.85,`${kind} follows the day/night lighting`);
 }
 assert(samples['day-after'].sceneEnvironment);assert.equal(samples['day-before'].calls,samples['day-after'].calls);assert.equal(samples['day-before'].triangles,samples['day-after'].triangles);assert.deepEqual(errors,[]);
 await writeFile(new URL('report.json',output),JSON.stringify({samples,errors},null,2));console.log(JSON.stringify({samples,errors,output:output.href}));
}finally{await browser.close();}
