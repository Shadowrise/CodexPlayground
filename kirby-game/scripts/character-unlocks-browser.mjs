import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';

const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const cache=new URL('../node_modules/.cache/',import.meta.url);await mkdir(cache,{recursive:true});
const key='kirby-bandana-unlocked-v1',url=process.env.KIRBY_URL??'http://127.0.0.1:5174/';
try{
 const page=await browser.newPage({viewport:{width:1280,height:850}}),errors=[];
 page.on('pageerror',e=>{errors.push(e.message);console.error(e.stack);});
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
 await page.route('**/room',route=>route.fulfill({json:{players:1,occupiedVariants:[1],capacity:16}}));
 await page.route('**/history/solo',route=>route.fulfill({json:{ok:true}}));
 await page.route('**/src/main.ts*',async route=>{
  const response=await route.fetch();await route.fulfill({response,body:(await response.text())+`
  let unlockPlays=0;const unlockSound=sounds.playCharacterUnlock.bind(sounds);sounds.playCharacterUnlock=()=>{unlockPlays++;unlockSound();};
  window.unlockCheck={get c(){return character},get selected(){return selected},get playing(){return playing},get network(){return network},get unlockPlays(){return unlockPlays},get log(){return localLog},set online(value){networkIntent=value},sounds,progress:characterUnlocks,required:SCORE_ACTIONS,gamepad,view:unlockView};
  `});
 });
 let socket;
 await page.routeWebSocket('**/ws?**',ws=>{
  socket=ws;ws.onMessage(m=>{if(m==='ping')ws.send('pong');});
  const required=['millQuest','sleep','coaster','bench','balloon','treehouse','swing','leaves','star','firefly','skyStar','fountain','boat','centipede'];
  const actor={p:[25,0,25],q:[0,0,0,1],s:1,state:'Idle',pose:[],fruits:0,achievements:required,name:'Друг',variant:1,star:0};
  ws.send(JSON.stringify({type:'welcome',protocolVersion:2,playerId:'self',room:{id:'unlock-test',host:'self',epoch:Date.now(),dayPhase:.25,fruits:Array(70).fill(null),starAt:0,mill:false,locks:{}},players:[{id:'self'},{id:'other',actor}],resume:{...actor,name:'Игрок',variant:0,achievements:required.slice(0,-1)}}));
 });
 const loaded=()=>page.locator('#startup-loader').waitFor({state:'hidden',timeout:120000});
 const bandana=()=>page.locator('.variant-button.bandana-kirby');
 const choose=async online=>{await page.locator(online?'#network-join':'#new-game').click();await page.locator('#player-name-input').fill('Игрок');};
 const start=async()=>{await page.locator('#start-game').click();await page.waitForFunction(()=>unlockCheck.playing);};
 const exit=async()=>{await page.locator('#settings-toggle').click();await page.locator('#exit-to-menu').click();await page.locator('#startup-menu').waitFor({state:'visible'});};
 await page.goto(url);await loaded();await choose(false);
 assert.equal(await bandana().getAttribute('aria-disabled'),'true');assert.equal(await bandana().getAttribute('title'),'');
 assert(await bandana().locator('.variant-lock').isVisible());await bandana().click({force:true});
 assert.equal(await page.evaluate(()=>unlockCheck.selected[0]),'Классический');assert.match(await page.locator('#locked-character-tooltip').textContent(),/Пройди все/);assert(!await page.locator('#selection-message').isVisible());
 await page.screenshot({path:new URL('bandana-locked.png',cache).pathname.replace(/^\/(\w:)/,'$1')});
 if(process.argv.includes('--command-only')){
  await start();await page.keyboard.press('Enter');await page.locator('#chat-input').fill('/');
  assert.deepEqual(await page.locator('#chat-command-list code').allTextContents(),['/size','/tele','/unlock']);
  await page.locator('#chat-input').fill('/unlock other');await page.keyboard.press('Enter');assert(await page.locator('#chat-command-error').isVisible());
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),null);assert.equal(await page.evaluate(()=>unlockCheck.unlockPlays),0);
  await page.evaluate(()=>unlockCheck.online=true);await page.locator('#chat-input').fill('/unlock bandana');
  assert(await page.locator('#chat-command-list').isHidden());await page.keyboard.press('Enter');assert(await page.locator('#chat-command-error').isVisible());
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),null);assert.equal(await page.evaluate(()=>unlockCheck.unlockPlays),0);
  await page.evaluate(()=>unlockCheck.online=false);
  const adventures=await page.evaluate(()=>[...unlockCheck.c.achievements]);
  await page.locator('#chat-input').fill('/unlock ba');assert.equal(await page.locator('#chat-command-list code').textContent(),'bandana');
  await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
  await page.locator('#character-unlock').waitFor({state:'visible'});assert(await page.locator('#chat-composer').isHidden());
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),'1');assert.equal(await page.evaluate(()=>unlockCheck.unlockPlays),1);
  assert.deepEqual(await page.evaluate(()=>[...unlockCheck.c.achievements]),adventures);
  const audio=await page.evaluate(()=>{const s=unlockCheck.sounds,b=s.buffers.get('character-unlock');return {duration:b?.duration,protected:[...s.active].some(v=>v.source.buffer===b&&v.protected)};});
  assert.equal(audio.duration,1.8);assert(audio.protected);
  await page.keyboard.press('Enter');await page.locator('#chat-input').fill('/unlock bandana');await page.keyboard.press('Enter');await page.waitForTimeout(150);
  assert.equal(await page.evaluate(()=>unlockCheck.unlockPlays),1);assert(!(await page.evaluate(()=>unlockCheck.log)).some(m=>m.text.startsWith('/unlock')));
  await exit();await choose(false);assert.equal(await bandana().getAttribute('aria-disabled'),'false');
  await page.reload();await loaded();await choose(false);assert.equal(await bandana().getAttribute('aria-disabled'),'false');
  assert.deepEqual(errors,[]);console.log('PASS unlock command: suggestions, online gating, unchanged adventures, same protected sound, one announcement and persisted selection');
 }else{
 // The styled hint is large, localized and never clipped by the scrolling picker.
 for(const [locale,title] of [['en','Character unavailable'],['bg','Героят е недостъпен'],['ru','Персонаж недоступен']]){
  await page.locator('#character-back').click();await page.locator(`#startup-menu [data-language="${locale}"]`).click();await choose(false);
  await bandana().hover();assert.equal(await page.locator('#locked-character-tooltip strong').textContent(),title);
  assert(!await page.locator('#selection-message').isVisible());
 }
 await page.locator('.variant-button').first().click();await bandana().hover();await page.mouse.move(0,0);assert(!await page.locator('#locked-character-tooltip').isVisible());
 for(const viewport of [{width:1280,height:850},{width:390,height:844},{width:844,height:390}]){
  await page.setViewportSize(viewport);await bandana().scrollIntoViewIfNeeded();await bandana().click({force:true});await page.waitForTimeout(200);
  const box=await page.locator('#locked-character-tooltip').boundingBox();assert(box.x>=12&&box.x+box.width<=viewport.width-12&&box.y>=12&&box.y+box.height<=viewport.height-12);
  assert.equal(await page.locator('#locked-character-tooltip p').evaluate(el=>getComputedStyle(el).fontSize),'17px');
  assert(!await page.locator('#selection-message').isVisible());
  await page.screenshot({path:new URL('bandana-tooltip-'+viewport.width+'x'+viewport.height+'.png',cache).pathname.replace(/^\/(\w:)/,'$1')});
  await page.keyboard.press('Escape');assert(!await page.locator('#locked-character-tooltip').isVisible());
 }
 await page.setViewportSize({width:1280,height:850});console.log('PASS large custom tooltip, hover dismissal, three languages and phone viewports');
 // Moving right past the locked final card must wrap rather than get stuck.
 await page.evaluate(()=>{
  document.querySelectorAll('.variant-button')[15].click();
  const pad={id:'Unlock test pad',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
  window.unlockPad=pad;Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[pad]});unlockCheck.gamepad.input.select(JSON.stringify([pad.id,pad.index]));
 });
 await page.waitForTimeout(200);await page.evaluate(()=>unlockPad.buttons[15]={pressed:true,value:1});
 await page.waitForFunction(()=>unlockCheck.selected[0]!=='Радуга');assert.notEqual(await page.evaluate(()=>unlockCheck.selected[0]),'Бандана');
 await page.evaluate(()=>{unlockPad.buttons[15]={pressed:false,value:0};unlockCheck.gamepad.input.select('keyboard');});
 await page.waitForTimeout(200);await start();
 await page.evaluate(()=>{unlockCheck.c.achievements.clear();unlockCheck.required.slice(0,-1).forEach(a=>unlockCheck.c.achievements.add(a));});
 await page.waitForTimeout(250);assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),null);assert(!await page.locator('#character-unlock').isVisible());
 await page.evaluate(()=>unlockCheck.c.achievements.add(unlockCheck.required.at(-1)));
 await page.locator('#character-unlock').waitFor({state:'visible'});
 assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),'1');assert.equal(await page.evaluate(()=>unlockCheck.unlockPlays),1);
 assert.match(await page.locator('#character-unlock').textContent(),/Персонаж разблокирован.*Бандана/);
 assert((await page.locator('#character-unlock .mini-kirby').evaluate(el=>getComputedStyle(el,'::before').backgroundImage)).includes('bandana.svg'));
 await page.waitForTimeout(500);await page.screenshot({path:new URL('bandana-unlocked-desktop.png',cache).pathname.replace(/^\/(\w:)/,'$1')});
 const sound=await page.evaluate(()=>{const s=unlockCheck.sounds,b=s.buffers.get('character-unlock'),data=b?.getChannelData(0);return {state:s.context?.state,duration:b?.duration,peak:data?Math.max(...data):0,first:data?.[0],last:data?.[data.length-1],protected:[...s.active].some(v=>v.source.buffer===b&&v.protected)};});
 assert.equal(sound.state,'running');assert(sound.duration>1.5&&sound.peak>.1&&sound.peak<1);assert.equal(sound.first,0);assert(Math.abs(sound.last)<1e-5);assert(sound.protected);
 assert.equal(await page.locator('#character-unlock button').count(),0);await page.locator('#character-unlock').click();await page.locator('#character-unlock').waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>unlockCheck.unlockPlays),1);
 await exit();await choose(false);assert.equal(await bandana().getAttribute('aria-disabled'),'false');await bandana().click();assert.equal(await page.evaluate(()=>unlockCheck.selected[0]),'Бандана');
 await page.reload();await loaded();await choose(false);assert.equal(await bandana().getAttribute('aria-disabled'),'false');
 console.log('PASS solo unlock, protected sound, gamepad skip and persistent selection');

 // A fresh online player must earn the unlock independently of the full-progress peer.
 await page.evaluate(key=>localStorage.removeItem(key),key);await page.reload();await loaded();await choose(true);await start();
 await page.waitForFunction(()=>unlockCheck.network?.actors.size===1);assert(!await page.locator('#character-unlock').isVisible());
 assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),null);
 socket.send(JSON.stringify({type:'centipede-progress',points:12,completed:true}));
 await page.locator('#character-unlock').waitFor({state:'visible'});assert.equal(await page.evaluate(()=>unlockCheck.unlockPlays),1);
 assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),'1');socket.send(JSON.stringify({type:'centipede-progress',points:12,completed:true}));await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>unlockCheck.unlockPlays),1);
 for(const viewport of [{width:390,height:844},{width:844,height:390}]){
  await page.setViewportSize(viewport);await page.waitForTimeout(150);
  const box=await page.locator('#character-unlock').boundingBox();assert(box.x>=0&&box.x+box.width<=viewport.width&&box.y>=0&&box.y+box.height<=viewport.height);
  await page.screenshot({path:new URL('bandana-unlocked-'+viewport.width+'x'+viewport.height+'.png',cache).pathname.replace(/^\/(\w:)/,'$1')});
 }
 await page.setViewportSize({width:1280,height:850});await exit();await choose(true);assert.equal(await bandana().getAttribute('aria-disabled'),'false');
 await page.locator('#character-back').click();
 console.log('PASS own online completion only, repeated acknowledgements and compact notification');

 // Old free-Bandana saves keep their progress while selecting an available appearance.
 await choose(false);await page.locator('.variant-button').first().click();await start();
 await page.locator('#settings-toggle').click();await page.locator('#save-game').click();
 await page.evaluate(key=>{
  const save=JSON.parse(localStorage.getItem('kirby-save-v1'));save.player.variant='Бандана';save.player.achievements=['swing'];save.player.fruitsEaten=7;
  save.npcs.find(n=>n.variant==='Сапфир').variant='Классический';localStorage.setItem('kirby-save-v1',JSON.stringify(save));localStorage.removeItem(key);
 },key);
 await page.reload();await loaded();await page.locator('#load-game').click();assert.notEqual(await page.evaluate(()=>unlockCheck.selected[0]),'Бандана');
 assert.match(await page.locator('#selection-message').textContent(),/Прогресс сохранён/);await page.locator('#player-name-input').fill('Игрок');await start();
 assert.equal(await page.evaluate(()=>unlockCheck.c.fruitsEaten),7);assert(await page.evaluate(()=>unlockCheck.c.achievements.has('swing')));assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),null);
 assert.deepEqual(errors,[]);console.log('PASS legacy save progress retained; zero page errors');
 }
}finally{await browser.close();}
