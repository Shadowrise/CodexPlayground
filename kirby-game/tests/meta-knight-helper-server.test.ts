import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {roomSql} from './room-sql';
import {BUILD,type ActorState} from '../src/network-protocol';
import {KIRBY_VARIANTS} from '../src/variant-palette';
import {setKnightPhase} from '../src/meta-knight-battle';
import {knightCosmicAlly} from '../src/meta-knight-cosmic-ally';
import {knightDefeatPose} from '../src/meta-knight-defeat';

test('actual Worker owns side selection, cast locks, persistence, independent hearts and rewards',async()=>{
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
  const hero=await join('Кирби',0),helper=await join('Рыцарь',KIRBY_VARIANTS.findIndex(v=>v[0]==='Meta Knight'));
  const actor=(x=2000,z=-2):ActorState=>({location:'meta-knight-arena',p:[x,0,z],q:[0,0,0,1],s:1,state:'Idle',pose:[],fruits:0,achievements:[],name:'spoof',variant:0,star:0});
  const send=(socket:Socket,p:ActorState,events:any[]=[])=>{now+=200;room.webSocketMessage(socket,JSON.stringify({type:'frame',actor:p,events}));};
  send(helper,actor(2012,0));send(hero,actor());assert.equal(room.room.knightBattle,undefined,'arrival does not open a side choice');send(hero,actor(),[{type:'knight',action:'start'}]);assert.equal(room.room.knightBattle.stage,'side-choice','starting the duel opens the choice before combat');
  const waitingId=helper.data.id,choiceUntil=room.room.knightBattle.choice.until;assert.equal(choiceUntil,now+15000);assert(hero.messages.some(m=>m.type==='room'&&m.room.knightBattle?.choice?.until===choiceUntil),'both clients receive the shared waiting deadline');
  await Promise.all(waits);room=new GameRoom(ctx,{});await new Promise(resolve=>setTimeout(resolve,0));assert.equal(room.room.knightBattle.choice.until,choiceUntil,'the deadline survives Worker hibernation');
  now=choiceUntil-1;await room.alarm();assert.equal(room.room.knightSides,undefined);now=choiceUntil;await room.alarm();assert.equal(room.room.knightSides[waitingId],'players','an idle room alarm chooses the player team at fifteen seconds');assert.equal(room.room.knightBattle.stage,'intro');
  send(hero,actor(),[{type:'knight',action:'start'}]);assert.equal(room.room.knightBattle.players[hero.data.id].hp,5);assert.equal(room.room.knightBattle.players[waitingId].side,undefined);room.room.knightBattle.stage='cancelled';

  send(hero,actor(),[{type:'knight',action:'start'}]);assert.equal(room.room.knightBattle.stage,'side-choice');send(hero,actor(),[{type:'knight',action:'side',side:'boss'}]);assert.equal(room.room.knightSides[waitingId],undefined,'Kirby cannot choose the boss team');
  send(helper,actor(2012,0),[{type:'knight',action:'side',side:'boss'}]);send(hero,actor(),[{type:'knight',action:'start'}]);
  await Promise.all(waits);room=new GameRoom(ctx,{});await new Promise(resolve=>setTimeout(resolve,0));assert.equal(room.room.knightBattle.stage,'intro','a wakeup immediately after confirming must not restore the old choice screen');
  const id=helper.data.id,s=room.room.knightBattle;assert.equal(s.players[id].side,'boss');assert.equal(s.players[id].hp,5);assert.equal(s.players[hero.data.id].hp,44);assert.equal(s.teamHp,44);
  now+=3500;send(hero,actor());Object.assign(s,{stage:'rest',until:now+1e9});
  const beforePush=[s.players[id].hp,s.players[hero.data.id].hp];send(hero,actor(2012,-2));send(helper,actor(2012,0));send(hero,actor(2012,-2),[{type:'hit'}]);assert(helper.messages.some(m=>m.type==='hit'&&m.target===id),'players can push the opposing playable Meta Knight');
  send(hero,actor(2012,2));send(helper,actor(2012,0),[{type:'hit'}]);assert(hero.messages.some(m=>m.type==='hit'&&m.target===hero.data.id),'the helper can push players in return');assert.deepEqual([s.players[id].hp,s.players[hero.data.id].hp],beforePush,'ordinary pushes do not consume hearts');

  send(helper,actor(2012,0),[{type:'knight',action:'ability',ability:2},{type:'knight',action:'ability',ability:3},{type:'knight',action:'side',side:'players'}]);
  assert.equal(s.players[id].helper.cast.ability,2);assert.equal(s.players[id].side,'boss');assert.equal(room.room.knightSides[id],'boss');
  send(helper,actor(2012,0),[{type:'knight',action:'ability',ability:4}]);assert.equal(s.duet.stage,'queued');assert.equal(s.players[id].helper.cooldowns[3],now+90000);
  const cooldowns=structuredClone(s.players[id].helper.cooldowns);send(helper,actor(2038,0));assert.equal(helper.data.actor.p[0],2012,'the server rejects movement during wind-up');
  await Promise.all(waits);room=new GameRoom(ctx,{});await new Promise(resolve=>setTimeout(resolve,0));assert.equal(room.room.knightSides[id],'boss');assert.equal(room.room.knightBattle.duet.stage,'queued');assert.deepEqual(room.room.knightBattle.players[id].helper.cooldowns,cooldowns);assert.equal(room.room.knightBattle.players[id].hp,5);
  const resumed=room.room.knightBattle;resumed.stage='open';resumed.until=now+1e9;resumed.from=resumed.to=[12,0,0];const hp=resumed.hp;
  send(helper,actor(2012,0),[{type:'knight',action:'attack'}]);now+=1000;send(hero,actor());assert.equal(resumed.hp,hp,'ordinary Q never damages the allied boss');
  now=Math.max(now,resumed.players[id].helper.cast.recoverUntil)+100;resumed.until=now+200;send(hero,actor(1980,0));assert.equal(resumed.stage,'duet-gather');
  let guard=0;while(resumed.stage!=='duet-recover'&&guard++<20){now=resumed.until-200;send(hero,actor(1980,0));}assert(guard<20);const until=resumed.until,bossHp=resumed.hp;
  send(hero,actor(1996.7,-3.7),[{type:'knight',action:'attack'}]);now+=150;send(hero,actor(1996.7,-3.7));assert.equal(resumed.hp,bossHp-1);assert.equal(resumed.stage,'duet-recover');assert.equal(resumed.until,until);
  now+=400;send(hero,actor(2003.3,-2),[{type:'knight',action:'attack'}]);send(hero,actor(2003.3,-2));assert.equal(resumed.players[id].hp,4);assert.equal(resumed.hp,bossHp-1);assert.equal(resumed.until,until);
  resumed.stage='won';resumed.players[id].hits=10;resumed.players[hero.data.id].hits=1;send(hero,actor());
  assert(!helper.messages.some(m=>m.type==='knight-victory'));assert(hero.messages.some(m=>m.type==='knight-victory'));
  // The same authoritative Worker supports a lone knight while the other player is on the meadow.
  now+=10000;send(hero,{...actor(),location:undefined});send(helper,actor(2000,-2),[{type:'knight',action:'start'}]);assert.equal(room.room.knightBattle.stage,'side-choice');
  send(helper,actor(2000,-2),[{type:'knight',action:'side',side:'boss'}]);
  const solo=room.room.knightBattle;assert.equal(solo.stage,'intro');assert.equal(Object.keys(solo.opponents).length,3);assert.equal(solo.players[id].side,'boss');assert(!solo.players[hero.data.id]);
  const variants=Object.values(solo.opponents).map((b:any)=>b.variant);assert.equal(new Set(variants).size,3);assert(!variants.includes(0),'the meadow player is excluded too');
  await Promise.all(waits);room=new GameRoom(ctx,{});await new Promise(resolve=>setTimeout(resolve,0));assert.deepEqual(room.room.knightBattle.opponents,solo.opponents);
  now+=3500;send(helper,actor(2000,-2));send(helper,actor(2000,-2),[{type:'knight',action:'ability',ability:1}]);assert.equal(room.room.knightBattle.players[id].helper.cast.ability,1);
  send(helper,actor(2000,-2),[{type:'knight',action:'cancel'}]);assert.equal(room.room.knightBattle.stage,'cancelled');
  send(helper,actor(2000,-2),[{type:'knight',action:'start'}]);assert.equal(room.room.knightBattle.stage,'side-choice','retry asks again');
  send(helper,actor(2000,-2),[{type:'knight',action:'side',side:'boss'}]);now+=3500;send(helper,actor(1988,0));
  const contact=room.room.knightBattle;Object.assign(contact,{stage:'rest',since:now,until:now+1000000,from:[25,0,20],to:[25,0,20]});
  const bots=Object.values(contact.opponents) as any[];bots.forEach((b,i)=>{b.p=i===0?[-9,0,0]:[10+i*7,0,-20];b.goal=[...b.p];b.thinkAt=now+100000;b.shoveReady=now+100000;});
  const facingRight={...actor(1988,0),q:[0,Math.SQRT1_2,0,Math.SQRT1_2]},health=Object.values(contact.players).map((p:any)=>p.hp);
  send(helper,facingRight,[{type:'hit'},{type:'hit'}]);assert.equal(contact.players[bots[0].id].bump.dx,1);assert.equal(bots.filter(b=>contact.players[b.id].bump).length,1,'Q chooses exactly one AI target');
  assert.deepEqual(Object.values(contact.players).map((p:any)=>p.hp),health,'an ordinary shove never changes hearts');
  now+=500;send(helper,facingRight);assert(bots[0].p[0]>-9,'the authoritative Worker advances the NPC roll');
  await Promise.all(waits);room=new GameRoom(ctx,{});await new Promise(resolve=>setTimeout(resolve,0));const restored=room.room.knightBattle;assert.deepEqual(restored.players[bots[0].id].bump,contact.players[bots[0].id].bump,'the roll survives a Worker wakeup');
  now+=3000;const counter=restored.opponents[bots[0].id];delete restored.players[counter.id].bump;counter.p=[-9,0,0];counter.goal=[...counter.p];counter.shove={at:now,release:now+300,target:id,yaw:-Math.PI/2};counter.shoveReady=now+6500;
  send(helper,facingRight);assert.equal(restored.players[id].bump,undefined,'the NPC windup does not push early');send(helper,facingRight);assert(restored.players[id].bump,'the NPC can push the playable knight after its windup');assert.equal(restored.players[id].hp,5);
  assert(helper.messages.some(m=>m.type==='room'&&m.room.knightBattle?.players[id]?.bump),'the client receives the counterpush in the shared battle state');
  send(helper,actor(2000,-2),[{type:'knight',action:'side',side:'boss'}]);const planet=room.room.knightBattle;
  assert(setKnightPhase(planet,4,[...room.knightActors(),...Object.values(planet.opponents)] as any,now,3));const gathering=structuredClone(planet.players[id].helper.planet);
  send(helper,actor(2038,8));let expected=knightCosmicAlly(planet,id,now)!;assert.deepEqual(helper.data.actor.p,[2000+expected.p[0],expected.p[1],expected.p[2]],'the Worker owns the planetary gathering, including a forged movement packet');
  await Promise.all(waits);room=new GameRoom(ctx,{});await new Promise(resolve=>setTimeout(resolve,0));const persisted=room.room.knightBattle;assert.deepEqual(persisted.players[id].helper.planet,gathering,'planetary support survives hibernation without restarting');
  now=gathering.arrival+50;send(helper,actor(2038,8),[{type:'knight',action:'ability',ability:1},{type:'knight',action:'ability',ability:4}]);expected=knightCosmicAlly(persisted,id,now)!;assert(expected&&!expected.gather);assert.equal(persisted.players[id].helper.cast,undefined);assert.equal(persisted.duet.stage,'queued','slot four reserves the next subphase while the helper conducts');assert.deepEqual(helper.data.actor.p,[2000+expected.p[0],180,expected.p[2]]);
  Object.assign(persisted,{stage:'cosmic-star-stun',hp:0,until:now+100,checked:now});send(helper,actor(2038,8));assert.equal(persisted.stage,'cosmic-descent');now+=3100;send(helper,actor(2038,8));assert.equal(persisted.stage,'won');const defeated=knightDefeatPose(persisted,id,now)!;assert.deepEqual(helper.data.actor.p,[2000+defeated.p[0],0,defeated.p[2]],'the defeated helper remains beside the main boss on the authoritative arena floor');
  send(helper,actor(2024,0),[{type:'knight',action:'cancel'}]);send(helper,actor(2024,0));assert(persisted.players[id].withdrawn);assert.equal(helper.data.actor.p[0],2024,'leaving the finished duel releases the final formation');
 }finally{Date.now=oldNow;globals.WebSocketPair=oldPair;globals.WebSocketRequestResponsePair=oldResponse;}
});
