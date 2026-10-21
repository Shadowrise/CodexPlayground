import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const url=process.env.GAME_URL??'http://127.0.0.1:5184/';
const output=resolve(process.env.SEAL_QUEST_OUTPUT??fileURLToPath(new URL('../node_modules/.cache/meta-knight-seal-quest/',import.meta.url)));
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding']});
const report={locations:[],pickups:[],rejections:{},saveLoad:{},mobile:{},online:null,errors:[]};

async function prepare(context,online=false){
 await context.addInitScript(()=>{try{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');}catch{/* The initial about:blank document has no storage origin. */}});
 if(!online)await context.route('http://127.0.0.1:8787/**',route=>route.fulfill({json:{count:0,occupiedVariants:[],capacity:19,ok:true}}));
 // This instrumentation exists only in the intercepted test response.
 await context.route('**/src/main.ts*',async route=>{
  const response=await route.fetch(),source=await response.text();
  const cameraBlock=/camera\.position\.set\(\s*cameraTarget\.x[\s\S]*?camera\.updateMatrixWorld\(\);/;
  assert(cameraBlock.test(source),'the test route must locate the real follow-camera block');
  const instrumented=source.replace(cameraBlock,block=>`if(!window.sealQuestTest?.cameraOverride){${block}}else{camera.updateMatrixWorld();}`);
  await route.fulfill({response,body:instrumented+`
   window.sealQuestTest={get c(){return character},get progress(){return sealProgress},get network(){return network},get playing(){return playing},seals,sealLocations,sites:META_KNIGHT_SEAL_SITES,scene,camera,renderer,followCamera,mountainLedges,treehouse,benches,seats:BENCH_SEATS,returnToMenu,cameraOverride:false,
    setDay(){dayStart=Date.now();dayStartPhase=.25;},
    enterTreehouse(){treehouse.cancel();const c=character;c.setActivity('Idle');c.swimming=false;c.resizeTo(1,true);c.surfaceY=0;c.actor.position.set(131,0,56);treehouse.interact(c);treehouse.update(5.3);c.actor.position.set(132,18,51);c.yaw=Math.PI/2;c.actor.rotation.set(0,c.yaw,0);followCamera.reset(c.yaw);return treehouse.active&&treehouse.canSit;},
    move(id,offset=[0,0,0],deck=true){treehouse.cancel();const site=META_KNIGHT_SEAL_SITES.find(s=>s.id===id),c=character;if(id==='treehouse'&&deck)this.enterTreehouse();else c.setActivity('Idle');c.swimming=false;c.resizeTo(1,true);c.surfaceY=site.surfaceY;c.actor.position.set(site.x+offset[0],site.surfaceY+offset[1],site.z+offset[2]);c.yaw=site.yaw;c.actor.rotation.set(0,c.yaw,0);},
    frameSite(id){const site=META_KNIGHT_SEAL_SITES.find(s=>s.id===id);this.restoreCamera?.();const fov=camera.fov;this.cameraOverride=true;this.restoreCamera=()=>{this.cameraOverride=false;camera.fov=fov;camera.updateProjectionMatrix();delete this.restoreCamera;};camera.position.set(site.x+Math.sin(site.yaw)*3.4,site.y+.65,site.z+Math.cos(site.yaw)*3.4);camera.lookAt(site.x,site.y,site.z);camera.fov=52;camera.updateProjectionMatrix();camera.updateMatrixWorld();},
    async frameWide(id){this.frameSite(id);const site=META_KNIGHT_SEAL_SITES.find(s=>s.id===id);if(id==='treehouse'){camera.position.set(164,30,90);camera.lookAt(135,12,47);}else{const layout=await import('/src/mountain-ledges-layout.ts'),p=layout.mountainWorld(layout.MOUNTAIN_SUMMIT.tangent,layout.MOUNTAIN_SUMMIT.radial),cx=(p.x+site.x)/2,cz=(p.z+site.z)/2,cy=(layout.MOUNTAIN_SUMMIT.y+site.surfaceY)/2;camera.position.set(cx-32,cy+16,cz-34);camera.lookAt(cx,cy,cz);}camera.fov=55;camera.updateProjectionMatrix();camera.updateMatrixWorld();}
   };
  `});
 });
 context.on('page',page=>{page.on('pageerror',error=>report.errors.push(error.message));page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});});
}
async function open(context){const page=await context.newPage();await page.goto(url);await page.locator('#startup-loader').waitFor({state:'hidden',timeout:120000});await page.waitForFunction(()=>window.sealQuestTest&&!document.querySelector('#start-game')?.disabled,null,{timeout:120000});await page.evaluate(()=>{sealQuestTest.stages=[];new MutationObserver(()=>{const hud=document.querySelector('#meta-knight-seal-hud');sealQuestTest.stages.push({stage:hud.dataset.stage,at:performance.now(),filled:hud.querySelectorAll('.filled').length});}).observe(document.querySelector('#meta-knight-seal-hud'),{attributes:true,attributeFilter:['data-stage']});});return page;}
async function start(page,{load=false,online=false,name='Искатель печатей'}={}){
 await page.locator(load?'#load-game':online?'#network-join':'#new-game').click();if(!load){await page.locator('#player-name-input').fill(name);await page.locator('#start-game').click();}await page.waitForFunction(()=>sealQuestTest.playing&&sealQuestTest.c);assert(await page.locator('#meta-knight-seal-hud').isHidden(),'starting, loading or joining never displays a pickup panel');
}
async function exit(page){await page.locator('#settings-toggle').click();await page.locator('#exit-to-menu').click();await page.locator('#startup-menu').waitFor({state:'visible',timeout:120000});}
async function count(page,expected){await page.waitForFunction(n=>Object.keys(sealQuestTest.progress.collected).length===n&&document.querySelectorAll('#meta-knight-seal-hud .filled').length===n,expected);assert.equal(await page.locator('.seal-hud-slot').count(),3);assert.equal(await page.locator('.seal-hud-heading>span').textContent(),`${expected} / 3`);}
async function notice(page,expected){
 await page.locator('#meta-knight-seal-hud').waitFor({state:'visible'});await count(page,expected);await noNotice(page);
 if(expected===3)assert(await page.evaluate(()=>sealQuestTest.stages.some(s=>s.stage==='complete'&&s.filled===3)),'all three badges are visible before opening');
}
async function completion(page){
 await page.waitForFunction(()=>document.querySelector('#meta-knight-seal-hud').dataset.stage==='open',null,{timeout:10000});
 const stages=await page.evaluate(()=>sealQuestTest.stages.filter(s=>s.filled===3));
 assert.deepEqual(stages.slice(-3).map(s=>s.stage),['complete','opening','open']);assert(stages.at(-1).at-stages.at(-3).at>=2500,'completed badges are held before the animated portal reveal');
 assert.equal(await page.locator('.seal-hud-message').textContent(),'Портал на космическую арену открыт!');
 await noNotice(page);return stages;
}
async function noNotice(page){assert.equal(await page.locator('#combat-message').evaluate(element=>element.classList.contains('seal-pickup-message')||!element.hidden&&/печать|значок|три печати/i.test(element.textContent)),false,'seal pickups never create an overhead notice');}
async function noticeExpires(page){
 await page.waitForFunction(()=>{const hud=document.querySelector('#meta-knight-seal-hud');return !hud.hidden&&hud.dataset.visibility==='leaving';},null,{timeout:12000});
 await page.waitForTimeout(220);
 const opacity=await page.locator('#meta-knight-seal-hud').evaluate(element=>Number(getComputedStyle(element).opacity));
 assert(opacity>0&&opacity<1,'the panel fades smoothly before being removed from layout');
 await page.locator('#meta-knight-seal-hud').waitFor({state:'hidden'});await noNotice(page);
 await page.waitForTimeout(200);assert(await page.locator('#meta-knight-seal-hud').isHidden(),'unchanged progress never reopens the expired panel');
}
async function pick(page,id,expected){
 if(id==='treehouse'){
  assert(await page.evaluate(()=>sealQuestTest.enterTreehouse()),'pickup must follow a real ladder climb into deck activity');
  await page.evaluate(()=>{sealQuestTest.c.yaw=Math.PI/2;sealQuestTest.c.actor.rotation.set(0,Math.PI/2,0);});
  await page.keyboard.down('KeyW');try{await page.waitForFunction(()=>!!sealQuestTest.progress.collected.treehouse,null,{timeout:10000});}finally{await page.keyboard.up('KeyW');}
  assert(await page.evaluate(()=>sealQuestTest.treehouse.canSit),'treehouse seal is collected on foot while walking the deck');
 }else{await page.evaluate(id=>sealQuestTest.move(id),id);await page.waitForFunction(id=>!!sealQuestTest.progress.collected[id],id,{timeout:10000});}
 await count(page,expected);await notice(page,expected);report.pickups.push({id,count:expected});
}
async function box(locator){const r=await locator.boundingBox();assert(r);return r;}
async function raisedNotice(page){
 const measured=await box(page.locator('#meta-knight-seal-hud'));
 assert(measured.y>=0&&measured.y<160&&measured.width>=300,'badge panel is large and at the top of the screen');return measured;
}

async function verifyNotice(){
 const context=await browser.newContext({viewport:{width:1280,height:900}});
 try{
  await prepare(context);const page=await open(context);await start(page);await count(page,0);await page.screenshot({path:resolve(output,'seal-panel-empty-desktop.png')});
  await page.evaluate(()=>{const q=sealQuestTest;q.setDay();q.move('maze',[-2.5,0,0]);q.followCamera.reset(q.c.yaw);q.followCamera.orbit(0,160);});await page.waitForTimeout(1200);await count(page,0);
  await page.keyboard.down('KeyS');try{await page.waitForFunction(()=>!!sealQuestTest.progress.collected.maze,null,{timeout:10000});}finally{await page.keyboard.up('KeyS');}
  await count(page,1);await notice(page,1);report.pickups.push({id:'maze',count:1});report.desktop=await raisedNotice(page);await page.screenshot({path:resolve(output,'seal-pickup-desktop-raised.png')});await noticeExpires(page);report.noticeExpired=true;
 }finally{await context.close();}
 await verifyPhone();
}

async function verifyPhone(){
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 try{
  await prepare(context);const page=await open(context);await start(page);
  await page.evaluate(()=>sealQuestTest.setDay());assert(await page.evaluate(()=>sealQuestTest.enterTreehouse()));await page.waitForTimeout(1200);await count(page,0);
  await page.evaluate(()=>{sealQuestTest.c.actor.position.x=136;});await count(page,1);await notice(page,1);report.pickups.push({id:'treehouse',count:1});
  const message=await box(page.locator('#meta-knight-seal-hud'));assert(message.x>=0&&message.y>=0&&message.x+message.width<=390&&message.y+message.height<=844,'phone badge panel stays inside the viewport');
  const sidebar=await box(page.locator('.right-hud'));assert(sidebar.y>=message.y+message.height,'phone sidebar follows the panel without overlap');
  report.mobile={message,raised:await raisedNotice(page)};await page.screenshot({path:resolve(output,'seal-pickup-phone-390.png')});await noticeExpires(page);
  const restoredSidebar=await box(page.locator('.right-hud'));assert(restoredSidebar.y<message.y+message.height,'the sidebar returns after the panel disappears');
  await page.emulateMedia({reducedMotion:'reduce'});await pick(page,'maze',2);await page.waitForTimeout(3000);await pick(page,'mountain',3);report.mobile.stages=await completion(page);
  await page.screenshot({path:resolve(output,'seal-portal-open-phone.png')});
  await page.setViewportSize({width:844,height:390});await page.waitForTimeout(300);
  const landscape=await box(page.locator('#meta-knight-seal-hud'));assert(landscape.x>=0&&landscape.y>=0&&landscape.x+landscape.width<=844&&landscape.y+landscape.height<200);report.mobile.landscape=landscape;
  await page.screenshot({path:resolve(output,'seal-portal-open-phone-landscape.png')});
  await page.waitForTimeout(1500);assert(await page.locator('#meta-knight-seal-hud').isVisible(),'the last pickup extends the display beyond the previous badge timer');
  await noticeExpires(page);report.mobile.portalExpired=true;
 }finally{await context.close();}
}

async function verifyOnline(){
 const contexts=[],enter=async name=>{const context=await browser.newContext({viewport:{width:1000,height:760}});contexts.push(context);await prepare(context,true);const page=await open(context);await start(page,{online:true,name});return page;};
 try{
  const host=await enter('Печати · Первый'),guest=await enter('Печати · Второй');await host.waitForFunction(()=>sealQuestTest.network?.actors.size===1);
  assert.equal(await host.evaluate(()=>Object.keys(sealQuestTest.progress.collected).length),0,'use a fresh local room for online seal QA');
  const contributors=[];
  for(const [page,id] of [[host,'maze'],[guest,'mountain']]){
   await page.bringToFront();const player=await page.evaluate(()=>sealQuestTest.network.id);await page.evaluate(id=>sealQuestTest.move(id),id);await page.waitForFunction(id=>!!sealQuestTest.progress.collected[id],id);await notice(page,contributors.length+1);contributors.push({id,by:player});
   for(const observer of [host,guest]){await count(observer,contributors.length);assert(await observer.locator('#meta-knight-seal-hud').isVisible());}
  }
  await host.bringToFront();await count(host,2);await guest.bringToFront();await count(guest,2);
  const shared=await guest.evaluate(()=>sealQuestTest.progress.collected);for(const claim of contributors)assert.equal(shared[claim.id].by,claim.by);assert.notEqual(contributors[0].by,contributors[1].by,'different players contribute to the same counter');
  // Use the production E interaction to obtain the real network tree lease.
  await guest.evaluate(()=>{const q=sealQuestTest;q.treehouse.cancel();q.c.setActivity('Idle');q.c.swimming=false;q.c.surfaceY=0;q.c.actor.position.set(131,0,56);q.c.yaw=Math.PI;q.c.actor.rotation.set(0,q.c.yaw,0);q.followCamera.reset(q.c.yaw);});await guest.waitForTimeout(500);await guest.keyboard.press('KeyE');
  await guest.waitForFunction(()=>sealQuestTest.treehouse.active&&sealQuestTest.network.room.locks['tree:0']===sealQuestTest.network.id,null,{timeout:15000});
  await guest.waitForFunction(()=>sealQuestTest.treehouse.canSit,null,{timeout:12000});
  for(const observer of [host,guest])await observer.locator('#meta-knight-seal-hud').waitFor({state:'hidden'});
  await guest.evaluate(()=>{const q=sealQuestTest;q.c.yaw=Math.PI/2;q.c.actor.rotation.set(0,q.c.yaw,0);q.followCamera.reset(q.c.yaw);});
  await guest.keyboard.down('KeyW');try{await guest.waitForFunction(()=>!!sealQuestTest.progress.collected.treehouse,null,{timeout:10000});}finally{await guest.keyboard.up('KeyW');}
  await notice(guest,3);assert(await guest.evaluate(()=>sealQuestTest.treehouse.onBalcony(sealQuestTest.c)),'online pickup must occur while walking the real balcony');
  const treehouseClaim=await guest.evaluate(()=>sealQuestTest.progress.collected.treehouse);assert.equal(treehouseClaim.by,contributors[1].by);contributors.push({id:'treehouse',by:treehouseClaim.by});
  await count(guest,3);await host.bringToFront();await count(host,3);await guest.bringToFront();
  const stages=await completion(guest);await completion(host);
  for(const observer of [host,guest]){
   const messages=await observer.locator('.chat-messages p').allTextContents();
   assert.equal(messages.filter(text=>text==='Печати · Первый подобрал значок Метакнайта. Собрано 1 из 3.').length,1);
   for(const n of [2,3])assert.equal(messages.filter(text=>text===`Печати · Второй подобрал значок Метакнайта. Собрано ${n} из 3.`).length,1);
   assert.equal(messages.filter(text=>text==='Все 3 значка Метакнайта собраны. Портал на космическую арену открыт!').length,1);
  }
  await guest.screenshot({path:resolve(output,'seal-shared-pickup-online.png')});
  await Promise.all([noticeExpires(host),noticeExpires(guest)]);
  const late=await enter('Печати · Третий');await count(late,3);await noNotice(late);for(const {id} of contributors)assert.equal(await late.evaluate(id=>{const i=sealQuestTest.sites.findIndex(s=>s.id===id);return sealQuestTest.seals[i].active;},id),false);
  assert.equal(await late.locator('#meta-knight-seal-hud').getAttribute('data-stage'),'open');assert.equal(await late.locator('.seal-arrive').count(),0);assert(await late.locator('#meta-knight-seal-hud').isHidden());
  report.online={sharedPickups:contributors,counters:[3,3,3],treehouseLease:true,treehouseWalk:true,lateJoin:true,stages,sharedChat:true};
 }finally{await Promise.all(contexts.map(context=>context.close()));}
}

async function verifyMountainCameras(){
 const context=await browser.newContext({viewport:{width:1280,height:900}});
 try{
  await prepare(context);const page=await open(context);await start(page);report.cameras=[];
  for(const view of ['peak-outward','peak-inward','upper-step']){
   await page.evaluate(async view=>{
    const q=sealQuestTest;q.setDay();q.move('mountain',[-Math.SQRT2,0,Math.SQRT2]);
    if(view==='upper-step'){const layout=await import('/src/mountain-ledges-layout.ts'),step=layout.MOUNTAIN_UPPER_STEPS.at(-4),p=layout.mountainWorld(step.tangent,step.radial);q.c.actor.position.set(p.x,step.y,p.z);q.c.surfaceY=step.y;}
    q.c.yaw=view==='peak-outward'?Math.PI*1.25:Math.PI*.25;q.c.actor.rotation.set(0,q.c.yaw,0);q.mountainLedges.restorePosition(q.c);q.followCamera.reset(q.c.yaw);
   },view);await page.waitForTimeout(1500);await count(page,0);
   const frame=await page.evaluate(async()=>{
    const q=sealQuestTest,p=q.c.actor.position,center=p.clone();center.y+=.9;
    const right=p.clone().setFromMatrixColumn(q.camera.matrixWorld,0).multiplyScalar(.85),a=center.clone().add(right).project(q.camera),b=center.clone().sub(right).project(q.camera);
    const terrain=await import('/src/mountain-surface.ts'),point=p.clone();let occluded=false;
    for(let i=1;i<32;i++){point.lerpVectors(center,q.camera.position,i/32);if(terrain.mountainSurfaceHeight(point.x,point.z)>point.y-.1)occluded=true;}
    return {override:q.cameraOverride,position:q.camera.position.toArray(),player:p.toArray(),defaultDistance:q.followCamera.distance,targetDistance:q.camera.position.distanceTo(center),bodyScreenFraction:Math.abs(a.x-b.x)/2,occluded};
   });await page.screenshot({path:resolve(output,`seal-${view}-normal-camera.png`)});report.cameras.push({view,...frame});assert.equal(frame.override,false);assert.equal(frame.defaultDistance,10);assert(frame.bodyScreenFraction<.45,`${view}: camera must not make the player fill the screen: ${JSON.stringify(frame)}`);assert.equal(frame.occluded,false,`${view}: terrain must not hide the player`);
  }
 }finally{await context.close();}
}

try{
 if(process.argv.includes('--online-only')){await verifyOnline();}else if(process.argv.includes('--notice-only')){await verifyNotice();}else if(process.argv.includes('--phone-only')){await verifyPhone();}else if(process.argv.includes('--peak-camera-only')){await verifyMountainCameras();}else if(process.argv.includes('--camera-only')){
  const context=await browser.newContext({viewport:{width:1280,height:900}});await prepare(context);const page=await open(context);await start(page);await page.evaluate(()=>{sealQuestTest.setDay();sealQuestTest.enterTreehouse();});await page.waitForTimeout(1500);await count(page,0);
  report.camera=await page.evaluate(()=>({override:sealQuestTest.cameraOverride,position:sealQuestTest.camera.position.toArray(),player:sealQuestTest.c.actor.position.toArray()}));assert.equal(report.camera.override,false);await page.screenshot({path:resolve(output,'seal-treehouse-normal-camera.png')});await context.close();
 }else{
 const context=await browser.newContext({viewport:{width:1280,height:900}});await prepare(context);const page=await open(context);await start(page);await page.evaluate(()=>sealQuestTest.setDay());await count(page,0);
 await noNotice(page);
 for(const id of ['maze','mountain','treehouse']){
  await page.evaluate(id=>sealQuestTest.frameSite(id),id);await page.waitForTimeout(350);await page.screenshot({path:resolve(output,`seal-location-${id}.png`)});
  const location=await page.evaluate(id=>{const q=sealQuestTest,i=q.sites.findIndex(s=>s.id===id);return {id,site:q.sites[i],active:q.seals[i].active,visible:q.seals[i].group.visible};},id);assert(location.active&&location.visible,`the real ${id} seal must be rendered by its diagnostic camera`);report.locations.push(location);
 }
 await page.evaluate(()=>{sealQuestTest.hiddenHud=[...document.querySelectorAll('.hud-corner,#settings-toggle,#fps-counter,#meadow-chat,#navigation-hud,#combat-message')].map(element=>{const previous=element.style.visibility;element.style.visibility='hidden';return [element,previous];});});
 for(const id of ['mountain','treehouse']){await page.evaluate(id=>sealQuestTest.frameWide(id),id);await page.waitForTimeout(350);await page.screenshot({path:resolve(output,`seal-location-${id}-wide.png`)});}
 await page.evaluate(()=>{for(const [element,previous] of sealQuestTest.hiddenHud)element.style.visibility=previous;delete sealQuestTest.hiddenHud;});
 await page.evaluate(()=>sealQuestTest.restoreCamera?.());
 if(!process.argv.includes('--locations-only')){
 // A position at balcony height alone cannot replace actually entering the deck.
 await page.evaluate(()=>{sealQuestTest.move('treehouse',[0,0,0],false);});await page.waitForTimeout(700);await count(page,0);report.rejections.treehouseWithoutDeck=true;
 // A real seated activity at an otherwise eligible pickup point must reject it.
 const mounted=await page.evaluate(()=>{
  const q=sealQuestTest,site=q.sites.find(s=>s.id==='maze'),seat=q.seats[0];q.savedSeat={position:seat.position.clone(),floor:seat.floor,yaw:seat.yaw};seat.position.set(site.x,site.surfaceY+.18,site.z);seat.floor=site.surfaceY;q.move('maze');q.benches.interact(q.c);return q.benches.active&&q.c.state==='Sitting';
 });assert(mounted);await page.waitForTimeout(850);await count(page,0);report.rejections.mounted=true;
 await page.evaluate(()=>{const q=sealQuestTest;q.benches.cancel();q.seats[0].position.copy(q.savedSeat.position);q.seats[0].floor=q.savedSeat.floor;q.seats[0].yaw=q.savedSeat.yaw;q.c.actor.position.set(0,0,0);q.c.surfaceY=0;delete q.savedSeat;});
 // A vertical pass over the seal cannot count as reaching its floor on foot.
 await page.evaluate(()=>{sealQuestTest.move('mountain',[0,2,0]);sealQuestTest.c.flight.press();});await page.waitForTimeout(350);await count(page,0);report.rejections.airborne=true;
 await page.evaluate(()=>{const q=sealQuestTest;q.c.setActivity('Idle');q.c.actor.position.set(0,0,0);q.c.surfaceY=0;});
 await pick(page,'maze',1);await page.screenshot({path:resolve(output,'seal-first-pickup.png')});await noticeExpires(page);report.noticeExpired=true;
 for(const locale of ['en','bg']){await page.evaluate(async locale=>{(await import('/src/i18n.ts')).setLocale(locale);},locale);await page.waitForFunction(text=>document.querySelector('.seal-hud-heading strong').textContent===text,locale==='en'?'Meta Knight badges':'Значки на Мета Найт');}await page.evaluate(async()=>{(await import('/src/i18n.ts')).setLocale('ru');});
 await page.locator('#settings-toggle').click();await page.locator('#save-game').click();report.saveLoad.saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('kirby-save-v1')).seals);assert(report.saveLoad.saved.collected.maze);await page.locator('#exit-to-menu').click();await page.locator('#startup-menu').waitFor({state:'visible',timeout:120000});
 await start(page,{load:true});await count(page,1);await noNotice(page);assert.equal(await page.evaluate(()=>sealQuestTest.seals[0].active),false);report.saveLoad.loaded=true;
 await pick(page,'mountain',2);await pick(page,'treehouse',3);await page.screenshot({path:resolve(output,'seal-all-three.png')});report.stages=await completion(page);await page.screenshot({path:resolve(output,'seal-portal-open-desktop.png')});
 await exit(page);await start(page);await count(page,0);assert(await page.evaluate(()=>sealQuestTest.seals.every(seal=>seal.active)));report.saveLoad.newGameReset=true;
 // The solo override opens the portal without claiming that missing badges exist.
 await page.keyboard.press('Enter');await page.locator('#chat-input').fill('/portal 1');await page.keyboard.press('Enter');
 await page.waitForFunction(()=>document.querySelector('#meta-knight-seal-hud').dataset.stage==='opening');await count(page,0);
 await page.waitForFunction(()=>document.querySelector('#meta-knight-seal-hud').dataset.stage==='open');
 await page.keyboard.press('Enter');await page.locator('#chat-input').fill('/portal 0');await page.keyboard.press('Enter');
 await page.waitForFunction(()=>document.querySelector('#meta-knight-seal-hud').dataset.stage==='collecting');report.saveLoad.portalOverride=true;

 await context.close();
 await verifyPhone();

 // Optional: start a real local Worker first, then pass --online. No fake room state.
 if(process.argv.includes('--online'))await verifyOnline();
 }else await context.close();
 }
 assert.deepEqual(report.errors,[]);await writeFile(resolve(output,process.argv.includes('--locations-only')?'locations-report.json':process.argv.includes('--online-only')?'online-report.json':process.argv.includes('--notice-only')?'notice-report.json':process.argv.includes('--phone-only')?'phone-report.json':process.argv.includes('--peak-camera-only')?'peak-camera-report.json':process.argv.includes('--camera-only')?'camera-report.json':'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({output,pickups:report.pickups,rejections:report.rejections,saveLoad:report.saveLoad,noticeExpired:report.noticeExpired,desktop:report.desktop,mobile:report.mobile,online:report.online,camera:report.camera,cameras:report.cameras,errors:report.errors}));
}finally{await browser.close();}
