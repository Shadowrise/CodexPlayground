import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const output=fileURLToPath(new URL('../design/meta-knight-arena/',import.meta.url));await mkdir(output,{recursive:true});
const mobile=process.argv.includes('--mobile'),failure=process.argv.includes('--failure');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--renderer-process-limit=1']});
try{
 const context=await browser.newContext(mobile?{viewport:{width:844,height:390},isMobile:true,hasTouch:true}:{viewport:{width:1440,height:900}});
 const page=await context.newPage(),errors=[],arenaRequests=[];
 page.on('dialog',dialog=>dialog.accept());
 page.on('pageerror',e=>{errors.push(e.message);console.error(e.stack);});page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL|shader/i.test(m.text())){errors.push(m.text());console.error(m.text());}});
 page.on('request',r=>{if(/\/src\/meta-knight-arena\.ts/.test(r.url()))arenaRequests.push(r.url());});
 await page.routeWebSocket(/^ws:\/\/127\.0\.0\.1:\d+\/(?!ws\?)/,ws=>ws.onMessage(()=>{}));
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
 for(const endpoint of ['room','players','history/solo'])await page.route('**/'+endpoint,r=>r.fulfill({json:{ok:true,players:0,occupiedVariants:[],capacity:14}}));
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.arenaQA={THREE,travel:cosmicArena,portal:meadowPortal,renderer,scene,camera,followCamera,get progress(){return sealProgress},claim(id){const s=META_KNIGHT_SEAL_SITES.find(s=>s.id===id);sealProgress=collectSeal(sealProgress,id,{id:"solo",p:[s.x,s.surfaceY,s.z],size:1,available:true},Date.now());},complete(){for(const id of ["maze","mountain","treehouse"])this.claim(id);},get c(){return character},get npcs(){return npcs},leave:returnToMenu,set day(v){dayStart=Date.now();dayStartPhase=v}};'});});
 await page.goto(process.env.GAME_URL??'http://127.0.0.1:5184/');await page.locator('#startup-loader').waitFor({state:'hidden',timeout:180000});
 assert.equal(arenaRequests.length,0,'arena module not requested at startup');
 await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Космонавт');await page.locator('#start-game').click();await page.waitForFunction(()=>arenaQA.c);
 assert.equal(arenaRequests.length,0,'arena module still absent after entering meadow');
 await page.evaluate(()=>{const q=arenaQA,p=q.portal.group.position;q.c.setActivity('Idle');q.c.actor.position.set(p.x,0,p.z+4);q.c.yaw=Math.PI;q.c.actor.rotation.y=Math.PI;q.followCamera.reset(Math.PI);q.followCamera.zoom(300);q.day=.25;});
 const suffix=mobile?'-phone':'';
 for(const badge of [null,'maze','mountain']){
  if(badge)await page.evaluate(id=>arenaQA.claim(id),badge);
  await page.evaluate(()=>{const p=arenaQA.portal.group.position;arenaQA.c.actor.position.set(p.x,0,p.z);});
  await page.waitForFunction(()=>!arenaQA.portal.working&&document.querySelector('#action-hint').textContent.includes('не работает'));
  if(!mobile)await page.keyboard.press('KeyE');await page.waitForTimeout(150);
  assert.equal(await page.evaluate(()=>arenaQA.travel.loading||arenaQA.travel.active),false);assert.equal(arenaRequests.length,0);
 }
 await page.evaluate(()=>{const p=arenaQA.portal.group.position;arenaQA.c.actor.position.set(p.x,0,p.z+4);});await page.waitForTimeout(600);
 await page.screenshot({path:output+'portal-dormant'+suffix+'.png'});
 const saveReload=async count=>{await page.locator('#settings-toggle').click();await page.locator('#save-game').click();await page.evaluate(()=>arenaQA.leave());await page.locator('#load-game').click();await page.waitForFunction(n=>!!arenaQA.c&&Object.keys(arenaQA.progress.collected).length===n&&arenaQA.portal.working===(n===3),count);};
 await saveReload(2);assert.equal(arenaRequests.length,0,'loading two badges keeps the arena unloaded');
 await page.evaluate(()=>{const p=arenaQA.portal.group.position;arenaQA.c.actor.position.set(p.x,0,p.z+4);arenaQA.claim('treehouse');});
 await page.waitForFunction(()=>arenaQA.portal.working);await saveReload(3);assert.equal(arenaRequests.length,0,'loading all badges opens the portal without loading its destination');
 await page.waitForFunction(()=>document.querySelector('#action-hint').textContent.includes('Войти на арену'));await page.waitForTimeout(600);
 await page.screenshot({path:output+'portal-working'+suffix+'.png'});
 const occlusion=await page.evaluate(()=>{
  const q=arenaQA,T=q.THREE,p=q.portal.group.position,n=128,camera=new T.PerspectiveCamera(52,1,.1,90);camera.position.set(p.x+4,2.3,p.z+14);camera.lookAt(p.x,3,p.z);camera.updateMatrixWorld();
  let source;q.scene.traverse(o=>{if(!source&&o.isInstancedMesh&&o.material.map?.userData.atlas)source=o;});if(!source)throw Error('Missing actual painted tree-shadow material');
  const probe=new T.InstancedMesh(source.geometry,source.material,1);probe.frustumCulled=false;probe.setMatrixAt(0,new T.Matrix4().makeScale(8,1,9).setPosition(p.x+2,.025,p.z-4));probe.setColorAt(0,new T.Color().setRGB(0,source.material.map.userData.projections[0].aspect,0));q.scene.add(probe);
  const shadows=[];q.scene.traverse(o=>{if(o.isMesh&&o.material===source.material)shadows.push([o,o.visible]);});
  const target=new T.WebGLRenderTarget(n,n),previous=q.renderer.getRenderTarget(),a=new Uint8Array(n*n*4),b=new Uint8Array(n*n*4);
  q.renderer.setRenderTarget(target);q.renderer.render(q.scene,camera);q.renderer.readRenderTargetPixels(target,0,0,n,n,a);
  shadows.forEach(([o])=>o.visible=false);q.renderer.render(q.scene,camera);q.renderer.readRenderTargetPixels(target,0,0,n,n,b);
  shadows.forEach(([o,v])=>o.visible=v);q.renderer.setRenderTarget(previous);target.dispose();probe.removeFromParent();probe.dispose();
  const ray=new T.Raycaster(),plane=new T.Plane(new T.Vector3(0,0,1),-p.z),hit=new T.Vector3();let inside=0,insideChanged=0,outsideChanged=0;
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){ray.setFromCamera(new T.Vector2((x+.5)/n*2-1,(y+.5)/n*2-1),camera);const point=ray.ray.intersectPlane(plane,hit),interior=!!point&&Math.hypot(hit.x-p.x,hit.y-3.84)<2.45,i=(y*n+x)*4,changed=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>2;if(interior){inside++;if(changed)insideChanged++;}else if(changed)outsideChanged++;}
  return {inside,insideChanged,outsideChanged};
 });assert(occlusion.inside>500);assert.equal(occlusion.insideChanged,0,'shadows behind the working portal cannot affect its interior');assert(occlusion.outsideChanged>0,'tree shadows still render outside the portal');
 if(!mobile){
  await page.addStyleTag({content:'body.arena-photo .hud,body.arena-photo #navigation-hud,body.arena-photo .chat-messages,body.arena-photo .chat-panel,body.arena-photo #settings-toggle,body.arena-photo #fps-counter{visibility:hidden}'});
  await page.evaluate(()=>{const q=arenaQA,p=q.portal.group.position;q.photoCamera=q.camera.clone();q.originalRender=q.renderer.render;q.renderer.render=function(scene,camera){return q.originalRender.call(this,scene,scene===q.scene?q.photoCamera:camera);};q.photoCamera.position.set(p.x+8,6,p.z+15);q.photoCamera.lookAt(p.x,2.5,p.z);document.body.classList.add('arena-photo');});
  await page.screenshot({path:output+'portal-steps.png'});
  await page.evaluate(()=>{const q=arenaQA,p=q.portal.group.position;q.photoCamera.position.set(p.x+55,38,p.z+85);q.photoCamera.lookAt(p.x+25,0,p.z+22);});
  await page.screenshot({path:output+'portal-path.png'});
  await page.evaluate(()=>{arenaQA.renderer.render=arenaQA.originalRender;document.body.classList.remove('arena-photo');});
 }
 // Delay the first dynamic import to make the real loading screen observable.
 if(failure)await page.route('**/src/meta-knight-arena.ts*',route=>route.abort(),{times:1});
 else await page.route('**/src/meta-knight-arena.ts*',async route=>{await new Promise(r=>setTimeout(r,1000));await route.continue();},{times:1});
 if(mobile)await page.locator('#touch-interact').tap();else await page.keyboard.press('KeyE');
 await page.locator('#arena-loader').waitFor({state:'visible'});await page.screenshot({path:output+'loading'+suffix+'.png'});
 if(failure){await page.waitForFunction(()=>document.querySelector('#arena-loader h2').textContent.includes('Не удалось'));assert(await page.evaluate(()=>arenaQA.c.actor.parent===arenaQA.scene&&!arenaQA.c.actor.userData.location));await page.screenshot({path:output+'loading-error.png'});await page.locator('#arena-loader button').first().click();}
 await page.waitForFunction(()=>arenaQA.travel.active,null,{timeout:90000});await page.locator('#arena-loader').waitFor({state:'hidden'});
 assert.equal(arenaRequests.length,failure?2:1);assert.equal(await page.evaluate(()=>arenaQA.c.actor.parent===arenaQA.travel.scene),true);
 const initial=await page.evaluate(()=>({geometries:arenaQA.renderer.info.memory.geometries,textures:arenaQA.renderer.info.memory.textures,programs:arenaQA.renderer.info.programs.length,position:arenaQA.c.actor.position.toArray()}));
 await page.screenshot({path:output+'arrival'+suffix+'.png'});
 // View the whole physical scene with the production renderer, then resume control.
 await page.evaluate(()=>{const q=arenaQA;q.renderer.setAnimationLoop(null);q.travel.camera.fov=45;q.travel.camera.updateProjectionMatrix();q.travel.camera.position.set(2045,60,92);q.travel.camera.lookAt(2000,-2,0);q.renderer.render(q.travel.scene,q.travel.camera);});
 await page.screenshot({path:output+'arena-overview'+suffix+'.png'});
 // Reload to resume the actual animation loop and exercise release/reentry.
 await page.reload();await page.locator('#startup-loader').waitFor({state:'hidden',timeout:180000});await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Космонавт');await page.locator('#start-game').click();await page.waitForFunction(()=>arenaQA.c);
 await page.evaluate(()=>{arenaQA.complete();const p=arenaQA.portal.group.position;arenaQA.c.actor.position.set(p.x,0,p.z);});await page.waitForFunction(()=>arenaQA.travel.active,null,{timeout:90000});
 if(!mobile){const before=await page.evaluate(()=>arenaQA.c.actor.position.z);await page.keyboard.down('KeyW');await page.waitForTimeout(550);await page.keyboard.up('KeyW');assert(await page.evaluate(before=>arenaQA.c.actor.position.z<before-.3,before));await page.keyboard.press('Space');await page.waitForTimeout(120);assert(await page.evaluate(()=>arenaQA.c.actor.position.y>0));}
 await page.evaluate(async()=>{const {META_KNIGHT_ARENA:s,META_KNIGHT_ANNEX:a}=await import('/src/meta-knight-arena-site.ts');arenaQA.c.setActivity('Idle');arenaQA.c.actor.position.set(s.x+s.exitX-Math.sin(a.angle)*3,0,s.exitZ-Math.cos(a.angle)*3);});await page.waitForFunction(()=>document.querySelector('#action-hint').textContent.includes('Вернуться на поляну'));
 if(mobile)await page.locator('#touch-interact').tap();else await page.keyboard.press('KeyE');await page.waitForFunction(()=>!arenaQA.travel.active&&!arenaQA.travel.loading);
 assert(await page.evaluate(()=>arenaQA.c.actor.parent===arenaQA.scene&&arenaQA.c.actor.position.x===arenaQA.portal.group.position.x&&!arenaQA.c.actor.userData.location));
 const released=await page.evaluate(()=>({geometries:arenaQA.renderer.info.memory.geometries,textures:arenaQA.renderer.info.memory.textures}));
 const cycles=[];for(let i=0;i<3;i++){await page.evaluate(()=>{const p=arenaQA.portal.group.position;arenaQA.c.actor.position.set(p.x,0,p.z);});await page.waitForFunction(()=>arenaQA.travel.active);await page.evaluate(()=>arenaQA.travel.leave());await page.waitForTimeout(120);cycles.push(await page.evaluate(()=>({g:arenaQA.renderer.info.memory.geometries,t:arenaQA.renderer.info.memory.textures})));}
 assert.deepEqual(cycles[1],cycles[2],'reentry does not leak geometry or textures');
 if(mobile){await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{const p=arenaQA.portal.group.position;arenaQA.c.actor.position.set(p.x,0,p.z);});await page.waitForFunction(()=>arenaQA.travel.active);await page.screenshot({path:output+'arena-portrait-phone.png'});await page.evaluate(()=>arenaQA.travel.leave());}
 await page.evaluate(()=>arenaQA.leave());await page.locator('#startup-menu').waitFor({state:'visible'});assert(!await page.locator('#arena-loader').isVisible());
 assert.deepEqual(errors,[]);const report={mobile,failureRecovery:failure,badgeGate:[0,1,2,3],saveRestore:[2,3],occlusion,initial,released,cycles,errors};await writeFile(output+'browser-report'+(failure?'-failure':suffix)+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
