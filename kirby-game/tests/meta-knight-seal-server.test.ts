import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {serialize} from 'node:v8';
import ts from 'typescript';
import {roomSql} from './room-sql';
import {BUILD,validWorld,type ActorState} from '../src/network-protocol';
import {META_KNIGHT_SEAL_SITES} from '../src/meta-knight-seal-sites';
import {SEAL_IDS,newSealProgress,validSealProgress,type SealId} from '../src/meta-knight-seal-state';
import {newMillQuest} from '../src/mill-quest';
import {META_KNIGHT_PORTAL_MESSAGE} from '../src/world-log';

test('actual room owns raced seal claims, refuses forged or unavailable pickups, and preserves shared progress across reload, joins and host migration',async()=>{
  const source=(await readFile(new URL('../../game-server/src/index.ts',import.meta.url),'utf8'))
    .replace("import { DurableObject } from 'cloudflare:workers';",'class DurableObject { constructor(public ctx:any,public env:any){} }')
    .replaceAll('../../kirby-game/src/',new URL('../src/',import.meta.url).href)
    .replaceAll("from './","from '"+new URL('../../game-server/src/',import.meta.url).href)
    .replace(/(from ['"]file:[^'"]+)(['"])/g,'$1.ts$2')
    .replaceAll('new Response(null,{status:101,webSocket:client})','({status:101,webSocket:client})');
  const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
  const globals=globalThis as any,oldPair=globals.WebSocketPair,oldResponse=globals.WebSocketRequestResponsePair,oldNow=Date.now;
  let now=100000;Date.now=()=>now;
  class Socket{
    readyState=1;data:any;messages:any[]=[];
    deserializeAttachment(){return structuredClone(this.data);}serializeAttachment(data:any){assert(serialize(data).length<=16384,'WebSocket attachment exceeds the runtime limit');this.data=structuredClone(data);}
    send(value:string){this.messages.push(JSON.parse(value));}close(){this.readyState=3;}accept(){}
  }
  let lastServer:Socket;globals.WebSocketPair=class{0=new Socket();1=lastServer=new Socket();};globals.WebSocketRequestResponsePair=class{};
  const sockets:Socket[]=[],storage=new Map<string,unknown>(),sql=roomSql();
  const ctx={waitUntil(){},blockConcurrencyWhile:(fn:()=>unknown)=>fn(),getWebSockets:()=>sockets,getWebSocketAutoResponseTimestamp:()=>new Date(now),acceptWebSocket:(s:Socket)=>sockets.push(s),setWebSocketAutoResponse(){},
    storage:{sql,async get(key:string){return structuredClone(storage.get(key));},async put(key:string,value:unknown){storage.set(key,structuredClone(value));},async delete(key:string){storage.delete(key);},async setAlarm(){},async deleteAlarm(){},async deleteAll(){storage.clear();sql.clear();}}};
  try{
    const {GameRoom}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));let room=new GameRoom(ctx,{});
    const join=async(name:string,variant:number)=>{await room.fetch(new Request(`https://test/ws?build=${BUILD}&variant=${variant}&name=${encodeURIComponent(name)}`,{headers:{Upgrade:'websocket'}}));return lastServer!;};
    const actor=(id:SealId,patch:Partial<ActorState>={}):ActorState=>{
      const site=META_KNIGHT_SEAL_SITES.find(site=>site.id===id)!;
      return {p:[site.x,site.surfaceY,site.z],q:[0,0,0,1],s:1,state:id==='treehouse'?'Lookout':'Idle',pose:[],fruits:0,achievements:[],name:'Client identity',variant:0,star:0,...(id==='treehouse'?{ride:{key:'tree:0',data:[0]}}:{}),...patch};
    };
    const send=(socket:Socket,position:ActorState,events:any[]=[],extra={})=>{now+=40;room.webSocketMessage(socket,JSON.stringify({type:'frame',actor:position,events,...extra}));};
    const a=await join('Искатель',0),b=await join('Сосед',1),roomId=room.room.id,aid=a.data.id;
    assert.deepEqual(a.messages.find(m=>m.type==='welcome').room.sealProgress,newSealProgress());

    // Legal world values and ten ordinary chat messages can exceed the runtime's
    // binary attachment limit even though the JSON world passes validation.
    const rows=(count:number,width:number)=>Array.from({length:count},()=>Array(width).fill(.1234));
    room.room.world={npcs:Array.from({length:14},(_,i)=>actor('maze',{state:'Hello',pose:i<6?rows(5,10):[]})),npcLife:rows(14,15),carts:rows(12,4),balloons:Array.from({length:3},()=>[0,'parked',...Array(14).fill(.1234)]),bugs:rows(40,10)};
    room.room.log=Array.from({length:10},(_,i)=>({id:`message-${i}`,name:'Искатель',variant:0,text:'Проверяем хлеб, жетоны и звезду в сетевой игре. '.repeat(6).slice(0,255),chat:true}));
    assert(validWorld(room.room.world));
    assert(serialize({room:room.room,actor:actor('maze')}).length>16384,'fixture reproduces the oversized host checkpoint');

    const forged={collected:{maze:{by:'attacker',at:1},mountain:{by:'attacker',at:1},treehouse:{by:'attacker',at:1}}};
    send(a,actor('maze',{p:[0,0,0]}),[{type:'seal',id:'maze',by:'attacker',at:1,progress:forged}],{room:{sealProgress:forged},sealProgress:forged});
    assert.deepEqual(room.room.sealProgress,newSealProgress(),'no client progress or distant request becomes authoritative');
    for(const id of ['unknown','grotto',null,0,'__proto__'])send(a,actor('maze'),[{type:'seal',id}]);
    assert.deepEqual(room.room.sealProgress,newSealProgress());
    for(const state of ['Jump','Fly','Swim','Roll','Death','Sitting','FireflyRide','Cart','Attack','Push'])send(a,actor('maze',{state}),[{type:'seal',id:'maze'}]);
    send(a,actor('maze',{roll:[1,0,0,0,0]}),[{type:'seal',id:'maze'}]);
    send(a,actor('maze',{p:[-98,0,124],s:20}),[{type:'seal',id:'maze'}]);
    const maze=META_KNIGHT_SEAL_SITES.find(site=>site.id==='maze')!;
    send(a,actor('maze',{p:[maze.x,maze.surfaceY+2,maze.z]}),[{type:'seal',id:'maze'}]);
    a.data.visible=false;send(a,actor('maze'),[{type:'seal',id:'maze'}]);a.data.visible=true;
    room.room.locks['bug:0']=aid;
    send(a,actor('maze',{ride:{key:'bug:0',data:Array(10).fill(0)}}),[{type:'seal',id:'maze'}]);
    send(a,actor('maze'),[{type:'seal',id:'maze'}]);delete room.room.locks['bug:0'];
    room.room.bread.active=true;room.room.bread.owner=aid;send(a,actor('maze'),[{type:'seal',id:'maze'}]);room.room.bread.owner='';
    room.room.millQuest={...newMillQuest(),stage:'bags',owner:aid,carried:1,updatedAt:now};
    send(a,actor('maze'),[{type:'seal',id:'maze'}]);room.room.millQuest=newMillQuest();
    assert.deepEqual(room.room.sealProgress,newSealProgress(),'flying, mounted, hidden, tumbling, carrying or through-wall claims all fail');

    send(a,actor('treehouse'),[{type:'seal',id:'treehouse'}]);
    assert.deepEqual(room.room.sealProgress,newSealProgress(),'balcony state without its tree lease is unavailable');
    room.room.locks['tree:0']=aid;
    for(const state of ['Idle','Run','Fly','Climb','Swing','LeafDive','Sitting'])send(a,actor('treehouse',{state}),[{type:'seal',id:'treehouse'}]);
    send(a,actor('treehouse',{ride:undefined}),[{type:'seal',id:'treehouse'}]);
    send(a,actor('treehouse',{ride:{key:'bug:0',data:Array(10).fill(0)}}),[{type:'seal',id:'treehouse'}]);
    const deck=META_KNIGHT_SEAL_SITES.find(site=>site.id==='treehouse')!;
    send(a,actor('treehouse',{p:[deck.x,0,deck.z],s:20}),[{type:'seal',id:'treehouse'}]);
    send(a,actor('treehouse',{p:[deck.x,deck.surfaceY,deck.z+2],s:20}),[{type:'seal',id:'treehouse'}]);
    room.room.locks['bug:0']=aid;send(a,actor('treehouse'),[{type:'seal',id:'treehouse'}]);delete room.room.locks['bug:0'];
    room.room.locks['tree:0']=b.data.id;send(a,actor('treehouse'),[{type:'seal',id:'treehouse'}]);delete room.room.locks['tree:0'];
    assert.deepEqual(room.room.sealProgress,newSealProgress(),'climb, swing, dive, wrong ride/lease, ground and off-balcony pickups all fail');

    delete room.room.sealProgress; // A hibernated room from before the hunt.
    const before=a.messages.filter(m=>m.type==='room').length;
    send(a,actor('maze'),[{type:'seal',id:'maze',by:'forged',at:0}]);
    const first=room.room.sealProgress,claimedAt=first.collected.maze.at;
    send(b,actor('maze'),[{type:'seal',id:'maze'}]);send(a,actor('maze'),[{type:'seal',id:'maze'},{type:'seal',id:'maze'}]);
    assert.equal(room.room.sealProgress,first,'racing duplicate requests are identity no-ops');
    assert.deepEqual(first.collected.maze,{by:aid,at:claimedAt});assert.equal(claimedAt,now-80);
    assert.equal(a.messages.filter(m=>m.type==='room').length,before+1,'only the successful claim broadcasts changed room state');
    assert(b.messages.some(m=>m.type==='room'&&m.room.sealProgress?.collected.maze?.by===aid));
    const sealLogs=(socket:Socket)=>socket.messages.filter(m=>m.type==='log'&&m.entry.text.includes('подобрал значок Метакнайта.'));
    for(const socket of [a,b])assert.deepEqual(sealLogs(socket).map(m=>m.entry.text),['Искатель подобрал значок Метакнайта. Собрано 1 из 3.'],'accepted claims broadcast once to every player using the server-owned name');
    const late=await join('Поздний',2);assert.deepEqual(late.messages.find(m=>m.type==='welcome').room.sealProgress,first);

    // One player may collect every remaining seal; there is no distinct-player gate.
    send(a,actor('mountain'),[{type:'seal',id:'mountain'}]);
    room.room.locks['tree:0']=aid;
    send(a,actor('treehouse'),[{type:'seal',id:'treehouse'}]);delete room.room.locks['tree:0'];
    const complete=structuredClone(room.room.sealProgress);
    for(const socket of [a,b]){
      assert.deepEqual(sealLogs(socket).map(m=>m.entry.text),[1,2,3].map(n=>`Искатель подобрал значок Метакнайта. Собрано ${n} из 3.`));
      const portal=socket.messages.filter(m=>m.type==='log'&&m.entry.text===META_KNIGHT_PORTAL_MESSAGE);
      assert.equal(portal.length,1);assert(socket.messages.indexOf(sealLogs(socket).at(-1))<socket.messages.indexOf(portal[0]),'portal announcement follows the third pickup');
    }
    assert(validSealProgress(complete));assert.equal(Object.keys(complete.collected).length,3);
    for(const id of SEAL_IDS)assert.equal(complete.collected[id]!.by,aid);
    assert.equal(a.data.actor.variant,0);assert.equal(a.data.actor.achievements.length,0,'collecting does not unlock a character or award an unrelated task');
    const count=a.messages.filter(m=>m.type==='room').length;send(a,actor('treehouse'));assert.equal(a.messages.filter(m=>m.type==='room').length,count,'movement adds no seal packets');

    await room.webSocketClose(a);assert.equal(room.room.host,b.data.id);assert.deepEqual(room.room.sealProgress,complete);
    assert(!a.data.room&&!b.data.room,'room state is never attached to a player socket');
    assert.deepEqual((storage.get('room-state') as any).sealProgress,complete,'shared storage retains progress across host migration');
    assert.deepEqual((storage.get('room-state') as any).world,room.room.world,'the complete world remains recoverable without being attached to a socket');
    const legacy:{collected:Record<string,{by:string;at:number}>}=structuredClone(complete);legacy.collected.grotto=legacy.collected.treehouse;delete legacy.collected.treehouse;
    b.data.room={...(storage.get('room-state') as any),sealProgress:legacy};storage.delete('room-state');
    room=new GameRoom(ctx,{});await Promise.resolve();await Promise.resolve();assert.deepEqual(room.room.sealProgress,complete,'hibernated legacy room migrates the old third seal without changing its collector');
    const returned=await join('Искатель',3),welcome=returned.messages.find(m=>m.type==='welcome');
    assert.equal(welcome.playerId,aid);assert.equal(welcome.room.id,roomId);assert.deepEqual(welcome.room.sealProgress,complete);
    assert.equal(welcome.room.log.filter((entry:any)=>entry.text===META_KNIGHT_PORTAL_MESSAGE).length,1,'late joins recover the portal announcement from room history');
    send(returned,actor('maze'),[{type:'seal',id:'maze'}]);assert.deepEqual(room.room.sealProgress,complete,'rejoining cannot recollect a seal');
    assert.equal(sealLogs(returned).length,0,'rejected duplicate claims do not replay chat events');
    await room.webSocketClose(b);await room.webSocketClose(late);await room.webSocketClose(returned);
    const fresh=await join('Новая игра',0);assert.notEqual(fresh.messages.find(m=>m.type==='welcome').room.id,roomId);
    assert.deepEqual(fresh.messages.find(m=>m.type==='welcome').room.sealProgress,newSealProgress(),'a genuinely new room starts a new hunt');
  }finally{Date.now=oldNow;globals.WebSocketPair=oldPair;globals.WebSocketRequestResponsePair=oldResponse;sql.close();}
});
