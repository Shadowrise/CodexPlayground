import {readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
const base=process.env.SERVER_URL||'http://127.0.0.1:8787';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
let nextVariant=0;
async function join(){const socket=new WebSocket(base.replace('http','ws')+'/ws?build=meadow-network-2&variant='+nextVariant++),messages=[];socket.addEventListener('message',e=>{if(e.data!=='pong')messages.push(JSON.parse(e.data));});await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve);socket.addEventListener('error',reject);});const wait=async check=>{for(let i=0;i<100;i++){const m=messages.find(check);if(m)return m;await pause(30);}throw Error('Message timed out');};const hello=await wait(m=>m.type==='welcome');return {socket,messages,hello,wait,send:obj=>socket.send(JSON.stringify(obj))};}
const actor={p:[0,0,0],q:[0,0,0,1],s:1,state:'Idle',pose:[],fruits:0,achievements:[],name:'Test',variant:0,star:0};
const clients=[];
try{
 const a=await join(),b=await join();clients.push(a,b);assert.equal(a.hello.room.id,b.hello.room.id);assert.equal(b.hello.room.host,a.hello.playerId);
 a.send({type:'frame',actor,events:[{type:'fruit',index:0},{type:'lock',key:'cart:0'}]});
 await b.wait(m=>m.type==='room'&&m.room.fruits[0]===a.hello.playerId);
 b.send({type:'frame',actor:{...actor,name:'Second'},events:[{type:'fruit',index:0},{type:'lock',key:'cart:0'}]});
 assert.equal((await b.wait(m=>m.type==='lock')).ok,false);
 assert.equal((await a.wait(m=>m.type==='frame'&&m.id===b.hello.playerId)).actor.variant,1);
 const duplicate=new WebSocket(base.replace('http','ws')+'/ws?build=meadow-network-2&variant=0');const rejected=await new Promise(resolve=>duplicate.addEventListener('message',e=>resolve(JSON.parse(e.data)),{once:true}));assert.equal(rejected.type,'error');assert.equal((await (await fetch(base+'/room')).json()).occupiedVariants.length,2);duplicate.close();
 await pause(120);const world=JSON.parse(await readFile(tmpdir()+'/kirby-network-world.json','utf8'));a.send({type:'frame',actor,world,events:[]});await b.wait(m=>m.type==='frame'&&m.world);
 for(let i=0;i<11;i++){await pause(720);const text='message '+i+' '+('я'.repeat(280));a.send({type:'frame',actor,events:[{type:'chat',text}]});const entry=(await b.wait(m=>m.type==='log'&&m.entry.text.startsWith('message '+i+' '))).entry;assert.equal(entry.text.length,255);assert.equal(entry.name,'Test');}
 const c=await join();clients.push(c);assert.equal(c.hello.room.log.length,10);assert(c.hello.room.log.at(-1).text.startsWith('message 10 '));assert.equal(c.hello.room.fruits[0],a.hello.playerId);assert.equal(c.hello.room.world.npcs.length,14);
 const room=a.hello.room.id;a.socket.close();await b.wait(m=>m.type==='room'&&m.room.host!==a.hello.playerId&&!m.room.locks['cart:0']);
 b.socket.close();c.socket.close();await pause(200);
 assert.equal((await (await fetch(base+'/players')).json()).players,0);
 const d=await join();clients.push(d);assert.notEqual(d.hello.room.id,room);assert(d.hello.room.fruits.every(x=>x===null));d.socket.close();
 console.log('PASS: shared room, peers, fruit contention, exclusive cart, late join, host migration, empty-room reset');
}finally{for(const c of clients)c.socket.close();}
