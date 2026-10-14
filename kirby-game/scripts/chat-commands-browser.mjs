import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';

const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const cache=new URL('../node_modules/.cache/',import.meta.url);await mkdir(cache,{recursive:true});
try{
 if(!process.argv.includes('--mobile-only')){
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
 // This test-only hook never ships in the application.
 await page.route('**/src/main.ts*',async route=>{
  const response=await route.fetch();await route.fulfill({response,body:(await response.text())+`
window.commandCheck={get c(){return character},chat,places:destinations,coaster,boats,home,benches,seats:BENCH_SEATS,treehouse,balloons,trampoline,skyTrail,get fireflies(){return fireflies},get log(){return localLog},get time(){return {phase:currentDayPhase(),startPhase:dayStartPhase,epoch:dayStart,night:home.night,exposure:renderer.toneMappingExposure}},set online(value){networkIntent=value}};
`});
 });
 await page.goto(process.env.KIRBY_URL??'http://127.0.0.1:5174/');
 await page.locator('#startup-loader').waitFor({state:'hidden',timeout:120000});
 await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Команды');await page.locator('#start-game').click();
 await page.waitForFunction(()=>window.commandCheck?.c);
 const open=()=>page.evaluate(()=>window.commandCheck.chat.show());
 const command=async text=>{await open();await page.locator('#chat-input').fill(text);await page.keyboard.press('Enter');assert(await page.locator('#chat-composer').isHidden(),text);};
 await open();await page.locator('#chat-input').fill('/');
 assert.deepEqual(await page.locator('#chat-command-list code').allTextContents(),['/size','/tele','/unlock','/time']);
 await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
 assert.equal(await page.locator('#chat-input').inputValue(),'/tele ');
 assert.equal(await page.locator('#chat-command-list button').count(),13);
 await page.screenshot({path:new URL('chat-command-destinations.png',cache).pathname.replace(/^\/(\w:)/,'$1')});
 await page.locator('#chat-input').fill('/tele m');assert.equal(await page.locator('#chat-command-list button').count(),2);
 await page.keyboard.press('ArrowDown');assert.equal(await page.locator('#chat-input').getAttribute('aria-activedescendant'),'chat-command-0');
 await page.keyboard.press('Enter');assert(await page.locator('#chat-composer').isHidden());
 assert(await page.evaluate(()=>Math.hypot(window.commandCheck.c.actor.position.x-49,window.commandCheck.c.actor.position.z-40.5)<.1));
 for(const size of [30,1000,100]){
  await command(`/size ${size}`);assert.equal(await page.evaluate(()=>window.commandCheck.c.savedSize),size/100);
  await page.waitForTimeout(550);assert.equal(await page.evaluate(()=>window.commandCheck.c.actor.scale.x),size/100);
 }
 await open();await page.locator('#chat-input').fill('/size 1001');await page.keyboard.press('Enter');
 assert(await page.locator('#chat-command-error').isVisible());assert.equal(await page.evaluate(()=>window.commandCheck.c.savedSize),1);
 assert.equal(await page.locator('#chat-input').inputValue(),'/size 1001');
 for(const [hour,label,night,exposure] of [[0,'Ночь',true,1],[6,'Рассвет',true,1.07],[12,'День',false,1.2],[18,'Закат',true,1.07],[23,'Ночь',true,1],[0,'Ночь',true,1],[12,'День',false,1.2]]){
  await command(`/time ${hour}`);
  await page.waitForFunction(({label,night,hour})=>{
   const angle=Number(document.querySelector('#time-needle').getAttribute('transform').match(/rotate\(([^ ]+)/)[1]);
   return document.querySelector('#time-dial').title===label&&window.commandCheck.time.night===night&&Math.abs(angle-((hour+18)%24)/24*360)<3;
  },{label,night,hour});
  const time=await page.evaluate(()=>window.commandCheck.time),phase=((hour+18)%24)/24;
  assert.equal(time.startPhase,phase);assert(time.phase>=phase&&time.phase-phase<.01,JSON.stringify(time));
  assert(Math.abs(time.exposure-exposure)<.03,JSON.stringify(time));
  const angle=Number((await page.locator('#time-needle').getAttribute('transform')).match(/rotate\(([^ ]+)/)[1]);
  assert(Math.abs(angle-phase*360)<3,`${hour}: ${angle}`);
 }
 const running=await page.evaluate(()=>window.commandCheck.time.phase);
 await page.waitForFunction(phase=>window.commandCheck.time.phase>phase,running);
 const unchanged=await page.evaluate(()=>window.commandCheck.time.epoch);
 for(const text of ['/time','/time -1','/time 24','/time 12.5','/time 12 extra']){
  await open();await page.locator('#chat-input').fill(text);await page.keyboard.press('Enter');
  // A bare command first completes its name; a second Enter submits it without an argument.
  if(await page.locator('#chat-command-error').isHidden())await page.keyboard.press('Enter');
  assert(await page.locator('#chat-command-error').isVisible(),text);
  assert.equal(await page.evaluate(()=>window.commandCheck.time.epoch),unchanged);
 }
 const aliases=await page.evaluate(async()=>{const {TELE_ALIASES}=await import('/src/chat-commands.ts');return TELE_ALIASES;});
 for(const [id,alias] of Object.entries(aliases)){
  await command(`/tele ${alias}`);await page.waitForTimeout(150);
  const distance=await page.evaluate(id=>{const q=window.commandCheck,d=q.places.find(p=>p.id===id);return Math.hypot(q.c.actor.position.x-d.x,q.c.actor.position.z-d.z);},id);
  assert(distance<.2,`${id}: ${distance}`);
 }
 // Visiting the fountain naturally shrinks Kirby; restore the fixture's base size.
 await command('/size 100');
 // Changing language keeps every abbreviation and translates the destination names.
 for(const locale of ['en','bg']){
  await page.evaluate(locale=>document.querySelector(`[data-language="${locale}"]`).click(),locale);
  await open();await page.locator('#chat-input').fill('/tele mz');
  assert.equal(await page.locator('#chat-command-list code').textContent(),'mz');
  assert.notEqual(await page.locator('#chat-command-list span').textContent(),'Радужный лабиринт');
 }
 await page.evaluate(()=>document.querySelector('[data-language="ru"]').click());
 // Teleporting interrupts scripted motion without earning unfinished adventures.
 const starts={
  home:q=>{q.c.actor.position.copy(q.home.entrance);return q.home.start(q.c);},
  benches:q=>{q.c.actor.position.copy(q.seats[0].position).setY(0);q.benches.interact(q.c);return q.benches.active;},
  treehouse:q=>{const d=q.places.find(p=>p.id==='treehouse');q.c.actor.position.set(d.x,0,d.z);q.treehouse.interact(q.c);return q.treehouse.active;},
  balloons:q=>{q.c.actor.position.copy(q.balloons.balloons[0].group.position);return q.balloons.board(q.c);},
  coaster:q=>{q.coaster.carts[0].wait=5;const d=q.places.find(p=>p.id==='depot');q.c.actor.position.set(d.x,0,d.z);return q.coaster.board(q.c);},
  boats:q=>{q.c.actor.position.copy(q.boats.boats[0].position);return q.boats.board(q.c);},
  trampoline:q=>{q.c.starBlessed=true;q.c.actor.position.copy(q.trampoline.position);return q.trampoline.start(q.c);},
  skyTrail:q=>{q.c.skyCheckpoint=1;q.c.actor.position.copy(q.skyTrail.lower.position).add(q.skyTrail.group.position);return q.skyTrail.start(q.c);},
  fireflies:q=>{const bug=q.fireflies.bugs.find((b,i)=>!q.fireflies.occupiedByNpc(i));bug.carrier.position.copy(q.c.actor.position);bug.land=true;return q.fireflies.board(q.c);},
 };
 for(const [ride,start] of Object.entries(starts)){
  await command('/tele hm');const started=await page.evaluate(source=>{const q=window.commandCheck;q.c.setActivity('Idle');return (0,eval)(`(${source})`)(q);},start.toString());assert(started,ride);
  await page.waitForTimeout(150);await command('/tele mz');await page.waitForTimeout(650);
  const state=await page.evaluate(()=>{const q=window.commandCheck,d=q.places.find(p=>p.id==='maze');return {distance:Math.hypot(q.c.actor.position.x-d.x,q.c.actor.position.z-d.z),state:q.c.state,fit:q.c.animationRoot.parent.scale.x,parent:q.c.actor.parent.type,active:[q.coaster.riding,q.boats.riding,q.home.active,q.benches.active,q.treehouse.active,q.balloons.riding,q.trampoline.active,q.skyTrail.active,q.fireflies.riding]};});
  assert(state.distance<.2,`${ride}: ${JSON.stringify(state)}`);assert(state.active.every(v=>!v),ride);assert.equal(state.fit,1,ride);assert.equal(state.parent,'Scene',ride);
 }
 // Simulate online mode in this isolated page; do not open a real network room.
 const beforeOnline=await page.evaluate(()=>window.commandCheck.c.savedSize);
 await page.evaluate(()=>window.commandCheck.online=true);await open();await page.locator('#chat-input').fill('/');assert(await page.locator('#chat-command-list').isHidden());
 await page.locator('#chat-input').fill('/size 999');await page.keyboard.press('Enter');assert(await page.locator('#chat-command-error').isVisible());assert.equal(await page.evaluate(()=>window.commandCheck.c.savedSize),beforeOnline);
 const onlineTime=await page.evaluate(()=>window.commandCheck.time.epoch);
 await page.locator('#chat-input').fill('/time 0');await page.keyboard.press('Enter');assert(await page.locator('#chat-command-error').isVisible());
 assert.equal(await page.evaluate(()=>window.commandCheck.time.epoch),onlineTime);
 assert(!(await page.evaluate(()=>window.commandCheck.log)).some(m=>m.text==='/size 999'));
 await page.evaluate(()=>window.commandCheck.online=false);await page.locator('#chat-input').fill('Обычное сообщение');await page.keyboard.press('Enter');
 assert((await page.evaluate(()=>window.commandCheck.log)).some(m=>m.chat&&m.text==='Обычное сообщение'));
 assert.deepEqual(errors,[]);console.log('PASS commands, time and lighting, localized suggestions, range, keyboard, all 13 destinations, 9 interrupted rides, online gating and ordinary chat');
 await page.close();
 }

 for(const viewport of [{width:390,height:844},{width:844,height:390}]){
  const context=await browser.newContext({viewport,isMobile:true,hasTouch:true}),phone=await context.newPage();
  const errors=[];phone.on('pageerror',e=>errors.push(e.message));
  await phone.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
  await phone.goto(process.env.KIRBY_URL??'http://127.0.0.1:5174/');await phone.locator('#startup-loader').waitFor({state:'hidden',timeout:120000});
  await phone.locator('#new-game').click();await phone.locator('#player-name-input').fill('Телефон');await phone.locator('#start-game').click();
  await phone.locator('#touch-chat').tap();await phone.locator('#chat-input').fill('/tele');
  const box=await phone.locator('#chat-composer').boundingBox(),list=await phone.locator('#chat-command-list').boundingBox();
  assert(box.y>=0&&box.y+box.height<=viewport.height,JSON.stringify({viewport,box}));assert(list.y>=box.y&&list.y+list.height<=box.y+box.height);
  await phone.screenshot({path:new URL(`chat-commands-options-phone-${viewport.width}.png`,cache).pathname.replace(/^\/(\w:)/,'$1')});
  // A reduced visual viewport represents space left above a landscape keyboard.
  await phone.setViewportSize({width:viewport.width,height:220});
  await phone.waitForFunction(()=>document.querySelector('#chat-composer').classList.contains('chat-compact'));
  const compact=await phone.locator('#chat-composer').boundingBox(),cancel=await phone.locator('.touch-chat-buttons button[type="button"]').boundingBox();
  assert(compact.y+compact.height<=220);assert(cancel.y+cancel.height<=compact.y+compact.height);
  assert((await phone.locator('#chat-command-list').boundingBox()).height>=32);
  await phone.screenshot({path:new URL(`chat-commands-keyboard-${viewport.width}.png`,cache).pathname.replace(/^\/(\w:)/,'$1')});
  await phone.setViewportSize(viewport);
  await phone.locator('#chat-command-list button').filter({hasText:'mz'}).tap();await phone.locator('.touch-chat-buttons button[type="submit"]').tap();
  assert(await phone.locator('#chat-composer').isVisible());assert.equal(await phone.locator('#chat-input').inputValue(),'');
  assert(await phone.locator('#chat-command-error').isHidden());
  await phone.screenshot({path:new URL(`chat-commands-phone-${viewport.width}.png`,cache).pathname.replace(/^\/(\w:)/,'$1')});
  assert.deepEqual(errors,[]);
  await context.close();console.log(`PASS mobile ${viewport.width}x${viewport.height}: dropdown bounds, touch selection and persistent chat`);
 }
}finally{await browser.close();}
