import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {Vector3} from 'three';
import {centipedeRoute,centipedeRoam} from '../src/arena-centipede';
import {CENTIPEDE_STEP,CENTIPEDE_TIMES,centipedeTarget,centipedeWheel,type CentipedeEvent} from '../src/centipede-event';

test('Worker shares all three phases, awards both participants only at the finale and persists the full cooldown',async()=>{
 const source=(await readFile(new URL('../../game-server/src/index.ts',import.meta.url),'utf8')).replace("import { DurableObject } from 'cloudflare:workers';",'class DurableObject { constructor(public ctx:any,public env:any){} }').replaceAll('../../kirby-game/src/',new URL('../src/',import.meta.url).href).replaceAll("from './", "from '"+new URL('../../game-server/src/',import.meta.url).href).replace(/(from ['"]file:[^'"]+)(['"])/g,'$1.ts$2');
 const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 const saved=(globalThis as any).WebSocketRequestResponsePair;(globalThis as any).WebSocketRequestResponsePair=class {};
 const original=Date.now;let now=100000;Date.now=()=>now;
 try{
  const {GameRoom}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
  const actor=(name:string,variant:number)=>({p:[140,5,-45],q:[0,0,0,1],s:1,state:'Idle',pose:[],fruits:0,achievements:[],eventPoints:0,name,variant,star:0});
  class Socket{readyState=1;messages:any[]=[];constructor(public data:any){}deserializeAttachment(){return structuredClone(this.data);}serializeAttachment(a:any){this.data=structuredClone(a);}send(m:string){this.messages.push(JSON.parse(m));}}
  const a=new Socket({id:'a',session:'room',name:'Первый',variant:0,seen:now,visible:true,announced:true,actor:actor('Первый',0)}),b=new Socket({id:'b',session:'room',name:'Второй',variant:1,seen:now,visible:true,announced:true,actor:actor('Второй',1)}),sockets=[a,b];
  const stored=new Map<string,any>(),pending:Promise<any>[]=[];
  const ctx={getWebSockets:()=>sockets,setWebSocketAutoResponse(){},blockConcurrencyWhile(fn:()=>Promise<any>){const p=fn();pending.push(p);return p;},waitUntil(p:Promise<any>){pending.push(p);},storage:{get:async(k:string)=>structuredClone(stored.get(k)),put:async(k:string,v:any)=>{stored.set(k,structuredClone(v));},delete:async(k:string)=>{stored.delete(k);},setAlarm:async()=>{}}};
  let room=new GameRoom(ctx,{});await Promise.all(pending);room.room={id:'room',host:'a',epoch:now,fruits:Array(70).fill(null),starAt:0,mill:false,locks:{}};
  const trail=Array.from({length:12},(_,i)=>{const p=centipedeRoute(centipedeRoam(0).distance-(11-i)*CENTIPEDE_STEP,new Vector3());return [140+p.x,-45+p.z];});
  const frame=(socket:Socket,events:any[]=[])=>{now+=200;room.webSocketMessage(socket,JSON.stringify({type:'frame',actor:structuredClone(socket.data.actor),events}));};
  const q=()=>room.room.centipede as CentipedeEvent;
  const start=()=>{a.data.actor.p=[trail.at(-1)![0]+3,0,trail.at(-1)![1]];frame(a,[{type:'centipede-start',trail}]);assert.equal(q().stage,'invite');};
  const advance=()=>{now=q().stageAt+CENTIPEDE_TIMES[q().stage]+1;a.data.actor.p=[170,5,-45];frame(a,[{type:'centipede-step'}]);};
  const complete=()=>{
   for(let hit=0;hit<9;hit++){
    let guard=0;while(!['exhausted','back','dizzy'].includes(q().stage)){assert(++guard<25);advance();}
    assert.equal(q().phase,1+Math.floor(hit/3));
    const target=centipedeTarget(q()),wheel=centipedeWheel(q(),now),p=[target[0],q().stage==='back'?2.9:0,target[2]+(q().stage==='dizzy'?0:1)];
    const yaw=q().stage==='dizzy'?Math.atan2(wheel.x-p[0],wheel.z-p[2]):Math.PI;
    a.data.actor.p=p;a.data.actor.q=[0,Math.sin(yaw/2),0,Math.cos(yaw/2)];a.data.actor.state=q().stage==='back'?'Jump':'Push';
    frame(a,[{type:'hit'}]);assert.equal(q().hits,hit+1);
    if(!a.data.actor.achievements.includes('centipede'))assert.equal(b.messages.filter(m=>m.type==='centipede-progress'&&m.completed).length,0,'no premature task completion');
   }
   while(q().stage!=='celebrate')advance();
  };
  start();complete();
  for(const s of sockets){assert(s.data.actor.achievements.includes('centipede'));assert.equal(s.messages.filter(m=>m.type==='centipede-progress'&&m.completed).length,1);for(const phase of [2,3])assert(s.messages.some(m=>m.room?.centipede?.phase===phase));}
  assert.equal(a.data.actor.eventPoints,12);const points=b.data.actor.eventPoints;assert(points>0);assert(!room.room.festival);
  advance();assert.equal(q().stage,'rest');const restAt=q().stageAt,startedAt=q().startedAt;
  // Recreate the Durable Object from its attachments and storage while it rests.
  await Promise.all(pending);room=new GameRoom(ctx,{});await Promise.all(pending);assert.equal(q().stage,'rest');
  for(const delay of [1000,59000]){now=restAt+delay;a.data.actor.p=[0,0,0];b.data.actor.p=[0,0,0];frame(a,[{type:'centipede-start',trail}]);assert.equal(q().stage,'rest');assert.equal(q().startedAt,startedAt);}
  now=restAt+60000;frame(a);assert(!q());assert(!stored.has('centipede-event'));
  b.data.actor.p=[140,5,-45];start();complete();
  assert.equal(a.data.actor.eventPoints,12);assert.equal(b.data.actor.eventPoints,points);
  for(const s of sockets)assert.equal(s.messages.filter(m=>m.type==='centipede-progress'&&m.completed).length,1,'no duplicate completion on replay');
 }finally{Date.now=original;(globalThis as any).WebSocketRequestResponsePair=saved;}
});
