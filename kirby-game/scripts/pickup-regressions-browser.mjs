import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import {serialize} from 'node:v8';
import {roomSql} from '../tests/room-sql.ts';
import {PROTOCOL,validActor} from '../src/network-protocol.ts';
import {META_KNIGHT_SEAL_SITES} from '../src/meta-knight-seal-sites.ts';
import {newBread,holdsBread} from '../src/bread-state.ts';
import {MILL_QUEST_LEVER,newMillQuest} from '../src/mill-quest.ts';
import {newSealProgress} from '../src/meta-knight-seal-state.ts';

const output=fileURLToPath(new URL('../node_modules/.cache/pickup-regressions/',import.meta.url));
await mkdir(output,{recursive:true});
globalThis.WebSocketRequestResponsePair=class{};
const source=(await readFile(new URL('../../game-server/src/index.ts',import.meta.url),'utf8'))
 .replace("import { DurableObject } from 'cloudflare:workers';",'class DurableObject { constructor(ctx,env){this.ctx=ctx;this.env=env;} }')
 .replaceAll('../../kirby-game/src/',new URL('../src/',import.meta.url).href)
 .replaceAll("from './","from '"+new URL('../../game-server/src/',import.meta.url).href)
 .replace(/(from ['"]file:[^'"]+)(['"])/g,'$1.ts$2');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {GameRoom}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const stored=new Map(),sockets=[],claims=[],errors=[];let maxAttachmentBytes=0,maxLegacyBytes=0;
const ctx={getWebSockets:()=>sockets,blockConcurrencyWhile:f=>f(),waitUntil:p=>p.catch(e=>errors.push(String(e))),setWebSocketAutoResponse(){},getWebSocketAutoResponseTimestamp(){return new Date();},storage:{sql:roomSql(),async get(k){return stored.get(k);},async put(k,v){stored.set(k,structuredClone(v));},async delete(k){stored.delete(k);},async setAlarm(){}}};
let room=new GameRoom(ctx,{});await Promise.resolve();await Promise.resolve();room.room=room.newRoom('p0');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding']});
const report={bread:[],seals:[],portal:{},claims,errors};
async function open(index){
 const context=await browser.newContext({viewport:{width:1000,height:760}}),page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');localStorage.setItem('kirby-pidgie-unlocked-v1','1');localStorage.setItem('kirby-meta-knight-unlocked-v1','1');});
 if(index===1)await page.addInitScript(()=>{const systemNow=Date.now;Date.now=()=>systemNow()+180000;});
 await page.routeWebSocket(/^ws:\/\/127\.0\.0\.1:\d+\/(?!ws\?)/,ws=>ws.onMessage(()=>{}));
 for(const endpoint of ['room','players','history/solo'])await page.route('**/'+endpoint,r=>r.fulfill({json:{ok:true,players:0,occupiedVariants:[],capacity:14}}));
 await page.routeWebSocket('**/ws?**',ws=>{
  const socket={readyState:1,data:{id:'p'+index,session:room.room.id,variant:index===0?18:17,name:'Игрок '+index,seen:Date.now(),visible:true,announced:true},deserializeAttachment(){return structuredClone(this.data);},serializeAttachment(a){const bytes=serialize(a).length;maxAttachmentBytes=Math.max(maxAttachmentBytes,bytes);maxLegacyBytes=Math.max(maxLegacyBytes,serialize({...a,room:room.room}).length);if(bytes>16384)throw Error('Attachment exceeds 16384 bytes: '+bytes);this.data=structuredClone(a);},send(text){ws.send(text);},close(){this.readyState=3;ws.close();}};sockets.push(socket);
  ws.onMessage(data=>{if(data==='ping'){ws.send('pong');return;}const m=JSON.parse(data);if(m.events?.some(e=>e.type==='seal'))claims.push({player:socket.data.id,valid:validActor(m.actor),actor:m.actor,events:m.events});try{room.webSocketMessage(socket,data);}catch(e){if(!errors.includes(String(e)))errors.push(String(e));}});
  ws.send(JSON.stringify({type:'welcome',serverNow:Date.now(),protocolVersion:PROTOCOL,playerId:socket.data.id,room:room.room,players:sockets.map(s=>({id:s.data.id,actor:s.data.actor}))}));room.broadcast({type:'presence',count:sockets.length},socket);
 });
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+`
 window.pickupQA={get c(){return character},get npcs(){return npcs},get session(){return network},get progress(){return sealProgress},get ready(){return metaKnightPortalReady()},travel:cosmicArena,portal:meadowPortal,bread,watermill,treehouse,maze,followCamera,millActor,sealActor,resolveInteraction,
  async bake(size){const q=await import('/src/mill-quest.ts');if(!network)bread.reset();character.resizeTo(size,true);character.setActivity('Idle');character.swimming=false;character.surfaceY=0;character.actor.position.fromArray(q.MILL_OVEN);character.yaw=Math.PI;character.actor.rotation.set(0,Math.PI,0);followCamera.reset(Math.PI);const now=network?.serverNow??Date.now();watermill.setQuest({...q.newMillQuest(),stage:'bake',owner:network?.id??'solo',startedAt:now-20000,updatedAt:now,bakeAt:now-10000,delivered:3,kneadStep:5},now);return {oven:q.MILL_OVEN,actor:millActor(character),quest:watermill.quest};},
  move(site){treehouse.cancel();character.setActivity('Idle');character.resizeTo(1,true);character.swimming=false;character.surfaceY=site.surfaceY;character.actor.position.set(site.x,site.surfaceY,site.z);character.yaw=site.yaw;character.actor.rotation.set(0,site.yaw,0);}
 };`});});
 await page.goto(process.env.GAME_URL??'http://127.0.0.1:5196/');await page.locator('#startup-loader').waitFor({state:'hidden',timeout:180000});
 return page;
}
async function start(page,online,index=0){await page.locator(online?'#network-join':'#new-game').click();await page.locator('#player-name-input').fill('Игрок '+index);if(online)await page.locator('#variant-grid button').nth(index===0?18:17).click();await page.locator('#start-game').click();await page.waitForFunction(()=>pickupQA.c);}
try{
 const solo=await open(-1);await start(solo,false);
 for(const size of [.3,1,7]){
  await solo.evaluate(size=>pickupQA.bake(size),size);
  await solo.keyboard.down('KeyW');await solo.waitForTimeout(550);await solo.keyboard.up('KeyW');
  await solo.keyboard.press('KeyE');await solo.waitForTimeout(350);
  const collected=await solo.evaluate(()=>pickupQA.bread.holds('solo'));report.bread.push({mode:'solo',size,collected});assert(collected);
 }
 await solo.context().close();
 const host=await open(0);await start(host,true,0);const guest=await open(1);await start(guest,true,1);
 await host.waitForTimeout(1000);
 for(let i=0;i<10;i++)try{room.logEntry({id:'chat-'+i,name:'Проверка',variant:17,text:'Обсуждаем, как испечь хлеб на мельнице и собрать все жетоны Метакнайта. '.repeat(4).slice(0,255),chat:true});}catch(e){if(!errors.includes(String(e)))errors.push(String(e));}
 for(const page of [host,guest]){await page.bringToFront();await page.evaluate(()=>{const q=pickupQA,p=q.portal.group.position;q.c.setActivity('Idle');q.c.actor.position.set(p.x,0,p.z);});await page.waitForTimeout(250);assert(await page.evaluate(()=>!pickupQA.portal.working&&!pickupQA.travel.active));}
 // Keep host role stable while exercising the guest's real game loop and packets.
 room.room.host='p0';room.broadcast({type:'room',room:room.room});
 // Exercise finished bakes and the next player's lever after a large room/chat.
 for(const [page,id,size] of [[host,'p0',.3],[guest,'p1',1]]){
  await page.bringToFront();const bake=await page.evaluate(size=>pickupQA.bake(size),size);room.room.millQuest=bake.quest;room.broadcast({type:'room',room:room.room});
  await page.keyboard.down('KeyW');await page.waitForTimeout(500);await page.keyboard.up('KeyW');
  await page.waitForFunction(()=>pickupQA.watermill.prompt(pickupQA.millActor(pickupQA.c)).includes('готовый'));
  await page.keyboard.press('KeyE');await page.waitForFunction(()=>pickupQA.bread.holds(pickupQA.session.id));
  assert(holdsBread(room.room.bread,id));report.bread.push({mode:'online',player:id,size,collected:true});
  if(id==='p0'){
   room.room.millQuest.runningUntil=Date.now()-1;await room.alarm();
   await guest.bringToFront();await guest.evaluate(p=>pickupQA.move({x:p[0],surfaceY:0,z:p[2],yaw:0}),MILL_QUEST_LEVER);
   await guest.waitForFunction(()=>pickupQA.watermill.prompt(pickupQA.millActor(pickupQA.c)).includes('начни'));
   await guest.keyboard.press('KeyE');await guest.waitForFunction(()=>pickupQA.watermill.quest.owner===pickupQA.session.id&&pickupQA.watermill.quest.stage==='clear');report.guestRestartedMill=true;
  }
 }
 assert(holdsBread(room.room.bread,'p0')&&holdsBread(room.room.bread,'p1'));
 room.room.bread=newBread();room.room.millQuest=newMillQuest();room.broadcast({type:'room',room:room.room});
 const before=await guest.evaluate(()=>pickupQA.npcs.map(n=>n.actor.position.toArray()));await guest.waitForTimeout(1200);const after=await guest.evaluate(()=>pickupQA.npcs.map(n=>n.actor.position.toArray()));assert.notDeepEqual(after,before,'guest receives moving NPC snapshots');report.npcsMoving=true;
 await guest.evaluate(()=>{const q=pickupQA,p=q.maze.rewardPosition.clone().add(q.maze.group.position);q.c.setActivity('Idle');q.c.swimming=false;q.c.surfaceY=0;q.c.actor.position.copy(p);});
 await guest.waitForFunction(()=>pickupQA.c.starRemaining>0&&pickupQA.c.actor.getObjectByName('Golden star blessing'));
 assert(room.room.starAt>Date.now());await guest.waitForTimeout(300);report.star={effect:await guest.evaluate(()=>pickupQA.c.starRemaining>0),hidden:await guest.evaluate(()=>!pickupQA.maze.star.visible),clientClockSkewMs:180000};assert(report.star.hidden);
 await host.bringToFront();await host.evaluate(site=>pickupQA.move(site),META_KNIGHT_SEAL_SITES.find(s=>s.id==='maze'));await host.waitForFunction(()=>!!pickupQA.progress.collected.maze);assert.equal(room.room.sealProgress.collected.maze.by,'p0');report.hostMazeCollected=true;
 room.room.sealProgress=newSealProgress();room.broadcast({type:'room',room:room.room});
 await host.evaluate(()=>{pickupQA.c.actor.position.set(0,0,0);});
 for(const id of ['maze','mountain']){
  await guest.bringToFront();await guest.evaluate(site=>pickupQA.move(site),META_KNIGHT_SEAL_SITES.find(s=>s.id===id));
  await guest.waitForTimeout(1600);
  await guest.waitForFunction(id=>!!pickupQA.progress.collected[id],id);
  report.seals.push({id,by:room.room.sealProgress.collected[id]?.by});
 }
 await guest.evaluate(()=>{const q=pickupQA;q.treehouse.cancel();q.c.setActivity('Idle');q.c.swimming=false;q.c.surfaceY=0;q.c.actor.position.set(131,0,56);q.c.yaw=Math.PI;q.c.actor.rotation.set(0,Math.PI,0);});await guest.waitForTimeout(400);await guest.keyboard.press('KeyE');
 await guest.waitForFunction(()=>pickupQA.treehouse.canSit,null,{timeout:15000});
 await guest.evaluate(()=>{const q=pickupQA;q.c.yaw=Math.PI/2;q.c.actor.rotation.set(0,Math.PI/2,0);});
 await guest.keyboard.down('KeyW');try{await guest.waitForFunction(()=>!!pickupQA.progress.collected.treehouse,null,{timeout:10000});}finally{await guest.keyboard.up('KeyW');}
 report.seals.push({id:'treehouse',by:room.room.sealProgress.collected.treehouse?.by});
 assert(report.seals.every(s=>s.by==='p1'),'non-host collects all three seals using real client frames');
 const beforeWake=structuredClone(room.room.sealProgress);room=new GameRoom(ctx,{});await Promise.resolve();await Promise.resolve();assert.deepEqual(room.room.sealProgress,beforeWake);report.roomRestored=true;
 await guest.evaluate(()=>{const q=pickupQA;q.treehouse.cancel();q.c.setActivity('Idle');q.c.surfaceY=0;const p=q.portal.group.position;q.c.actor.position.set(p.x,0,p.z+5);});await guest.waitForTimeout(400);
 assert.equal(await guest.evaluate(()=>pickupQA.session.host),false);
 await guest.waitForFunction(()=>pickupQA.portal.working&&pickupQA.ready);
 await guest.screenshot({path:output+'guest-open-portal.png'});
 await guest.evaluate(()=>{const q=pickupQA,p=q.portal.group.position;q.c.actor.position.set(p.x,0,p.z);});
 await guest.waitForFunction(()=>pickupQA.travel.active,null,{timeout:90000});
 await guest.waitForTimeout(400);report.portal={guestEntered:await guest.evaluate(()=>pickupQA.travel.active),location:sockets[1].data.actor?.location,host:room.room.host};
 assert.equal(report.portal.location,'meta-knight-arena');assert.equal(room.room.host,'p0');
 await guest.screenshot({path:output+'guest-in-arena.png'});
 assert(maxLegacyBytes>16384,'exercise a room that exceeds the old attachment limit');assert(maxAttachmentBytes<16384);
 assert(report.bread[0].collected,'30% baker collects the finished loaf');assert.deepEqual(errors,[]);
}finally{report.maxAttachmentBytes=maxAttachmentBytes;report.maxLegacyBytes=maxLegacyBytes;await writeFile(output+'checks.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,claims:claims.map(c=>({player:c.player,valid:c.valid,events:c.events}))}));await browser.close();}
