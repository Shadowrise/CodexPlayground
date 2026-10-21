import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import {roomSql} from '../tests/room-sql.ts';
import {PROTOCOL} from '../src/network-protocol.ts';

const output=fileURLToPath(new URL('../node_modules/.cache/meta-knight-multiplayer/',import.meta.url));await mkdir(output,{recursive:true});
globalThis.WebSocketRequestResponsePair=class{};
const source=(await readFile(new URL('../../game-server/src/index.ts',import.meta.url),'utf8')).replace("import { DurableObject } from 'cloudflare:workers';",'class DurableObject { constructor(ctx,env){this.ctx=ctx;this.env=env;} }').replaceAll('../../kirby-game/src/',new URL('../src/',import.meta.url).href).replaceAll("from './", "from '"+new URL('../../game-server/src/',import.meta.url).href).replace(/(from ['"]file:[^'"]+)(['"])/g,'$1.ts$2');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {GameRoom}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64')),stored=new Map(),sockets=[];
const ctx={getWebSockets:()=>sockets,blockConcurrencyWhile:f=>f(),waitUntil:p=>p.catch(console.error),setWebSocketAutoResponse(){},getWebSocketAutoResponseTimestamp(){return new Date(Date.now());},storage:{sql:roomSql(),async get(k){return stored.get(k);},async put(k,v){stored.set(k,structuredClone(v));},async delete(k){stored.delete(k);},async setAlarm(){}}};
const room=new GameRoom(ctx,{});await Promise.resolve();await Promise.resolve();room.room=room.newRoom('p0');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding']});
const pages=[],errors=[];
try{
 for(let i=0;i<2;i++){
  const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();pages.push(page);
  page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL|shader/i.test(m.text()))errors.push(m.text());});
  await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
  await page.routeWebSocket(/^ws:\/\/127\.0\.0\.1:\d+\/(?!ws\?)/,ws=>ws.onMessage(()=>{}));
  for(const endpoint of ['room','players','history/solo'])await page.route('**/'+endpoint,r=>r.fulfill({json:{ok:true,players:0,occupiedVariants:[],capacity:14}}));
  await page.routeWebSocket('**/ws?**',ws=>{
   const socket={readyState:1,data:{id:'p'+i,session:room.room.id,variant:i,name:'Игрок '+i,seen:Date.now(),visible:true,announced:true},deserializeAttachment(){return structuredClone(this.data);},serializeAttachment(a){this.data=structuredClone(a);},send(text){ws.send(text);},close(){this.readyState=3;ws.close();}};sockets.push(socket);
   ws.onMessage(data=>{if(data==='ping'){ws.send('pong');return;}room.webSocketMessage(socket,data);});
   ws.send(JSON.stringify({type:'welcome',serverNow:Date.now(),protocolVersion:PROTOCOL,playerId:socket.data.id,room:room.room,players:sockets.map(s=>({id:s.data.id,actor:s.data.actor}))}));room.broadcast({type:'presence',count:sockets.length},socket);
  });
  await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.arenaQA={THREE,renderer,travel:cosmicArena,scene,stop(){renderer.setAnimationLoop(null)},get c(){return character},get remotes(){return remotePlayers.players},get session(){return network}};'});});
  await page.goto(process.env.GAME_URL??'http://127.0.0.1:5184/');await page.locator('#startup-loader').waitFor({state:'hidden',timeout:180000});
  await page.locator('#network-join').click();await page.locator('#player-name-input').fill('Игрок '+i);if(i)await page.locator('#variant-grid button').nth(i).click();await page.locator('#start-game').click();await page.waitForFunction(()=>window.arenaQA?.c);
  await page.evaluate(async i=>{await arenaQA.travel.enter(arenaQA.c);arenaQA.c.actor.position.set(2000+i*8,0,-2);},i);
  await page.waitForFunction(()=>arenaQA.travel.active);await page.waitForTimeout(500);console.log('Entered arena: player '+i);
 }
 for(const page of pages){await page.bringToFront();await page.waitForFunction(()=>arenaQA.remotes.size===1&&[...arenaQA.remotes.values()][0].actor.parent===arenaQA.travel.scene);}
 await pages[0].bringToFront();await pages[0].keyboard.press('KeyE');await pages[0].waitForFunction(()=>Object.keys(arenaQA.travel.battle?.players??{}).length===2);await pages[0].waitForTimeout(500);
 for(const page of pages){await page.bringToFront();await page.waitForFunction(()=>document.querySelectorAll('.knight-party-row').length===2);assert.equal(await page.locator('.knight-hearts').count(),0);}
 const hitNow=Date.now();Object.assign(room.room.knightBattle,{stage:'slash',pattern:'sword',since:hitNow,until:hitNow+300000,checked:hitNow,from:[0,0,0],to:[0,0,0],yaw:0,height:0});
 room.broadcast({type:'room',room:room.room});await pages[1].bringToFront();await pages[1].evaluate(()=>arenaQA.c.actor.position.set(2000,0,7));
 await pages[1].waitForFunction(()=>arenaQA.travel.battle.players.p1.hp<5);await pages[0].waitForFunction(()=>arenaQA.travel.battle.players.p1.hp<5);
 const receivedDamage=room.room.knightBattle.players.p1.hp;assert(receivedDamage<5);console.log('Worker damage reached both clients');
 // A frozen/resumed renderer must resume authoritative damage even at rest.
 const cdp=await pages[1].context().newCDPSession(pages[1]);await cdp.send('Page.setWebLifecycleState',{state:'frozen'});await pages[0].bringToFront();await pages[0].waitForTimeout(500);await cdp.send('Page.setWebLifecycleState',{state:'active'});await pages[1].bringToFront();
 Object.assign(room.room.knightBattle.players.p1,{hp:5,invulnerable:0});room.broadcast({type:'room',room:room.room});await pages[1].waitForFunction(()=>arenaQA.travel.battle.players.p1.hp<5);console.log('Damage resumed after frozen tab');
 const showResult=()=>{const now=Date.now();Object.assign(room.room.knightBattle,{stage:'lost',since:now,until:now+1e12});for(const p of Object.values(room.room.knightBattle.players))p.hp=0;room.broadcast({type:'room',room:room.room});};
 const resultHint='E — Завершить дуэль, Q — Ещё раз';showResult();await pages[0].bringToFront();await pages[0].waitForFunction(text=>document.querySelector('#action-hint').textContent===text,resultHint);assert.equal(await pages[0].locator('#knight-battle-hud button').count(),0);await pages[0].screenshot({path:output+'bottom-actions-result.png'});
 const previousId=room.room.knightBattle.id;await pages[0].keyboard.press('KeyQ');await pages[0].waitForFunction(id=>arenaQA.travel.battle.id!==id&&arenaQA.travel.battle.stage==='intro',previousId);assert.equal(room.room.knightBattle.players.p0.hp,5);assert.equal(room.room.knightBattle.players.p0.attackAt,-1e9,'the replay key does not also attack in the new duel');
 showResult();await pages[0].waitForFunction(text=>document.querySelector('#action-hint').textContent===text,resultHint);await pages[0].keyboard.press('KeyE');await pages[0].locator('#knight-battle-hud').waitFor({state:'hidden'});assert.equal(room.room.knightBattle.stage,'lost');console.log('Bottom E/Q actions verified with real keyboard input');
 for(const page of pages)await page.evaluate(()=>{
  const q=arenaQA;q.stop();q.session.close();q.now=100000;Object.defineProperty(q.session,'serverNow',{get:()=>q.now});
  q.empty={forward:false,left:false,right:false};q.step=(s,now)=>{if(s)q.session.room.knightBattle=structuredClone(s);q.now=now;q.travel.update(0,now/1000,q.c,q.empty,0,0,false,false);q.travel.routeRemotes(q.remotes.entries());document.querySelector('#action-hint').textContent=q.travel.controlsHint('E','Q');q.travel.render();};
 });
 const state=structuredClone(room.room.knightBattle);Object.assign(state,{id:1000,stage:'dash-warn',pattern:'flight',phase:2,since:100000,until:102000,checked:100000,from:[-12,0,-20],to:[12,0,20],yaw:Math.atan2(24,40),height:0});for(const p of Object.values(state.players))Object.assign(p,{hp:5,invulnerable:0});
 for(const page of pages)await page.evaluate(s=>{const q=arenaQA;q.c.actor.position.set(2015,0,15);[...q.remotes.values()][0].actor.position.set(2000,0,0);q.step(s,101000);},state);
 const page=pages[0];await page.bringToFront();await page.screenshot({path:output+'two-players-dash-warning.png'});
 const occlusion=await page.evaluate(()=>{
  const q=arenaQA,T=q.THREE,scene=q.travel.scene,remote=q.remotes.get('p1').actor,warnings=scene.getObjectByName('Meta Knight floor warnings behind characters');
  const size=q.renderer.getDrawingBufferSize(new T.Vector2()),target=new T.WebGLRenderTarget(size.x,size.y),pixels=()=>{const data=new Uint8Array(size.x*size.y*4);q.renderer.render(scene,q.travel.camera);q.renderer.readRenderTargetPixels(target,0,0,size.x,size.y,data);return data;};
  const oldTarget=q.renderer.getRenderTarget(),background=scene.background,clear=q.renderer.getClearColor(new T.Color()),alpha=q.renderer.getClearAlpha();q.renderer.setRenderTarget(target);
  const withWarning=pixels();warnings.visible=false;const without=pixels();warnings.visible=true;
  const visible=scene.children.map(o=>[o,o.visible]);for(const [o] of visible)o.visible=o===remote||!!o.isLight;scene.background=null;q.renderer.setClearColor(0,0);const mask=pixels();
  const foot=remote.position.clone().project(q.travel.camera),cutoff=(foot.y+1)*size.y/2+8;let compared=0,changed=0;
  // Compare fully opaque interiors. Antialiased glyph edges correctly blend
  // with whichever floor colour is behind them and are not overlay regressions.
  for(let y=Math.ceil(cutoff);y<size.y-1;y++)for(let x=1;x<size.x-1;x++){
   const i=(y*size.x+x)*4;let interior=true;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(mask[i+(dy*size.x+dx)*4+3]!==255)interior=false;
   if(!interior)continue;compared++;if(Math.max(...[0,1,2].map(c=>Math.abs(withWarning[i+c]-without[i+c])))>2)changed++;
  }
  const maskCanvas=document.createElement('canvas');maskCanvas.width=size.x;maskCanvas.height=size.y;const context=maskCanvas.getContext('2d'),data=context.createImageData(size.x,size.y);for(let y=0;y<size.y;y++)data.data.set(mask.subarray(y*size.x*4,(y+1)*size.x*4),(size.y-1-y)*size.x*4);context.putImageData(data,0,0);
  for(const [o,value] of visible)o.visible=value;scene.background=background;q.renderer.setClearColor(clear,alpha);q.renderer.setRenderTarget(oldTarget);target.dispose();q.travel.render();return {compared,changed,cutoff,size:size.toArray(),mask:maskCanvas.toDataURL().split(',')[1]};
 });await writeFile(output+'peer-mask.png',Buffer.from(occlusion.mask,'base64'));delete occlusion.mask;console.log('Pixel comparison',occlusion);assert(occlusion.compared>50);assert.equal(occlusion.changed,0,'floor warnings cannot recolour the peer body or nickname');
 const flicker=await page.evaluate(s=>{
  const q=arenaQA;s.stage='open';s.pattern='sword';s.from=s.to=[0,0,0];s.since=3000;s.until=6000;for(const p of Object.values(s.players)){p.hp=4;p.invulnerable=4000;}
  q.step(s,3040);const on=[q.c.actor.visible,q.remotes.get('p1').actor.visible];q.step(null,3135);const off=[q.c.actor.visible,q.remotes.get('p1').actor.visible];q.step(null,4100);const ended=[q.c.actor.visible,q.remotes.get('p1').actor.visible];return {on,off,ended};
 },structuredClone(state));assert.deepEqual(flicker,{on:[true,true],off:[false,false],ended:[true,true]});
 await page.evaluate(s=>{const q=arenaQA;s.stage='open';s.pattern='leap';s.phase=1;s.from=s.to=[0,0,0];s.since=100000;s.until=104000;q.step(s,100180);},state);await page.screenshot({path:output+'sword-impact-lightning-and-target.png'});
 const impact=await page.evaluate(()=>{
  const q=arenaQA,fx=q.travel.scene.getObjectByName('Meta Knight decorative sword impact lightning'),late=fx.getWorldPosition(new q.THREE.Vector3()),count=fx.getObjectByName('Sword impact lightning cores').count,s=structuredClone(q.travel.battle);
  s.id++;q.step(s,s.since);const early=fx.getWorldPosition(new q.THREE.Vector3());s.id++;q.step(s,s.since+180);return {visible:fx.visible,origin:late.toArray(),lateSnapshotError:late.distanceTo(early),count};
 });assert(impact.visible&&impact.count>100);assert(impact.lateSnapshotError<.001,'late packets use the actual ground strike instead of the lifted sword');
 const emitter=await page.evaluate(s=>{
  const q=arenaQA;s.stage='shot';s.pattern='crescent';s.phase=1;s.height=1.2;s.from=[0,1.2,-6];s.to=[0,0,20];s.yaw=.7;s.since=100000;s.until=104000;let maxError=0;
  for(const elapsed of [220,236,260,300,340,380]){q.step(s,100000+elapsed);const tip=q.travel.knight.actor.getObjectByName('Galaxia').localToWorld(new q.THREE.Vector3(-.315,2.05,0)),glow=q.travel.scene.getObjectByName('Crescent launch connecting sword flash').getWorldPosition(new q.THREE.Vector3());if(elapsed<380)maxError=Math.max(maxError,tip.distanceTo(glow));}return {maxError};
 },state);assert(emitter.maxError<.001);await page.screenshot({path:output+'crescent-from-sword.png'});
 await page.evaluate(s=>{
  const q=arenaQA,peer=q.session.actors.get('p1');for(let i=2;i<5;i++){s.players['p'+i]={...s.players.p1,hp:i===4?0:5};q.session.actors.set('p'+i,{...peer,name:['','','Пиджи','Meta Knight','Снежок'][i],variant:[0,0,17,18,19][i]});}q.step(s,101000);
 },state);
 const panel=await page.locator('.knight-party-list').evaluate(list=>({rows:list.children.length,scrollable:list.scrollHeight>list.clientHeight,height:list.clientHeight}));assert.equal(panel.rows,5);assert(panel.scrollable);await page.locator('.knight-party-list').evaluate(list=>list.scrollTop=list.scrollHeight);assert(await page.locator('.knight-party-list').evaluate(list=>list.scrollTop>0));await page.screenshot({path:output+'five-players-scroll.png'});
 const responsive=[];
 for(const [width,height] of [[390,844],[844,390],[1024,768]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(100);await page.evaluate(()=>arenaQA.step(null,101000));
  const layout=await page.evaluate(()=>{const panel=document.querySelector('#knight-party-hud').getBoundingClientRect(),boss=document.querySelector('#knight-battle-hud').getBoundingClientRect();return {right:panel.right,bottom:panel.bottom,left:panel.left,top:panel.top,overlap:panel.left<boss.right&&panel.right>boss.left&&panel.top<boss.bottom&&panel.bottom>boss.top};});assert(layout.left>=0&&layout.right<=width&&layout.bottom<=height&&!layout.overlap);responsive.push({width,height,...layout});await page.screenshot({path:output+`party-${width}x${height}.png`});
 }
 await page.evaluate(()=>{const q=arenaQA;q.session.room.knightBattle=undefined;q.step(null,102000);});assert.equal(await page.locator('.knight-party-row').count(),1);assert.equal(await page.locator('.knight-party-row .stat-name').textContent(),'Игрок 0');
 await page.evaluate(()=>arenaQA.travel.leave());assert.equal(await page.locator('#knight-party-hud').count(),0);
 assert.deepEqual(errors,[]);const report={players:2,server:'actual GameRoom',receivedDamage,resumedDamage:true,bottomActions:{topButtons:0,finish:'E',replay:'Q'},occlusion,flicker,impact,emitter,panel,responsive,errors};await writeFile(output+'checks.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(error){
 console.log(JSON.stringify({errors,room:room.room.knightBattle,sockets:sockets.map(s=>s.data.actor&&({id:s.data.id,p:s.data.actor.p,state:s.data.actor.state,visible:s.data.visible}))}));
 for(let i=0;i<pages.length;i++)try{console.log('Client '+i,await pages[i].evaluate(()=>({position:arenaQA.c?.actor.position.toArray(),state:arenaQA.c?.state,active:arenaQA.travel.active,hidden:document.hidden,focus:document.hasFocus(),sessionClosed:arenaQA.session.closed,stage:arenaQA.travel.battle?.stage,player:arenaQA.travel.battle?.players[arenaQA.session.id]})));await pages[i].screenshot({path:output+`failure-${i}.png`,timeout:5000});}catch{}
 throw error;
}finally{await browser.close();}
