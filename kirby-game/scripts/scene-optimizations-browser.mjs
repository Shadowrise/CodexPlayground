import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const url=process.env.GAME_URL??'http://127.0.0.1:5183/';
const out=new URL('../artifacts/scene-optimizations-2026-10-23/',import.meta.url);await mkdir(out,{recursive:true});
const screenshots=new URL('../node_modules/.cache/scene-optimizations-visuals/',import.meta.url);await mkdir(screenshots,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const errors=[],report={views:[],fireflies:[],errors};
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080}});page.setDefaultTimeout(180000);
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL|shader/i.test(m.text()))errors.push(m.text());});
 await page.routeWebSocket(/.*/,ws=>ws.onMessage(()=>{}));
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');localStorage.setItem('kirby-render-scale-v1','1.25');});
 for(const endpoint of ['room','players','history/solo'])await page.route('**/'+endpoint,r=>r.fulfill({json:{ok:true,players:0,occupiedVariants:[],capacity:14}}));
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.qa={THREE,scene,camera,renderer,characterShadows,forestDetail,shadows,preparedShadows,sceneryVisibility,celestialLighting,updateSky,updateTreeShadows,treehouse,get fireflies(){return fireflies},get c(){return character}};'});});
 await page.goto(url);await page.locator('#startup-loader').waitFor({state:'hidden'});
 await page.click('#new-game');await page.fill('#player-name-input','Проверка оптимизаций');await page.click('#start-game');await page.waitForFunction(()=>window.qa?.c);
 await page.evaluate(()=>{
  const q=qa,T=q.THREE;q.renderer.setAnimationLoop(null);q.c.actor.position.set(124,0,48);q.treehouse.interact(q.c);
  document.querySelectorAll('body > :not(#game)').forEach(el=>el.style.visibility='hidden');
  q.gl=q.renderer.getContext();q.startupError=q.gl.getError();q.renderer.info.autoReset=false;
  q.render=()=>{q.renderer.info.reset();q.renderer.render(q.scene,q.camera);return {...q.renderer.info.render};};
  q.pixels=()=>{const a=new Uint8Array(q.gl.drawingBufferWidth*q.gl.drawingBufferHeight*4);q.gl.readPixels(0,0,q.gl.drawingBufferWidth,q.gl.drawingBufferHeight,q.gl.RGBA,q.gl.UNSIGNED_BYTE,a);return a;};
  q.difference=(a,b)=>{let changed=0,total=0,max=0;for(let i=0;i<a.length;i++)if(i%4!==3){const delta=Math.abs(a[i]-b[i]);if(delta>8)changed++;total+=delta;max=Math.max(max,delta);}return {fractionOver8:changed/(a.length*.75),mean:total/(a.length*.75),max};};
  q.optimized=value=>{q.characterShadows.enabled=value;q.forestDetail.setEnabled(value);q.fireflies.instances.enabled=value;q.fireflies.syncInstances(q.camera);};
 });
 for(const [angle,hour] of [[45,8],[135,8],[225,8],[135,0]]){
  await page.evaluate(async({angle,hour})=>{
   const q=qa,T=q.THREE,{daylight,phaseAtHour}=await import('/src/day-cycle.ts'),light=daylight(phaseAtHour(hour));
   q.camera.position.set(124+18*Math.sin(angle*Math.PI/180),10,48+18*Math.cos(angle*Math.PI/180));q.camera.lookAt(124,3,48);q.camera.updateMatrixWorld();
   q.celestialLighting.update(light);q.updateTreeShadows(light);q.updateSky(0,q.camera,light);q.shadows.update();q.preparedShadows.update(light,q.camera.position);q.sceneryVisibility.update(q.camera,360);q.fireflies.update(.016,light.night,q.camera.position);
   q.scene.fog.color.set('#d8e9eb').lerp(new T.Color('#182b4b'),light.night).lerp(new T.Color('#ffc392'),light.twilight*.7);q.scene.background.set('#b3d9ef').lerp(new T.Color('#0b1428'),light.night).lerp(new T.Color('#dd8b9b'),light.twilight*.65);q.renderer.toneMappingExposure=1+light.day*.2;
   q.optimized(false);for(let i=0;i<3;i++)q.render();q.before=q.pixels();q.beforeInfo=q.render();
  },{angle,hour});
  await page.screenshot({path:fileURLToPath(new URL(`view-${angle}-${hour}-before.png`,angle===135&&hour===8?out:screenshots))});
  const row=await page.evaluate(()=>{const q=qa;q.optimized(true);for(let i=0;i<3;i++)q.render();return {before:q.beforeInfo,after:q.render(),pixels:q.difference(q.before,q.pixels()),glError:q.gl.getError()};});
  await page.screenshot({path:fileURLToPath(new URL(`view-${angle}-${hour}-after.png`,angle===135&&hour===8?out:screenshots))});
  assert.equal(row.glError,0);assert(row.after.calls<row.before.calls);report.views.push({angle,hour,...row});console.log(JSON.stringify({angle,hour,...row}));
 }
 // Compare an isolated coloured, animated bug at a range where instancing uses
 // the exact native geometry. This catches colour/pose/transform regressions.
 await page.evaluate(()=>{
  const q=qa;for(const root of q.scene.children)if(root!==q.fireflies.group&&!root.isLight)root.visible=false;
  q.fireflies.bugs.forEach((bug,i)=>bug.carrier.visible=i===0);q.scene.fog=null;q.characterShadows.enabled=true;
  q.target=q.fireflies.bugs[0].carrier.position.clone().add(new q.THREE.Vector3(0,.6,0));
 });
 for(const distance of [12,40,95]){
  const row=await page.evaluate(distance=>{
   const q=qa;q.camera.position.copy(q.target).add(new q.THREE.Vector3(0,2,distance));q.camera.lookAt(q.target);q.camera.updateMatrixWorld();q.shadows.update();
   q.fireflies.update(.04,1,q.camera.position);q.target.copy(q.fireflies.bugs[0].carrier.position).y+=.6;
   q.fireflies.instances.enabled=false;q.fireflies.syncInstances(q.camera);for(let i=0;i<3;i++)q.render();const before=q.pixels(),beforeInfo=q.render();
   q.fireflies.instances.enabled=true;q.fireflies.syncInstances(q.camera);for(let i=0;i<3;i++)q.render();const after=q.render();
   return {distance,before:beforeInfo,after,pixels:q.difference(before,q.pixels()),instances:q.fireflies.instances.group.children.reduce((n,mesh)=>n+mesh.count,0),glError:q.gl.getError()};
  },distance);
  await page.screenshot({path:fileURLToPath(new URL(`firefly-${distance}.png`,screenshots))});
  assert.equal(row.glError,0);if(distance<=40)assert(row.pixels.fractionOver8<.00001&&row.pixels.mean<.002,'native and instanced firefly must keep the same paint/pose');report.fireflies.push(row);console.log(JSON.stringify(row));
 }
 const away=await page.evaluate(()=>{const q=qa;q.camera.lookAt(q.camera.position.clone().add(new q.THREE.Vector3(0,0,100)));q.camera.updateMatrixWorld();q.fireflies.syncInstances(q.camera);return q.fireflies.instances.group.children.reduce((sum,mesh)=>sum+mesh.count,0);});assert.equal(away,0);
 // The setting persists and resize must retain the selected scale.
 await page.evaluate(()=>document.querySelectorAll('body > :not(#game)').forEach(el=>el.style.visibility=''));
 await page.click('#settings-toggle');await page.locator('#render-scale').selectOption('1');await page.setViewportSize({width:390,height:844});
 report.settings=await page.evaluate(()=>({scale:qa.renderer.getPixelRatio(),saved:localStorage.getItem('kirby-render-scale-v1'),fits:document.querySelector('#render-scale').getBoundingClientRect().right<=innerWidth}));
 assert.equal(report.settings.scale,1);assert.equal(report.settings.saved,'1');assert(report.settings.fits);
 assert.deepEqual(errors,[]);await writeFile(new URL('visual-checks.json',out),JSON.stringify(report,null,2));console.log(JSON.stringify({settings:report.settings,errors}));
}finally{await browser.close();}
