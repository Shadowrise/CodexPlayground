import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {SCORE_ACTIONS} from '../src/score';
import {RESULTS_MS} from '../src/starfall';
test('room starts once, survives host departure, freezes rewards and expires with players connected',async()=>{
 const source=(await readFile(new URL('../../game-server/src/index.ts',import.meta.url),'utf8')).replace("import { DurableObject } from 'cloudflare:workers';",'class DurableObject { constructor(public ctx:any,public env:any){} }').replaceAll('../../kirby-game/src/',new URL('../src/',import.meta.url).href).replaceAll("from './", "from '"+new URL('../../game-server/src/',import.meta.url).href).replace(/(from ['"]file:[^'"]+)(['"])/g,'$1.ts$2');
 const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 const saved=(globalThis as any).WebSocketRequestResponsePair;(globalThis as any).WebSocketRequestResponsePair=class {};
 const original=Date.now;let now=100000;Date.now=()=>now;
 try{
 const {GameRoom}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
 const actor=(variant:number)=>({p:[0,0,0],q:[0,0,0,1],s:1,state:'Idle',pose:[],fruits:0,achievements:[],name:'Игрок '+variant,variant,star:0});
 class Socket {readyState=1;data:any;messages:any[]=[];constructor(id:string,variant:number){this.data={id,variant,seen:now,visible:true,actor:actor(variant)};}deserializeAttachment(){return structuredClone(this.data);}serializeAttachment(a:any){this.data=structuredClone(a);}send(v:string){this.messages.push(JSON.parse(v));}close(){this.readyState=3;}}
 const a=new Socket('a',0),b=new Socket('b',1),sockets=[a,b];let alarm=0,cleared=false;const visits:any[]=[];
 for(const socket of sockets)socket.data.history={id:'online:'+socket.data.id,startedAt:now,activeMs:0,tick:now,lastWrite:now,startScore:0,seq:0,device:{}};
 const ctx={waitUntil(){},blockConcurrencyWhile:(fn:()=>unknown)=>fn(),getWebSockets:()=>sockets,setWebSocketAutoResponse(){},getWebSocketAutoResponseTimestamp:()=>new Date(now),storage:{async put(){},async setAlarm(t:number){alarm=t;},async deleteAlarm(){alarm=0;},async deleteAll(){cleared=true;}}};
 const room=new GameRoom(ctx,{HISTORY:{getByName:()=>({write:async(rows:any[])=>{visits.push(...structuredClone(rows));}})}});room.room={id:'room',host:'a',epoch:now,fruits:Array(70).fill(null),starAt:0,mill:false,locks:{}};
 room.webSocketMessage(a,JSON.stringify({type:'frame',actor:{...actor(0),achievements:SCORE_ACTIONS}}));
 const f=room.room.festival;assert(f);assert.equal(alarm,now+30000);assert.equal(Object.keys(f.players).length,2);
 now=f.startsAt+3000;room.webSocketMessage(b,JSON.stringify({type:'frame',events:[{type:'festival-star',index:0},{type:'festival-star',index:0}]}));assert.equal(f.players.b.bonus,1);
 await room.webSocketClose(a);assert.equal(room.room.host,'b');assert.equal(room.room.festival.startsAt,f.startsAt);
 assert.equal(visits[0].status,'left');assert.equal(visits[0].completed,false);assert.equal(visits[0].tasksDone,SCORE_ACTIONS.length);assert.equal(visits[0].tasksTotal,SCORE_ACTIONS.length);assert.equal(visits[0].activeMs,23000);
 now=f.endsAt;room.webSocketMessage(b,JSON.stringify({type:'frame',events:[]}));assert(f.results);assert(b.messages.some(m=>m.type==='room'&&m.room.festival?.results));const results=JSON.stringify(f.results);
 const completed=visits.find(v=>v.playerId==='b');assert.equal(completed.status,'finished');assert.equal(completed.completed,true);assert.equal(completed.score,1);assert.equal(completed.place,2);assert.equal(completed.endedAt,f.endsAt);
 room.webSocketMessage(b,JSON.stringify({type:'frame',events:[{type:'festival-star',index:3}]}));assert.equal(JSON.stringify(f.results),results);
 now=f.endsAt+RESULTS_MS;await room.alarm();assert.equal(b.readyState,3);assert.equal(room.room,undefined);assert(cleared);assert.equal(alarm,0);
 assert.equal(visits.filter(v=>v.playerId==='b').length,1,'results timer cannot overwrite the completed visit');
 }finally{Date.now=original;(globalThis as any).WebSocketRequestResponsePair=saved;}
});
