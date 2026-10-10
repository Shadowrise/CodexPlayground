import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),clientRequire=createRequire(new URL('../../kirby-game/package.json',import.meta.url));clientRequire('tsx/cjs');
const {BUILD}=require('../../kirby-game/src/network-protocol.ts');
const {centipedeTarget,centipedeWheel,centipedeBalls,CENTIPEDE_BALLS,CENTIPEDE_TIMES,CENTIPEDE_STEP}=require('../../kirby-game/src/centipede-event.ts');
const {centipedeRoam,centipedeRoute}=require('../../kirby-game/src/arena-centipede.ts');
const {Vector3}=require('../../kirby-game/node_modules/three');
const base=process.env.SERVER_URL||'http://127.0.0.1:8788',pause=ms=>new Promise(r=>setTimeout(r,ms));
const clients=[];
async function join(name,variant){
 const socket=new WebSocket(base.replace('http','ws')+`/ws?build=${BUILD}&name=${encodeURIComponent(name)}&variant=${variant}`),messages=[];
 const client={socket,messages,room:undefined,send(m){socket.send(JSON.stringify(m));},async wait(test,timeout=15000){const end=Date.now()+timeout;while(Date.now()<end){const result=messages.findLast(test);if(result)return result;await pause(20);}throw Error('Timeout: '+test.toString());}};
 socket.addEventListener('message',e=>{if(e.data==='pong')return;const m=JSON.parse(e.data);messages.push(m);if(m.room)client.room=m.room;});socket.addEventListener('error',e=>console.error('WebSocket error',e.message));clients.push(client);
 client.hello=await client.wait(m=>m.type==='welcome');return client;
}
const actor=(name,variant,p)=>({p,q:[0,0,0,1],s:1,state:'Idle',pose:[],fruits:0,achievements:[],name,variant,star:0});
try{
 const a=await join('Тест Топотушки',0),b=await join('Друг Топотушки',1);
 const world=JSON.parse(await readFile(tmpdir()+'/kirby-network-world.json','utf8'));
 const distance=centipedeRoam(0).distance,trail=Array.from({length:12},(_,i)=>{const p=centipedeRoute(distance-(11-i)*CENTIPEDE_STEP,new Vector3());return [p.x+140,p.z-45];});
 const ca=actor('Тест Топотушки',0,[trail.at(-1)[0]+3,0,trail.at(-1)[1]]),cb=actor('Друг Топотушки',1,[140,5,-45]);
 a.send({type:'frame',actor:ca,world,events:[{type:'centipede-start',trail}]});await b.wait(m=>m.type==='room'&&m.room.centipede?.stage==='invite');b.send({type:'frame',actor:cb});
 let before,after,ballBumpsBefore,ballBumpsAfter;
 for(let round=0;round<2;round++){
  if(round){await a.wait(m=>m.type==='room'&&!m.room.centipede);ca.p=[trail.at(-1)[0]+3,0,trail.at(-1)[1]];a.send({type:'frame',actor:ca,events:[{type:'centipede-start',trail}]});await b.wait(m=>m.type==='room'&&m.room.centipede?.stage==='invite'&&m.room.centipede.startedAt>before.startedAt);}
  for(let hit=0;hit<9;hit++){
   ca.p=[140,5,-45];ca.state='Idle';a.send({type:'frame',actor:ca});
   const deadline=Date.now()+36000;let q;
   while(Date.now()<deadline){
    q=a.room.centipede;if(['exhausted','back','dizzy'].includes(q?.stage))break;
    if(!round&&!hit&&q?.stage==='balls'){
     ballBumpsBefore??=a.messages.filter(m=>m.type==='centipede-bump').length;
     const age=Date.now()-q.stageAt-CENTIPEDE_BALLS.launch;
     if(age>500&&age<1600){const ball=centipedeBalls(q,Date.now()).find(b=>b.wave===0&&b.index===2);if(ball){ca.p=[ball.x,0,ball.z];a.send({type:'frame',actor:ca});}}
     else if(age>=1600){ca.p=[140,5,-45];a.send({type:'frame',actor:ca});ballBumpsAfter=a.messages.filter(m=>m.type==='centipede-bump').length;}
    }
    if(q&&Date.now()>=q.stageAt+CENTIPEDE_TIMES[q.stage])a.send({type:'frame',actor:ca,events:[{type:'centipede-step'}]});b.send({type:'frame',actor:cb});await pause(180);
   }
   q=a.room.centipede;assert.equal(q?.stage,['exhausted','back','dizzy'][Math.floor(hit/3)]);const target=centipedeTarget(q),wheel=centipedeWheel(q,Date.now());ca.p=[target[0],q.stage==='back'?2.9:0,target[2]+(q.stage==='dizzy'?0:1)];
   const yaw=q.stage==='dizzy'?Math.atan2(wheel.x-ca.p[0],wheel.z-ca.p[2]):Math.PI;ca.q=[0,Math.sin(yaw/2),0,Math.cos(yaw/2)];ca.state=q.stage==='back'?'Jump':'Push';
   a.send({type:'frame',actor:ca,events:[{type:'hit'}]});await b.wait(m=>m.type==='room'&&m.room.centipede?.hits===hit+1&&m.room.centipede.startedAt===q.startedAt);
   if(!round)assert(!b.messages.some(m=>m.type==='centipede-progress'&&m.completed),'no early friendship');
   ca.state='Idle';
  }
  const q=a.room.centipede;ca.p=[140,5,-45];
  while(a.room.centipede.stage!=='celebrate'){const stage=a.room.centipede;await pause(Math.max(0,stage.stageAt+CENTIPEDE_TIMES[stage.stage]+50-Date.now()));a.send({type:'frame',actor:ca,events:[{type:'centipede-step'}]});await b.wait(m=>m.type==='room'&&m.room.centipede?.stage!==stage.stage&&m.room.centipede.startedAt===q.startedAt);}
  const resultA=await a.wait(m=>m.type==='centipede-progress'&&m.completed),resultB=await b.wait(m=>m.type==='centipede-progress'&&m.completed);assert(resultA.points>=6);assert(resultB.points>=3);
  const score={a:resultA.points,b:resultB.points,startedAt:q.startedAt};if(!round)before=score;else {after=score;assert.equal(after.a,before.a);assert.equal(after.b,before.b);}
  if(!round){ca.eventPoints=resultA.points;ca.achievements=['centipede'];cb.eventPoints=resultB.points;cb.achievements=['centipede'];await pause(CENTIPEDE_TIMES.celebrate+30);a.send({type:'frame',actor:ca,events:[{type:'centipede-step'}]});await a.wait(m=>m.type==='room'&&m.room.centipede?.stage==='rest');await pause(CENTIPEDE_TIMES.rest-1000);a.send({type:'frame',actor:ca,events:[{type:'centipede-start',trail}]});assert.equal(a.room.centipede.stage,'rest');await pause(1200);a.send({type:'frame',actor:ca,events:[{type:'centipede-step'}]});}
 }
 assert.equal(ballBumpsAfter-ballBumpsBefore,1,'many contact frames receive only one authoritative bump per ball wave');
 const rewardA=a.messages.filter(m=>m.type==='centipede-progress'),rewardB=b.messages.filter(m=>m.type==='centipede-progress');assert.equal(rewardA.filter(m=>m.completed).length,1);assert.equal(rewardB.filter(m=>m.completed).length,1);
 for(const stage of ['balls','stomp','wheelRoll','rest'])for(const c of [a,b])assert(c.messages.some(m=>m.room?.centipede?.stage===stage),'both clients see '+stage);
 assert(!a.room.festival,'ordinary event does not finish the room');
 a.socket.close();await b.wait(m=>m.type==='room'&&m.room.host===b.hello.playerId);const returned=await join('Тест Топотушки',0);assert(returned.hello.resume.achievements.includes('centipede'));assert.equal(returned.hello.resume.eventPoints,before.a);assert(returned.hello.room.centipede,'late join sees the active celebration');
 console.log(JSON.stringify({result:'PASS three shared phases, two-player task/rewards, minute cooldown, no repeat points, late join/rejoin, ball collision deduplication, unchanged world contract',before,after}));
}finally{clients.forEach(c=>c.socket.close());}
