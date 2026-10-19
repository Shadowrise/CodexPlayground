import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {roomSql} from './room-sql';
import {BUILD,type ActorState} from '../src/network-protocol';
import {chooseShieldCrystal,crystalPoint,SHIELD} from '../src/meta-knight-shield';
import {META_KNIGHT_ARENA as ARENA,META_KNIGHT_ANNEX,knightAnnexCoordinates} from '../src/meta-knight-arena-site';

test('actual Worker validates duel attacks, owns victory and respect chat, persists the encounter, and refuses client supplied health',async()=>{
 const source=(await readFile(new URL('../../game-server/src/index.ts',import.meta.url),'utf8'))
  .replace("import { DurableObject } from 'cloudflare:workers';",'class DurableObject {constructor(public ctx:any,public env:any){}}')
  .replaceAll('../../kirby-game/src/',new URL('../src/',import.meta.url).href).replaceAll("from './","from '"+new URL('../../game-server/src/',import.meta.url).href)
  .replace(/(from ['"]file:[^'"]+)(['"])/g,'$1.ts$2').replaceAll('new Response(null,{status:101,webSocket:client})','({status:101,webSocket:client})');
 const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 const globals=globalThis as any,oldPair=globals.WebSocketPair,oldResponse=globals.WebSocketRequestResponsePair,oldNow=Date.now;let now=100000;Date.now=()=>now;
 class Socket{readyState=1;data:any;messages:any[]=[];deserializeAttachment(){return structuredClone(this.data);}serializeAttachment(data:any){this.data=structuredClone(data);}send(v:string){this.messages.push(JSON.parse(v));}close(){this.readyState=3;}}
 let lastServer:Socket;globals.WebSocketPair=class{0=new Socket();1=lastServer=new Socket();};globals.WebSocketRequestResponsePair=class{};
 const sockets:Socket[]=[],storage=new Map<string,unknown>(),sql=roomSql(),waits:Promise<unknown>[]=[];
 const ctx={waitUntil(p:Promise<unknown>){waits.push(p);},blockConcurrencyWhile:(fn:()=>unknown)=>fn(),getWebSockets:()=>sockets,getWebSocketAutoResponseTimestamp:()=>new Date(now),acceptWebSocket:(s:Socket)=>sockets.push(s),setWebSocketAutoResponse(){},storage:{sql,async get(k:string){return structuredClone(storage.get(k));},async put(k:string,v:unknown){storage.set(k,structuredClone(v));},async delete(k:string){storage.delete(k);},async setAlarm(){},async deleteAlarm(){},async deleteAll(){storage.clear();sql.clear();}}};
 try{
  const {GameRoom}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));let room=new GameRoom(ctx,{});
  const join=async(name:string,variant:number)=>{await room.fetch(new Request(`https://test/ws?build=${BUILD}&variant=${variant}&name=${encodeURIComponent(name)}`,{headers:{Upgrade:'websocket'}}));return lastServer!;};
  const a=await join('Рыцарь',0),b=await join('Сосед',1),c=await join('На площадке',2),aid=a.data.id;
  const actor=(p=[2000,0,-2]):ActorState=>({location:'meta-knight-arena',p,q:[0,1,0,0],s:1,state:'Idle',pose:[],fruits:0,achievements:[],name:'FORGED NAME',variant:0,star:0});
  const send=(s:Socket,p:ActorState,events:any[]=[],extra={})=>{now+=200;room.webSocketMessage(s,JSON.stringify({type:'frame',actor:p,events,...extra}));};
  const portal=[ARENA.x+ARENA.exitX,0,ARENA.exitZ];send(c,actor(portal));
  send(b,actor([2041,0,0]));send(a,actor(),[{type:'knight',action:'start'}]);assert.equal(room.room.knightBattle.hp,12);
  assert(room.room.knightBattle.players[b.data.id],'a player at the arena edge joins');assert(!room.room.knightBattle.players[c.data.id],'the portal landing is excluded');
  send(c,actor(),[{type:'knight',action:'attack'}]);assert(knightAnnexCoordinates(c.data.actor.p[0]-ARENA.x,c.data.actor.p[2]).along>=META_KNIGHT_ANNEX.gate+1,'Worker blocks entry from the annex');assert.equal(room.room.knightBattle.hp,12);
  const late=await join('Позже',3);send(late,actor());assert(!room.room.knightBattle.players[late.data.id]);assert(knightAnnexCoordinates(late.data.actor.p[0]-ARENA.x,late.data.actor.p[2]).along>=META_KNIGHT_ANNEX.gate+1,'late arrivals also remain outside');
  send(c,actor(portal));assert.deepEqual(c.data.actor.p,portal,'the working portal remains accessible to nonparticipants');
  send(b,actor(portal));assert(Math.hypot(b.data.actor.p[0]-ARENA.x,b.data.actor.p[2])<=41+1e-8,'Worker blocks escape from the arena');
  send(a,actor(),[{type:'knight',action:'win',hp:0}],{knightBattle:{stage:'won',hp:0}});assert.equal(room.room.knightBattle.hp,12);assert(!a.messages.some(m=>m.type==='knight-victory'));
  send(b,actor([2025,0,20]),[{type:'knight',action:'cancel'}]);assert(room.room.knightBattle.players[b.data.id].withdrawn);assert.notEqual(room.room.knightBattle.stage,'cancelled');assert.equal(b.data.actor.location,'meta-knight-arena');
  for(let i=0;i<7;i++){
   const s=room.room.knightBattle;Object.assign(s,{stage:'open',since:now,until:now+2500,checked:now,from:[0,0,0],to:[0,0,0],openHit:false});
   const height=[0,1.45,2.2,2.9,2.9,1.45,0][i],attacker=actor([2000,height,2]);attacker.state=height===2.9?'Fly':height?'Jump':'Idle';
   now+=800;send(a,attacker,[{type:'knight',action:'attack'}]);send(a,attacker);
   assert.equal(room.room.knightBattle.hp,11-i,`Worker accepts a reachable ${attacker.state} attack at height ${height}`);
   assert.equal(room.room.knightBattle.stage,'stunned');
   if(i===3){await Promise.all(waits);room=new GameRoom(ctx,{});await new Promise(r=>setTimeout(r,0));assert.equal(room.room.knightBattle.hp,8,'Worker wakeup restores shared progress');assert.equal(room.room.knightBattle.stage,'stunned','the post-hit reaction survives wakeup');}
   now=room.room.knightBattle.until;send(a,actor([2000,0,2]));assert.equal(room.room.knightBattle.stage,'get-up');now=room.room.knightBattle.until;send(a,actor([2000,0,2]));
  }
  const returning=room.room.knightBattle;Object.assign(returning,{stage:'return',pattern:'crescent',step:5,since:now,until:now+450,checked:now,from:[0,1.2,0],to:[0,0,0],returnFrom:[0,1.2,20]});returning.players[aid].reflects=1;
  send(a,actor());send(a,actor());assert.equal(room.room.knightBattle.hp,5,'no damage before the returned crescent arrives');send(a,actor());assert.equal(room.room.knightBattle.hp,4);assert.equal(room.room.knightBattle.stage,'stunned');assert.equal(room.room.knightBattle.phase,2);
  await Promise.all(waits);room=new GameRoom(ctx,{});await new Promise(r=>setTimeout(r,0));assert.equal(room.room.knightBattle.stage,'stunned','reflected-hit stars survive Worker wakeup');now=room.room.knightBattle.until;send(a,actor());assert.equal(room.room.knightBattle.stage,'get-up');now=room.room.knightBattle.until;send(a,actor());assert.equal(room.room.knightBattle.phase,3);
  room.room.knightBattle.players[aid].invulnerable=now+100000;
  while(room.room.knightBattle.stage!=='ricochet-warn'){now=room.room.knightBattle.until;send(a,actor([2037,0,12]));}
  const lockedAims=structuredClone(room.room.knightBattle.starAims),lockedRoute=structuredClone(room.room.knightBattle.starRoute);assert.deepEqual(lockedAims[0],[37,0,12]);
  await Promise.all(waits);room=new GameRoom(ctx,{});await new Promise(r=>setTimeout(r,0));assert.deepEqual(room.room.knightBattle.starAims,lockedAims,'Worker wakeup keeps the locked bend');assert.deepEqual(room.room.knightBattle.starRoute,lockedRoute);
  send(a,actor([1975,0,-20]));assert.deepEqual(room.room.knightBattle.starAims,lockedAims,'network movement cannot drag an already displayed flight lane');
  for(let i=0;i<4;i++){
   const s=room.room.knightBattle;Object.assign(s,{pattern:'star',stage:'shield',cycle:i+1,step:13,since:now,until:now+1e12,checked:now,from:[0,0,0],to:[0,0,0],openHit:false});s.activeCrystal=chooseShieldCrystal(s);const index=s.activeCrystal;
   // This authority/credit fixture teleports across waves; wave damage is tested separately.
   s.players[aid].invulnerable=now+10000;
   send(a,actor([2000,0,1]),[{type:'knight',action:'attack'}]);assert(Math.hypot(a.data.actor.p[0]-2000,a.data.actor.p[2])>=SHIELD.radius+.64,'Worker enforces the solid dome');assert.equal(s.hp,4-i,'the shield rejects a boss hit');
   const p=crystalPoint(index),point=[2000+p[0]*.94,0,p[2]*.94],yaw=Math.atan2(p[0],p[2]),c=actor(point);c.q=[0,Math.sin(yaw/2),0,Math.cos(yaw/2)];
   // Move around the shield before attacking, preserving the server sweep check.
   const current=a.data.actor.p,begin=Math.atan2(current[0]-2000,current[2]),end=Math.atan2(p[0],p[2]),turn=Math.atan2(Math.sin(end-begin),Math.cos(end-begin));
   for(let j=0;j<=8;j++){const angle=begin+turn*j/8;send(a,actor([2000+Math.sin(angle)*38,0,Math.cos(angle)*38]));}
   now+=800;send(a,c,[{type:'knight',action:'attack'}]);send(a,c);
   assert.equal(s.hp,3-i);assert(s.brokenCrystals&(1<<index));
   assert.equal(s.stage,'crystal-break');
   if(i===1){await Promise.all(waits);const mask=s.brokenCrystals;room=new GameRoom(ctx,{});await new Promise(r=>setTimeout(r,0));assert.equal(room.room.knightBattle.brokenCrystals,mask,'destroyed crystals survive Worker wakeup');}
   now=room.room.knightBattle.until;send(a,c);if(i<3){assert.equal(room.room.knightBattle.stage,'get-up');now=room.room.knightBattle.until;send(a,c);}
  }
  assert.equal(room.room.knightBattle.stage,'won');assert.equal(room.room.knightBattle.players[aid].hits,11);assert.equal(room.room.knightBattle.players[aid].reflects,1);
  assert.equal(a.messages.filter(m=>m.type==='knight-victory').length,1);assert.equal(b.messages.filter(m=>m.type==='knight-victory').length,0);
  assert(a.messages.some(m=>m.type==='log'&&m.entry.text==='Метакнайт с уважением смотрит на Рыцарь.'&&m.entry.name===''));
  assert(b.messages.some(m=>m.type==='log'&&m.entry.text==='Метакнайт с уважением смотрит на Рыцарь.'));
  send(a,actor());assert.equal(a.messages.filter(m=>m.type==='knight-victory').length,1);
  assert(!a.data.room?.knightBattle,'large encounter is stored outside socket attachments');
  send(a,actor(),[{type:'knight',action:'start'}]);send(a,actor(),[{type:'knight',action:'cancel'}]);send(b,actor([2025,0,20]),[{type:'knight',action:'cancel'}]);assert.equal(room.room.knightBattle.stage,'cancelled');assert.equal(a.data.actor.location,'meta-knight-arena');assert.equal(a.messages.filter(m=>m.type==='knight-victory').length,1);
 }finally{Date.now=oldNow;globals.WebSocketPair=oldPair;globals.WebSocketRequestResponsePair=oldResponse;sql.close();}
});
