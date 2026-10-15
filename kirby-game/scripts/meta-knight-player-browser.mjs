import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const url=process.env.KIRBY_URL??'http://127.0.0.1:5184/';
const output=process.env.META_KNIGHT_OUTPUT?resolve(process.env.META_KNIGHT_OUTPUT):fileURLToPath(new URL('../node_modules/.cache/meta-knight-player/',import.meta.url));
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const report={desktop:{},mobile:[],errors:[]};
const key='kirby-meta-knight-unlocked-v1';
const hint='Это Meta Knight. Он не играет с незнакомцами.';
async function prepare(page){
 page.on('pageerror',error=>report.errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
 await page.route('http://127.0.0.1:8787/**',route=>route.fulfill({json:{count:0,players:0,occupiedVariants:[],capacity:19,ok:true}}));
 // Scene internals are exposed only in this routed test response.
 await page.route('**/src/main.ts*',async route=>{
  const response=await route.fetch();await route.fulfill({response,body:(await response.text())+`
  let metaKnightUnlockSounds=0;const originalKnightUnlockSound=sounds.playCharacterUnlock.bind(sounds);
  sounds.playCharacterUnlock=()=>{metaKnightUnlockSounds++;originalKnightUnlockSound();};
  window.metaKnightCheck={get c(){return character},get selected(){return selected},get playing(){return playing},get log(){return localLog},get npcCount(){return npcs.length},get unlockSounds(){return metaKnightUnlockSounds},set online(value){networkIntent=value},chat,progress:characterUnlocks,unlockView,coaster,boats,home,benches,seats:BENCH_SEATS,treehouse,balloons,trampoline,skyTrail,get fireflies(){return fireflies},places:destinations,scene,camera,renderer,followCamera,returnToMenu};
  `});
 });
 await page.goto(url);
 await page.locator('#startup-loader').waitFor({state:'hidden',timeout:120000});
 await page.waitForFunction(()=>window.metaKnightCheck&&!document.querySelector('#start-game').disabled,null,{timeout:120000});
}
async function choose(page){await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Meta Knight');}
async function start(page){await page.waitForFunction(()=>window.metaKnightCheck&&!document.querySelector('#start-game').disabled,null,{timeout:120000});await page.locator('#start-game').click();await page.waitForFunction(()=>window.metaKnightCheck.playing);}
async function command(page,text){await page.evaluate(()=>metaKnightCheck.chat.show());await page.locator('#chat-input').fill(text);await page.keyboard.press('Enter');assert(await page.locator('#chat-composer').isHidden(),text);}
async function exit(page){await page.locator('#settings-toggle').click();await page.locator('#exit-to-menu').click();await page.locator('#startup-menu').waitFor({state:'visible'});}
async function assertInViewport(locator,viewport){const box=await locator.boundingBox();assert(box&&box.x>=0&&box.y>=0&&box.x+box.width<=viewport.width+1&&box.y+box.height<=viewport.height+1,JSON.stringify({box,viewport}));return box;}
async function captureSleepInterior(page){
 // A test-only interior camera exposes the mattress and quilt without hiding scenery.
 await page.evaluate(()=>{
  const q=metaKnightCheck,render=q.renderer.render.bind(q.renderer);
  q.restoreInteriorCamera=()=>{q.renderer.render=render;};
  q.renderer.render=(scene,camera)=>{
   const position=camera.position.clone(),rotation=camera.quaternion.clone(),fov=camera.fov;
   camera.position.set(q.home.group.position.x+3.6,4.7,q.home.group.position.z+3.4);
   camera.lookAt(q.home.group.position.x,1.6,q.home.group.position.z-.65);camera.fov=60;
   camera.updateProjectionMatrix();camera.updateMatrixWorld();render(scene,camera);
   camera.position.copy(position);camera.quaternion.copy(rotation);camera.fov=fov;
   camera.updateProjectionMatrix();camera.updateMatrixWorld();
  };
 });
 try{await page.waitForTimeout(400);await page.screenshot({path:resolve(output,'meta-knight-player-sleep-interior.png'),animations:'disabled'});}
 finally{await page.evaluate(()=>{metaKnightCheck.restoreInteriorCamera();delete metaKnightCheck.restoreInteriorCamera;});}
}
try{
 const page=await browser.newPage({viewport:{width:1400,height:900}});
 if(process.argv.includes('--sleep-only')){
  await prepare(page);await choose(page);await start(page);await command(page,'/unlock meta-knight');
  await exit(page);await choose(page);await page.locator('.variant-button.meta-knight-character').click();await start(page);
  assert(await page.evaluate(()=>{const q=metaKnightCheck;q.c.actor.position.copy(q.home.entrance);return q.home.start(q.c);}));
  await page.waitForTimeout(3500);assert.equal(await page.evaluate(()=>metaKnightCheck.c.state),'Sleep');
  await captureSleepInterior(page);assert.deepEqual(report.errors,[]);console.log('PASS native Sleep interior camera capture; no geometry hidden and original camera restored');
 }else{
 await prepare(page);await choose(page);
 const knight=()=>page.locator('.variant-button.meta-knight-character');
 assert.equal(await knight().count(),1);assert.equal(await knight().getAttribute('aria-disabled'),'true');
 assert(await knight().locator('.variant-lock').isVisible());
 await knight().click({force:true});
 assert.equal(await page.evaluate(()=>metaKnightCheck.selected[0]),'Классический');
 assert.equal(await page.locator('#locked-character-tooltip p').textContent(),hint);
 await assertInViewport(page.locator('#locked-character-tooltip'),{width:1400,height:900});
 await page.waitForTimeout(250);
 await page.screenshot({path:resolve(output,'meta-knight-locked-desktop.png'),animations:'disabled'});
 await page.locator('.variant-button').first().click();await start(page);
 // The real command-menu gate is exercised without connecting to a network room.
 await page.evaluate(()=>{metaKnightCheck.online=true;metaKnightCheck.chat.show();});
 await page.locator('#chat-input').fill('/unlock meta-knight');
 assert(await page.locator('#chat-command-list').isHidden());await page.keyboard.press('Enter');
 assert(await page.locator('#chat-command-error').isVisible());
 assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),null);
 assert.equal(await page.evaluate(()=>metaKnightCheck.progress.metaKnightUnlocked),false);
 await page.evaluate(()=>metaKnightCheck.online=false);
 const adventures=await page.evaluate(()=>[...metaKnightCheck.c.achievements]);
 await page.locator('#chat-input').fill('/unlock meta');
 assert.deepEqual(await page.locator('#chat-command-list code').allTextContents(),['meta-knight']);
 await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
 await page.locator('#character-unlock').waitFor({state:'visible'});
 assert(await page.locator('#character-unlock').evaluate(element=>element.classList.contains('meta-knight-character')));
 assert.match(await page.locator('#character-unlock').textContent(),/Персонаж разблокирован!.*Meta Knight/);
 assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),'1');
 assert.deepEqual(await page.evaluate(()=>[...metaKnightCheck.c.achievements]),adventures);
 assert.equal(await page.evaluate(()=>metaKnightCheck.unlockSounds),1);
 await page.screenshot({path:resolve(output,'meta-knight-unlocked.png'),animations:'disabled'});
 await command(page,'/unlock meta-knight');assert.equal(await page.evaluate(()=>metaKnightCheck.unlockSounds),1);
 assert(!(await page.evaluate(()=>metaKnightCheck.log)).some(entry=>entry.text.startsWith('/unlock')));
 await exit(page);await choose(page);
 assert.equal(await knight().getAttribute('aria-disabled'),'false');await knight().click();await start(page);
 const native=await page.evaluate(()=>{const q=metaKnightCheck,c=q.c;return {selected:q.selected[0],native:c.isMetaKnight,pigeon:c.isPigeon,animations:c.hasNativeAnimations,clips:[...c.actions.keys()],npcs:q.npcCount};});
 assert.equal(native.selected,'Meta Knight');assert(native.native&&native.animations&&!native.pigeon);
 assert.equal(native.npcs,14);
 for(const clip of ['Run','WalkBackward','Jump','Fly','Swim','Push','Eat','Boat','Cart','Balloon','Sitting','Sleep','Wake','Hello','Joy','Fear','Anger','Sad'])assert(native.clips.includes(clip),clip);
 // A fixed dry clearing makes keyboard motion checks independent of random spawns.
 await page.evaluate(()=>{const c=metaKnightCheck.c;c.setActivity('Idle');c.swimming=false;c.surfaceY=0;c.actor.position.set(0,0,0);c.yaw=0;c.actor.rotation.set(0,0,0);});
 const origin=await page.evaluate(()=>metaKnightCheck.c.actor.position.toArray());
 await page.keyboard.down('w');await page.waitForFunction(()=>metaKnightCheck.c.state==='Run');await page.waitForTimeout(450);await page.keyboard.up('w');
 const distance=await page.evaluate(origin=>Math.hypot(metaKnightCheck.c.actor.position.x-origin[0],metaKnightCheck.c.actor.position.z-origin[2]),origin);assert(distance>.6,`movement: ${distance}`);
 await page.waitForFunction(()=>metaKnightCheck.c.state==='Idle');
 await page.keyboard.down('s');await page.waitForFunction(()=>metaKnightCheck.c.state==='WalkBackward');await page.waitForTimeout(180);await page.keyboard.up('s');await page.waitForFunction(()=>metaKnightCheck.c.state==='Idle');
 await page.keyboard.down('Space');await page.waitForFunction(()=>metaKnightCheck.c.actor.position.y>.3);await page.waitForTimeout(450);
 assert.equal(await page.evaluate(()=>metaKnightCheck.c.cloud.visible),false);await page.keyboard.up('Space');await page.waitForFunction(()=>!metaKnightCheck.c.flight.active&&metaKnightCheck.c.state==='Idle',null,{timeout:15000});
 await page.keyboard.down('q');await page.waitForFunction(()=>metaKnightCheck.c.state==='Push');await page.keyboard.up('q');await page.waitForFunction(()=>metaKnightCheck.c.state==='Idle');
 const emotions=[];
 for(const [index,name] of ['Hello','Joy','Fear','Anger','Sad'].entries()){
  await page.keyboard.press(String(index+1));await page.waitForFunction(name=>metaKnightCheck.c.state===name,name);
  await page.waitForTimeout(280);
  assert(await page.evaluate(name=>{const action=metaKnightCheck.c.actions.get(name);return action.time>0&&action.getEffectiveWeight()>.8;},name));
  emotions.push(name);await page.waitForFunction(()=>metaKnightCheck.c.state==='Idle',null,{timeout:6000});
 }
 await command(page,'/time 12');
 await page.evaluate(()=>{metaKnightCheck.followCamera.zoom(-200);metaKnightCheck.followCamera.orbit(Math.PI/.005,0);});
 await page.waitForTimeout(900);await page.screenshot({path:resolve(output,'meta-knight-playable.png'),animations:'disabled'});
 const rides={
  Sitting:q=>{q.c.actor.position.copy(q.seats[0].position).setY(0);q.benches.interact(q.c);return q.benches.active;},
  Boat:q=>{q.c.actor.position.copy(q.boats.boats[0].position);return q.boats.board(q.c);},
  Sleep:q=>{q.c.actor.position.copy(q.home.entrance);return q.home.start(q.c);},
  Balloon:q=>{q.balloons.reset();q.c.actor.position.copy(q.balloons.balloons[0].group.position);return q.balloons.board(q.c);},
  Cart:q=>{q.coaster.carts[0].wait=5;const d=q.places.find(p=>p.id==='depot');q.c.actor.position.set(d.x,0,d.z);return q.coaster.board(q.c);},
 };
 const checkedRides=[];
 for(const [state,begin] of Object.entries(rides)){
  await command(page,'/tele hm');
  assert(await page.evaluate(source=>{const q=metaKnightCheck;q.c.setActivity('Idle');return (0,eval)(`(${source})`)(q);},begin.toString()),state);
  await page.waitForFunction(state=>metaKnightCheck.c.state===state,state);
  await page.waitForTimeout(450);
  assert(await page.evaluate(state=>{const action=metaKnightCheck.c.actions.get(state);return action.time>0&&action.getEffectiveWeight()>.8;},state),state);
  if(['Boat','Cart','Sleep'].includes(state)){
   await page.evaluate(()=>{const q=metaKnightCheck;q.followCamera.reset(q.c.yaw);q.followCamera.zoom(200);q.followCamera.orbit((Math.PI-.7)/.005,40);});
   await page.waitForTimeout(state==='Sleep'?2500:900);
   await page.screenshot({path:resolve(output,`meta-knight-player-${state.toLowerCase()}.png`),animations:'disabled'});
   if(state==='Sleep')await captureSleepInterior(page);
  }
  if(state==='Sleep'){
   await page.evaluate(()=>metaKnightCheck.home.wake());await page.waitForFunction(()=>metaKnightCheck.c.state==='Wake');
   await page.waitForFunction(()=>!metaKnightCheck.home.active&&metaKnightCheck.c.state==='Idle');
  }
  checkedRides.push(state);await command(page,'/tele hm');
  assert.equal(await page.evaluate(()=>metaKnightCheck.c.animationRoot.parent.scale.x),1,state);
 }
 // Save and restore a native selection through the same menu a player uses.
 await page.locator('#settings-toggle').click();await page.locator('#save-game').click();
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('kirby-save-v1')).player.variant),'Meta Knight');
 await page.reload();await page.locator('#startup-loader').waitFor({state:'hidden',timeout:120000});
 await page.waitForFunction(()=>window.metaKnightCheck&&!document.querySelector('#start-game').disabled,null,{timeout:120000});
 assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),'1');
 await page.locator('#load-game').click();assert.equal(await knight().getAttribute('aria-pressed'),'true');await start(page);
 assert.equal(await page.evaluate(()=>metaKnightCheck.c.isMetaKnight),true);
 report.desktop={lockedHint:hint,onlineCommandBlocked:true,persistedUnlock:true,native,movementDistance:distance,emotions,rides:checkedRides,savedNativeSelection:true};
 await page.close();
 for(const viewport of [{width:390,height:844},{width:844,height:390}]){
  const context=await browser.newContext({viewport,isMobile:true,hasTouch:true});const phone=await context.newPage();
  await prepare(phone);await choose(phone);const button=phone.locator('.variant-button.meta-knight-character');
  await button.scrollIntoViewIfNeeded();await button.tap({force:true});
  assert.equal(await phone.locator('#locked-character-tooltip p').textContent(),hint);
  const tooltip=await assertInViewport(phone.locator('#locked-character-tooltip'),viewport);
  const portrait=await assertInViewport(button,viewport);
  assert.equal(await phone.evaluate(()=>metaKnightCheck.selected[0]),'Классический');
  await phone.waitForTimeout(250);
  await phone.screenshot({path:resolve(output,`meta-knight-locked-phone-${viewport.width}.png`),animations:'disabled'});
  report.mobile.push({viewport,tooltip,portrait,locked:true});await context.close();
 }
 assert.deepEqual(report.errors,[]);await writeFile(resolve(output,'meta-knight-browser-checks.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
 }
}finally{await browser.close();}
