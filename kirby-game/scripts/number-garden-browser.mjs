import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import {numberAnswer,numberDeadline,validNumberProblem,NUMBER_EMPTY_MS} from '../src/number-garden-game.ts';
import {NUMBER_DIGITS,NUMBER_GARDEN_SITE as SITE} from '../src/number-garden-site.ts';
import {PROTOCOL} from '../src/network-protocol.ts';
import {roomSql} from '../tests/room-sql.ts';
const online=process.argv.includes('--online'),mobile=process.argv.includes('--mobile'),output=fileURLToPath(new URL('../design/number-garden/',import.meta.url));await mkdir(output,{recursive:true});
const realNow=Date.now;let shift=0;Date.now=()=>realNow()+shift;
let room;const sockets=[];
if(online){
 globalThis.WebSocketRequestResponsePair=class{};
 const source=(await readFile(new URL('../../game-server/src/index.ts',import.meta.url),'utf8')).replace("import { DurableObject } from 'cloudflare:workers';",'class DurableObject { constructor(ctx,env){this.ctx=ctx;this.env=env;} }').replaceAll('../../kirby-game/src/',new URL('../src/',import.meta.url).href).replaceAll("from './", "from '"+new URL('../../game-server/src/',import.meta.url).href).replace(/(from ['"]file:[^'"]+)(['"])/g,'$1.ts$2');
 const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 const {GameRoom}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64')),stored=new Map();
 const ctx={getWebSockets:()=>sockets,blockConcurrencyWhile:f=>f(),waitUntil:p=>p.catch(console.error),setWebSocketAutoResponse(){},getWebSocketAutoResponseTimestamp(){return new Date(Date.now());},storage:{sql:roomSql(),async get(k){return stored.get(k);},async put(k,v){stored.set(k,structuredClone(v));},async delete(k){stored.delete(k);},async setAlarm(){}}};
 room=new GameRoom(ctx,{});await Promise.resolve();await Promise.resolve();room.room=room.newRoom('p0');
}
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--renderer-process-limit=1']});
try{
 const errors=[],pages=[];
 for(let i=0;i<(online?2:1);i++){
  const context=await browser.newContext(mobile?{viewport:{width:844,height:390},isMobile:true,hasTouch:true}:{viewport:{width:1440,height:900}}),page=await context.newPage();pages.push(page);
  page.on('pageerror',e=>{errors.push(e.message);console.error(e.stack);});page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL|shader/i.test(m.text()))errors.push(m.text());});
  await page.routeWebSocket('ws://127.0.0.1:5174/**',ws=>ws.onMessage(()=>{}));
  await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
  for(const endpoint of ['room','players','history/solo'])await page.route('**/'+endpoint,r=>r.fulfill({json:{ok:true,players:0,occupiedVariants:[],capacity:14}}));
  if(online)await page.routeWebSocket('**/ws?**',ws=>{
   const socket={readyState:1,data:{id:'p'+i,session:room.room.id,variant:i,name:'Игрок '+i,seen:Date.now(),visible:true,announced:true},deserializeAttachment(){return structuredClone(this.data);},serializeAttachment(a){this.data=structuredClone(a);},send(text){ws.send(text);},close(){this.readyState=3;ws.close();}};sockets.push(socket);
   ws.onMessage(data=>{if(data==='ping'){ws.send('pong');return;}room.webSocketMessage(socket,data);});
   ws.send(JSON.stringify({type:'welcome',serverNow:Date.now(),protocolVersion:PROTOCOL,playerId:socket.data.id,room:room.room,players:sockets.map(s=>({id:s.data.id,actor:s.data.actor}))}));room.broadcast({type:'presence',count:sockets.length},socket);
  });
  await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+`\nwindow.numberQA={garden:numberGarden,view:numberGameView,renderer,scene,camera,sounds,music,followCamera,get c(){return character},get game(){return currentNumberGame()},get session(){return network},set solo(q){soloNumberGame=q},set clock(v){const native=window.realNumberNow??=Date.now,delta=v-native();Date.now=()=>native()+delta;},set offset(v){if(network)network.clockOffset=v;},set day(v){dayStart=Date.now();dayStartPhase=v}};\n`});});
  await page.goto(process.env.GAME_URL??'http://127.0.0.1:5174/');await page.locator('#startup-loader').waitFor({state:'hidden',timeout:180000});
  await page.locator(online?'#network-join':'#new-game').click();await page.locator('#player-name-input').fill('Игрок '+i);if(i)await page.locator('#variant-grid button').nth(i).click();await page.locator('#start-game').click();await page.waitForFunction(()=>window.numberQA?.c);
  await page.evaluate(SITE=>{const q=numberQA;q.c.setActivity('Idle');q.c.actor.position.set(SITE.buttonX,0,SITE.buttonZ+1.7);q.c.yaw=Math.PI;q.c.actor.rotation.y=Math.PI;q.followCamera.reset(Math.PI);q.followCamera.zoom(900);q.followCamera.orbit(0,70);q.day=.25;},SITE);
  console.log('Loaded player '+i);
 }
 const page=pages[0],get=()=>online?room.room.numberGame:page.evaluate(()=>numberQA.game);
 const jump=async at=>{if(online){shift=at-realNow();for(const p of pages)await p.evaluate(shift=>{numberQA.offset=shift;},shift);}else await page.evaluate(at=>{numberQA.clock=at;},at);await page.waitForTimeout(240);};
 const action=async p=>{if(mobile)await p.locator('#touch-interact').tap();else await p.keyboard.press('KeyE');};
 const press=async(p,digit)=>{
  await p.bringToFront();await p.waitForFunction(()=>!document.hidden&&numberQA.sounds.context?.state==='running');
  await p.evaluate(d=>{numberQA.c.setActivity('Idle');numberQA.c.actor.position.set(d.x,0,d.z+1.7);},NUMBER_DIGITS[digit]);
  await p.waitForFunction(digit=>document.querySelector('#action-hint').textContent.includes('цифру '+digit),digit);await action(p);await p.waitForTimeout(250);
 };
 await page.waitForFunction(()=>document.querySelector('#action-hint').textContent.includes('Начать звонкие циферки'));
 await page.evaluate(SITE=>numberQA.c.actor.position.set(SITE.x,0,SITE.z+SITE.halfDepth+2),SITE);await page.waitForTimeout(500);await page.screenshot({path:output+'platform'+(mobile?'-phone':online?'-online':'')+'.png'});
 assert.equal(await page.evaluate(()=>numberQA.garden.keys.length),10);
 // Free play sounds every key without starting the challenge.
 for(let i=0;i<10;i++)await press(page,i);assert.equal(await get(),undefined);
 const soundState=await page.evaluate(()=>({keys:Array.from({length:10},(_,i)=>numberQA.sounds.buffers.has('number-'+i)),context:numberQA.sounds.context?.state,enabled:numberQA.sounds.enabled,active:numberQA.sounds.active.size,hidden:document.hidden,position:numberQA.c.actor.position.toArray(),pressed:numberQA.garden.keys.map(k=>performance.now()/1000-k.playedAt)}));assert(soundState.keys.every(Boolean),JSON.stringify(soundState));
 await page.evaluate(SITE=>numberQA.c.actor.position.set(SITE.buttonX,0,SITE.buttonZ+1.7),SITE);await page.waitForFunction(()=>document.querySelector('#action-hint').textContent.includes('Начать звонкие циферки'));await action(page);
 await page.waitForFunction(()=>numberQA.game?.stage==='answer');
 if(!online)await page.evaluate(()=>{numberQA.solo={...numberQA.game,startedAt:numberQA.game.startedAt-1,problems:[{left:7,right:5,operator:'+'},{left:9,right:4,operator:'−'},{left:23,right:46,operator:'+'},{left:97,right:24,operator:'−'},{left:58,right:64,operator:'+'},{left:92,right:17,operator:'−'}]};});
 await page.waitForFunction(()=>numberQA.music.audio.volume<numberQA.music.volume*.3);
 await page.screenshot({path:output+'example'+(mobile?'-phone':online?'-online':'')+'.png'});
 let q=await get(),answer=numberAnswer(q.problems[0]);await press(page,Number(answer[0]));
 if(answer.length>1){assert.equal((await get()).cursor,1);const wrong=(Number(answer[1])+1)%10;await press(page,wrong);assert.equal((await get()).stage,'error');assert.equal(await page.locator('#number-game-hud .wrong').count(),1);assert.equal(await page.locator('#number-game-hud .correct').count(),1);await page.screenshot({path:output+'error'+(mobile?'-phone':online?'-online':'')+'.png'});q=await get();await jump(numberDeadline(q)+20);}
 else {q=await get();await jump(numberDeadline(q)+20);}
 while((q=await get())?.stage!=='celebrate'){
  assert.equal(q.stage,'answer');assert(validNumberProblem(q.problems[q.round-1],q.round));answer=numberAnswer(q.problems[q.round-1]);
  if(q.round===3){await page.evaluate(SITE=>numberQA.c.actor.position.set(SITE.x,0,SITE.z+SITE.halfDepth+2),SITE);await page.waitForTimeout(350);await page.screenshot({path:output+'example-two-digits'+(mobile?'-phone':online?'-online':'')+'.png'});}
  for(let i=0;i<answer.length;i++){await press(pages[online?i%2:0],Number(answer[i]));assert.equal((await get()).cursor,i+1);}
  q=await get();console.log('Round '+q.round+' '+q.stage);if(q.stage==='round')await jump(numberDeadline(q)+20);
 }
 for(const p of pages){await p.waitForFunction(()=>numberQA.c.achievements.has('numbers'));assert(await p.evaluate(()=>numberQA.c.achievements.has('numbers')));}
 assert(await page.evaluate(()=>numberQA.sounds.buffers.has('number-finish')));assert(await page.evaluate(()=>numberQA.view.group.children[0].visible));
 await page.evaluate(SITE=>numberQA.c.actor.position.set(SITE.buttonX,0,SITE.buttonZ+1.7),SITE);await page.waitForTimeout(450);await page.screenshot({path:output+'win'+(mobile?'-phone':online?'-online':'')+'.png'});
 if(mobile)for(const [width,height] of [[844,390],[390,844]]){await page.setViewportSize({width,height});const box=await page.locator('#number-game-hud').boundingBox();assert(box.x>=0&&box.x+box.width<=width&&box.y+box.height<height/2,JSON.stringify(box));}
 await jump(numberDeadline(await get())+20);await page.waitForFunction(()=>!numberQA.game);
 await page.waitForFunction(()=>document.querySelector('#action-hint').textContent.includes('Начать звонкие циферки'));await action(page);await page.waitForFunction(()=>!!numberQA.game);
 for(const p of pages)await p.evaluate(()=>numberQA.c.actor.position.set(0,0,0));await page.waitForTimeout(450);q=await get();assert(q.emptySince!==undefined);await page.screenshot({path:output+'countdown'+(mobile?'-phone':online?'-online':'')+'.png'});await jump(q.emptySince+NUMBER_EMPTY_MS+20);await page.waitForFunction(()=>!numberQA.game);
 assert.deepEqual(errors,[]);console.log('PASS '+(online?'two browser players + actual Worker':mobile?'touch landscape/portrait':'solo keyboard')+': free play, six arithmetic rounds, left-to-right input, errors, reward, sound, fireworks, countdown and reset');
}finally{Date.now=realNow;await browser.close();}
