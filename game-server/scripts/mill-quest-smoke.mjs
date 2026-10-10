import assert from 'node:assert/strict';
import {finishMill,pause} from './mill-quest-helper.mjs';
const base=process.env.SERVER_URL||'http://127.0.0.1:8788',clients=[];
async function join(variant){const socket=new WebSocket(base.replace('http','ws')+'/ws?build=meadow-network-8&name=Mill'+variant+'&variant='+variant),messages=[];socket.onmessage=e=>{if(e.data!=='pong')messages.push(JSON.parse(e.data));};await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j;});const wait=async p=>{for(let i=0;i<150;i++){const m=messages.find(p);if(m)return m;await pause(30);}throw Error('Missing server event '+p);};const welcome=await wait(m=>m.type==='welcome'),c={socket,messages,wait,welcome};clients.push(c);return c;}
const actor={p:[49,0,40.5],q:[0,0,0,1],s:1,state:'Idle',pose:[],fruits:0,achievements:[],name:'Mill',variant:0,star:0};
try{
 const a=await join(0),b=await join(1);
 b.socket.send(JSON.stringify({type:'frame',actor:{...actor,variant:1,achievements:['millQuest']}}));
 await a.wait(m=>m.type==='frame'&&m.id===b.welcome.playerId);assert(!a.messages.find(m=>m.type==='frame'&&m.id===b.welcome.playerId).actor.achievements.includes('millQuest'));
 await finishMill(a,actor);
 await b.wait(m=>m.type==='room'&&m.room.millQuest?.stage==='running');
 a.socket.send(JSON.stringify({type:'frame',actor}));
 const earned=await b.wait(m=>m.type==='frame'&&m.id===a.welcome.playerId&&m.actor?.achievements.includes('millQuest'));assert.equal(earned.actor.achievements.filter(x=>x==='millQuest').length,1);
 b.socket.send(JSON.stringify({type:'frame',actor:{...actor,variant:1},events:[{type:'mill',action:{kind:'start'}}]}));await pause(200);assert.equal(b.messages.filter(m=>m.type==='room').at(-1).room.millQuest.owner,a.welcome.playerId);
 if(process.env.MILL_RESTART==='1'){
  const until=b.messages.filter(m=>m.type==='room').at(-1).room.millQuest.runningUntil;
  while(Date.now()<until+100){await pause(Math.min(10000,until+100-Date.now()));a.socket.send('ping');b.socket.send('ping');}
  b.socket.send(JSON.stringify({type:'frame',actor:{...actor,variant:1},events:[{type:'mill',action:{kind:'start'}}]}));
  await b.wait(m=>m.type==='room'&&m.room.millQuest?.stage==='clear'&&m.room.millQuest.owner===b.welcome.playerId);
  b.socket.close();await a.wait(m=>m.type==='room'&&m.room.millQuest?.stage==='idle');
  console.log('PASS real one-minute cooldown, second owner, and release on disconnect');
 }
 console.log('PASS two clients: staged quest, wrong sack, shared progress, six-point achievement survives stale frames, occupied/restart guard');
}finally{for(const c of clients)c.socket.close();}
