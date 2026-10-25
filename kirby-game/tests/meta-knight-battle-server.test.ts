import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {roomSql} from './room-sql';
import {BUILD,type ActorState} from '../src/network-protocol';
import {chooseShieldCrystal,crystalPoint,SHIELD} from '../src/meta-knight-shield';
import {META_KNIGHT_ARENA as ARENA,META_KNIGHT_ANNEX,knightAnnexCoordinates} from '../src/meta-knight-arena-site';
import {COSMIC_SPIN,cosmicOrbs} from '../src/meta-knight-cosmic-spin';
import {setKnightPhase} from '../src/meta-knight-battle';
import {meteorPath} from '../src/meta-knight-cosmic-meteor';
import {refugeStar} from '../src/meta-knight-cosmic-refuge';

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
  // Landing vulnerability and the independent wave survive authoritative persistence.
  const beforeWave=structuredClone(room.room.knightBattle),landing=now+200;
  Object.assign(room.room.knightBattle,{phase:2,hp:8,pattern:'dive',stage:'dive',step:1,since:landing-450,until:landing,checked:now,from:[0,0,-9],to:[0,0,0]});
  send(a,actor([2000,1.2,3]));assert.equal(room.room.knightBattle.stage,'open');assert.equal(room.room.knightBattle.impactWave.at,landing);
  send(a,actor([2000,1.2,3]),[{type:'knight',action:'attack'}]);send(a,actor([2000,1.2,3]));assert.equal(room.room.knightBattle.hp,7);assert.equal(room.room.knightBattle.stage,'stunned');
  const persistedWave=structuredClone(room.room.knightBattle.impactWave);await Promise.all(waits);room=new GameRoom(ctx,{});await new Promise(r=>setTimeout(r,0));
  assert.equal(room.room.knightBattle.stage,'stunned');assert.deepEqual(room.room.knightBattle.impactWave,persistedWave,'Worker wakeup retains the ring while the boss reacts to a hit');room.room.knightBattle=beforeWave;
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
  assert.equal(room.room.knightBattle.phase,4);assert.equal(room.room.knightBattle.hp,6);assert.equal(room.room.knightBattle.stage,'transition');assert.equal(a.messages.filter(m=>m.type==='knight-victory').length,0,'the old finale must not award victory before phase four');
  await Promise.all(waits);room=new GameRoom(ctx,{});await new Promise(r=>setTimeout(r,0));assert.equal(room.room.knightBattle.phase,4,'cosmic phase persists across Worker wakeup');
  delete room.room.knightBattle.players[b.data.id].withdrawn;send(b,actor([1975,0,12]));
  const start=room.room.knightBattle.since;now=start+5200;send(a,actor([2007,0,8]));assert.equal(room.room.knightBattle.stage,'cosmic-surge');assert.deepEqual(room.room.knightBattle.cosmicLaunch.players[aid].from,[7,0,8]);assert.deepEqual(room.room.knightBattle.cosmicLaunch.players[b.data.id].from,[-25,0,12]);
  const launch=structuredClone(room.room.knightBattle.cosmicLaunch);await Promise.all(waits);room=new GameRoom(ctx,{});await new Promise(r=>setTimeout(r,0));assert.deepEqual(room.room.knightBattle.cosmicLaunch,launch,'the electrical launch survives Worker wakeup');
  now=start+6900;send(a,actor([2000,99,0]));assert(Math.abs(Math.hypot(a.data.actor.p[0]-2000,a.data.actor.p[2])-41)<1e-6,'forged movement cannot cancel the outward electrical recoil');assert.equal(a.data.actor.p[1],0,'players reach the rim before they gain altitude');
  assert(Math.abs(Math.hypot(b.data.actor.p[0]-2000,b.data.actor.p[2])-41)<1e-6,'the electrical recoil also moves the other participant without a new packet');
  now=start+15000;send(a,actor());assert.equal(room.room.knightBattle.stage,'cosmic-flight');send(a,actor([2009,-99,9]));assert.equal(a.data.actor.p[1],180,'the authority fixes participating players to the common flight plane');
  send(c,actor(portal));assert.equal(c.data.actor.p[1],0,'spectators stay on the real arena landing');assert.equal(a.messages.filter(m=>m.type==='knight-victory').length,0);
  now=room.room.knightBattle.until;send(a,actor([2041,180,0]));assert.equal(room.room.knightBattle.stage,'cosmic-spin-warn');now=room.room.knightBattle.until;send(a,actor([2041,180,0]));assert.equal(room.room.knightBattle.stage,'cosmic-spin');
  const spin=structuredClone(room.room.knightBattle.cosmicSpin);await Promise.all(waits);room=new GameRoom(ctx,{});await new Promise(r=>setTimeout(r,0));assert.deepEqual(room.room.knightBattle.cosmicSpin,spin,'the exact spin and projectile clock survive Worker wakeup');
  const contactAt=spin.at+1700,orb=cosmicOrbs(room.room.knightBattle,contactAt).find(o=>o.distance>25)!;now=contactAt-200;
  const beforeContact=room.room.knightBattle.teamHp;room.room.knightBattle.players[aid].invulnerable=0;send(a,actor([2000+orb.p[0],-99,orb.p[2]]));assert.equal(room.room.knightBattle.teamHp,beforeContact-1,'a swept electric ball damages authoritative shared health despite forged altitude');
  // Exercise the new curved attack in the actual Worker, then restore this finale fixture.
  const beforeMeteors=structuredClone(room.room.knightBattle),priorReflects=beforeMeteors.players[aid].reflects;
  setKnightPhase(room.room.knightBattle,4,[{id:aid,p:[0,180,35],yaw:Math.PI,available:true}],now,2);
  now+=400;send(a,actor([2000.4,-99,35]));assert.equal(a.data.actor.p[1],180);
  const savedMeteor=structuredClone(room.room.knightBattle.cosmicMeteor);await Promise.all(waits);room=new GameRoom(ctx,{});await new Promise(r=>setTimeout(r,0));assert.deepEqual(room.room.knightBattle.cosmicMeteor,savedMeteor,'the curved meteor, aim, target and release clock survive Worker wakeup');
  now=room.room.knightBattle.until-200;send(a,actor([2000,180,35]));assert.equal(room.room.knightBattle.stage,'cosmic-meteor-cast');
  now=room.room.knightBattle.cosmicMeteor.at-200;send(a,actor([2000.6,180,35]));send(a,actor([2001.2,180,35]));
  assert(room.room.knightBattle.cosmicMeteor.guidance?.length,'the actual Worker steers only the early part of the flight');
  const savedGuidance=structuredClone(room.room.knightBattle.cosmicMeteor);await Promise.all(waits);room=new GameRoom(ctx,{});await new Promise(r=>setTimeout(r,0));assert.deepEqual(room.room.knightBattle.cosmicMeteor,savedGuidance,'guidance history and measured velocity survive Worker wakeup');
  const meteor=room.room.knightBattle.cosmicMeteor,path=meteorPath(meteor),arrival=meteor.at+path.hitMs,defender=actor([2000+path.end[0],180,path.end[2]]);now=arrival-350;send(a,defender,[{type:'knight',action:'attack'}]);send(a,defender);
  assert.equal(room.room.knightBattle.stage,'cosmic-meteor-return');assert.equal(room.room.knightBattle.hp,6);assert.equal(room.room.knightBattle.players[aid].reflects,priorReflects+1);
  now=room.room.knightBattle.until-200;send(a,actor([2000,180,35]));assert.equal(room.room.knightBattle.hp,5);assert.equal(room.room.knightBattle.stage,'cosmic-hit');room.room.knightBattle=structuredClone(beforeMeteors);
  const priorHits=beforeMeteors.players[aid].hits;
  setKnightPhase(room.room.knightBattle,4,[{id:aid,p:[0,180,35],yaw:Math.PI,available:true}],now,3);
  now=room.room.knightBattle.until-200;send(a,actor([2000,180,35]));assert.equal(room.room.knightBattle.stage,'cosmic-star-open');
  const star=refugeStar(room.room.knightBattle,now+200),starAttacker=actor([2000+star[0],-99,star[2]-3]);starAttacker.q=[0,0,0,1];send(a,starAttacker);send(a,starAttacker);
  assert.equal(a.data.actor.p[1],180);assert.equal(room.room.knightBattle.cosmicRefuge.activatedAt,room.room.knightBattle.since,'the authority activates the star on arrival without an attack');assert.equal(room.room.knightBattle.cosmicRefuge.activator,undefined);
  const savedRefuge=structuredClone(room.room.knightBattle.cosmicRefuge);await Promise.all(waits);room=new GameRoom(ctx,{});await new Promise(r=>setTimeout(r,0));assert.deepEqual(room.room.knightBattle.cosmicRefuge,savedRefuge,'the moving shared refuge survives Worker wakeup');
  for(const player of Object.values(room.room.knightBattle.players) as any[])player.invulnerable=now+100000;
  while(room.room.knightBattle.stage!=='cosmic-star-retreat'){const point=refugeStar(room.room.knightBattle,room.room.knightBattle.until);starAttacker.p=[2000+point[0],180,point[2]];now=room.room.knightBattle.until-200;send(a,starAttacker);}
  assert.equal(room.room.knightBattle.hp,5);assert.equal(room.room.knightBattle.players[aid].hits,priorHits+1,'only the returned star awards the sheltered player a hit');
  const shifted=structuredClone(beforeMeteors),offset=now-shifted.checked;shifted.since+=offset;shifted.until+=offset;shifted.checked=now;if(shifted.cosmicSpin)shifted.cosmicSpin.at+=offset;if(shifted.cosmicLaunch)shifted.cosmicLaunch.at+=offset;room.room.knightBattle=shifted;
  for(let hit=0;hit<6;hit++){
   const s=room.room.knightBattle;for(const p of Object.values(s.players) as any[])p.invulnerable=now+100000;
   while(room.room.knightBattle.stage!=='cosmic-open'){now=room.room.knightBattle.until;send(a,actor([2041,180,0]));}
   const at=room.room.knightBattle.since+3500;now=at-200;const attacker=actor([2000,180,4]);attacker.q=[0,1,0,0];send(a,attacker,[{type:'knight',action:'attack'}]);send(a,attacker);
   assert.equal(room.room.knightBattle.hp,5-hit);assert.equal(room.room.knightBattle.stage,hit===5?'cosmic-descent':'cosmic-hit');assert.equal(a.data.actor.p[1],180);
   assert.equal(a.messages.filter(m=>m.type==='knight-victory').length,0,'no reward until the actual landing');
   // Isolate the six melee openings: the automatic star counter has its own persisted branch above.
   if(hit<5){const hp=room.room.knightBattle.hp;now+=1000;setKnightPhase(room.room.knightBattle,4,[{id:aid,p:[0,180,41],yaw:Math.PI,available:true}],now,1);room.room.knightBattle.hp=hp;}
  }
  now=room.room.knightBattle.until-1600;send(a,actor([2000,180,4]));assert(a.data.actor.p[1]>0&&a.data.actor.p[1]<180);assert(Math.hypot(a.data.actor.p[0]-2000,a.data.actor.p[2])<5,'descent never replays the original recoil');
  const savedFall=structuredClone(room.room.knightBattle.cosmicFall);assert(savedFall);await Promise.all(waits);room=new GameRoom(ctx,{});await new Promise(r=>setTimeout(r,0));assert.deepEqual(room.room.knightBattle.cosmicFall,savedFall,'the fall clock and fixed facing survive Worker wakeup');
  now=room.room.knightBattle.until-500;send(a,actor([2000,180,4]));assert.equal(a.data.actor.p[1],0,'the real floor is reached during the landing recovery');assert.equal(b.data.actor.p[1],0,'other players land on the same authoritative clock');assert.equal(room.room.knightBattle.stage,'cosmic-descent');assert.equal(a.messages.filter(m=>m.type==='knight-victory').length,0);
  now=room.room.knightBattle.until;send(a,actor([2000,0,4]));assert.equal(room.room.knightBattle.stage,'won');assert.equal(room.room.knightBattle.players[aid].hits,17);assert.equal(room.room.knightBattle.players[aid].reflects,1);
  assert.equal(a.messages.filter(m=>m.type==='knight-victory').length,1);assert.equal(b.messages.filter(m=>m.type==='knight-victory').length,0);
  assert(a.messages.some(m=>m.type==='log'&&m.entry.text==='Метакнайт с уважением смотрит на Рыцарь.'&&m.entry.name===''));
  assert(b.messages.some(m=>m.type==='log'&&m.entry.text==='Метакнайт с уважением смотрит на Рыцарь.'));
  send(a,actor());assert.equal(a.messages.filter(m=>m.type==='knight-victory').length,1);
  assert(!a.data.room?.knightBattle,'large encounter is stored outside socket attachments');
  send(a,actor(),[{type:'knight',action:'start'}]);send(a,actor(),[{type:'knight',action:'cancel'}]);send(b,actor([2025,0,20]),[{type:'knight',action:'cancel'}]);assert.equal(room.room.knightBattle.stage,'cancelled');assert.equal(a.data.actor.location,'meta-knight-arena');assert.equal(a.messages.filter(m=>m.type==='knight-victory').length,1);
  // The actual authority owns the team's five lives across frames and wakeups.
  send(a,actor(),[{type:'knight',action:'start'}]);assert.equal(room.room.knightBattle.teamHp,5);
  Object.assign(room.room.knightBattle,{stage:'slash',pattern:'sword',since:now,until:now+100000,checked:now,from:[0,0,0],to:[0,0,0],yaw:0});
  send(b,actor([2000,0,8]));assert.equal(room.room.knightBattle.teamHp,4);
  assert.equal(room.room.knightBattle.players[aid].hp,4);assert.equal(room.room.knightBattle.players[aid].invulnerable,0);
  send(a,actor(),[],{knightBattle:{teamHp:5,players:{[aid]:{hp:5}}}});assert.equal(room.room.knightBattle.teamHp,4,'client health cannot refill the bank');
  send(b,actor([2025,0,20]),[{type:'knight',action:'cancel'}]);assert.equal(room.room.knightBattle.teamHp,4);
  await Promise.all(waits);room=new GameRoom(ctx,{});await new Promise(r=>setTimeout(r,0));assert.equal(room.room.knightBattle.teamHp,4);
  for(const p of [[2020,0,-20],[2020,0,20],[2008,0,12]])send(a,actor(p));
  for(let i=0;i<4;i++){now+=1300;send(a,actor([2000,0,8]));assert.equal(room.room.knightBattle.teamHp,3-i);}
  assert.equal(room.room.knightBattle.stage,'lost');assert(Object.values(room.room.knightBattle.players).every((p:any)=>p.hp===0));
  send(a,actor(),[{type:'knight',action:'start'}]);assert.equal(room.room.knightBattle.teamHp,5);
 }finally{Date.now=oldNow;globals.WebSocketPair=oldPair;globals.WebSocketRequestResponsePair=oldResponse;sql.close();}
});
