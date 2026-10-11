import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';

const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const cache=new URL('../node_modules/.cache/',import.meta.url);await mkdir(cache,{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:850}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');window.documentToken=crypto.randomUUID();});
 await page.route('**/room',route=>route.fulfill({json:{players:0,occupiedVariants:[],capacity:16}}));
 await page.route('**/history/solo',route=>route.fulfill({json:{ok:true}}));
 await page.route('**/src/main.ts*',async route=>{
  const response=await route.fetch();await route.fulfill({response,body:(await response.text())+`
window.menuCheck={scene,renderer,shadows,gamepad,chat,fruits,coaster,station:STATION,boats,balloons,home,treehouse,skyTrail,maze,trampoline,benches,get fireflies(){return fireflies},get c(){return character},get npcs(){return npcs},get network(){return network},get remote(){return remotePlayers},get playing(){return playing},get history(){return soloHistory},festivalView};
`});
 });
 let pendingSocket,joins=0,closes=0,deferWelcome=false,finished=false;
 const welcome=ws=>{
  const now=Date.now(),room={id:'test-room',host:'self',epoch:now-1000,dayPhase:.25,fruits:Array.from({length:70},(_,i)=>i===0?'other':null),starAt:0,mill:false,locks:{'bug:0':'other'}};
  const peer={p:[5,0,5],q:[0,0,0,1],s:1,state:'Idle',pose:[],fruits:3,achievements:[],name:'Друг',variant:1,star:0};
  if(finished)room.festival={startsAt:now-130000,endsAt:now-1000,initiator:'Друг',players:{self:{name:'Игрок',variant:0,base:12,fruits:1,size:1,bonus:0,collected:[]}},results:[{id:'self',name:'Игрок',variant:0,points:12,bonus:0,fruits:1,size:1}]};
  ws.send(JSON.stringify({type:'welcome',protocolVersion:2,playerId:'self',room,players:[{id:'self'},{id:'other',actor:peer}]}));
 };
 await page.routeWebSocket('**/ws?**',ws=>{
  joins++;ws.onClose(()=>closes++);ws.onMessage(m=>{if(m==='ping')ws.send('pong');});
  if(deferWelcome)pendingSocket=ws;else welcome(ws);
 });
 await page.goto(process.env.KIRBY_URL??'http://127.0.0.1:5174/');
 await page.locator('#startup-loader').waitFor({state:'hidden',timeout:120000});
 const token=await page.evaluate(()=>window.documentToken);let navigations=0;
 page.on('framenavigated',frame=>{if(frame===page.mainFrame())navigations++;});
 const checkMenu=async()=>{
  await page.locator('#startup-menu').waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>window.documentToken),token);assert.equal(navigations,0);
  const state=await page.evaluate(()=>({playing:menuCheck.playing,c:!!menuCheck.c,npcs:menuCheck.npcs.length,remote:!!menuCheck.remote,network:!!menuCheck.network,actors:menuCheck.scene.children.filter(o=>o.name==='Игрок'||o.name.startsWith('NPC ')).length,claim:!!menuCheck.fruits.claim,onMap:menuCheck.fruits.onMap,blocked:menuCheck.fireflies.networkBlocked.size,boats:menuCheck.boats.riding,home:menuCheck.home.active,balloon:menuCheck.balloons.riding,firefly:menuCheck.fireflies.riding,history:!!menuCheck.history}));
  assert.deepEqual(state,{playing:false,c:false,npcs:0,remote:false,network:false,actors:0,claim:false,onMap:70,blocked:0,boats:false,home:false,balloon:false,firefly:false,history:false});
 };
 const choose=async online=>{await page.locator(online?'#network-join':'#new-game').click();await page.locator('#player-name-input').fill('Игрок');};
 const start=async online=>{await choose(online);await page.locator('#start-game').click();await page.waitForFunction(()=>menuCheck.playing);};
 const exit=async()=>{await page.locator('#settings-toggle').click();await page.locator('#exit-to-menu').click();await checkMenu();};
 await choose(false);assert.equal(await page.locator('#spawn-near-depot').count(),0);
 const select=await page.locator('.selection-input-row select').boundingBox(),hint=await page.locator('.selection-input-row .gamepad-hint').boundingBox();
 assert(hint.x>select.x+select.width,'hint sits to the right of the selector');
 const back=await page.locator('#character-back').boundingBox(),startBox=await page.locator('#start-game').boundingBox();assert(back.x<startBox.x&&Math.abs(back.y-startBox.y)<12);
 await page.screenshot({path:new URL('menu-selection-desktop.png',cache).pathname.replace(/^\/(\w:)/,'$1')});
 await page.locator('#character-back').click();await checkMenu();
 await choose(false);
 await page.evaluate(()=>{
  window.testPad={id:'Menu test pad',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0,touched:false}))};
  Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[window.testPad]});menuCheck.gamepad.input.select(JSON.stringify([window.testPad.id,0]));
 });
 await page.waitForFunction(()=>menuCheck.gamepad.input.active!=='keyboard');await page.waitForTimeout(80);
 await page.evaluate(()=>window.testPad.buttons[1]={pressed:true,value:1,touched:true});await checkMenu();
 await page.evaluate(()=>{window.testPad.buttons[1]={pressed:false,value:0,touched:false};menuCheck.gamepad.input.select('keyboard');});await page.waitForFunction(()=>menuCheck.gamepad.input.active==='keyboard');
 await start(false);
 await page.evaluate(()=>{menuCheck.c.resizeTo(3,true);menuCheck.c.grow();menuCheck.c.skyCheckpoint=2;menuCheck.c.achievements.add('sleep');menuCheck.c.actor.position.copy(menuCheck.home.entrance);menuCheck.home.start(menuCheck.c);});
 // A save remains usable after an in-page exit, even from a scripted attraction.
 await page.locator('#settings-toggle').click();await page.locator('#save-game').click();await page.locator('#exit-to-menu').click();await checkMenu();
 await page.locator('#load-game').click();await page.locator('#start-game').click();await page.waitForFunction(()=>menuCheck.playing);
 assert(await page.evaluate(()=>menuCheck.c.achievements.has('sleep')&&menuCheck.c.fruitsEaten===1&&menuCheck.c.skyCheckpoint===2));await exit();
 const afterSolo=await page.evaluate(()=>menuCheck.shadows.shaders.size);
 for(let i=0;i<3;i++){
  await start(false);assert.equal(await page.evaluate(()=>menuCheck.c.fruitsEaten),0);assert.equal(await page.evaluate(()=>menuCheck.c.skyCheckpoint),0);
  await page.locator('#settings-toggle').click();assert(await page.locator('#save-game').isVisible());await page.locator('#exit-to-menu').click();await checkMenu();
  assert.equal(await page.evaluate(()=>menuCheck.shadows.shaders.size),afterSolo,'retired actors must not accumulate in the shadow cache');
 }
 for(const attraction of ['balloon','firefly','coaster','boat','star']){
  await start(false);
  assert(await page.evaluate(kind=>{
   const m=menuCheck,c=m.c;c.setActivity('Idle');c.actor.scale.setScalar(1);
   if(kind==='balloon'){c.actor.position.copy(m.balloons.balloons[0].group.position);return m.balloons.board(c);}
   if(kind==='firefly'){const b=m.fireflies.bugs[0];b.carrier.position.copy(b.home);b.land=true;c.actor.position.copy(b.carrier.position);return m.fireflies.board(c);}
   if(kind==='coaster'){const rows=m.coaster.networkState();rows[0]=[0,2.5,0,1];m.coaster.networkApply(rows);c.actor.position.copy(m.station);return m.coaster.board(c);}
   if(kind==='boat'){c.actor.position.copy(m.boats.boats[0].position);c.actor.position.y=0;return m.boats.board(c);}
   c.activateStarPower();m.maze.update(.01,c,false);return !!c.actor.getObjectByName('Golden star blessing');
  },attraction),attraction);
  await exit();assert.equal(await page.evaluate(()=>menuCheck.shadows.shaders.size),afterSolo);
 }
 await start(true);await page.waitForFunction(()=>menuCheck.remote?.players.size===1);assert(await page.locator('#save-game').isHidden());
 await page.evaluate(()=>{window.oldLock=menuCheck.network.acquire('bug:1');});
 await exit();assert.equal(await page.evaluate(()=>window.oldLock),false);await page.waitForFunction(()=>!document.querySelector('.remote-stat-row'));
 // Cancelling an unfinished connection must not allow a late welcome to start a game.
 deferWelcome=true;await choose(true);await page.locator('#start-game').click();await page.waitForTimeout(300);
 await page.locator('#character-back').click();await checkMenu();
 try{welcome(pendingSocket);}catch{}await page.waitForTimeout(300);await checkMenu();deferWelcome=false;
 await start(false);await exit();
 // Final results also return without navigating and are reset for the next game.
 finished=true;await choose(true);await page.locator('#start-game').click();await page.locator('#starfall-results').waitFor({state:'visible',timeout:10000});
 await page.locator('#starfall-results button').click();await checkMenu();assert(await page.locator('#starfall-results').isHidden());finished=false;
 await start(false);assert(await page.locator('#starfall-results').isHidden());await exit();
 assert.equal(joins,3);assert.equal(closes,3);assert.deepEqual(errors,[]);
 console.log('PASS desktop: mouse/gamepad Back, wrapping hint, solo/load/restart, all ride exits, star reset, online cleanup, connection cancellation, results exit; zero navigations or actor shadow leaks');
 await page.close();

 for(const viewport of process.argv.includes('--desktop-only')?[]:[{width:390,height:844},{width:844,height:390}]){
  const mobile=await browser.newPage({viewport,isMobile:true,hasTouch:true});const mobileErrors=[];mobile.on('pageerror',e=>mobileErrors.push(e.message));
  await mobile.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');window.documentToken=crypto.randomUUID();});
  await mobile.route('**/room',route=>route.fulfill({json:{players:0,occupiedVariants:[],capacity:16}}));await mobile.route('**/history/solo',route=>route.fulfill({json:{ok:true}}));
  await mobile.goto(process.env.KIRBY_URL??'http://127.0.0.1:5174/');await mobile.locator('#startup-loader').waitFor({state:'hidden',timeout:120000});
  const original=await mobile.evaluate(()=>window.documentToken);await mobile.locator('#new-game').tap();
  const layout=await mobile.locator('.selection-input-row').evaluate(el=>{const s=el.querySelector('select').getBoundingClientRect(),h=el.querySelector('p').getBoundingClientRect();return {right:h.x>=s.right,wrap:h.height>35,overflow:el.scrollWidth>el.clientWidth};});assert(layout.right);assert(!layout.overflow);
  await mobile.locator('#character-back').scrollIntoViewIfNeeded();await mobile.screenshot({path:new URL(`menu-selection-mobile-${viewport.width}.png`,cache).pathname.replace(/^\/(\w:)/,'$1')});
  await mobile.locator('#character-back').tap();assert(await mobile.locator('#startup-menu').isVisible());
  await mobile.locator('#new-game').tap();await mobile.locator('#player-name-input').fill('Игрок');await mobile.locator('#start-game').tap();await mobile.locator('#settings-toggle').tap();await mobile.locator('#exit-to-menu').tap();
  assert(await mobile.locator('#startup-menu').isVisible());assert.equal(await mobile.evaluate(()=>window.documentToken),original);assert.deepEqual(mobileErrors,[]);await mobile.close();
 }
 if(!process.argv.includes('--desktop-only'))console.log('PASS mobile portrait and landscape: hint, Back and session exit without reload');
}finally{await browser.close();}
