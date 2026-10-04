import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const base=process.env.SERVER_URL||'http://127.0.0.1:8787';
if(!/^http:\/\/(127\.0\.0\.1|localhost):/.test(base))throw Error('Run history fixtures against a local server only');
const password=process.env.ADMIN_PASSWORD||(await readFile(new URL('../.dev.vars',import.meta.url),'utf8')).match(/^ADMIN_PASSWORD=(.+)$/m)?.[1].trim();
const login=body=>fetch(base+'/admin/api/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(body)});
assert.equal((await fetch(base+'/admin/api/history')).status,401);
assert.equal((await login({password:'wrong-test-password'})).status,401);
const response=await login({password});assert.equal(response.status,200);
const setCookie=response.headers.get('set-cookie');assert.match(setCookie,/HttpOnly/);assert.match(setCookie,/SameSite=Strict/);const cookie=setCookie.split(';')[0];
const get=async name=>{const response=await fetch(base+'/admin/api/history?name='+encodeURIComponent(name),{headers:{Cookie:cookie}});assert.equal(response.status,200);assert.equal(response.headers.get('Access-Control-Allow-Origin'),null);return response.json();};
const name='Тест истории '+Date.now().toString().slice(-6),startedAt=Date.now()-60000;
const report={id:crypto.randomUUID(),seq:0,name,variant:3,startedAt,activeMs:10000,startScore:7,score:13,tasksDone:3,tasksTotal:13,end:false,device:{type:'phone',os:'Android',browser:'Chrome',width:390,height:844,orientation:'portrait',input:'touch'}};
const post=async payload=>fetch(base+'/history/solo',{method:'POST',headers:{'Content-Type':'text/plain',Origin:'http://127.0.0.1:5173'},body:JSON.stringify(payload)});
assert.equal((await post(report)).status,204);assert.equal((await get(name)).rows[0].tasks_done,3);
assert.equal((await post({...report,seq:2,score:20,tasksDone:5,activeMs:40000,end:true})).status,204);
await post({...report,seq:1});let row=(await get(name)).rows[0];assert.equal(row.score,20);assert.equal(row.active_ms,40000);assert.equal(row.tasks_done,5);assert.equal(row.status,'left');assert.equal(row.device.type,'phone');
assert.equal((await post({...report,tasksDone:99})).status,400);
const onlineName='Сеть '+Date.now().toString().slice(-6),socket=new WebSocket(base.replace('http','ws')+'/ws?build=meadow-network-6&variant=14&name='+encodeURIComponent(onlineName));
const messages=[];socket.onmessage=e=>{if(e.data!=='pong')messages.push(JSON.parse(e.data));};
const wait=async f=>{for(let i=0;i<80;i++){const value=await f();if(value)return value;await new Promise(r=>setTimeout(r,50));}throw Error('Timed out');};
try{
 await wait(()=>messages.find(m=>m.type==='welcome'));
 socket.send(JSON.stringify({type:'frame',actor:{p:[0,0,0],q:[0,0,0,1],s:1,state:'Idle',pose:[],fruits:0,achievements:['mill','bench'],name:onlineName,variant:14,star:0},events:[{type:'fruit',index:0}]}));
 await wait(()=>messages.find(m=>m.type==='room'&&m.room.fruits[0]));socket.close(1000,'Left game');
 row=await wait(async()=>{const r=(await get(onlineName)).rows[0];return r?.status==='left'?r:null;});assert.equal(row.tasks_done,2);assert.equal(row.tasks_total,13);assert.equal(row.score,7);assert.equal(row.mode,'online');
 // Disposing of the last player's room must not delete either visit.
 assert.equal((await get(name)).rows.length,1);assert.equal((await get(onlineName)).rows.length,1);
}finally{socket.close();}
assert.equal((await fetch(base+'/admin/api/logout',{method:'POST',headers:{Cookie:cookie,Origin:'https://unrelated.example'}})).status,403);
const logout=await fetch(base+'/admin/api/logout',{method:'POST',headers:{Cookie:cookie,Origin:base}});assert.equal(logout.status,200);assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);
console.log('PASS admin auth, protected history, solo progress/tasks, stale packets, online departure and persistent archive');
