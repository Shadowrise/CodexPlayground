import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import ts from 'typescript';
import {roomSql} from '../tests/room-sql.ts';
import {historyRoutes} from '../../game-server/src/admin.ts';
import {PROTOCOL} from '../src/network-protocol.ts';
import {createServer} from 'vite';
import {FLOCK_RADIUS} from '../src/pigeon-flock.ts';

const base=process.env.GAME_URL??'http://127.0.0.1:5178',output=new URL('../node_modules/.cache/pigeon-flock/',import.meta.url);
const dev=process.argv.includes('--serve')?await createServer({server:{host:'127.0.0.1',port:5178,strictPort:true,hmr:false}}):undefined;
await dev?.listen();
await mkdir(output,{recursive:true});
globalThis.WebSocketRequestResponsePair=class{};
const workerRoot=new URL('../../game-server/src/',import.meta.url),clientRoot=new URL('../src/',import.meta.url);
const source=(await readFile(new URL('index.ts',workerRoot),'utf8')).replace("import { DurableObject } from 'cloudflare:workers';",'class DurableObject {constructor(ctx,env){this.ctx=ctx;this.env=env}}').replaceAll('../../kirby-game/src/',clientRoot.href).replaceAll("from './","from '"+workerRoot.href).replace(/(from ['"]file:[^'"]+)(['"])/g,'$1.ts$2');
const {GameRoom}=await import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString('base64'));
const errors=[],sockets=[],stored=new Map();
const ctx={getWebSockets:()=>sockets,blockConcurrencyWhile:fn=>fn(),waitUntil:p=>p.catch(e=>errors.push(String(e))),setWebSocketAutoResponse(){},getWebSocketAutoResponseTimestamp:()=>new Date(),storage:{sql:roomSql(),async get(k){return stored.get(k)},async put(k,v){stored.set(k,structuredClone(v))},async delete(k){stored.delete(k)},async deleteAll(){stored.clear()},async setAlarm(){},async deleteAlarm(){}}};
const room=new GameRoom(ctx,{});await Promise.resolve();room.room=room.newRoom('host');
const env={ADMIN_PASSWORD:'flock-local-test',ROOMS:{getByName:()=>room},HISTORY:{getByName:()=>({list:async()=>({rows:[],next:null})})},ADMIN_LOGIN_LIMITER:{limit:async()=>({success:true})}};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding']});
const hook=`
import {pigeonSlot as QA_pigeonSlot} from '/src/pigeon-flock.ts';
window.flockQA={get flock(){return pigeonFlock},get session(){return network},get player(){return character},safe:pidgieSafeGround,slot:QA_pigeonSlot,hello:0,
 teleport(x,z){character.actor.position.set(x,0,z);character.surfaceY=0;},
 advance(seconds){for(let i=0;i<seconds*20;i++){const players=[{id:network.id,position:character.actor.position,hasBread:false},...Array.from(network.actors,([id,a])=>({id,position:new THREE.Vector3().fromArray(a.p),hasBread:false}))];pigeonFlock.update(.05,network.room.pigeonFlock??[],network.host,players,[],constrainNpc);}},
 clearance(){const birds=Array.from(pigeonFlock.birds.values()).filter(b=>b.npc.actor.visible);let min=Infinity;for(let i=0;i<birds.length;i++)for(let j=i+1;j<birds.length;j++)min=Math.min(min,birds[i].npc.actor.position.distanceTo(birds[j].npc.actor.position));return min;},
 summary(){return {count:pigeonFlock.birds.size,phases:Array.from(pigeonFlock.birds.values(),b=>b.npc.phase),skins:Array.from(pigeonFlock.birds.values(),b=>b.spec.skin),hello:this.hello,min:this.clearance()};},
 capture(){const cam=new THREE.PerspectiveCamera(45,16/10,.1,1500),p=character.actor.position;cam.position.copy(p).add(new THREE.Vector3(36,28,38));cam.lookAt(p.clone().add(new THREE.Vector3(0,3,0)));renderer.render(scene,cam);return renderer.domElement.toDataURL('image/png');}
};const voice=sounds.playPigeonEmoteAt.bind(sounds);sounds.playPigeonEmoteAt=(...args)=>{if(args[0]==='Hello')flockQA.hello++;return voice(...args)};
`;
async function game(id,variant){
 const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1')});
 for(const endpoint of ['room','players','history/solo','history/solo/**'])await page.route('**/'+endpoint,r=>r.fulfill({json:room.info()}));
 await page.route('https://kirby-game-server.kirby-game-server.workers.dev/**',r=>r.fulfill({json:{ok:true}}));
 await page.routeWebSocket('**/ws?*',ws=>{
  const url=new URL(ws.url()),socket={readyState:1,data:{id,session:room.room.id,variant:Number(url.searchParams.get('variant')),name:id,seen:Date.now(),visible:true,announced:true},deserializeAttachment(){return structuredClone(this.data)},serializeAttachment(a){this.data=structuredClone(a)},send(s){ws.send(s)},close(code=1000,reason='Disconnected'){this.readyState=3;void ws.close({code,reason})}};sockets.push(socket);
  ws.onMessage(data=>data==='ping'?ws.send('pong'):room.webSocketMessage(socket,data));ws.onClose(()=>room.webSocketClose(socket));
  socket.send(JSON.stringify({type:'welcome',serverNow:Date.now(),protocolVersion:PROTOCOL,playerId:id,room:room.room,players:sockets.map(s=>({id:s.data.id,actor:s.data.actor}))}));room.broadcast({type:'presence',count:sockets.length});
 });
 await page.route('**/src/main.ts*',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text())+'\n'+hook})});
 await page.goto(base);await page.locator('#startup-loader').waitFor({state:'hidden',timeout:180000});await page.locator('#network-join').click();await page.locator('#player-name-input').fill(id);if(variant)await page.locator('#variant-grid button').nth(variant).click();await page.locator('#start-game:not([disabled])').click();await page.waitForFunction(()=>window.flockQA?.player&&flockQA.session?.id);return page;
}
try{
 const host=await game('host',0),guest=await game('target',1);
 const point=await host.evaluate(()=>{let best={x:0,z:0,score:0};for(let z=-225;z<225;z+=15)for(let x=-225;x<225;x+=15){if(!flockQA.safe(x,z))continue;let score=0;for(let i=0;i<30;i++){const p=flockQA.slot(i);if(flockQA.safe(x+p.x,z+p.z))score++;}if(score>best.score)best={x,z,score};}if(best.score<12)throw Error('No landing area: '+JSON.stringify(best));return best;});
 console.log('Landing area',point);
 await guest.evaluate(p=>flockQA.teleport(p.x,p.z),point);await host.evaluate(p=>flockQA.teleport(p.x+40,p.z),point);
 const admin=await browser.newPage({viewport:{width:1500,height:900}});admin.on('pageerror',e=>errors.push(String(e)));
 await admin.route('**/admin**',async route=>{const req=route.request(),response=await historyRoutes(new Request(req.url(),{method:req.method(),headers:await req.allHeaders(),body:req.method()==='POST'?req.postData():undefined}),env);await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});});
 await admin.goto(base+'/admin');await admin.locator('#password').fill(env.ADMIN_PASSWORD);await admin.locator('#login-form button').click();await admin.locator('#online-tab').click();await admin.getByRole('button',{name:'Прислать голубя: target',exact:true}).waitFor();
 for(let i=0;i<12;i++){await admin.getByRole('button',{name:'Прислать голубя: target',exact:true}).click();await admin.locator('#online-message').filter({hasText:'Голубь уже летит'}).waitFor();}
 await admin.screenshot({path:new URL('admin.png',output).pathname.slice(1)});
 await host.waitForFunction(()=>flockQA.flock.birds.size===12);await host.evaluate(()=>flockQA.advance(25));
 await guest.waitForFunction(()=>flockQA.flock.birds.size===12);
 await host.waitForFunction(()=>Array.from(flockQA.flock.birds.values()).every(b=>b.npc.phase==='follow'),undefined,{timeout:20000});
 const summary=await host.evaluate(()=>flockQA.summary());assert(summary.min>=FLOCK_RADIUS*2-.01);assert.equal(new Set(summary.skins).size,2);
 const png=await guest.evaluate(()=>flockQA.capture());await writeFile(new URL('landed.png',output),Buffer.from(png.split(',')[1],'base64'));
 await host.evaluate(()=>flockQA.advance(12));assert((await host.evaluate(()=>flockQA.summary())).hello>0);
 const remote=await guest.evaluate(()=>flockQA.summary());assert(remote.min>=FLOCK_RADIUS*2-.01);
 await guest.evaluate(()=>flockQA.teleport(flockQA.player.actor.position.x+20,flockQA.player.actor.position.z));await host.waitForTimeout(500);await host.evaluate(()=>flockQA.advance(15));
 assert((await host.evaluate(()=>flockQA.summary())).min>=FLOCK_RADIUS*2-.01);
 await host.close();if(sockets[0].readyState===1)await room.webSocketClose(sockets[0]);await guest.waitForFunction(()=>flockQA.session.host);await guest.evaluate(()=>flockQA.advance(8));assert.equal((await guest.evaluate(()=>flockQA.summary())).count,12);
 const late=await game('late',2);await late.waitForFunction(()=>flockQA.flock.birds.size===12);assert((await late.evaluate(()=>flockQA.summary())).min>=FLOCK_RADIUS*2-.01);
 await admin.getByRole('button',{name:'Разогнать всех голубей',exact:true}).click();
 await guest.waitForFunction(()=>Array.from(flockQA.flock.birds.values()).every(b=>b.npc.state==='Fear'));
 const fear=await guest.evaluate(()=>flockQA.capture());await writeFile(new URL('scared.png',output),Buffer.from(fear.split(',')[1],'base64'));
 await guest.evaluate(()=>flockQA.advance(4));const flight=await guest.evaluate(()=>flockQA.capture());await writeFile(new URL('scattering.png',output),Buffer.from(flight.split(',')[1],'base64'));
 await guest.evaluate(()=>flockQA.advance(16));await guest.waitForFunction(()=>flockQA.flock.birds.size===0);await late.waitForFunction(()=>flockQA.flock.birds.size===0);
 assert.equal(room.room.pigeonFlock.length,0);assert(!Array.from(stored.keys()).some(k=>k.startsWith('pigeon:')));
 assert.deepEqual(errors,[]);await writeFile(new URL('checks.json',output),JSON.stringify({host:summary,remote,scattered:true,errors},null,2));console.log('PASS admin button, 12 shared pigeons, both skins, landing, greetings, collision clearance, host handoff, late join and scared departure');
}finally{await browser.close();await dev?.close();}
