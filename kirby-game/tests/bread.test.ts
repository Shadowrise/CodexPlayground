import {roomSql} from './room-sql';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {BUILD} from '../src/network-protocol';
import {parseSave} from '../src/save-game';
import {KIRBY_VARIANTS} from '../src/variant-palette';
import {Mesh,Points,Group} from 'three';
import {BreadWorld} from '../src/bread';
import {softMistMaterial} from '../src/soft-mist';
import {canFeedPidgie} from '../src/bread-state';
import {pidgieFixture} from './pidgie-fixture';
import {achievementPoints} from '../src/score';
import {applyBread,advanceBread,breadFloor,breadPosition,canPickBread,newBread,grantBread,holdsBread,normalizeBread,breadLoaves,validBread,BREAD_SPAWN,type BreadActor} from '../src/bread-state';
import {MOUNTAIN_STEPS,MOUNTAIN_SUMMIT,MOUNTAIN_SEAL_NICHE,mountainWorld} from '../src/mountain-ledges-layout';
const freshBread=()=>({...newBread(),active:true});
const actor=(id='solo',p:readonly number[]=BREAD_SPAWN):BreadActor=>({id,p:[...p],yaw:0,size:1,available:true});

test('feeding requires carried bread, a nearby grounded bird and a facing player; the throw lands midway and cannot be reclaimed',()=>{
 const a=actor('solo',[0,0,0]),b={...freshBread(),owner:'solo'},bird={phase:'follow',p:[0,0,4]};
 assert(canFeedPidgie(b,a,bird));assert(!canFeedPidgie(b,{...a,yaw:Math.PI},bird));
 assert(!canFeedPidgie(freshBread(),a,bird));assert(canFeedPidgie(b,a,{...bird,p:[0,0,8.4]}));assert(!canFeedPidgie(b,a,{...bird,p:[0,0,10]}));assert(!canFeedPidgie(b,a,{...bird,phase:'fly'}));
 const offered=applyBread(b,{kind:'feed'},a,1000,undefined,bird);
 assert.deepEqual(offered.p,[0,0,2]);assert(offered.drop);assert.equal(offered.offering?.by,a.id);
 assert(breadPosition(offered,1200)[1]>0);assert(!canPickBread(offered,{...a,p:offered.p},100000));assert(validBread(offered));
 assert.equal(applyBread(offered,{kind:'feed'},a,100000,undefined,bird),offered);
});

test('golden aura shares the fruit mist shader and keeps all sparkles inside the fog volume',()=>{
 const world=new BreadWorld(),mist=world.aura.getObjectByName('Golden bread volume mist') as Mesh;
 assert.equal((mist.material as any).customProgramCacheKey(),softMistMaterial('#fff',.3).customProgramCacheKey());
 assert.equal(world.aura.children.length,2);const points=world.aura.children.find(o=>o instanceof Points) as Points;
 const owner=new Group(),actors=new Map([['solo',owner]]);
 for(const held of [false,true])for(const now of [1000,14300,56700]){
  world.state.owner=held?'solo':'';world.update(now,actors);const p=points.geometry.getAttribute('position');
  for(let i=0;i<p.count;i++)assert(((p.getX(i)-mist.position.x)/mist.scale.x)**2+((p.getY(i)-mist.position.y)/mist.scale.y)**2+((p.getZ(i)-mist.position.z)/mist.scale.z)**2<1,'sparkles remain inside the mist while held and resting');
 }
});

test('only baked bread can be picked up by a nearby available character',()=>{
 const b=freshBread(),a=actor();assert(validBread(b));assert.equal(b.p[1],0);assert(!canPickBread(newBread(),a,1000));
 assert.equal(breadFloor(b.p[0],b.p[2],b.p[1]),b.p[1]);
 assert(canPickBread(b,a,1000));
 assert(!canPickBread(b,{...a,available:false},1000));
 assert(!canPickBread(b,{...a,p:[b.p[0],10,b.p[2]]},1000));
 assert(!canPickBread(b,{...a,p:[b.p[0]+5,b.p[1],b.p[2]]},1000));
 const held=applyBread(b,{kind:'pick'},a,1000);assert.equal(held.owner,'solo');
 assert.equal(applyBread(held,{kind:'pick'},actor('pigeon'),1000),held,'another character cannot duplicate the loaf');
 assert.equal(applyBread(held,{kind:'drop'},actor('pigeon'),1100),held,'only the carrier can drop it');
});

test('a loaf released on the permanent seal niche keeps its visible supporting floor',()=>{
 const niche=MOUNTAIN_SEAL_NICHE,p=mountainWorld(niche.tangent,niche.radial-.35);
 assert.equal(breadFloor(p.x,p.z,niche.y),niche.y);
 const loaf={...freshBread(),p:[p.x,niche.y,p.z] as [number,number,number]};
 assert.equal(advanceBread(loaf,10000),loaf,'the new niche is a real floor for shared loose items');
});

test('a drop falls forward, rests on the ground, and can be picked up again without snapping back',()=>{
 for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2]){
  const a={...actor(),p:[0,0,0],yaw},held={...freshBread(),owner:a.id};
  const drop=applyBread(held,{kind:'drop'},a,10000);
  assert.equal(drop.owner,'');assert(drop.drop);
  assert(Math.abs(drop.p[0]-Math.sin(yaw)*3.4)<1e-8);assert(Math.abs(drop.p[2]-Math.cos(yaw)*3.4)<1e-8);
  assert(breadPosition(drop,10200)[1]>0);assert(Math.abs(breadPosition(drop,20000)[1])<1e-8);
  assert.deepEqual(breadPosition(drop,20000),breadPosition(drop,50000),'the loaf stays at its landing place');
  assert(!canPickBread(drop,a,20000),'the carrier must approach the loaf again');
  const near={...a,p:drop.p};assert(!canPickBread(drop,near,drop.pickupAt-1));
  assert(canPickBread(drop,near,drop.pickupAt));assert.equal(applyBread(drop,{kind:'pick'},near,drop.pickupAt).owner,a.id);
 }
});

test('dropping on the high platform uses its height, while throwing off its edge falls to the lower surface',()=>{
 const top=mountainWorld(MOUNTAIN_SUMMIT.tangent,MOUNTAIN_SUMMIT.radial-.5),a={...actor('solo',[top.x,MOUNTAIN_SUMMIT.y,top.z]),yaw:-Math.PI*3/4},b={...freshBread(),owner:a.id};
 const onTop=applyBread(b,{kind:'drop'},a,1000);assert.equal(onTop.p[1],MOUNTAIN_SUMMIT.y);
 const edge=mountainWorld(MOUNTAIN_SUMMIT.tangent,MOUNTAIN_SUMMIT.radial-MOUNTAIN_SUMMIT.depth/2+.2);
 const off=applyBread(b,{kind:'drop'},{...a,p:[edge.x,MOUNTAIN_SUMMIT.y,edge.z]},1000);
 assert(off.p[1]<MOUNTAIN_SUMMIT.y);assert(off.drop!.duration>onTop.drop!.duration);
 assert(Math.abs(breadPosition(off,100000)[1]-off.p[1])<1e-8);
});

test('bread saves reject invalid positions and drop times',()=>{
 const b=freshBread();assert(validBread(JSON.parse(JSON.stringify(b))));
 assert(!validBread({...b,p:[0,NaN,0]}));assert(!validBread({...b,scale:0}));
 assert(!validBread({...b,drop:{from:[0,1,0],at:0,duration:0}}));assert(!validBread({...b,pickupAt:-1}));
 const actor=(variant:string)=>({variant,x:0,z:0,yaw:0,size:1,fruitsEaten:0});
 const save={version:1,savedAt:'2026-10-14',player:actor(KIRBY_VARIANTS[14][0]),npcs:KIRBY_VARIANTS.slice(0,14).map(v=>actor(v[0])),fruits:Array(70).fill(false)};
 assert.equal(parseSave(JSON.stringify(save)).bread,undefined,'older saves remain compatible');
 assert.equal(parseSave(JSON.stringify({...save,bread:{...b,owner:'solo'}})).bread?.owner,'solo');
 assert.throws(()=>parseSave(JSON.stringify({...save,bread:{...b,scale:0}})));
});

test('a loaf left on a disappearing step falls with the lost support',()=>{
 const p=MOUNTAIN_STEPS[0],xy=mountainWorld(p.tangent,p.radial),b={...freshBread(),p:[xy.x,p.y,xy.z] as [number,number,number]},steps=MOUNTAIN_STEPS.map(()=>[0,0,0]);
 assert.equal(advanceBread(b,1000,steps),b);steps[0]=[2,0,0];const falling=advanceBread(b,1000,steps);
 assert(falling.p[1]<p.y);assert.equal(falling.drop?.speed,0);assert(breadPosition(falling,1100)[1]<p.y);
 assert.deepEqual(breadPosition(falling,100000),falling.p);
});

test('the room arbitrates one loaf, permits fruit pickup while carrying it, blocks other interactions, and drops it when its carrier leaves',async()=>{
 const source=(await readFile(new URL('../../game-server/src/index.ts',import.meta.url),'utf8'))
  .replace("import { DurableObject } from 'cloudflare:workers';",'class DurableObject { constructor(public ctx:any,public env:any){} }')
  .replaceAll('../../kirby-game/src/',new URL('../src/',import.meta.url).href).replaceAll("from './","from '"+new URL('../../game-server/src/',import.meta.url).href)
  .replace(/(from ['"]file:[^'"]+)(['"])/g,'$1.ts$2')
  .replaceAll('new Response(null,{status:101,webSocket:client})','({status:101,webSocket:client})');
 const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 const globals=globalThis as any,oldPair=globals.WebSocketPair,oldResponse=globals.WebSocketRequestResponsePair,oldNow=Date.now;
 let now=100000;Date.now=()=>now;
 class Socket{
  readyState=1;data:any;messages:any[]=[];
  deserializeAttachment(){return structuredClone(this.data);}serializeAttachment(a:any){this.data=structuredClone(a);}
  send(value:string){this.messages.push(JSON.parse(value));}close(){this.readyState=3;}
 }
 let lastServer:Socket;const sockets:Socket[]=[],storage=new Map();
 globals.WebSocketPair=class {0=new Socket();1=lastServer=new Socket();};globals.WebSocketRequestResponsePair=class {};
 const ctx={waitUntil(){},blockConcurrencyWhile:(fn:()=>unknown)=>fn(),getWebSocketAutoResponseTimestamp:()=>new Date(now),getWebSockets:()=>sockets,acceptWebSocket:(s:Socket)=>sockets.push(s),setWebSocketAutoResponse(){},storage:{sql:roomSql(),async get(key:string){return structuredClone(storage.get(key));},async put(key:string,value:unknown){storage.set(key,structuredClone(value));},async delete(key:string){storage.delete(key);},async setAlarm(){},async deleteAlarm(){},async deleteAll(){storage.clear();}}};
 try{
  const {GameRoom}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64')),room=new GameRoom(ctx,{});
  const join=async(name:string,variant:number)=>{await room.fetch(new Request(`https://test/ws?build=${BUILD}&variant=${variant}&name=${name}`,{headers:{Upgrade:'websocket'}}));return lastServer!;};
  const first=await join('Baker',0),second=await join('Bird',1);
  const a={p:[...BREAD_SPAWN],q:[0,0,0,1],s:1,state:'Idle',pose:[],fruits:0,achievements:[],name:'Baker',variant:0,star:0};
  const send=(s:Socket,p:number[],events:unknown[])=>room.webSocketMessage(s,JSON.stringify({type:'frame',actor:{...a,p},events}));
  send(first,a.p,[{type:'bread',action:{kind:'pick'}},{type:'mill',action:{kind:'collect'}}]);assert.equal(room.room.bread.active,false);
  const {MILL_QUEST_LEVER,MILL_BRANCHES,MILL_BAGS,MILL_HOPPER,MILL_TABLE,MILL_OVEN,MILL_BAKE_MS}=await import('../src/mill-quest');
  const act=(p:readonly number[],action:unknown)=>{now+=1000;send(first,[...p],[{type:'mill',action}]);};
  act(MILL_QUEST_LEVER,{kind:'start'});
  for(const p of MILL_BRANCHES){now+=1000;send(first,[...p],[{type:'hit'}]);}
  act(MILL_QUEST_LEVER,{kind:'gate'});act(MILL_QUEST_LEVER,{kind:'gate'});now+=3100;send(first,[...MILL_QUEST_LEVER],[]);
  for(const index of room.room.millQuest.order){act(MILL_BAGS[index],{kind:'pick',index});act(MILL_HOPPER,{kind:'deliver'});}
  assert.equal(room.room.millQuest.stage,'knead');assert(!first.data.actor.achievements.includes('millQuest'));
  act(MILL_HOPPER,{kind:'flour'});act(MILL_TABLE,{kind:'mix'});for(let i=0;i<3;i++)act(MILL_TABLE,{kind:'knead'});
  act(MILL_OVEN,{kind:'load'});act(MILL_OVEN,{kind:'collect'});assert.equal(room.room.bread.active,false,'no early bread');
  now+=MILL_BAKE_MS;send(second,[...MILL_OVEN],[{type:'mill',action:{kind:'collect'}}]);assert.equal(room.room.bread.active,false,'another player cannot claim the bake');
  act(MILL_OVEN,{kind:'collect'});assert.equal(room.room.bread.owner,first.data.id);const rewarded=structuredClone(room.room.bread);
  act(MILL_OVEN,{kind:'collect'});assert.deepEqual(room.room.bread,rewarded,'duplicate collects do not produce more loaves');
  send(second,a.p,[{type:'bread',action:{kind:'pick'}}]);assert.equal(room.room.bread.owner,first.data.id);
  send(first,[49,0,40.5],[{type:'lock',key:'cart:0'},{type:'mill',action:{kind:'start'}},{type:'fruit',index:0},{type:'star'}]);
  assert.equal([...first.messages].reverse().find(m=>m.type==='lock').ok,false);assert.equal(room.room.millQuest.stage,'running');
  assert.equal(room.room.fruits[0],first.data.id);assert.equal(room.room.starAt,0);
  assert.equal(first.data.actor.fruits,1);assert.deepEqual(first.data.actor.fruitBoost,{stacks:1,remaining:20});
  assert.equal(room.room.bread.owner,first.data.id,'eating fruit keeps the loaf in the carrier’s hands');
  send(second,[49,0,40.5],[{type:'fruit',index:0}]);assert.equal(second.data.actor.fruits,0,'another player cannot collect the same fruit');
  send(first,[49,0,40.5],[{type:'fruit',index:0}]);assert.equal(first.data.actor.fruits,1);
  assert.deepEqual(first.data.actor.fruitBoost,{stacks:1,remaining:20},'duplicate claims do not add another speed stack');
  send(first,[0,0,0],[{type:'bread',action:{kind:'drop'}}]);const dropped=room.room.bread;
  assert.equal(dropped.owner,'');assert.deepEqual(dropped.p,[0,0,3.4]);
  send(second,dropped.p,[{type:'bread',action:{kind:'pick'}}]);assert.equal(room.room.bread.owner,'');
  now=Math.floor(dropped.drop.at+dropped.drop.duration*1000)+1999;send(second,dropped.p,[{type:'bread',action:{kind:'pick'}}]);assert.equal(room.room.bread.owner,'','the server also waits two seconds after landing');
  now=Math.ceil(dropped.pickupAt)+10;send(second,dropped.p,[{type:'bread',action:{kind:'pick'}}]);assert.equal(room.room.bread.owner,second.data.id);
  await room.webSocketClose(second);assert.equal(room.room.bread.owner,'');assert.equal(room.room.bread.p[1],0);
  const third=await join('Friend',2);assert.deepEqual(third.messages.find(m=>m.type==='welcome').room.bread,room.room.bread);
  now=Math.ceil(room.room.bread.pickupAt)+10;const p=[...room.room.bread.p],pidgie={...pidgieFixture(),phase:'wander',p:[p[0],0,p[2]+4],clip:'Idle'};
  const world={npcs:Array.from({length:14},()=>({...a,p:[0,0,0]})),npcLife:Array.from({length:14},()=>Array(15).fill(0)),carts:Array.from({length:12},()=>Array(4).fill(0)),balloons:Array.from({length:3},()=>[0,'parked',...Array(14).fill(0)]),bugs:Array.from({length:40},()=>Array(10).fill(0)),pidgie};
  room.webSocketMessage(first,JSON.stringify({type:'frame',actor:{...a,p},world,events:[{type:'bread',action:{kind:'pick'}}]}));
  send(first,p,[{type:'bread',action:{kind:'feed'}}]);const offered=structuredClone(room.room.bread);
  assert(offered.offering);assert.equal(room.room.world.pidgie.phase,'joy');assert.equal(achievementPoints(first.data.actor.achievements),16);
  const notices=()=>room.room.log.filter((m:any)=>m.text.includes('угостил дикого Пиджи хлебушком'));
  assert.equal(notices().length,1);assert.equal(notices()[0].text,'Baker угостил дикого Пиджи хлебушком, теперь Пиджи его лучший друг.');
  send(first,p,[{type:'bread',action:{kind:'feed'}},{type:'bread',action:{kind:'drop'}}]);
  now+=5000;send(third,offered.p,[{type:'bread',action:{kind:'pick'}}]);
  assert.deepEqual(room.room.bread,offered);assert.equal(notices().length,1);assert.equal(achievementPoints(first.data.actor.achievements),16);
  room.room.bread={...offered};delete room.room.bread.offering;
  room.room.world.pidgie.phase='toBread';room.room.world.pidgie.clip='Run';
  send(third,offered.p,[{type:'bread',action:{kind:'pick'}}]);
  assert.equal(room.room.bread.owner,'','the running bird reserves his target independently of the loaf marker');
  room.room.bread=structuredClone(offered);
  room.webSocketMessage(first,JSON.stringify({type:'frame',actor:{...a,p},world,events:[]}));
  assert.equal(room.room.world.pidgie.friend.by,first.data.id,'stale host frames cannot undo the friendship');
  await room.webSocketClose(first);assert.deepEqual(room.room.bread,offered);assert.equal(room.room.world.pidgie.friend.by,first.data.id);
  const awakened=new GameRoom(ctx,{});await Promise.resolve();await Promise.resolve();assert.deepEqual(awakened.room.bread,offered,'permanent bread and friendship survive hibernation');
  // The new host feeds Snowball without consuming Pidgie's permanent loaf.
  now+=1000;const snowPlayer=[p[0]+30,0,p[2]],snowball={...pidgie,p:[snowPlayer[0],0,snowPlayer[2]+4]};
  const both={...world,snowball};
  room.room.bread=grantBread(room.room.bread,actor(third.data.id,snowPlayer),now);
  room.webSocketMessage(third,JSON.stringify({type:'frame',actor:{...a,p:snowPlayer,achievements:['snowballFriend']},world:both,events:[]}));
  assert(!third.data.actor.achievements.includes('snowballFriend'),'clients cannot forge the Snowball unlock');
  send(third,snowPlayer,[{type:'bread',action:{kind:'feed',bird:'unknown'}}]);assert.equal(room.room.bread.owner,third.data.id);
  send(third,snowPlayer,[{type:'bread',action:{kind:'feed',bird:'snowball'}}]);
  assert(third.data.actor.achievements.includes('snowballFriend'));assert(!third.data.actor.achievements.includes('pidgieFriend'));
  assert.equal(room.room.world.snowball.phase,'joy');assert.equal(room.room.world.snowball.friend.target,'snowball');
  assert.equal(room.room.world.pidgie.friend.by,first.data.id);assert.equal(breadLoaves(room.room.bread).length,2);
  assert.equal(room.room.log.filter((m:any)=>m.text==='Friend угостил дикого Снежка хлебушком, теперь Снежок его лучший друг.').length,1);
  room.webSocketMessage(third,JSON.stringify({type:'frame',actor:{...a,p:snowPlayer},world:both,events:[]}));
  assert.equal(room.room.world.snowball.friend.by,third.data.id,'stale host frames preserve both friendships');
  // New plumages require a real, targeted feeding and keep all previous friendships.
  for(const [i,id] of ['ugolyok','ryzhik'].entries()){
   now+=1000;const position=[p[0]+60+i*30,0,p[2]],checkpoint={...pidgie,p:[position[0],0,position[2]+4]};
   const current={...room.room.world,[id]:checkpoint};
   room.room.bread=grantBread(room.room.bread,actor(third.data.id,position),now);
   room.webSocketMessage(third,JSON.stringify({type:'frame',actor:{...a,p:position,achievements:[id+'Friend']},world:current,events:[]}));
   assert(!third.data.actor.achievements.includes(id+'Friend'),'clients cannot forge '+id+' friendship');
   send(third,[position[0],0,position[2]-30],[{type:'bread',action:{kind:'feed',bird:id}}]);assert(!third.data.actor.achievements.includes(id+'Friend'),'feeding from far away fails');
   send(third,position,[{type:'bread',action:{kind:'feed',bird:id}}]);
   assert(third.data.actor.achievements.includes(id+'Friend'));assert.equal(room.room.world[id].friend.target,id);
   room.webSocketMessage(third,JSON.stringify({type:'frame',actor:{...a,p:position},world:current,events:[]}));
   assert.equal(room.room.world[id].friend.by,third.data.id,'stale host frames preserve '+id+' friendship');
   assert.equal(room.room.world.snowball.friend.by,third.data.id);assert.equal(room.room.world.pidgie.friend.by,first.data.id);
  }
  const late=await join('Snow watcher',19);assert.equal(late.messages[0].room.world.snowball.friend.by,third.data.id);
  await room.webSocketClose(third);assert.equal(room.room.host,late.data.id);
  const afterSnow=new GameRoom(ctx,{});await Promise.resolve();await Promise.resolve();
  assert.equal(afterSnow.room.world.snowball.friend.by,third.data.id);assert.equal(breadLoaves(afterSnow.room.bread).length,4);
  for(const id of ['ugolyok','ryzhik'])assert.equal(afterSnow.room.world[id].friend.by,third.data.id);
 }finally{Date.now=oldNow;globals.WebSocketPair=oldPair;globals.WebSocketRequestResponsePair=oldResponse;}
});


test('baked rewards coexist, stay with their owners, and preserve an offered loaf',()=>{
 const a=actor('a',[0,0,0]),b=actor('b',[8,0,0]);
 let state=grantBread(newBread(),a,1000);state=grantBread(state,b,2000);
 assert(holdsBread(state,'a'));assert(holdsBread(state,'b'));assert.equal(breadLoaves(state).length,2);assert(validBread(state));
 assert.equal(grantBread(state,b,3000),state,'a carrier cannot receive a duplicate');
 state=applyBread(state,{kind:'feed'},a,4000,undefined,{phase:'wander',p:[0,0,4]});
 assert(state.offering);assert(holdsBread(state,'b'));assert(validBread(state));
 state=applyBread(state,{kind:'drop'},b,5000);assert(!holdsBread(state,'b'));assert(breadLoaves(state).some(v=>v.offering?.by==='a'));
 const world=new BreadWorld();world.state=state;world.update(5500,new Map());assert.equal(world.group.children.length,3,'both world loaves render');
 assert(!validBread({...state,others:[{...freshBread(),owner:'same'},{...freshBread(),owner:'same'}]}));
});

test('a thrown loaf cannot be picked up until two seconds after landing, including older drops',()=>{
 const a=actor('solo',[0,0,0]),dropped=applyBread({...freshBread(),owner:a.id},{kind:'drop'},a,1000);
 const landedAt=1000+dropped.drop!.duration*1000,nearby={...a,p:dropped.p};
 const oldDrop={...dropped,pickupAt:landedAt+800};
 for(const time of [landedAt+801,landedAt+1999]){
  assert(!canPickBread(oldDrop,nearby,time));assert.equal(applyBread(oldDrop,{kind:'pick'},nearby,time),oldDrop);
 }
 assert(canPickBread(oldDrop,nearby,landedAt+2000));
});

test('Pidgie reserves his running target even if a bread snapshot loses its offering marker',()=>{
 const a=actor('solo',[0,0,0]),offered=applyBread({...freshBread(),owner:a.id},{kind:'feed'},a,1000,undefined,{phase:'wander',p:[0,0,8]});
 const {offering,...stale}=offered,nearby={...a,p:offered.p};assert(offering);
 const bird={phase:'toBread',p:[0,0,7],friend:offering};
 assert(!canPickBread(stale,nearby,100000,bird));
 assert.equal(applyBread(stale,{kind:'pick'},nearby,100000,undefined,bird),stale);
 const others=grantBread(stale,{...a,id:'other',p:[20,0,20]},2000);
 assert.equal(applyBread(others,{kind:'pick'},nearby,100000,undefined,bird),others);
});

test('old untouched mountain bread migrates away while carried and dropped rewards survive',()=>{
 const p=mountainWorld(MOUNTAIN_SUMMIT.tangent,MOUNTAIN_SUMMIT.radial-.5),old={...freshBread(),active:undefined,p:[p.x,MOUNTAIN_SUMMIT.y,p.z] as [number,number,number]};
 assert.equal(normalizeBread(old).active,false);
 assert.equal(normalizeBread({...old,owner:'solo'}).owner,'solo');
 assert.equal(normalizeBread(newBread()).active,false);
 const world=new BreadWorld();world.update(0,new Map());assert(!world.loaf.visible);assert(!world.aura.visible);
});
