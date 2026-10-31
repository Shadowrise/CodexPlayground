import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import {roomSql} from '../tests/room-sql.ts';
import {PROTOCOL} from '../src/network-protocol.ts';

const online=process.argv.includes('--online'),mode=online?'online':'solo';
const output=process.env.QA_OUTPUT??fileURLToPath(new URL('../node_modules/.cache/meta-knight-contact/'+mode+'/',import.meta.url));await mkdir(output,{recursive:true});
let room;
if(online){
 globalThis.WebSocketRequestResponsePair=class{};
 const source=(await readFile(new URL('../../game-server/src/index.ts',import.meta.url),'utf8')).replace("import { DurableObject } from 'cloudflare:workers';",'class DurableObject {constructor(ctx,env){this.ctx=ctx;this.env=env;}}').replaceAll('../../kirby-game/src/',new URL('../src/',import.meta.url).href).replaceAll("from './","from '"+new URL('../../game-server/src/',import.meta.url).href).replace(/(from ['"]file:[^'"]+)(['"])/g,'$1.ts$2');
 const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 const {GameRoom}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64')),sockets=[],stored=new Map();
 const ctx={getWebSockets:()=>sockets,blockConcurrencyWhile:f=>f(),waitUntil:p=>p.catch(console.error),setWebSocketAutoResponse(){},getWebSocketAutoResponseTimestamp:()=>new Date(),storage:{sql:roomSql(),async get(k){return stored.get(k);},async put(k,v){stored.set(k,structuredClone(v));},async delete(k){stored.delete(k);},async setAlarm(){}}};
 room=new GameRoom(ctx,{});await Promise.resolve();await Promise.resolve();room.room=room.newRoom('p0');room.qaSockets=sockets;
}
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding']});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL|shader/i.test(m.text()))errors.push(m.text());});
const snapshot=()=>online?structuredClone(room.room.knightBattle):undefined;
const state=async()=>online?room.room.knightBattle:await page.evaluate(()=>contactQA.travel.battle);
const configure=async(fn)=>{
 if(online){const s=room.room.knightBattle;fn(s,Date.now());room.broadcast({type:'room',room:room.room});}
 else await page.evaluate(({source})=>{new Function('s','now','('+source+')(s,now)')(contactQA.travel.battle,contactQA.travel.soloNow);},{source:fn.toString()});
};
try{
 await page.addInitScript(()=>{try{localStorage.setItem('kirby-meta-knight-unlocked-v1','1');localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');}catch{}});
 await page.routeWebSocket(/^ws:\/\/127\.0\.0\.1:\d+\/(?!ws\?)/,ws=>ws.onMessage(()=>{}));
 for(const endpoint of ['room','players','history/solo'])await page.route('**/'+endpoint,r=>r.fulfill({json:{ok:true,players:0,occupiedVariants:[],capacity:14}}));
 if(online)await page.routeWebSocket('**/ws?**',ws=>{
  const socket={readyState:1,data:{id:'p0',session:room.room.id,variant:18,name:'Метакнайт',seen:Date.now(),visible:true,announced:true},deserializeAttachment(){return structuredClone(this.data);},serializeAttachment(a){this.data=structuredClone(a);},send(m){ws.send(m);},close(){this.readyState=3;ws.close();}};room.qaSockets.push(socket);
  ws.onMessage(data=>{if(data==='ping')ws.send('pong');else room.webSocketMessage(socket,data);});ws.send(JSON.stringify({type:'welcome',serverNow:Date.now(),protocolVersion:PROTOCOL,playerId:'p0',room:room.room,players:[{id:'p0'}]}));
 });
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.contactQA={THREE,renderer,travel:cosmicArena,get c(){return character},get network(){return network}};'});});
 await page.goto(process.env.GAME_URL??'http://127.0.0.1:5199/');await page.locator('#startup-loader').waitFor({state:'hidden',timeout:180000});
 await page.locator(online?'#network-join':'#new-game').click();await page.locator('#player-name-input').fill('Метакнайт');await page.locator('#variant-grid button').nth(18).click();await page.locator('#start-game').click();await page.waitForFunction(()=>window.contactQA?.c,{},{timeout:180000});
 await page.evaluate(async()=>{const q=contactQA;await q.travel.enter(q.c);q.c.actor.position.set(2000,0,-2);q.travel.startBattle();});await page.locator('#knight-side-choice [data-side=boss]').click();await page.waitForFunction(()=>Object.keys(contactQA.travel.battle?.opponents??{}).length===3);await page.waitForTimeout(3300);
 await page.evaluate(()=>{const c=contactQA.c;c.roll.reset();c.setActivity('Idle');c.actor.position.set(1988,0,0);c.yaw=Math.PI/2;c.actor.rotation.y=c.yaw;});await page.waitForTimeout(250);
 await configure((s,now)=>{Object.assign(s,{stage:'rest',since:now,checked:now,until:now+1e6,from:[25,0,20],to:[25,0,20]});for(const b of Object.values(s.opponents)){b.p=[-7,0,0];b.goal=[...b.p];b.thinkAt=now+1e6;b.shoveReady=now+1e6;delete b.shove;delete s.players[b.id].bump;}});
 await page.waitForTimeout(500);let s=await state(),bots=Object.values(s.opponents);for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)assert(Math.hypot(bots[i].p[0]-bots[j].p[0],bots[i].p[2]-bots[j].p[2])>=2.55);
 await page.screenshot({path:output+'/01-separated.png'});
 await configure((s,now)=>{Object.values(s.opponents).forEach((b,i)=>{b.p=i===0?[-9,0,0]:[10+i*7,0,-20];b.goal=[...b.p];b.thinkAt=now+1e6;b.shoveReady=now+1e6;});});await page.waitForTimeout(200);
 await page.locator('#game canvas').focus();await page.keyboard.press('KeyQ',{delay:80});await page.waitForFunction(()=>!!contactQA.travel.battle.players['knight-ai:0'].bump);await page.waitForTimeout(350);
 s=await state();assert(s.opponents['knight-ai:0'].p[0]>-8);assert.equal(s.players['knight-ai:0'].hp,36);assert.equal(Object.values(s.opponents).filter(b=>s.players[b.id].bump).length,1);assert.equal(await page.evaluate(()=>contactQA.travel.opponentsView.characters.get('knight-ai:0').state),'Roll');
 await page.screenshot({path:output+'/02-q-roll.png'});await page.waitForTimeout(1000);
 const player=await page.evaluate(()=>{const q=contactQA;return {id:q.network?.id??'solo',p:[q.c.actor.position.x-2000,0,q.c.actor.position.z]};});
 if(online){const b=room.room.knightBattle.opponents['knight-ai:0'];delete room.room.knightBattle.players[b.id].bump;b.p=[player.p[0]+3,0,player.p[2]];b.goal=[...b.p];b.shove={at:Date.now()+100,release:Date.now()+500,target:player.id,yaw:-Math.PI/2};room.broadcast({type:'room',room:room.room});}
 else await page.evaluate(({id,p})=>{const q=contactQA,s=q.travel.battle,b=s.opponents['knight-ai:0'],now=q.travel.soloNow;delete s.players[b.id].bump;b.p=[p[0]+3,0,p[2]];b.goal=[...b.p];b.shove={at:now+100,release:now+500,target:id,yaw:-Math.PI/2};},player);
 await page.waitForFunction(()=>contactQA.c.roll.active);await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>contactQA.travel.battle.players[contactQA.network?.id??'solo'].hp),5);await page.screenshot({path:output+'/03-counterpush.png'});await page.waitForTimeout(1100);
 // Set a reproducible nearby visitor and a bot that decides to pursue it; the real AI must perform the strike.
 await page.evaluate(()=>{const c=contactQA.c;c.roll.reset();c.setActivity('Idle');c.actor.position.set(1980,0,-25);});await page.waitForTimeout(200);
 await configure((s,now)=>{
  Object.assign(s,{stage:'rest',since:now-1000,until:now+1e6,from:[25,0,20],to:[25,0,20]});s.lifeFirefly={phase:1,at:now-1000,angle:Math.PI,side:1,color:.5};
  const random=seed=>{let x=Math.imul(seed^(seed>>>16),0x45d9f3b);x=Math.imul(x^(x>>>16),0x45d9f3b);return ((x^(x>>>16))>>>0)/4294967296;};let seed=0;while(random(seed^(s.lifeFirefly.at|0))>=.28)seed++;
  Object.values(s.opponents).forEach((b,i)=>{b.p=i===0?[-1.5,0,-39]:[10+i*7,0,-20];b.goal=[...b.p];b.thinkAt=now;b.shoveReady=now+1e6;delete b.shove;delete s.players[b.id].bump;s.players[b.id].hp=8;});s.teamHp=8;s.opponents['knight-ai:0'].seed=seed;
 });
 await page.waitForFunction(()=>contactQA.travel.battle.lifeFirefly?.hit?.by==='knight-ai:0',{},{timeout:10000});s=await state();assert.equal(s.players['knight-ai:0'].hp,9);assert.equal(s.players['knight-ai:1'].hp,9);await page.screenshot({path:output+'/04-heart-hit.png'});
 await configure((s,now)=>{s.teamHp=1;for(const p of Object.values(s.players))if(p.side!=='boss')p.hp=1;});await page.waitForTimeout(200);
 assert(await page.evaluate(()=>[...contactQA.travel.opponentsView.characters.values()].every(c=>c.state!=='Sitting')),'all NPCs remain active while one shared life remains');
 await configure((s,now)=>{s.teamHp=0;for(const p of Object.values(s.players))if(p.side!=='boss')p.hp=0;});await page.waitForFunction(()=>[...contactQA.travel.opponentsView.characters.values()].every(c=>c.state==='Sitting'));await page.screenshot({path:output+'/05-shared-defeat.png'});
 assert.deepEqual(errors,[]);await writeFile(output+'/report.json',JSON.stringify({mode,separation:true,qPush:true,counterpush:true,heartHit:true,errors,snapshot:snapshot()},null,2));console.log(JSON.stringify({output,mode,separation:true,qPush:true,counterpush:true,heartHit:true,errors}));
}catch(error){await page.screenshot({path:output+'/failure.png'});console.log(errors);throw error;}finally{await browser.close();}
