import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {FLOWER_MELODIES,flowerDeadline,FLOWER_EMPTY_MS} from '../src/musical-flower-game';
import {MUSICAL_FLOWERS,MUSICAL_FLOWER_SITE as SITE} from '../src/musical-flower-site';
import {achievementPoints} from '../src/score';

async function worker(){
 const source=(await readFile(new URL('../../game-server/src/index.ts',import.meta.url),'utf8')).replace("import { DurableObject } from 'cloudflare:workers';",'class DurableObject { constructor(public ctx:any,public env:any){} }').replaceAll('../../kirby-game/src/',new URL('../src/',import.meta.url).href).replaceAll("from './", "from '"+new URL('../../game-server/src/',import.meta.url).href).replace(/(from ['"]file:[^'"]+)(['"])/g,'$1.ts$2');
 const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 return (await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))).GameRoom;
}
test('authoritative shared flower game validates notes, awards both participants once, and broadcasts compact progress',async()=>{
 const original=Date.now,originalRandom=Math.random,saved=(globalThis as any).WebSocketRequestResponsePair;let now=100000;Date.now=()=>now;Math.random=()=>0;
 (globalThis as any).WebSocketRequestResponsePair=class{};
 try{
  class Socket {readyState=1;messages:any[]=[];data:any;constructor(id:string){this.data={id,variant:0,announced:true,seen:now,visible:true,actor:{p:[SITE.x,0,SITE.z+2],q:[0,0,0,1],s:1,state:'Idle',pose:[],fruits:0,achievements:[],name:id,variant:0,star:0}};}deserializeAttachment(){return structuredClone(this.data);}serializeAttachment(a:any){this.data=structuredClone(a);}send(text:string){this.messages.push(JSON.parse(text));}}
  const a=new Socket('a'),b=new Socket('b'),storage=new Map<string,any>(),alarms:number[]=[];
  const ctx={blockConcurrencyWhile:(f:()=>unknown)=>f(),waitUntil(p:Promise<unknown>){p.catch(e=>{throw e;});},getWebSockets:()=>[a,b],setWebSocketAutoResponse(){},getWebSocketAutoResponseTimestamp(){return null;},storage:{async get(key:string){return storage.get(key);},async put(key:string,value:unknown){storage.set(key,structuredClone(value));},async delete(key:string){storage.delete(key);},async setAlarm(at:number){alarms.push(at);}}};
  const GameRoom=await worker(),room=new GameRoom(ctx,{});await Promise.resolve();await Promise.resolve();room.room={id:'room',host:'a',epoch:now,fruits:Array(70).fill(null),starAt:0,mill:false,locks:{},world:{marker:'a large world would be wasteful here'}};
  const frame=(s:Socket,events:any[]=[],actor?:any)=>room.webSocketMessage(s,JSON.stringify({type:'frame',events,actor}));
  frame(a,[{type:'flower-start'}]);const startedAt=room.room.flowerGame.startedAt;
  frame(b,[{type:'flower-start'}]);assert.equal(room.room.flowerGame.startedAt,startedAt);
  frame(a,[{type:'flower-note',index:0}]);assert.equal(room.room.flowerGame.stage,'listen');
  const putNear=(s:Socket,index:number)=>{const f=MUSICAL_FLOWERS[index];s.data.actor.p=[f.x,0,f.z+1];};
  now=flowerDeadline(room.room.flowerGame);frame(a);assert.equal(room.room.flowerGame.stage,'repeat');
  putNear(a,1);now+=250;frame(a,[{type:'flower-note',index:1}]);assert.equal(room.room.flowerGame.stage,'error');
  now=flowerDeadline(room.room.flowerGame);frame(a);assert.equal(room.room.flowerGame.round,1);
  const beforeNormalRoom=a.messages.filter(m=>m.type==='room').length;
  for(let round=1;round<=10;round++){
   now=flowerDeadline(room.room.flowerGame);frame(a);assert.equal(room.room.flowerGame.stage,'repeat');
   for(let i=0;i<round;i++){
    const s=i%2?b:a,index=FLOWER_MELODIES[room.room.flowerGame.melody].notes[i];putNear(s,index);now+=250;frame(s,[{type:'flower-note',index}]);
   }
   if(round<10){assert.equal(room.room.flowerGame.stage,'echo');now=flowerDeadline(room.room.flowerGame);frame(a);assert.equal(room.room.flowerGame.round,round+1);}
  }
  assert.equal(room.room.flowerGame.stage,'celebrate');for(const s of [a,b]){assert.equal(achievementPoints(s.data.actor.achievements),6);assert.equal(s.messages.filter(m=>m.type==='flower-complete').length,1);}
  assert.equal(a.messages.filter(m=>m.type==='room').length,beforeNormalRoom,'notes never rebroadcast the whole world');
  assert(a.messages.filter(m=>m.type==='flower-game').every(m=>JSON.stringify(m).length<1100&&!m.game?.world));
  // Normal client snapshots cannot erase or forge the server-owned achievement.
  const snapshot=structuredClone(a.data.actor);snapshot.achievements=[];frame(a,[],snapshot);assert(a.data.actor.achievements.includes('flowers'));
  now=flowerDeadline(room.room.flowerGame);frame(a);assert.equal(room.room.flowerGame,undefined);
  a.data.actor.p=[SITE.x,0,SITE.z+2];now+=250;frame(a,[{type:'flower-start'}]);now=flowerDeadline(room.room.flowerGame);frame(a);
  // A departed last participant starts one alarm and a return cancels the countdown.
  a.data.actor.p=[200,0,200];frame(a);assert.equal(room.room.flowerGame.emptySince,now);assert(alarms.includes(now+FLOWER_EMPTY_MS));
  now+=9000;a.data.actor.p=[SITE.x,0,SITE.z];frame(a);assert.equal(room.room.flowerGame.emptySince,undefined);
  a.data.actor.p=[200,0,200];now+=100;frame(a);now+=FLOWER_EMPTY_MS;frame(a);assert.equal(room.room.flowerGame,undefined);
  const fresh=structuredClone(b.data.actor);fresh.achievements=['flowers'];b.data.actor.achievements=[];frame(b,[],fresh);assert(!b.data.actor.achievements.includes('flowers'),'unearned flower award rejected');
 }finally{Date.now=original;Math.random=originalRandom;(globalThis as any).WebSocketRequestResponsePair=saved;}
});
