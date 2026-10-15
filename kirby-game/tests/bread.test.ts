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
import {applyBread,advanceBread,breadFloor,breadPosition,canPickBread,newBread,validBread,BREAD_SPAWN,type BreadActor} from '../src/bread-state';
import {MOUNTAIN_STEPS,MOUNTAIN_SUMMIT,MOUNTAIN_SEAL_NICHE,mountainWorld} from '../src/mountain-ledges-layout';
const actor=(id='solo',p:readonly number[]=BREAD_SPAWN):BreadActor=>({id,p:[...p],yaw:0,size:1,available:true});

test('feeding requires carried bread, a nearby grounded bird and a facing player; the throw lands midway and cannot be reclaimed',()=>{
 const a=actor('solo',[0,0,0]),b={...newBread(),owner:'solo'},bird={phase:'follow',p:[0,0,4]};
 assert(canFeedPidgie(b,a,bird));assert(!canFeedPidgie(b,{...a,yaw:Math.PI},bird));
 assert(!canFeedPidgie(newBread(),a,bird));assert(canFeedPidgie(b,a,{...bird,p:[0,0,8.4]}));assert(!canFeedPidgie(b,a,{...bird,p:[0,0,10]}));assert(!canFeedPidgie(b,a,{...bird,phase:'fly'}));
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

test('one textured loaf starts on the summit and only a nearby available character can take it',()=>{
 const b=newBread(),a=actor();assert(validBread(b));assert.equal(b.p[1],MOUNTAIN_SUMMIT.y);
 assert.equal(breadFloor(b.p[0],b.p[2],b.p[1]),b.p[1]);
 assert(canPickBread(b,a,1000));
 assert(!canPickBread(b,{...a,available:false},1000));
 assert(!canPickBread(b,{...a,p:[b.p[0],0,b.p[2]]},1000));
 assert(!canPickBread(b,{...a,p:[b.p[0]+5,b.p[1],b.p[2]]},1000));
 const held=applyBread(b,{kind:'pick'},a,1000);assert.equal(held.owner,'solo');
 assert.equal(applyBread(held,{kind:'pick'},actor('pigeon'),1000),held,'another character cannot duplicate the loaf');
 assert.equal(applyBread(held,{kind:'drop'},actor('pigeon'),1100),held,'only the carrier can drop it');
});

test('a loaf released on the permanent seal niche keeps its visible supporting floor',()=>{
 const niche=MOUNTAIN_SEAL_NICHE,p=mountainWorld(niche.tangent,niche.radial-.35);
 assert.equal(breadFloor(p.x,p.z,niche.y),niche.y);
 const loaf={...newBread(),p:[p.x,niche.y,p.z] as [number,number,number]};
 assert.equal(advanceBread(loaf,10000),loaf,'the new niche is a real floor for shared loose items');
});

test('a drop falls forward, rests on the ground, and can be picked up again without snapping back',()=>{
 for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2]){
  const a={...actor(),p:[0,0,0],yaw},held={...newBread(),owner:a.id};
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
 const a={...actor(),yaw:-Math.PI*3/4},b={...newBread(),owner:a.id};
 const onTop=applyBread(b,{kind:'drop'},a,1000);assert.equal(onTop.p[1],MOUNTAIN_SUMMIT.y);
 const edge=mountainWorld(MOUNTAIN_SUMMIT.tangent,MOUNTAIN_SUMMIT.radial-MOUNTAIN_SUMMIT.depth/2+.2);
 const off=applyBread(b,{kind:'drop'},{...a,p:[edge.x,MOUNTAIN_SUMMIT.y,edge.z]},1000);
 assert(off.p[1]<MOUNTAIN_SUMMIT.y);assert(off.drop!.duration>onTop.drop!.duration);
 assert(Math.abs(breadPosition(off,100000)[1]-off.p[1])<1e-8);
});

test('bread saves reject invalid positions and drop times',()=>{
 const b=newBread();assert(validBread(JSON.parse(JSON.stringify(b))));
 assert(!validBread({...b,p:[0,NaN,0]}));assert(!validBread({...b,scale:0}));
 assert(!validBread({...b,drop:{from:[0,1,0],at:0,duration:0}}));assert(!validBread({...b,pickupAt:-1}));
 const actor=(variant:string)=>({variant,x:0,z:0,yaw:0,size:1,fruitsEaten:0});
 const save={version:1,savedAt:'2026-10-14',player:actor(KIRBY_VARIANTS[14][0]),npcs:KIRBY_VARIANTS.slice(0,14).map(v=>actor(v[0])),fruits:Array(70).fill(false)};
 assert.equal(parseSave(JSON.stringify(save)).bread,undefined,'older saves remain compatible');
 assert.equal(parseSave(JSON.stringify({...save,bread:{...b,owner:'solo'}})).bread?.owner,'solo');
 assert.throws(()=>parseSave(JSON.stringify({...save,bread:{...b,scale:0}})));
});

test('a loaf left on a disappearing step falls with the lost support',()=>{
 const p=MOUNTAIN_STEPS[0],xy=mountainWorld(p.tangent,p.radial),b={...newBread(),p:[xy.x,p.y,xy.z] as [number,number,number]},steps=MOUNTAIN_STEPS.map(()=>[0,0,0]);
 assert.equal(advanceBread(b,1000,steps),b);steps[0]=[2,0,0];const falling=advanceBread(b,1000,steps);
 assert(falling.p[1]<p.y);assert.equal(falling.drop?.speed,0);assert(breadPosition(falling,1100)[1]<p.y);
 assert.deepEqual(breadPosition(falling,100000),falling.p);
});

test('the room arbitrates one loaf, blocks other interactions, and drops it when its carrier leaves',async()=>{
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
  send(first,a.p,[{type:'bread',action:{kind:'pick'}}]);assert.equal(room.room.bread.owner,first.data.id);
  send(second,a.p,[{type:'bread',action:{kind:'pick'}}]);assert.equal(room.room.bread.owner,first.data.id);
  send(first,[49,0,40.5],[{type:'lock',key:'cart:0'},{type:'mill',action:{kind:'start'}},{type:'fruit',index:0},{type:'star'}]);
  assert.equal([...first.messages].reverse().find(m=>m.type==='lock').ok,false);assert.equal(room.room.millQuest.stage,'idle');
  assert.equal(room.room.fruits[0],null);assert.equal(room.room.starAt,0);
  send(first,[0,0,0],[{type:'bread',action:{kind:'drop'}}]);const dropped=room.room.bread;
  assert.equal(dropped.owner,'');assert.deepEqual(dropped.p,[0,0,3.4]);
  send(second,dropped.p,[{type:'bread',action:{kind:'pick'}}]);assert.equal(room.room.bread.owner,'');
  now=Math.ceil(dropped.pickupAt)+10;send(second,dropped.p,[{type:'bread',action:{kind:'pick'}}]);assert.equal(room.room.bread.owner,second.data.id);
  await room.webSocketClose(second);assert.equal(room.room.bread.owner,'');assert.equal(room.room.bread.p[1],0);
  const third=await join('Friend',2);assert.deepEqual(third.messages.find(m=>m.type==='welcome').room.bread,room.room.bread);
  now=Math.ceil(room.room.bread.pickupAt)+10;const p=[...room.room.bread.p],pidgie={...pidgieFixture(),phase:'wander',p:[p[0],0,p[2]+4],clip:'Idle'};
  const world={npcs:Array.from({length:14},()=>({...a,p:[0,0,0]})),npcLife:Array.from({length:14},()=>Array(15).fill(0)),carts:Array.from({length:12},()=>Array(4).fill(0)),balloons:Array.from({length:3},()=>[0,'parked',...Array(14).fill(0)]),bugs:Array.from({length:40},()=>Array(10).fill(0)),pidgie};
  room.webSocketMessage(first,JSON.stringify({type:'frame',actor:{...a,p},world,events:[{type:'bread',action:{kind:'pick'}}]}));
  send(first,p,[{type:'bread',action:{kind:'feed'}}]);const offered=structuredClone(room.room.bread);
  assert(offered.offering);assert.equal(room.room.world.pidgie.phase,'joy');assert.equal(achievementPoints(first.data.actor.achievements),10);
  const notices=()=>room.room.log.filter((m:any)=>m.text.includes('угостил дикого Пиджи хлебушком'));
  assert.equal(notices().length,1);assert.equal(notices()[0].text,'Baker угостил дикого Пиджи хлебушком, теперь Пиджи его лучший друг.');
  send(first,p,[{type:'bread',action:{kind:'feed'}},{type:'bread',action:{kind:'drop'}}]);
  now+=5000;send(third,offered.p,[{type:'bread',action:{kind:'pick'}}]);
  assert.deepEqual(room.room.bread,offered);assert.equal(notices().length,1);assert.equal(achievementPoints(first.data.actor.achievements),10);
  room.webSocketMessage(first,JSON.stringify({type:'frame',actor:{...a,p},world,events:[]}));
  assert.equal(room.room.world.pidgie.friend.by,first.data.id,'stale host frames cannot undo the friendship');
  await room.webSocketClose(first);assert.deepEqual(room.room.bread,offered);assert.equal(room.room.world.pidgie.friend.by,first.data.id);
  const awakened=new GameRoom(ctx,{});assert.deepEqual(awakened.room.bread,offered,'permanent bread and friendship survive hibernation');
 }finally{Date.now=oldNow;globals.WebSocketPair=oldPair;globals.WebSocketRequestResponsePair=oldResponse;}
});
