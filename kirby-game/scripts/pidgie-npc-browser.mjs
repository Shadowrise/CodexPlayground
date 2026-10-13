import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import {PROTOCOL} from '../src/network-protocol.ts';

// Both modes use the real game. Online messages go through an isolated instance
// of the actual Worker, never to a shared server or another player's room.
const onlySolo=process.argv.includes('--solo'),onlyOnline=process.argv.includes('--online');
const gameUrl=process.env.GAME_URL??'http://127.0.0.1:5176/';
const output=fileURLToPath(new URL('../node_modules/.cache/pidgie-npc/',import.meta.url));
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--renderer-process-limit=3','--disable-background-timer-throttling']});
const errors=[],contexts=[];

const qaHook=`
window.pidgieQA={
 get c(){return character},get bird(){return pidgieNpc},get ready(){return pidgieReady},get session(){return network},get npcs(){return npcs},
 scene,camera,renderer,constrainNpc,pidgieSafeGround,pidgieFlightHeight,fearCalls:0,trace:[],
 get snapshot(){return pidgieNpc?.networkState()},
 get count(){return scene.children.filter(node=>node.userData.elusivePidgie).length},
 capture(){const bird=pidgieNpc,visible=bird.actor.visible,cam=new THREE.PerspectiveCamera(35,renderer.domElement.width/renderer.domElement.height,.1,1500);bird.actor.visible=true;cam.position.copy(bird.actor.position).add(new THREE.Vector3(9,5,9));cam.lookAt(bird.actor.position.clone().add(new THREE.Vector3(0,1.2,0)));renderer.render(scene,cam);const png=renderer.domElement.toDataURL('image/png');bird.actor.visible=visible;return png;},
 watchDisposal(){this.oldActor=pidgieNpc.actor;this.disposedMaterials=0;const own=new Set();pidgieNpc.actor.traverse(node=>{if(node.isMesh)for(const m of Array.isArray(node.material)?node.material:[node.material])own.add(m)});for(const m of own)m.addEventListener('dispose',()=>this.disposedMaterials++);},
 advanceTo(phase){for(let i=0;i<2000&&pidgieNpc.phase!==phase;i++){pidgieNpc.update(.05,[character.actor.position],constrainNpc);if(this.trace.at(-1)!==pidgieNpc.phase)this.trace.push(pidgieNpc.phase)}return pidgieNpc.phase;},
 set day(value){dayStart=Date.now();dayStartPhase=value}
};
const pidgieOriginalCoo=sounds.playPigeonEmoteAt.bind(sounds);
sounds.playPigeonEmoteAt=(...args)=>{if(args[0]==='Fear')window.pidgieQA.fearCalls++;return pidgieOriginalCoo(...args)};
`;

async function makeRoom(){
 globalThis.WebSocketRequestResponsePair=class{};
 const workerRoot=new URL('../../game-server/src/',import.meta.url),clientRoot=new URL('../src/',import.meta.url);
 const source=(await readFile(new URL('index.ts',workerRoot),'utf8'))
  .replace("import { DurableObject } from 'cloudflare:workers';",'class DurableObject {constructor(ctx,env){this.ctx=ctx;this.env=env}}')
  .replaceAll('../../kirby-game/src/',clientRoot.href).replaceAll("from './","from '"+workerRoot.href)
  .replace(/(from ['"]file:[^'"]+)(['"])/g,'$1.ts$2');
 const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 const {GameRoom}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
 const sockets=[],stored=new Map(),frames=[];
 const ctx={getWebSockets:()=>sockets,blockConcurrencyWhile:fn=>fn(),waitUntil:promise=>promise.catch(error=>errors.push(String(error))),setWebSocketAutoResponse(){},getWebSocketAutoResponseTimestamp(){return new Date(Date.now())},storage:{async get(key){return stored.get(key)},async put(key,value){stored.set(key,structuredClone(value))},async delete(key){stored.delete(key)},async deleteAll(){stored.clear()},async setAlarm(){},async deleteAlarm(){}}};
 const room=new GameRoom(ctx,{});await Promise.resolve();room.room=room.newRoom('p0');
 return {room,sockets,frames};
}

async function pageFor({online=false,id='solo',variant=0,fixture}={}){
 const context=await browser.newContext({viewport:{width:1280,height:800}});contexts.push(context);
 const page=await context.newPage();page.setDefaultTimeout(20000);
 page.on('pageerror',error=>{errors.push(error.stack??error.message);console.error(error.stack)});
 page.on('console',message=>{if(message.type()==='error'&&/THREE|WebGL|shader|Pidgie|Пиджи/i.test(message.text()))errors.push(message.text())});
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1')});
 // All room/history requests are local fixtures, even if Vite has a production URL configured.
 for(const endpoint of ['room','players','history/solo','history/solo/**'])await page.route('**/'+endpoint,route=>route.fulfill({json:fixture?fixture.room.info():{ok:true,players:0,occupiedVariants:[],capacity:14}}));
 await page.route('https://kirby-game-server.kirby-game-server.workers.dev/**',route=>route.fulfill({json:{ok:true}}));
 await page.routeWebSocket('**',ws=>{
  if(!online||!new URL(ws.url()).pathname.endsWith('/ws')){ws.onMessage(()=>{});return;}
  const {room,sockets,frames}=fixture,url=new URL(ws.url());
  const socket={readyState:1,finished:false,data:{id,session:room.room.id,variant:Number(url.searchParams.get('variant')),name:url.searchParams.get('name'),seen:Date.now(),visible:true,announced:true},deserializeAttachment(){return structuredClone(this.data)},serializeAttachment(value){this.data=structuredClone(value)},send(text){const parsed=JSON.parse(text);frames.push({to:id,...parsed});ws.send(text)},close(code=1000,reason='Disconnected'){this.readyState=3;void ws.close({code,reason})}};
  sockets.push(socket);
  ws.onMessage(data=>{if(data==='ping'){ws.send('pong');return}room.webSocketMessage(socket,data)});
  ws.onClose(async code=>{if(socket.finished)return;socket.finished=true;await room.webSocketClose(socket,code??1000)});
  socket.send(JSON.stringify({type:'welcome',serverNow:Date.now(),protocolVersion:PROTOCOL,playerId:id,room:room.room,players:sockets.filter(s=>s.readyState===1).map(s=>({id:s.data.id,actor:s.data.actor}))}));
  room.broadcast({type:'presence',count:sockets.filter(s=>s.readyState===1).length},socket);
 });
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\n'+qaHook})});
 await page.goto(gameUrl);await page.locator('#startup-loader').waitFor({state:'hidden',timeout:180000});
 assert.equal(await page.evaluate(()=>window.pidgieQA.count),0,'the menu never owns an NPC');
 await page.locator(online?'#network-join':'#new-game').click();await page.locator('#player-name-input').fill('QA '+id);
 if(variant)await page.locator('#variant-grid button').nth(variant).click();
 await page.locator('#start-game:not([disabled])').waitFor();await page.locator('#start-game').click();
 await page.waitForFunction(()=>window.pidgieQA?.c&&pidgieQA.bird&&pidgieQA.ready&&pidgieQA.bird.phase!=='hidden',undefined,{timeout:45000});
 await page.evaluate(()=>{pidgieQA.day=.25});
 const info=await page.evaluate(()=>({count:pidgieQA.count,npcs:pidgieQA.npcs.length,safe:pidgieQA.pidgieSafeGround(pidgieQA.bird.actor.position.x,pidgieQA.bird.actor.position.z),snapshot:pidgieQA.snapshot}));
 assert.equal(info.count,1);assert.equal(info.npcs,14);assert(info.safe||info.snapshot.phase!=='wander','dry unobstructed ground spawn');
 console.log('Loaded '+id,info.snapshot.phase);
 return page;
}

async function capture(page,name){const png=await page.evaluate(()=>pidgieQA.capture());await writeFile(output+name+'.png',Buffer.from(png.split(',')[1],'base64'))}
async function approach(page,point){await page.evaluate(point=>{const q=pidgieQA;q.c.setActivity('Idle');q.c.actor.position.set(point[0],0,point[2]+2);q.c.surfaceY=0;q.c.yaw=Math.PI;q.c.actor.rotation.set(0,Math.PI,0)},point)}
async function waitPhase(page,phase){await page.waitForFunction(phase=>pidgieQA.bird?.phase===phase,phase)}
async function noSmoke(page){assert(await page.evaluate(()=>!pidgieQA.bird.actor.getObjectByName('Flight cloud')?.visible),'NPC flight must have no smoke')}
async function finishFlight(page){assert.equal(await page.evaluate(()=>pidgieQA.advanceTo('wander')),'wander');await page.evaluate(()=>pidgieQA.bird.update(.5,[pidgieQA.c.actor.position],pidgieQA.constrainNpc));}
async function leave(page){await page.locator('#settings-toggle').click();await page.locator('#exit-to-menu').click();await page.waitForFunction(()=>!pidgieQA.c&&!pidgieQA.bird);assert.equal(await page.evaluate(()=>pidgieQA.count),0)}

try{
 if(!onlyOnline){
  const page=await pageFor(),initial=await page.evaluate(()=>pidgieQA.snapshot);
  assert.equal(initial.phase,'wander');assert.equal(initial.fearCount,0);
  const firstCoo=await page.evaluate(()=>pidgieQA.fearCalls);
  await approach(page,initial.p);await waitPhase(page,'fear');await page.waitForFunction(n=>pidgieQA.fearCalls===n+1,firstCoo);
  await capture(page,'solo-fear');assert.equal(await page.evaluate(()=>pidgieQA.snapshot.fearCount),1);
  assert.equal(await page.evaluate(()=>pidgieQA.advanceTo('fly')),'fly');await noSmoke(page);await capture(page,'solo-flight');
  const flight=await page.evaluate(()=>pidgieQA.snapshot);assert(flight.p[1]>=26);assert(Math.hypot(flight.destination[0]-flight.origin[0],flight.destination[1]-flight.origin[1])>=60);
  await finishFlight(page);const landed=await page.evaluate(()=>pidgieQA.snapshot);assert.equal(landed.p[1],0);assert(Math.hypot(landed.p[0]-initial.p[0],landed.p[2]-initial.p[2])>=59);
  assert(await page.evaluate(()=>pidgieQA.pidgieSafeGround(pidgieQA.bird.actor.position.x,pidgieQA.bird.actor.position.z)));
  await approach(page,landed.p);await waitPhase(page,'fear');await page.waitForFunction(n=>pidgieQA.fearCalls===n+2,firstCoo);assert.equal(await page.evaluate(()=>pidgieQA.snapshot.fearCount),2);
  await page.evaluate(()=>pidgieQA.watchDisposal());await leave(page);
  assert(await page.evaluate(()=>pidgieQA.oldActor.parent===null&&pidgieQA.disposedMaterials>0),'menu removes NPC and disposes its own materials');
  await page.locator('#new-game').click();await page.locator('#start-game').click();await page.waitForFunction(()=>pidgieQA.bird&&pidgieQA.ready);
  assert.equal(await page.evaluate(()=>pidgieQA.count),1);assert.equal(await page.evaluate(()=>pidgieQA.bird.fearCount),0);await leave(page);await page.context().close();
  console.log('PASS solo: real start, one safe bird, fear/coo once, distant flight/landing, repeated scare, no smoke, menu disposal and restart');
 }
 if(!onlySolo){
  const fixture=await makeRoom(),host=await pageFor({online:true,id:'p0',fixture}),guest=await pageFor({online:true,id:'p1',variant:1,fixture});
  await host.waitForFunction(()=>pidgieQA.session.actors.size===1);await guest.waitForFunction(()=>pidgieQA.session.world?.pidgie);
  const origin=await host.evaluate(()=>pidgieQA.snapshot),hostCoo=await host.evaluate(()=>pidgieQA.fearCalls),guestCoo=await guest.evaluate(()=>pidgieQA.fearCalls);
  await approach(guest,origin.p);await waitPhase(host,'fear');await waitPhase(guest,'fear');
  for(const [page,count] of [[host,hostCoo],[guest,guestCoo]])await page.waitForFunction(count=>pidgieQA.fearCalls===count+1,count);
  const states=await Promise.all([host,guest].map(page=>page.evaluate(()=>pidgieQA.snapshot)));
  assert.equal(states[0].fearCount,states[1].fearCount);assert.deepEqual(states[0].destination,states[1].destination);assert.deepEqual(states[0].origin,states[1].origin);
  assert(fixture.frames.some(frame=>frame.world?.pidgie?.phase==='fear'),'actual Worker accepts and relays the authoritative bird');
  await capture(guest,'online-guest-fear');assert.equal(await host.evaluate(()=>pidgieQA.advanceTo('fly')),'fly');await waitPhase(guest,'fly');await noSmoke(host);await noSmoke(guest);await capture(guest,'online-shared-flight');
  const before=await host.evaluate(()=>pidgieQA.snapshot);
  const late=await pageFor({online:true,id:'p2',variant:2,fixture});await late.waitForFunction(n=>pidgieQA.bird.fearCount===n,before.fearCount);
  assert.equal(await late.evaluate(()=>pidgieQA.fearCalls),0,'late join must not replay an old fear coo');assert.equal(await late.evaluate(()=>pidgieQA.count),1);
  await host.evaluate(()=>pidgieQA.watchDisposal());await leave(host);
  await guest.waitForFunction(()=>pidgieQA.session.host);assert.equal(fixture.room.room.host,'p1');
  const after=await guest.evaluate(()=>pidgieQA.snapshot);assert.equal(after.fearCount,before.fearCount);assert.deepEqual(after.destination,before.destination);assert.deepEqual(after.origin,before.origin);
  assert.equal(await guest.evaluate(()=>pidgieQA.fearCalls),guestCoo+1,'handoff cannot replay the scare');
  await finishFlight(guest);await waitPhase(late,'wander');const landing=await guest.evaluate(()=>pidgieQA.snapshot);
  assert(Math.hypot(landing.p[0]-origin.p[0],landing.p[2]-origin.p[2])>=59);assert.equal(landing.p[1],0);
  await approach(late,landing.p);await waitPhase(guest,'fear');await waitPhase(late,'fear');
  await guest.waitForFunction(n=>pidgieQA.bird.fearCount===n,before.fearCount+1);await late.waitForFunction(n=>pidgieQA.bird.fearCount===n,before.fearCount+1);
  assert.equal(await late.evaluate(()=>pidgieQA.fearCalls),1,'new fear is heard once by the late guest');
  // All clients are already loaded now, so host departure happens mid-flight
  // rather than spending the first flight waiting for a third WebGL scene.
  assert.equal(await guest.evaluate(()=>pidgieQA.advanceTo('fly')),'fly');await waitPhase(late,'fly');
  const airborneBefore=await guest.evaluate(()=>pidgieQA.snapshot);await leave(guest);
  await late.waitForFunction(()=>pidgieQA.session.host);assert.equal(fixture.room.room.host,'p2');
  const airborneAfter=await late.evaluate(()=>pidgieQA.snapshot);
  assert.equal(airborneAfter.phase,'fly');assert(airborneAfter.p[1]>=25,'host handoff must keep the bird airborne');
  assert.equal(airborneAfter.fearCount,airborneBefore.fearCount);assert.deepEqual(airborneAfter.destination,airborneBefore.destination);assert.deepEqual(airborneAfter.origin,airborneBefore.origin);
  assert.equal(await late.evaluate(()=>pidgieQA.fearCalls),1,'airborne handoff cannot replay a coo');
  await noSmoke(late);await finishFlight(late);
  await writeFile(output+'online-snapshots.json',JSON.stringify({origin,scare:states,flight:before,handoff:after,landing,airborneBefore,airborneAfter,worldFrames:fixture.frames.filter(frame=>frame.world?.pidgie).length},null,2));
  await guest.context().close();await late.context().close();await host.context().close();
  console.log('PASS online: isolated actual Worker, guest proximity triggers host, one shared bird/scare/flight, late join, host handoff without a restart or duplicate coo, repeated guest scare');
 }
 assert.deepEqual(errors,[]);console.log('PASS no browser or Worker exceptions');
}finally{for(const context of contexts)await context.close().catch(()=>{});await browser.close()}
