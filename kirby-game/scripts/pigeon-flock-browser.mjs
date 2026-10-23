import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import ts from 'typescript';
import {roomSql} from '../tests/room-sql.ts';
import {historyRoutes} from '../../game-server/src/admin.ts';
import {PROTOCOL} from '../src/network-protocol.ts';
import {createServer} from 'vite';
import {FLOCK_GROUND_RADIUS} from '../src/pigeon-flock.ts';
import {fileURLToPath} from 'node:url';

const base=process.env.GAME_URL??'http://127.0.0.1:5178',output=new URL('../node_modules/.cache/pigeon-flock/',import.meta.url);
await mkdir(output,{recursive:true});
const real=process.argv.includes('--real-worker'),stress=process.argv.includes('--stress'),birdCount=Number(process.env.FLOCK_BIRDS??20);let worker;
if(real){
 const {unstable_dev}=await import('../../game-server/node_modules/wrangler/wrangler-dist/cli.js');
 const config=JSON.parse(await readFile(new URL('../../game-server/wrangler.jsonc',import.meta.url),'utf8'));
 config.main=fileURLToPath(new URL('../../game-server/src/index.ts',import.meta.url));config.vars={ADMIN_PASSWORD:'flock-local-test'};
 delete config.$schema;const path=new URL('worker-test.json',output);await writeFile(path,JSON.stringify(config));
 worker=await unstable_dev(config.main,{config:fileURLToPath(path),envFiles:[],port:8793,inspectorPort:9293,ip:'127.0.0.1',local:true,persist:false,logLevel:'error',experimental:{disableExperimentalWarning:true,disableDevRegistry:true,watch:false}});
}
const workerUrl='http://127.0.0.1:8793';
const dev=process.argv.includes('--serve')?await createServer({define:real?{'import.meta.env.VITE_GAME_SERVER_URL':JSON.stringify(workerUrl)}:undefined,server:{host:'127.0.0.1',port:Number(new URL(base).port),strictPort:true,hmr:false}}):undefined;
await dev?.listen();
await mkdir(output,{recursive:true});
globalThis.WebSocketRequestResponsePair=class{};
const workerRoot=new URL('../../game-server/src/',import.meta.url),clientRoot=new URL('../src/',import.meta.url);
const source=(await readFile(new URL('index.ts',workerRoot),'utf8')).replace("import { DurableObject } from 'cloudflare:workers';",'class DurableObject {constructor(ctx,env){this.ctx=ctx;this.env=env}}').replaceAll('../../kirby-game/src/',clientRoot.href).replaceAll("from './","from '"+workerRoot.href).replace(/(from ['"]file:[^'"]+)(['"])/g,'$1.ts$2');
const {GameRoom}=await import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString('base64'));
const errors=[],sockets=[],stored=new Map();
const ctx={getWebSockets:()=>sockets,blockConcurrencyWhile:fn=>fn(),waitUntil:p=>p.catch(e=>errors.push(String(e))),setWebSocketAutoResponse(){},getWebSocketAutoResponseTimestamp:()=>new Date(),storage:{sql:roomSql(),async get(k){return stored.get(k)},async put(k,v){if(typeof k==='string')stored.set(k,structuredClone(v));else for(const [key,value] of Object.entries(k))stored.set(key,structuredClone(value))},async delete(k){stored.delete(k)},async deleteAll(){stored.clear()},async setAlarm(){},async deleteAlarm(){}}};
const room=new GameRoom(ctx,{});await Promise.resolve();room.room=room.newRoom('host');
const env={ADMIN_PASSWORD:'flock-local-test',ROOMS:{getByName:()=>room},HISTORY:{getByName:()=>({list:async()=>({rows:[],next:null})})},ADMIN_LOGIN_LIMITER:{limit:async()=>({success:true})}};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding']});
const hook=`
import {pigeonSlot as QA_pigeonSlot} from '/src/pigeon-flock.ts';
window.flockQA={get flock(){return pigeonFlock},get session(){return network},get player(){return character},safe:pidgieSafeGround,slot:QA_pigeonSlot,hello:0,
 cpu:[],frames:[],steps:[],watch:false,lastWatch:0,lastBird:null,
 teleport(x,z){character.actor.position.set(x,0,z);character.surfaceY=0;},
 advance(seconds){for(let i=0;i<seconds*20;i++){const players=[{id:network.id,position:character.actor.position,hasBread:false},...Array.from(network.actors,([id,a])=>({id,position:new THREE.Vector3().fromArray(a.p),hasBread:false}))];pigeonFlock.update(.05,network.room.pigeonFlock??[],network.host,players,[],constrainNpc,network.serverNow);}},
 clearance(){const birds=Array.from(pigeonFlock.birds.values()).filter(b=>b.npc.actor.visible);let min=Infinity;for(let i=0;i<birds.length;i++)for(let j=i+1;j<birds.length;j++)min=Math.min(min,birds[i].npc.actor.position.distanceTo(birds[j].npc.actor.position));return min;},
 summary(){return {count:pigeonFlock.birds.size,phases:Array.from(pigeonFlock.birds.values(),b=>b.npc.phase),skins:Array.from(pigeonFlock.birds.values(),b=>b.spec.skin),hello:this.hello,min:this.clearance()};},
 capture(){const cam=new THREE.PerspectiveCamera(45,16/10,.1,1500),p=character.actor.position;cam.position.copy(p).add(new THREE.Vector3(36,28,38));cam.lookAt(p.clone().add(new THREE.Vector3(0,3,0)));renderer.render(scene,cam);return renderer.domElement.toDataURL('image/png');}
};const voice=sounds.playPigeonEmoteAt.bind(sounds);sounds.playPigeonEmoteAt=(...args)=>{if(args[0]==='Hello')flockQA.hello++;return voice(...args)};
const flockUpdate=PigeonFlock.prototype.update;PigeonFlock.prototype.update=function(...args){const start=performance.now();const result=flockUpdate.apply(this,args);if(flockQA.watch){flockQA.cpu.push(performance.now()-start);const at=performance.now();if(flockQA.lastWatch)flockQA.frames.push(at-flockQA.lastWatch);flockQA.lastWatch=at;const bird=Array.from(this.birds.values())[0];if(bird){const position=bird.npc.actor.position.clone();if(flockQA.lastBird)flockQA.steps.push(position.distanceTo(flockQA.lastBird));flockQA.lastBird=position;}}return result;};
`;
async function game(id,variant){
 const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(String(e)));
 page.on('console',m=>{if(m.type()==='error'&&/THREE\.|WebGL|Shader Error/.test(m.text()))errors.push(m.text());});
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1')});
 await page.addInitScript(()=>{window.flockWire={closed:[],largest:0};const Native=window.WebSocket;window.WebSocket=class extends Native{constructor(...args){super(...args);this.addEventListener('close',e=>flockWire.closed.push({code:e.code,reason:e.reason}));}send(data){if(typeof data==='string')flockWire.largest=Math.max(flockWire.largest,data.length);super.send(data);}};});
 if(!real)for(const endpoint of ['room','players','history/solo','history/solo/**'])await page.route('**/'+endpoint,r=>r.fulfill({json:room.info()}));
 await page.route('https://kirby-game-server.kirby-game-server.workers.dev/**',r=>r.fulfill({json:{ok:true}}));
 if(!real)await page.routeWebSocket('**/ws?*',ws=>{
  const url=new URL(ws.url()),socket={readyState:1,data:{id,session:room.room.id,variant:Number(url.searchParams.get('variant')),name:id,seen:Date.now(),visible:true,announced:true},deserializeAttachment(){return structuredClone(this.data)},serializeAttachment(a){this.data=structuredClone(a)},send(s){ws.send(s)},close(code=1000,reason='Disconnected'){this.readyState=3;void ws.close({code,reason})}};sockets.push(socket);
  ws.onMessage(data=>data==='ping'?ws.send('pong'):room.webSocketMessage(socket,data));ws.onClose(()=>room.webSocketClose(socket));
  socket.send(JSON.stringify({type:'welcome',serverNow:Date.now(),protocolVersion:PROTOCOL,playerId:id,room:room.room,players:sockets.map(s=>({id:s.data.id,actor:s.data.actor}))}));room.broadcast({type:'presence',count:sockets.length});
 });
 await page.route('**/src/main.ts*',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text())+'\n'+hook})});
 await page.goto(base);await page.locator('#startup-loader').waitFor({state:'hidden',timeout:180000});await page.waitForFunction(()=>window.flockQA&&!document.querySelector('#start-game').disabled,null,{timeout:180000});await page.locator('#network-join').click();await page.locator('#player-name-input').fill(id);if(variant)await page.locator('#variant-grid button').nth(variant).click();await page.locator('#start-game:not([disabled])').click();await page.waitForFunction(()=>window.flockQA?.player&&flockQA.session?.id);console.log('Joined',id);return page;
}
try{
 const host=await game('host',0),guest=await game('target',1);
 const point=await host.evaluate(()=>{let best={x:0,z:0,score:0};for(let z=-225;z<225;z+=15)for(let x=-225;x<225;x+=15){if(!flockQA.safe(x,z))continue;let score=0;for(let i=0;i<30;i++){const p=flockQA.slot(i);if(flockQA.safe(x+p.x,z+p.z))score++;}if(score>best.score)best={x,z,score};}if(best.score<12)throw Error('No landing area: '+JSON.stringify(best));return best;});
 console.log('Landing area',point);
 await guest.evaluate(p=>flockQA.teleport(p.x,p.z),point);await host.evaluate(p=>flockQA.teleport(p.x+40,p.z),point);
 const admin=await browser.newPage({viewport:{width:1500,height:900}});admin.on('pageerror',e=>errors.push(String(e)));
 if(!real)await admin.route('**/admin**',async route=>{const req=route.request(),response=await historyRoutes(new Request(req.url(),{method:req.method(),headers:await req.allHeaders(),body:req.method()==='POST'?req.postData():undefined}),env);await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});});
 await admin.goto((real?workerUrl:base)+'/admin');await admin.locator('#password').fill(env.ADMIN_PASSWORD);await admin.locator('#login-form button').click();await admin.locator('#online-tab').click();await admin.getByRole('button',{name:'Прислать голубя: target',exact:true}).waitFor();
 for(let i=0;i<birdCount;i++){await admin.getByRole('button',{name:'Прислать голубя: target',exact:true}).click();await admin.locator('#online-message').filter({hasText:'Голубь уже летит'}).waitFor();}
 await admin.screenshot({path:new URL('admin.png',output).pathname.slice(1)});
 await host.waitForFunction(n=>flockQA.flock.birds.size===n,birdCount);await host.evaluate(()=>flockQA.advance(25));
 await guest.waitForFunction(n=>flockQA.flock.birds.size===n,birdCount);
 await host.waitForFunction(()=>Array.from(flockQA.flock.birds.values()).every(b=>b.npc.phase==='follow'),undefined,{timeout:20000});
 await guest.waitForFunction(()=>Array.from(flockQA.flock.birds.values()).every(b=>b.npc.phase==='follow'),undefined,{timeout:20000});
 const summary=await host.evaluate(()=>flockQA.summary());assert(summary.min>=FLOCK_GROUND_RADIUS*2-.01);assert.equal(new Set(summary.skins).size,2);
 const png=await guest.evaluate(()=>flockQA.capture());await writeFile(new URL('landed.png',output),Buffer.from(png.split(',')[1],'base64'));
 await host.evaluate(()=>flockQA.advance(12));assert((await host.evaluate(()=>flockQA.summary())).hello>0);
 const remote=await guest.evaluate(()=>flockQA.summary());assert(remote.min>=FLOCK_GROUND_RADIUS*2-.01);
 let performanceReport;
 if(stress){
  await guest.bringToFront();await guest.evaluate(()=>{flockQA.watch=true;flockQA.motion=setInterval(()=>{flockQA.player.actor.position.x+=.08;},20);});
  await guest.waitForTimeout(12000);
  performanceReport=await guest.evaluate(()=>{clearInterval(flockQA.motion);flockQA.watch=false;const stat=values=>{values.sort((a,b)=>a-b);return {mean:values.reduce((a,b)=>a+b,0)/values.length,p95:values[Math.floor(values.length*.95)],max:values.at(-1),count:values.length}};return {cpu:stat(flockQA.cpu),frames:stat(flockQA.frames),steps:stat(flockQA.steps),wire:flockWire};});
  assert.equal(performanceReport.wire.closed.length,0,'a guest pursuit must not disconnect');assert(performanceReport.wire.largest<=22000);
  assert.equal((await host.evaluate(()=>flockQA.summary())).count,birdCount);assert.equal((await guest.evaluate(()=>flockQA.summary())).count,birdCount);
  console.log('Guest real movement',performanceReport);
 }
 await guest.evaluate(()=>flockQA.teleport(flockQA.player.actor.position.x+20,flockQA.player.actor.position.z));await host.waitForTimeout(500);await host.evaluate(()=>flockQA.advance(15));
 assert((await host.evaluate(()=>flockQA.summary())).min>=FLOCK_GROUND_RADIUS*2-.01);
 await host.close();if(!real&&sockets[0].readyState===1)await room.webSocketClose(sockets[0]);await guest.waitForFunction(()=>flockQA.session.host);await guest.evaluate(()=>flockQA.advance(8));assert.equal((await guest.evaluate(()=>flockQA.summary())).count,birdCount);
 const late=await game('late',2);await late.waitForFunction(n=>flockQA.flock.birds.size===n,birdCount);assert((await late.evaluate(()=>flockQA.summary())).min>=FLOCK_GROUND_RADIUS*2-.01);
 await admin.getByRole('button',{name:'Разогнать всех голубей',exact:true}).click();
 await guest.waitForFunction(()=>Array.from(flockQA.flock.birds.values()).every(b=>b.npc.state==='Fear'));
 const fear=await guest.evaluate(()=>flockQA.capture());await writeFile(new URL('scared.png',output),Buffer.from(fear.split(',')[1],'base64'));
 await guest.evaluate(()=>flockQA.advance(4));const flight=await guest.evaluate(()=>flockQA.capture());await writeFile(new URL('scattering.png',output),Buffer.from(flight.split(',')[1],'base64'));
 await guest.evaluate(()=>flockQA.advance(16));await guest.waitForFunction(()=>flockQA.flock.birds.size===0);await late.waitForFunction(()=>flockQA.flock.birds.size===0);
 if(!real){assert.equal(room.room.pigeonFlock.length,0);assert(!Array.from(stored.keys()).some(k=>k.startsWith('pigeon:')));}
 assert.deepEqual(errors,[]);await writeFile(new URL(stress?'stability-checks.json':'checks.json',output),JSON.stringify({host:summary,remote,performanceReport,scattered:true,errors},null,2));console.log('PASS admin button, '+birdCount+' shared pigeons, both skins, landing, greetings, collision clearance, host handoff, late join and scared departure');
}catch(error){console.log('Browser errors',errors);for(const context of browser.contexts())for(const page of context.pages())try{console.log('DIAGNOSTIC',JSON.stringify(await page.evaluate(()=>({wire:window.flockWire,session:window.flockQA?.session?.host,flock:window.flockQA?.flock?Array.from(flockQA.flock.birds.values(),b=>({id:b.spec.id,phase:b.npc.phase,departed:b.departed,departureY:b.departureY,p:b.npc.actor.position.toArray(),seed:b.npc.networkState().seed,follow:b.npc.networkState().followId})):null}))));}catch{}throw error;
}finally{await browser.close();await dev?.close();await worker?.stop();}
