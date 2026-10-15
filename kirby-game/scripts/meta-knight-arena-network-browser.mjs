import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import ts from 'typescript';
import {roomSql} from '../tests/room-sql.ts';
import {PROTOCOL} from '../src/network-protocol.ts';
import {META_KNIGHT_SEAL_SITES} from '../src/meta-knight-seal-sites.ts';
globalThis.WebSocketRequestResponsePair=class{};
const source=(await readFile(new URL('../../game-server/src/index.ts',import.meta.url),'utf8')).replace("import { DurableObject } from 'cloudflare:workers';",'class DurableObject { constructor(ctx,env){this.ctx=ctx;this.env=env;} }').replaceAll('../../kirby-game/src/',new URL('../src/',import.meta.url).href).replaceAll("from './", "from '"+new URL('../../game-server/src/',import.meta.url).href).replace(/(from ['"]file:[^'"]+)(['"])/g,'$1.ts$2');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {GameRoom}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64')),stored=new Map(),sockets=[];
const ctx={getWebSockets:()=>sockets,blockConcurrencyWhile:f=>f(),waitUntil:p=>p.catch(console.error),setWebSocketAutoResponse(){},getWebSocketAutoResponseTimestamp(){return new Date(Date.now());},storage:{sql:roomSql(),async get(k){return stored.get(k);},async put(k,v){stored.set(k,structuredClone(v));},async delete(k){stored.delete(k);},async setAlarm(){}}};
const room=new GameRoom(ctx,{});await Promise.resolve();await Promise.resolve();room.room=room.newRoom('p0');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding']});
try{
 const pages=[],errors=[];
 for(let i=0;i<2;i++){
  const context=await browser.newContext({viewport:{width:1100,height:720}}),page=await context.newPage();pages.push(page);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL|shader/i.test(m.text()))errors.push(m.text());});
  await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
  await page.routeWebSocket(/^ws:\/\/127\.0\.0\.1:\d+\/(?!ws\?)/,ws=>ws.onMessage(()=>{}));
  for(const endpoint of ['room','players','history/solo'])await page.route('**/'+endpoint,r=>r.fulfill({json:{ok:true,players:0,occupiedVariants:[],capacity:14}}));
  await page.routeWebSocket('**/ws?**',ws=>{
   const socket={readyState:1,data:{id:'p'+i,session:room.room.id,variant:i,name:'Игрок '+i,seen:Date.now(),visible:true,announced:true},deserializeAttachment(){return structuredClone(this.data);},serializeAttachment(a){this.data=structuredClone(a);},send(text){ws.send(text);},close(){this.readyState=3;ws.close();}};sockets.push(socket);
   ws.onMessage(data=>{if(data==='ping'){ws.send('pong');return;}room.webSocketMessage(socket,data);});
   ws.send(JSON.stringify({type:'welcome',serverNow:Date.now(),protocolVersion:PROTOCOL,playerId:socket.data.id,room:room.room,players:sockets.map(s=>({id:s.data.id,actor:s.data.actor}))}));room.broadcast({type:'presence',count:sockets.length},socket);
  });
  await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.arenaQA={travel:cosmicArena,portal:meadowPortal,scene,get c(){return character},get remotes(){return remotePlayers.players},get session(){return network}};'});});
  await page.goto(process.env.GAME_URL??'http://127.0.0.1:5184/');await page.locator('#startup-loader').waitFor({state:'hidden',timeout:180000});
  await page.locator('#network-join').click();await page.locator('#player-name-input').fill('Игрок '+i);if(i)await page.locator('#variant-grid button').nth(i).click();await page.locator('#start-game').click();await page.waitForFunction(()=>window.arenaQA?.c);
 }
 const expectLocked=async page=>{await page.bringToFront();await page.evaluate(()=>{const p=arenaQA.portal.group.position;arenaQA.c.setActivity('Idle');arenaQA.c.actor.position.set(p.x,0,p.z);});await page.waitForTimeout(200);assert(await page.evaluate(()=>!arenaQA.portal.working&&!arenaQA.travel.active&&!arenaQA.travel.loading&&!arenaQA.travel.scene));};
 const claim=async(index,id)=>{
  await pages[index].bringToFront();await pages[index].waitForTimeout(100);const socket=sockets[index],site=META_KNIGHT_SEAL_SITES.find(s=>s.id===id);
  const actor={p:[site.x,site.surfaceY,site.z],q:[0,0,0,1],s:1,state:id==='treehouse'?'Lookout':'Idle',pose:[],fruits:0,achievements:[],name:'Игрок '+index,variant:index,star:0,...(id==='treehouse'?{ride:{key:'tree:0',data:[0]}}:{})};
  if(id==='treehouse')room.room.locks['tree:0']=socket.data.id;
  room.webSocketMessage(socket,JSON.stringify({type:'frame',actor,events:[{type:'seal',id}]}));
  assert(room.room.sealProgress.collected[id],'real Worker accepted badge '+id);
  if(id==='treehouse'){delete room.room.locks['tree:0'];room.broadcast({type:'room',room:room.room});}
 };
 await expectLocked(pages[0]);await expectLocked(pages[1]);
 await claim(0,'maze');await expectLocked(pages[0]);await expectLocked(pages[1]);
 await claim(1,'mountain');await expectLocked(pages[0]);await expectLocked(pages[1]);
 // Move the viewers out of the doorway before the last badge opens it.
 for(const page of pages)await page.evaluate(()=>{const p=arenaQA.portal.group.position;arenaQA.c.actor.position.set(p.x,0,p.z+4);});
 await claim(1,'treehouse');for(const page of pages){await page.bringToFront();await page.waitForFunction(()=>arenaQA.portal.working);}
 const enter=async page=>{await page.bringToFront();await page.evaluate(()=>{const p=arenaQA.portal.group.position;arenaQA.c.setActivity('Idle');arenaQA.c.actor.position.set(p.x,0,p.z);});await page.waitForFunction(()=>arenaQA.travel.active,null,{timeout:90000});await page.waitForTimeout(400);};
 await enter(pages[0]);assert.equal(sockets[0].data.actor.location,'meta-knight-arena');assert(sockets[0].data.actor.p[0]>1900);
 await pages[1].bringToFront();await pages[1].waitForFunction(()=>arenaQA.remotes.get('p0')?.actor.userData.location==='meta-knight-arena');
 assert(await pages[1].evaluate(()=>!arenaQA.remotes.get('p0').actor.visible&&!arenaQA.travel.scene),'arena visitor is absent from the meadow and peer has not constructed an arena');
 await enter(pages[1]);await pages[1].waitForFunction(()=>arenaQA.remotes.get('p0')?.actor.parent===arenaQA.travel.scene);
 await pages[0].bringToFront();await pages[0].waitForFunction(()=>arenaQA.remotes.get('p1')?.actor.parent===arenaQA.travel.scene);
 const worldBefore=JSON.stringify(room.room.world.npcs.map(n=>n.p));await pages[0].waitForTimeout(900);assert.notEqual(JSON.stringify(room.room.world.npcs.map(n=>n.p)),worldBefore,'host continues simulating meadow NPCs');
 await pages[0].evaluate(()=>arenaQA.travel.leave());await pages[0].waitForTimeout(400);
 await pages[1].bringToFront();await pages[1].waitForFunction(()=>arenaQA.remotes.get('p0')?.actor.parent===arenaQA.scene);
 assert(await pages[1].evaluate(()=>!arenaQA.remotes.get('p0').actor.userData.location));
 assert.deepEqual(errors,[]);const report={players:2,server:'actual GameRoom',sharedBadgeGate:[0,1,2,3],sharedArena:true,meadowContinues:true,errors};await writeFile(new URL('../design/meta-knight-arena/network-report.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
