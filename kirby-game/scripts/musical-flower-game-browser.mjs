import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {FLOWER_MELODIES,FLOWER_ROUNDS,flowerDeadline,flowerPlayback,FLOWER_EMPTY_MS} from '../src/musical-flower-game.ts';
import {MUSICAL_FLOWER_SITE as SITE,MUSICAL_FLOWERS} from '../src/musical-flower-site.ts';
import {PROTOCOL} from '../src/network-protocol.ts';
const online=process.argv.includes('--online'),mobile=process.argv.includes('--mobile'),output=new URL('../node_modules/.cache/',import.meta.url).pathname.replace(/^\/(\w:)/,'$1');
const realNow=Date.now;let shift=0;Date.now=()=>realNow()+shift;
let room;const sockets=[];
if(online){
 globalThis.WebSocketRequestResponsePair=class{};
 const source=(await readFile(new URL('../../game-server/src/index.ts',import.meta.url),'utf8')).replace("import { DurableObject } from 'cloudflare:workers';",'class DurableObject { constructor(ctx,env){this.ctx=ctx;this.env=env;} }').replaceAll('../../kirby-game/src/',new URL('../src/',import.meta.url).href).replaceAll("from './", "from '"+new URL('../../game-server/src/',import.meta.url).href).replace(/(from ['"]file:[^'"]+)(['"])/g,'$1.ts$2');
 const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 const {GameRoom}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64')),stored=new Map();
 const ctx={getWebSockets:()=>sockets,blockConcurrencyWhile:f=>f(),waitUntil:p=>p.catch(console.error),setWebSocketAutoResponse(){},getWebSocketAutoResponseTimestamp(){return new Date(Date.now());},storage:{async get(k){return stored.get(k);},async put(k,v){stored.set(k,structuredClone(v));},async delete(k){stored.delete(k);},async setAlarm(){}}};
 room=new GameRoom(ctx,{});await Promise.resolve();room.room=room.newRoom('p0');
}
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--renderer-process-limit=1']});
try{
 const errors=[],pages=[];
 for(let i=0;i<(online?2:1);i++){
  const context=await browser.newContext(mobile?{viewport:{width:844,height:390},isMobile:true,hasTouch:true}:{viewport:{width:1440,height:850}}),page=await context.newPage();pages.push(page);
  page.on('pageerror',e=>{errors.push(e.message);console.error(e.stack);});page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL|shader/i.test(m.text()))errors.push(m.text());});
  // Keep this loaded version stable if other local work changes the Vite project.
  await page.routeWebSocket('ws://127.0.0.1:5174/**',ws=>ws.onMessage(()=>{}));
  await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
  for(const endpoint of ['room','players','history/solo'])await page.route('**/'+endpoint,r=>r.fulfill({json:{ok:true,players:0,occupiedVariants:[],capacity:14}}));
  if(online)await page.routeWebSocket('**/ws?**',ws=>{
   const socket={readyState:1,data:{id:'p'+i,session:room.room.id,variant:i,name:'Игрок '+i,seen:Date.now(),visible:true,announced:true},deserializeAttachment(){return structuredClone(this.data);},serializeAttachment(a){this.data=structuredClone(a);},send(text){ws.send(text);},close(){this.readyState=3;ws.close();}};sockets.push(socket);
   ws.onMessage(data=>{if(data==='ping'){ws.send('pong');return;}room.webSocketMessage(socket,data);});
   ws.send(JSON.stringify({type:'welcome',serverNow:Date.now(),protocolVersion:PROTOCOL,playerId:socket.data.id,room:room.room,players:sockets.map(s=>({id:s.data.id,actor:s.data.actor}))}));room.broadcast({type:'presence',count:sockets.length},socket);
  });
  await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+`\nwindow.flowerGameQA={garden:musicalFlowers,view:flowerGameView,renderer,scene,camera,sounds,music,gamepad,played:[],get c(){return character},get game(){return currentFlowerGame()},get session(){return network},set solo(q){soloFlowerGame=q},set clock(v){const native=window.realFlowerNow??=Date.now,delta=v-native();Date.now=()=>native()+delta;},set offset(v){if(network)network.clockOffset=v;},set day(v){dayStart=Date.now();dayStartPhase=v}};const playFlowerForQA=flowerGameView.play;flowerGameView.play=(index,transpose)=>{flowerGameQA.played.push({index,transpose,stage:currentFlowerGame()?.stage});playFlowerForQA(index,transpose);};\n`});});
  await page.goto(process.env.GAME_URL??'http://127.0.0.1:5174/');await page.locator('#startup-loader').waitFor({state:'hidden',timeout:180000});
  await page.locator(online?'#network-join':'#new-game').click();await page.locator('#player-name-input').fill('Игрок '+i);if(i)await page.locator('#variant-grid button').nth(i).click();await page.locator('#start-game').click();await page.waitForFunction(()=>window.flowerGameQA?.c);
  console.log('Loaded player '+i);
  await page.evaluate(({x,z})=>{flowerGameQA.c.setActivity('Idle');flowerGameQA.c.actor.position.set(x,0,z+2);flowerGameQA.day=.25;},SITE);
 }
 const page=pages[0],get=()=>online?room.room.flowerGame:page.evaluate(()=>flowerGameQA.game);
 const jump=async at=>{if(online){shift=at-realNow();for(const p of pages)await p.evaluate(shift=>{flowerGameQA.offset=shift;},shift);}else await page.evaluate(at=>{flowerGameQA.clock=at;},at);await page.waitForTimeout(220);};
 const press=async(p,index)=>{
  const f=MUSICAL_FLOWERS[index];await p.evaluate(f=>{const q=flowerGameQA;q.c.setActivity('Idle');q.c.actor.position.set(f.x+Math.sin(f.yaw),0,f.z+Math.cos(f.yaw));},f);
  await p.waitForFunction(()=>document.querySelector('#action-hint').textContent.includes('Сыграть ноту'));
  if(mobile)await p.locator('#touch-interact').tap();else await p.keyboard.press('KeyE');await p.waitForTimeout(230);
 };
 const listen=async q=>{for(const note of flowerPlayback(q)){await jump(note.at+20);assert(await page.evaluate(index=>performance.now()/1000-flowerGameQA.garden.flowers[index].playedAt<.6,note.index),'scheduled flower playback');}if(q.stage==='echo'){assert.deepEqual(flowerPlayback(q),[]);assert(await page.evaluate(()=>flowerGameQA.sounds.buffers.has('task-complete')));}await jump(flowerDeadline(q)+20);};
 await page.waitForFunction(()=>document.querySelector('#action-hint').textContent.includes('Начать цветочную мелодию'));
 assert(await page.evaluate(()=>flowerGameQA.music.audio.volume===flowerGameQA.music.volume),'normal music level before the flower game');
 if(mobile)await page.locator('#touch-interact').tap();else await page.keyboard.press('KeyE');
 await page.waitForFunction(()=>flowerGameQA.game?.stage==='listen');let q=await get();
 await page.waitForFunction(()=>flowerGameQA.music.audio.volume<flowerGameQA.music.volume*.25);
 assert(await page.evaluate(()=>Number(document.querySelector('#music-volume').value)/100===flowerGameQA.music.volume),'ducking preserves the music setting');
 // The clock controls shorten waits, while real E/touch input and room rules remain intact.
 let retried=false;
 for(let round=1;round<=FLOWER_ROUNDS;round++){
  q=await get();assert.equal(q.round,round);
  await listen(q);await page.waitForFunction(()=>flowerGameQA.game?.stage==='repeat');q=await get();console.log('Round '+round);
  assert.equal(await page.locator('#flower-game-hud .flower-game-notes > span').count(),round);
  if(round===3&&!retried){
   const wrong=(FLOWER_MELODIES[q.melody].notes[0]+1)%7;await press(page,wrong);await page.waitForFunction(()=>flowerGameQA.game?.stage==='error');
   assert.equal(await page.locator('#flower-game-hud .wrong').count(),1);await page.screenshot({path:output+'flower-game-error'+(mobile?'-phone':'')+'.png'});q=await get();await jump(flowerDeadline(q)+20);q=await get();await jump(flowerDeadline(q)+20);retried=true;
  }
  q=await get();
  if(round===4){
   await press(page,FLOWER_MELODIES[q.melody].notes[0]);assert.equal((await get()).cursor,1);
   await page.evaluate(SITE=>{flowerGameQA.c.setActivity('Idle');flowerGameQA.c.actor.position.set(SITE.x,0,SITE.z+2);},SITE);
   await page.waitForFunction(()=>document.querySelector('#action-hint').textContent.includes('Послушать мелодию ещё раз'));
   if(mobile)await page.locator('#touch-interact').tap();else await page.keyboard.press('KeyE');await page.waitForFunction(()=>flowerGameQA.game?.stage==='listen');
   q=await get();assert.equal(q.round,4);assert.equal(q.cursor,0);await listen(q);q=await get();
  }
  for(let i=0;i<round;i++){
   const p=pages[online?i%2:0];await press(p,FLOWER_MELODIES[q.melody].notes[i]);
   assert.equal(await page.locator('#flower-game-hud .correct').count(),i+1);
  }
  q=await get();if(round<FLOWER_ROUNDS){assert.equal(q.stage,'echo');await listen(q);}else assert.equal(q.stage,'celebrate');
 }
 for(const p of pages){await p.waitForFunction(()=>flowerGameQA.c.achievements.has('flowers'));assert.equal(await p.evaluate(()=>flowerGameQA.c.achievements.has('flowers')),true);}
 const celebration=await page.evaluate(()=>({visible:flowerGameQA.view.group.getObjectByName('Flower melody celebration fireworks').visible,score:document.querySelector('#player-fruits').textContent}));assert(celebration.visible);
 await page.screenshot({path:output+'flower-game-win'+(online?'-online':mobile?'-phone':'')+'.png'});
 if(mobile){for(const [width,height] of [[844,390],[390,844]]){await page.setViewportSize({width,height});const box=await page.locator('#flower-game-hud').boundingBox();assert(box.y<12&&box.x>=0&&box.x+box.width<=width&&box.y+box.height<height/2,JSON.stringify(box));}}
 q=await get();const performance=flowerPlayback(q);assert(performance.length>10);
 for(const p of pages)await p.evaluate(SITE=>{flowerGameQA.c.setActivity('Idle');flowerGameQA.c.actor.position.set(SITE.x,0,SITE.z+2);},SITE);
 await page.keyboard.press('KeyE');assert.equal((await get()).stageAt,q.stageAt,'start button is locked during the concert');
 for(const note of performance){
  await jump(note.at+20);
  for(const p of pages)assert(await p.evaluate(({index,transpose})=>[...flowerGameQA.sounds.active].some(v=>v.source.buffer===flowerGameQA.sounds.buffers.get('flower-note-'+index)&&Math.abs(v.source.playbackRate.value-2**(transpose/12))<.0001),note),'the full melody uses the bell sound and its correct pitch');
 }
 for(const p of pages){
  const played=await p.evaluate(()=>flowerGameQA.played.filter(n=>n.stage==='celebrate').map(({index,transpose})=>({index,transpose})));
  assert.deepEqual(played,performance.map(({index,transpose})=>({index,transpose})),'every full melody note plays once, in order');
 }
 await page.keyboard.press('KeyE');assert.equal((await get()).stage,'celebrate','still locked while the last note rings');
 await jump(flowerDeadline(q)+20);assert.equal(await get(),undefined);
 await page.waitForFunction(()=>Math.abs(flowerGameQA.music.audio.volume-flowerGameQA.music.volume)<.001);
 await page.evaluate(SITE=>{flowerGameQA.c.setActivity('Idle');flowerGameQA.c.actor.position.set(SITE.x,0,SITE.z+2);},SITE);
 await page.waitForFunction(()=>document.querySelector('#action-hint').textContent.includes('Начать цветочную мелодию'));
 if(mobile)await page.locator('#touch-interact').tap();else await page.keyboard.press('KeyE');await page.waitForFunction(()=>!!flowerGameQA.game);
 for(const p of pages)await p.evaluate(()=>{flowerGameQA.c.actor.position.set(200,0,180);});await page.waitForTimeout(350);q=await get();assert(q.emptySince!==undefined);await page.screenshot({path:output+'flower-game-countdown.png'});await jump(q.emptySince+FLOWER_EMPTY_MS+20);assert.equal(await get(),undefined);
 assert.deepEqual(errors,[]);console.log('PASS '+(online?'two real browser players + actual Worker':mobile?'touch landscape/portrait':'solo keyboard')+': ten rounds, mistake/button replay, full melody/pitches, locked concert button, music fade, fireworks/reward, leave countdown and reset');
}finally{Date.now=realNow;await browser.close();}
