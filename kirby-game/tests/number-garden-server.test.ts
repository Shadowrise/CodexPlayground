import {roomSql} from './room-sql';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {numberAnswer,numberDeadline,NUMBER_EMPTY_MS} from '../src/number-garden-game';
import {NUMBER_DIGITS,NUMBER_GARDEN_SITE as SITE} from '../src/number-garden-site';
import {achievementPoints,SCORE_ACTIONS} from '../src/score';

test('actual Worker shares six rounds, protects rewards, persists progress and resets by alarm',async()=>{
 const original=Date.now,saved=(globalThis as any).WebSocketRequestResponsePair;let now=100000;Date.now=()=>now;(globalThis as any).WebSocketRequestResponsePair=class{};
 try{
  const source=(await readFile(new URL('../../game-server/src/index.ts',import.meta.url),'utf8')).replace("import { DurableObject } from 'cloudflare:workers';",'class DurableObject { constructor(public ctx:any,public env:any){} }').replaceAll('../../kirby-game/src/',new URL('../src/',import.meta.url).href).replaceAll("from './", "from '"+new URL('../../game-server/src/',import.meta.url).href).replace(/(from ['"]file:[^'"]+)(['"])/g,'$1.ts$2');
  const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
  const {GameRoom}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
  class Socket {readyState=1;messages:any[]=[];data:any;constructor(id:string){this.data={id,variant:0,announced:true,seen:now,visible:true,actor:{p:[SITE.buttonX,0,SITE.buttonZ+1.7],q:[0,0,0,1],s:1,state:'Idle',pose:[],fruits:0,achievements:[],name:id,variant:0,star:0}};}deserializeAttachment(){return structuredClone(this.data);}serializeAttachment(a:any){this.data=structuredClone(a);}send(text:string){this.messages.push(JSON.parse(text));}close(){this.readyState=3;}}
  const a=new Socket('a'),b=new Socket('b'),storage=new Map(),alarms:number[]=[];
  const ctx={blockConcurrencyWhile:(f:()=>unknown)=>f(),waitUntil(p:Promise<unknown>){p.catch(e=>{throw e;});},getWebSockets:()=>[a,b],setWebSocketAutoResponse(){},getWebSocketAutoResponseTimestamp(){return new Date(now);},storage:{sql:roomSql(),async get(k:string){return storage.get(k);},async put(k:string,v:unknown){storage.set(k,structuredClone(v));},async delete(k:string){storage.delete(k);},async setAlarm(at:number){alarms.push(at);}}};
  const room=new GameRoom(ctx,{});await Promise.resolve();await Promise.resolve();room.room={id:'room',host:'a',epoch:now,fruits:Array(70).fill(null),starAt:0,mill:false,locks:{}};
  const frame=(s:Socket,events:any[]=[],actor?:any)=>room.webSocketMessage(s,JSON.stringify({type:'frame',events,actor}));
  const press=(s:Socket,digit:number)=>{now+=250;s.data.actor.p=[NUMBER_DIGITS[digit].x,0,NUMBER_DIGITS[digit].z+1.7];frame(s,[{type:'number-note',digit}]);};
  b.data.actor.p=[0,0,0];frame(b,[{type:'number-start'}]);assert.equal(room.room.numberGame,undefined);
  frame(a,[{type:'number-start'}]);const started=room.room.numberGame.startedAt;frame(a,[{type:'number-start'}]);assert.equal(room.room.numberGame.startedAt,started);
  const old=room.room.numberGame;frame(b,[{type:'number-note',digit:0}]);assert.deepEqual(room.room.numberGame,old,'out of range input rejected');
  const wrong=(Number(numberAnswer(old.problems[0])[0])+1)%10;press(a,wrong);assert.equal(room.room.numberGame.stage,'error');now=numberDeadline(room.room.numberGame);frame(a);
  for(let round=1;round<=6;round++){
   assert.equal(room.room.numberGame.round,round);let i=0;
   for(const char of numberAnswer(room.room.numberGame.problems[round-1]))press((round+i++)%2?a:b,Number(char));
   if(round<6){assert.equal(room.room.numberGame.stage,'round');now=numberDeadline(room.room.numberGame);frame(a);}
  }
  assert.equal(room.room.numberGame.stage,'celebrate');for(const s of [a,b]){assert.equal(achievementPoints(s.data.actor.achievements),12);assert.equal(s.messages.filter(m=>m.type==='number-complete').length,1);}
  assert(storage.has('number-game'));assert(!a.data.room,'progress stored outside the WebSocket attachment');
  const snapshot=structuredClone(a.data.actor);snapshot.achievements=[];frame(a,[],snapshot);assert(a.data.actor.achievements.includes('numbers'));
  assert(a.messages.filter(m=>m.type==='number-game').every(m=>JSON.stringify(m).length<1800));
  a.data.actor.achievements=[...SCORE_ACTIONS];frame(a);assert.equal(room.room.festival,undefined,'finale waits for the reward celebration');
  now=numberDeadline(room.room.numberGame);frame(a);assert.equal(room.room.numberGame,undefined);assert(room.room.festival);room.room.festival=undefined;
  a.data.actor.achievements=['numbers'];a.data.actor.p=[SITE.buttonX,0,SITE.buttonZ+1.7];frame(a,[{type:'number-start'}]);
  a.data.actor.p=b.data.actor.p=[0,0,0];now+=250;frame(a);const leftAt=room.room.numberGame.emptySince;assert(alarms.includes(leftAt+NUMBER_EMPTY_MS));
  // Hibernation reload uses the separately stored state.
  const restored=new GameRoom(ctx,{});await Promise.resolve();await Promise.resolve();assert.equal(restored.room.numberGame.startedAt,room.room.numberGame.startedAt);
  now=leftAt+NUMBER_EMPTY_MS;await restored.alarm();assert.equal(restored.room.numberGame,undefined);assert(a.messages.some(m=>m.type==='number-game'&&!m.game));
  b.data.actor.achievements=[];const forged=structuredClone(b.data.actor);forged.achievements=['numbers'];frame(b,[],forged);assert(!b.data.actor.achievements.includes('numbers'));
 }finally{Date.now=original;(globalThis as any).WebSocketRequestResponsePair=saved;}
});
