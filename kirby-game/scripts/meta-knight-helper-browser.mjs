import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import {roomSql} from '../tests/room-sql.ts';
import {KIRBY_VARIANTS} from '../src/variant-palette.ts';
import {PROTOCOL} from '../src/network-protocol.ts';

const output=fileURLToPath(new URL('../node_modules/.cache/meta-knight-helper/',import.meta.url));await mkdir(output,{recursive:true});
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
  await page.addInitScript(()=>{
   const buttons=Array.from({length:17},()=>({pressed:false,touched:false,value:0}));const pad={id:'Xbox 360 Controller (XInput STANDARD GAMEPAD)',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons,timestamp:0};let enabled=false;
   Object.defineProperty(navigator,'getGamepads',{value:()=>enabled?[pad]:[]});window.virtualPad={press(i){enabled=true;buttons[i]={pressed:true,touched:true,value:1};pad.timestamp=performance.now();},release(i){buttons[i]={pressed:false,touched:false,value:0};pad.timestamp=performance.now();},off(){enabled=false;}};
  localStorage.setItem('kirby-meta-knight-unlocked-v1','1');localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
  await page.routeWebSocket(/^ws:\/\/127\.0\.0\.1:\d+\/(?!ws\?)/,ws=>ws.onMessage(()=>{}));
  for(const endpoint of ['room','players','history/solo'])await page.route('**/'+endpoint,r=>r.fulfill({json:{ok:true,players:0,occupiedVariants:[],capacity:14}}));
  await page.routeWebSocket('**/ws?**',ws=>{
   const socket={readyState:1,data:{id:'p'+i,session:room.room.id,variant:i?KIRBY_VARIANTS.findIndex(v=>v[0]==='Meta Knight'):0,name:'Игрок '+i,seen:Date.now(),visible:true,announced:true},deserializeAttachment(){return structuredClone(this.data);},serializeAttachment(a){this.data=structuredClone(a);},send(text){ws.send(text);},close(){this.readyState=3;ws.close();}};sockets.push(socket);
   ws.onMessage(data=>{if(data==='ping'){ws.send('pong');return;}room.webSocketMessage(socket,data);});
   ws.send(JSON.stringify({type:'welcome',serverNow:Date.now(),protocolVersion:PROTOCOL,playerId:socket.data.id,room:room.room,players:sockets.map(s=>({id:s.data.id,actor:s.data.actor}))}));room.broadcast({type:'presence',count:sockets.length},socket);
  });
  await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.arenaQA={THREE,renderer,gamepad,travel:cosmicArena,scene,stop(){renderer.setAnimationLoop(null)},get c(){return character},get remotes(){return remotePlayers.players},get session(){return network}};'});});
  await page.goto(process.env.GAME_URL??'http://127.0.0.1:5184/');await page.locator('#startup-loader').waitFor({state:'hidden',timeout:180000});
  await page.locator('#network-join').click();await page.locator('#player-name-input').fill('Игрок '+i);if(i)await page.locator('#variant-grid button').nth(KIRBY_VARIANTS.findIndex(v=>v[0]==='Meta Knight')).click();await page.locator('#start-game').click();await page.waitForFunction(()=>window.arenaQA?.c,{},{timeout:180000});
  await page.evaluate(async i=>{await arenaQA.travel.enter(arenaQA.c);arenaQA.c.actor.position.set(2000+i*4,0,-2);},i);
  await page.waitForFunction(()=>arenaQA.travel.active);await page.waitForTimeout(500);console.log('Entered arena: player '+i);
 }

 const helper=pages[1],hero=pages[0];await hero.bringToFront();assert.equal(await helper.locator('#knight-side-choice').isVisible(),false);await hero.evaluate(()=>arenaQA.travel.startBattle());await helper.bringToFront();await helper.locator('#knight-side-choice').waitFor({state:'visible'});assert((await hero.locator('#knight-side-choice strong').textContent()).includes('Ждём'));
 const press=async index=>{await helper.evaluate(i=>virtualPad.press(i),index);await helper.waitForTimeout(160);await helper.evaluate(i=>virtualPad.release(i),index);await helper.waitForTimeout(130);};
 await press(15);await press(0);assert.equal(room.room.knightSides.p1,'boss');
 assert.equal(await helper.evaluate(()=>arenaQA.c.isMetaKnight),true);await helper.screenshot({path:output+'01-side-choice-controller.png'});
 await helper.waitForFunction(()=>arenaQA.travel.engaged);await helper.waitForTimeout(3200);
 const s=room.room.knightBattle;Object.assign(s,{stage:'rest',since:Date.now(),until:Date.now()+1000000});s.players.p0.hp=8;s.players.p0.invulnerable=0;room.broadcast({type:'room',room:room.room});
 assert.equal(s.players.p1.hp,5);assert.equal(s.players.p0.hp,8);assert.equal(s.players.p1.side,'boss');
 await helper.locator('#knight-helper-actions').waitFor({state:'visible'});
 for(const page of pages){assert.equal(await page.locator('.knight-party-health').count(),2);assert.equal(await page.locator('.knight-party-hearts').first().locator('span:not(.empty)').count(),8);assert.equal(await page.locator('.knight-helper-hearts span:not(.empty)').count(),5);}
 await hero.evaluate(()=>arenaQA.stop());
 const bounds=await helper.evaluate(()=>{const a=document.querySelector('#knight-helper-actions').getBoundingClientRect(),b=document.querySelector('#navigation-hud').getBoundingClientRect();return {overlap:a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top};});assert.equal(bounds.overlap,false,'cancel hint stays above the two hex rows');
assert.deepEqual(await helper.locator('#knight-helper-actions kbd').allTextContents(),['←','↑','→','↓']);
 await press(14);await helper.waitForFunction(()=>arenaQA.travel.battle.players.p1.helper.cast?.ability===1);await helper.screenshot({path:output+'02-crescent-warning.png'});
 const first=s.players.p1.helper.cast;assert.equal(first.meteor,false);await helper.waitForTimeout(1800);await helper.screenshot({path:output+'03-crescent.png'});
 await helper.waitForTimeout(3500);
 await press(12);await helper.waitForFunction(()=>arenaQA.travel.battle.players.p1.helper.cast?.ability===2);
 await helper.waitForFunction(()=>arenaQA.travel.helperViews.get(arenaQA.c).target.group.visible);await helper.screenshot({path:output+'05-dash-green-recovery.png'});
 await helper.waitForTimeout(3000);await press(15);await helper.waitForFunction(()=>arenaQA.travel.battle.players.p1.helper.cast?.ability===3);await helper.waitForFunction(()=>arenaQA.travel.helperViews.get(arenaQA.c).orbs.cores.count===6);await helper.screenshot({path:output+'06-six-orbs.png'});
 // Down on the controller reserves the duet and waits for a real boss boundary.
 s.players.p0.hp=8;await press(13);await helper.waitForFunction(()=>arenaQA.travel.battle.duet?.stage==='queued');assert(s.players.p1.helper.cooldowns[3]-Date.now()>85000);Object.assign(s,{stage:'open',pattern:'leap',since:Date.now(),until:Date.now()+5500});room.broadcast({type:'room',room:room.room});await helper.waitForFunction(()=>arenaQA.travel.battle.stage==='duet-gather',{},{timeout:15000});await helper.screenshot({path:output+'08-duet-gather-controller.png'});await helper.waitForFunction(()=>arenaQA.travel.battle.stage==='duet-warn',{},{timeout:15000});await helper.screenshot({path:output+'09-duet-yellow.png'});await helper.waitForFunction(()=>!arenaQA.travel.battle.duet,{},{timeout:30000});assert(s.players.p0.hp>0);
 // Phase-four slot one changes to the real meteor visual and still has no green opening.
 Object.assign(s,{phase:4,stage:'cosmic-flight',since:Date.now(),until:Date.now()+1000000,from:[0,180,0],to:[0,180,0]});delete s.players.p1.helper.cast;s.players.p1.helper.phase=4;room.broadcast({type:'room',room:room.room});await helper.waitForTimeout(400);await press(14);await helper.waitForFunction(()=>arenaQA.travel.battle.players.p1.helper.cast?.meteor);await helper.waitForTimeout(1900);await helper.screenshot({path:output+'07-meteor.png'});assert.equal(await helper.evaluate(()=>arenaQA.travel.helperViews.get(arenaQA.c).target.group.visible),false);await helper.waitForTimeout(3400);
 const beforeQ=s.hp;await press(2);await helper.waitForTimeout(700);assert.equal(s.hp,beforeQ);await press(1);assert.equal(await helper.evaluate(()=>arenaQA.c.playerDash.cooldown>0),true);
 // A zero-heart helper can still leave by holding Y.
 s.players.p1.hp=0;room.broadcast({type:'room',room:room.room});await helper.waitForTimeout(250);await helper.evaluate(()=>virtualPad.press(3));await helper.waitForTimeout(2400);await helper.evaluate(()=>virtualPad.release(3));await helper.waitForTimeout(250);assert.equal(s.players.p1.withdrawn,true);
 s.players.p1.withdrawn=false;s.players.p1.hp=5;await helper.evaluate(()=>arenaQA.travel.withdrawnBattle=0);
 // Playback uses the real rig and shared victory clock, also with a defeated helper.
 await helper.evaluate(()=>{arenaQA.stop();arenaQA.c.actor.position.set(2010,0,0);});await hero.evaluate(()=>arenaQA.stop());
 s.players.p1.hp=0;s.players.p0.hp=0;Object.assign(s,{phase:1,stage:'lost',since:Date.now(),until:Date.now()+1e12,celebration:{at:Date.now(),boss:[-5,0,-6],helpers:{p1:[10,0,0]}}});room.broadcast({type:'room',room:room.room});
 const poses=[];for(const elapsed of [0,900,2200,3000,3600,4400,5400,6500,7600,9000,11200,14000]){
  await helper.evaluate(({state,now})=>{const q=arenaQA;q.session.room.knightBattle=state;q.session.serverNow;const old=q.travel.battleOptions.now;q.travel.battleOptions.now=()=>now;q.travel.update(1/60,now/1000,q.c,{forward:false,left:false,right:false,scheme:'gamepad'},0,0,false,false);q.travel.routeRemotes(q.remotes.entries());q.travel.render();q.travel.battleOptions.now=old;}, {state:structuredClone(s),now:s.celebration.at+elapsed});
  await helper.screenshot({path:output+'victory-'+String(elapsed).padStart(5,'0')+'.png'});
  poses.push(await helper.evaluate(()=>({p:arenaQA.c.actor.position.toArray(),boss:arenaQA.travel.knight.actor.position.toArray(),sword:arenaQA.c.actor.getObjectByName('Galaxia').visible})));
 }
 assert(poses.every(p=>p.sword===false));assert.equal(await helper.locator('#knight-side-choice').isVisible(),false);
 await helper.setViewportSize({width:1280,height:800});
 const video=await helper.evaluate(async state=>{const q=arenaQA,stream=q.renderer.domElement.captureStream(30),recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:4500000}),chunks=[];recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};const complete=new Promise(resolve=>recorder.onstop=resolve);const old=q.travel.battleOptions.now,start=performance.now();recorder.start();await new Promise(resolve=>{function frame(){const elapsed=performance.now()-start,now=state.celebration.at+elapsed;q.session.room.knightBattle=state;q.travel.battleOptions.now=()=>now;q.travel.update(1/30,elapsed/1000,q.c,{forward:false,left:false,right:false,scheme:'gamepad'},0,0,false,false);q.travel.routeRemotes(q.remotes.entries());q.travel.render();if(elapsed<17000)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame);});recorder.stop();await complete;q.travel.battleOptions.now=old;stream.getTracks().forEach(t=>t.stop());const bytes=new Uint8Array(await new Blob(chunks,{type:'video/webm'}).arrayBuffer());return Array.from(bytes);},structuredClone(s));await writeFile(output+'meta-knights-victory.webm',Buffer.from(video));

 for(const [width,height] of [[390,844],[844,390]]){await helper.setViewportSize({width,height});await helper.evaluate(()=>{const q=arenaQA;const now=q.travel.battle.celebration.at+3500;const old=q.travel.battleOptions.now;q.travel.battleOptions.now=()=>now;q.travel.update(0,now/1000,q.c,{forward:false,left:false,right:false,scheme:'touch'},0,0,false,false);q.travel.render();q.travel.battleOptions.now=old;});await helper.screenshot({path:output+'victory-'+width+'x'+height+'.png'});}
 assert.deepEqual(errors,[]);await writeFile(output+'report.json',JSON.stringify({controllerChoices:true,controllerAbilities:true,poses,errors},null,2));console.log(JSON.stringify({output,controllerChoices:true,controllerAbilities:true,errors}));
}catch(error){for(let i=0;i<pages.length;i++)try{await pages[i].screenshot({path:output+'failure-'+i+'.png'});console.log(await pages[i].evaluate(()=>({stage:arenaQA.travel.battle?.stage,p:arenaQA.c.actor.position.toArray(),helper:arenaQA.travel.battle?.players.p1,choosing:arenaQA.travel.choosingSide})));}catch{}console.log(errors);throw error;}finally{await browser.close();}
