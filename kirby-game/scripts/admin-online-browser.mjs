import {chromium} from 'playwright';

import assert from 'node:assert/strict';

import {readFile} from 'node:fs/promises';

const base='http://127.0.0.1:8791'; // Dedicated local room: never exercise admin mutations in production.

const password=(await readFile(new URL('../../game-server/.dev.vars',import.meta.url),'utf8')).match(/^ADMIN_PASSWORD=(.+)$/m)[1].trim();

const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});

const sockets=[];

const wait=async fn=>{for(let i=0;i<100;i++){const value=await fn();if(value)return value;await new Promise(r=>setTimeout(r,50));}throw Error('Timed out');};

async function join(name,variant){const socket=new WebSocket(base.replace('http','ws')+'/ws?build=meadow-network-4&name='+encodeURIComponent(name)+'&variant='+variant),messages=[];sockets.push(socket);socket.onmessage=e=>{if(e.data!=='pong'){const m=JSON.parse(e.data);messages.push(m);if(m.type==='error')socket.close();}};const welcome=await wait(()=>messages.find(m=>m.type==='welcome'));return {socket,messages,welcome};}

try{

 const page=await browser.newPage({viewport:{width:1400,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());

 assert.equal((await page.request.get(base+'/admin/api/online')).status(),401);

 assert.equal((await page.request.post(base+'/admin/api/online/recreate',{headers:{Origin:base},data:{roomId:'test'}})).status(),401);

 await page.goto(base+'/admin');await page.locator('#password').fill(password);await page.locator('#login-form button').click();await page.locator('#dashboard').waitFor({state:'visible'});

 await page.locator('#online-tab').click();await page.waitForFunction(()=>!document.querySelector('#online-message').textContent);

 assert(await page.locator('#history-panel').isHidden());assert(await page.locator('#starfall').isDisabled());

 const icon=await page.request.get(base+'/admin/favicon.svg');assert.equal(icon.status(),200);assert.match(icon.headers()['content-type'],/svg/);

 const a=await join('Хост тест',0),b=await join('Гость тест',1),oldId=a.welcome.room.id;

 a.socket.send(JSON.stringify({type:'frame',actor:{p:[0,0,0],q:[0,0,0,1],s:1,state:'Idle',pose:[],fruits:0,achievements:['bench'],name:'Хост тест',variant:0,star:0}}));

 await page.locator('#refresh').click();await page.waitForFunction(()=>document.querySelectorAll('#online-rows tr').length===2);

 assert.equal(await page.locator('#room-id').textContent(),oldId);
 await page.locator('#online-rows tr').filter({hasText:'Хост тест'}).getByRole('button',{name:/Икота/}).click();
 const prank=await wait(()=>a.messages.find(m=>m.type==='room'&&m.room.pranks?.length));await wait(()=>b.messages.find(m=>m.type==='room'&&m.room.pranks?.length));
 assert.equal(prank.room.pranks[0].kind,'hiccup');assert.equal(prank.room.pranks[0].playerId,a.welcome.playerId);
 assert.equal((await page.request.post(base+'/admin/api/online/prank',{headers:{Origin:base},data:{roomId:oldId,playerId:a.welcome.playerId,kind:'gift'}})).status(),409);
 assert.equal((await page.request.post(base+'/admin/api/online/prank',{headers:{Origin:'https://unrelated.example'},data:{roomId:oldId,playerId:a.welcome.playerId,kind:'gift'}})).status(),403);

 assert.equal((await page.request.post(base+'/admin/api/online/recreate',{headers:{Origin:'https://unrelated.example'},data:{roomId:oldId}})).status(),403);

 assert.equal((await page.request.post(base+'/admin/api/online/disconnect',{headers:{Origin:base},data:{roomId:'stale',playerId:a.welcome.playerId}})).status(),409);

 await page.screenshot({path:process.env.TEMP+'/kirby-admin-online.png'});

 await page.getByRole('button',{name:'Disconnect Хост тест',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('#online-rows tr').length===1);await wait(()=>a.socket.readyState===WebSocket.CLOSED);

 assert.match(await page.locator('#online-rows').textContent(),/Гость тест.*Хост/s);

 await page.locator('#recreate').click();await wait(()=>b.messages.find(m=>m.type==='error'));assert.notEqual(b.socket.readyState,WebSocket.OPEN);await page.waitForFunction(old=>document.querySelector('#room-id').textContent!==old&&document.querySelector('#room-id').textContent!=='—',oldId);

 const newId=await page.locator('#room-id').textContent();assert.notEqual(newId,oldId);await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);assert(await page.locator('#starfall').isDisabled());

 const c=await join('Новая игра',2);assert.equal(c.welcome.room.id,newId);assert(!c.welcome.resume);

 await page.locator('#refresh').click();await page.waitForFunction(()=>!document.querySelector('#starfall').disabled);

 await page.locator('#starfall').click();await wait(()=>c.messages.find(m=>m.type==='room'&&m.room.festival));await page.waitForFunction(()=>document.querySelector('#starfall').disabled&&!document.querySelector('#finish-game').disabled);

 await page.locator('#finish-game').click();const result=await wait(()=>c.messages.find(m=>m.type==='room'&&m.room.festival?.results));assert.equal(result.room.festival.results[0].name,'Новая игра');assert(result.room.festival.endsAt<=Date.now());

 await page.waitForFunction(()=>document.querySelector('#finish-game').disabled&&!document.querySelector('#refresh').disabled);

 const history=await page.request.get(base+'/admin/api/history?name='+encodeURIComponent('Новая игра'));await wait(async()=>{const r=await page.request.get(base+'/admin/api/history?name='+encodeURIComponent('Новая игра'));return (await r.json()).rows[0]?.completed;});assert.equal(history.status(),200);

 await page.locator('#history-tab').click();await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);assert(await page.locator('#history-panel').isVisible());assert(await page.locator('#online-panel').isHidden());

 await page.locator('#online-tab').click();await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);await page.setViewportSize({width:390,height:844});await page.screenshot({path:process.env.TEMP+'/kirby-admin-online-mobile.png'});

 assert.deepEqual(errors,[]);console.log('PASS Online UI, favicon, authentication, CSRF, stale actions, host disconnect, room reset, starfall, immediate results and archive');

}finally{for(const socket of sockets)socket.close();await browser.close();}

