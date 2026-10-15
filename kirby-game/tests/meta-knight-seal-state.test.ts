import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SEAL_IDS,newSealProgress,allSealsCollected,validSealProgress,normalizeSealProgress,canCollectSeal,collectSeal,type SealActor} from '../src/meta-knight-seal-state';
import {META_KNIGHT_SEAL_SITES} from '../src/meta-knight-seal-sites';
import {MOUNTAIN_STEPS} from '../src/mountain-ledges-layout';
import {BUILD,PROTOCOL,validWorld,type ActorState} from '../src/network-protocol';
import {NetworkSession} from '../src/network';

const near=(id:typeof SEAL_IDS[number],player='solo'):SealActor=>{
  const site=META_KNIGHT_SEAL_SITES.find(site=>site.id===id)!;
  return {id:player,p:[site.x,site.surfaceY,site.z],size:1,available:true};
};

test('three seal claims are immutable and idempotent, and one player may collect the entire set',()=>{
  const empty=newSealProgress();let progress=empty;
  for(const [i,id] of SEAL_IDS.entries()){
    const old=progress;assert(canCollectSeal(progress,id,near(id)));
    progress=collectSeal(progress,id,near(id),1000+i);assert.notEqual(progress,old);assert(!old.collected[id]);
    assert.deepEqual(progress.collected[id],{by:'solo',at:1000+i});
    assert.equal(collectSeal(progress,id,near(id,'other'),2000+i),progress,'first claim owns its original collector and timestamp');
  }
  assert.deepEqual(empty,{collected:{}});assert.equal(Object.keys(progress.collected).length,3);assert(validSealProgress(progress));
});
test('the portal unlocks only after all three distinct badges, including restored and shared progress',()=>{
 for(const players of [['solo','solo','solo'],['one','two','one']]){
  let progress=newSealProgress();assert(!allSealsCollected(progress));
  for(const [i,id] of SEAL_IDS.entries()){progress=collectSeal(progress,id,near(id,players[i]),1000+i);assert.equal(allSealsCollected(progress),i===2);}
  assert(allSealsCollected(JSON.parse(JSON.stringify(progress))));
  assert(!allSealsCollected(newSealProgress()),'a new game starts locked');
 }
 assert(!allSealsCollected({collected:{maze:{by:'p',at:1},mountain:{by:'p',at:2},unknown:{by:'p',at:3}}} as any),'three entries cannot substitute for the treehouse badge');
});

test('collection requires available feet at the correct height, inside the real corridor or ledge',()=>{
  const progress=newSealProgress();
  for(const id of SEAL_IDS){
    const actor=near(id);assert(canCollectSeal(progress,id,actor),id);
    for(const invalid of [{...actor,available:false},{...actor,p:[actor.p[0]+30,actor.p[1],actor.p[2]]},{...actor,p:[actor.p[0],actor.p[1]+1,actor.p[2]]},{...actor,p:[actor.p[0],actor.p[1]-1,actor.p[2]]},{...actor,size:NaN},{...actor,size:0},{...actor,p:[NaN,actor.p[1],actor.p[2]]},{...actor,id:''}]){
      assert.equal(collectSeal(progress,id,invalid,1000),progress,`${id}: invalid actor cannot claim`);
    }
  }
  assert(!canCollectSeal(progress,'maze',{...near('maze'),p:[-98,0,124],size:20}),'large players cannot collect through the dead-end hedge from the entrance cell');
  for(const time of [NaN,Infinity,-1,1.5])assert.equal(collectSeal(progress,'maze',near('maze'),time),progress);
  assert.equal(collectSeal(progress,'unknown',near('maze'),1000),progress);
});

test('saved and room progress rejects unknown ids, forged reward fields and malformed collector metadata',()=>{
  assert(validSealProgress(newSealProgress()));
  for(const value of [null,[],{}, {collected:[]},{collected:new Date()},{collected:{unknown:{by:'a',at:1}}},{collected:{maze:{by:'',at:1}}},{collected:{maze:{by:'a\n',at:1}}},{collected:{maze:{by:'a',at:-1}}},{collected:{maze:{by:'a',at:Infinity}}},{collected:{maze:{by:'a',at:'1'}}},{collected:{maze:{by:'a',at:1,unlock:true}}},{collected:{grotto:{by:'a',at:1,unlock:true}}},{collected:{},unlocked:true}]){
    assert(!validSealProgress(value));assert.equal(normalizeSealProgress(value),null);
  }
});

test('legacy grotto progress migrates once to treehouse without losing the collector or enabling legacy claims',()=>{
  const old={collected:{maze:{by:'first',at:100},grotto:{by:'old collector',at:200}}},original=structuredClone(old);
  assert(!validSealProgress(old));
  const migrated=normalizeSealProgress(old)!;
  assert.deepEqual(migrated,{collected:{maze:{by:'first',at:100},treehouse:{by:'old collector',at:200}}});
  assert.deepEqual(old,original,'migration does not mutate a loaded save or socket attachment');
  assert(validSealProgress(migrated));assert.equal(normalizeSealProgress(migrated),migrated,'current room state is an identity no-op');
  assert(!canCollectSeal(newSealProgress(),'grotto',near('treehouse')),'legacy ids are accepted at data boundaries, not as current pickup events');
  assert.equal(collectSeal(migrated,'treehouse',near('treehouse'),300),migrated,'migrated claims cannot be collected again');
  const mixed={collected:{grotto:{by:'old',at:1},treehouse:{by:'current',at:2}}};
  assert.deepEqual(normalizeSealProgress(mixed),{collected:{treehouse:{by:'current',at:2}}},'an existing current claim takes priority over the alias');
});

test('network snapshots accept the peak route and legacy eleven- and thirteen-step rooms',()=>{
  const actor={p:[0,0,0],q:[0,0,0,1],s:1,state:'Idle',pose:[],fruits:0,achievements:[],name:'Kirby',variant:0,star:0};
  const world={npcs:Array.from({length:14},()=>actor),npcLife:Array.from({length:14},()=>Array(15).fill(0)),carts:Array.from({length:13},()=>Array(4).fill(0)),balloons:Array.from({length:3},()=>[0,'parked',...Array(14).fill(0)]),bugs:Array.from({length:40},()=>Array(10).fill(0)),mountainSteps:Array.from({length:MOUNTAIN_STEPS.length},()=>[0,0,0])};
  assert(validWorld(world));
  for(const count of [11,13])assert(validWorld({...world,mountainSteps:Array.from({length:count},()=>[0,0,0])}));
  assert(!validWorld({...world,mountainSteps:[...world.mountainSteps,[0,0,0]]}));
  assert(!validWorld({...world,mountainSteps:world.mountainSteps.map((v,i)=>i===0?[2,5,0]:v)}));
  assert.equal(BUILD,'meadow-network-17');assert.equal(PROTOCOL,2);
});

test('network room and welcome carry authoritative progress without adding it to movement frames',async()=>{
  const previous=globalThis.WebSocket;let socket:FakeSocket|undefined;
  class FakeSocket{
    static OPEN=1;readyState=1;bufferedAmount=0;sent:any[]=[];onmessage?:(event:{data:string})=>void;onerror?:()=>void;onclose?:()=>void;
    constructor(){socket=this;}send(value:string){this.sent.push(JSON.parse(value));}close(){}
  }
  globalThis.WebSocket=FakeSocket as unknown as typeof WebSocket;const session=new NetworkSession();
  const actor:ActorState={p:[0,0,0],q:[0,0,0,1],s:1,state:'Idle',pose:[],fruits:0,achievements:[],name:'Solo',variant:0,star:0};
  const room={id:'room',host:'other',epoch:0,fruits:[],starAt:0,mill:false,locks:{}};
  try{
    const connected=session.connect('https://example.test',0,'Solo');
    const legacy={collected:{grotto:{by:'old room player',at:123}}};
    socket!.onmessage!({data:JSON.stringify({type:'welcome',protocolVersion:PROTOCOL,playerId:'local',room:{...room,sealProgress:legacy},players:[{id:'local'},{id:'other'}]})});await connected;
    assert.deepEqual(session.room.sealProgress,{collected:{treehouse:{by:'old room player',at:123}}},'welcome migrates the old third seal');
    session.event({type:'seal',id:'treehouse'});session.tick(.1,actor,()=>{throw Error('guest must not send world');});
    assert.deepEqual(socket!.sent.at(-1).events,[],'migrated progress suppresses recollection');
    socket!.onmessage!({data:JSON.stringify({type:'room',room})});assert.deepEqual(session.room.sealProgress,newSealProgress(),'older snapshots without the hunt start empty');
    session.event({type:'seal',id:'maze'});session.event({type:'seal',id:'maze'});session.tick(.1,actor,()=>{throw Error('guest must not send world');});
    assert.deepEqual(socket!.sent.at(-1).events,[{type:'seal',id:'maze'}]);assert(!('sealProgress' in socket!.sent.at(-1)));
    const progress=collectSeal(newSealProgress(),'maze',near('maze','other'),1000);
    socket!.onmessage!({data:JSON.stringify({type:'room',room:{...room,sealProgress:progress}})});assert.deepEqual(session.room.sealProgress,progress);
    const sent=socket!.sent.length;session.event({type:'seal',id:'maze'});session.tick(.1,actor,()=>{throw Error('guest must not send world');});assert.equal(socket!.sent.length,sent,'confirmed duplicate is not queued');
    socket!.onmessage!({data:JSON.stringify({type:'room',room:{...room,sealProgress:legacy}})});assert.deepEqual(session.room.sealProgress,{collected:{treehouse:{by:'old room player',at:123}}},'changed room snapshots also migrate persisted aliases');
    socket!.onmessage!({data:JSON.stringify({type:'room',room:{...room,sealProgress:{collected:{forged:{by:'x',at:0}}}}})});assert.deepEqual(session.room.sealProgress,newSealProgress());
  }finally{session.close();globalThis.WebSocket=previous;}
});
