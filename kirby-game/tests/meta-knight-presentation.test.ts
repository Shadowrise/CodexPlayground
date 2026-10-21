import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {KNIGHT,startKnightBattle,knightPlayerVisible} from '../src/meta-knight-battle';
import {constrainKnightBody,knightBody} from '../src/meta-knight-body';
import {MetaKnightImpactLightning} from '../src/meta-knight-impact-lightning';
import {CentipedeTargetCue} from '../src/centipede-target-cue';
import {NetworkSession} from '../src/network';
import type {ActorState} from '../src/network-protocol';
import {knightArenaActions} from '../src/meta-knight-actions';

function battle(){const s=startKnightBattle([{id:'a',p:[0,0,-2],yaw:0,available:true}],'a',1000)!;Object.assign(s,{stage:'open',pattern:'sword',from:[0,0,0],to:[0,0,0],since:2000,until:5000});return s;}

test('arena controls expose one bottom action during a fight and finish plus attack-key replay after it',()=>{
 assert.deepEqual(knightArenaActions(undefined,'a',false,true,false),[{key:'interact',action:'start',label:'Начать дуэль'}]);assert.deepEqual(knightArenaActions(undefined,'a',false,false,false),[]);
 const s=battle();assert.deepEqual(knightArenaActions(s,'a',false,true,false),[{key:'interact',action:'cancel',label:'Прервать дуэль'}]);assert.deepEqual(knightArenaActions(s,'spectator',false,true,false),[]);
 for(const stage of ['won','lost'] as const){s.stage=stage;assert.deepEqual(knightArenaActions(s,'a',false,false,false),[{key:'interact',action:'finish',label:'Завершить дуэль'},{key:'attack',action:'start',label:'Ещё раз'}]);}
 assert.deepEqual(knightArenaActions(s,'a',true,false,false),[{key:'interact',action:'start',label:'Ещё раз'}]);assert.deepEqual(knightArenaActions(s,'a',false,false,true),[{key:'interact',action:'leave',label:'Вернуться на поляну'}]);
});

test('the solid torso blocks walking and swept crossings while leaving counterattacks reachable',()=>{
 const s=battle(),before=JSON.stringify(s),body=knightBody(s,2100);
 for(let i=0;i<16;i++){
  const angle=i*Math.PI/8,previous:[number,number,number]=[body.x+Math.sin(angle)*8,0,body.z+Math.cos(angle)*8];
  const p:[number,number,number]=[body.x-Math.sin(angle)*8,0,body.z-Math.cos(angle)*8];
  assert(constrainKnightBody(s,p,2100,previous));assert((p[0]-body.x)*(previous[0]-body.x)+(p[2]-body.z)*(previous[2]-body.z)>0,'a fast step stops on the incoming side');
  assert(Math.hypot(p[0],p[2])<KNIGHT.meleeReach,'the solid body does not block the counterattack range');
  assert(!constrainKnightBody(s,[...p],2100),'resolved point is outside the collider');
 }
 const centre:[number,number,number]=[body.x,0,body.z];assert(constrainKnightBody(s,centre,2100));assert(centre.every(Number.isFinite));
 assert.equal(JSON.stringify(s),before,'collision changes neither damage nor choreography');
});

test('body collision respects flight altitude and is released when the encounter ends',()=>{
 const s=battle();assert(!constrainKnightBody(s,[0,20,0],2100));
 Object.assign(s,{stage:'dash',height:12});assert(!constrainKnightBody(s,[0,0,0],2100),'a high flying boss does not create an invisible wall on the floor');
 Object.assign(s,{stage:'cancelled',height:0});assert(!constrainKnightBody(s,[0,0,0],2100));
});

test('a boss at the rim separates the player without pushing outside the arena or back into its body',()=>{
 const s=battle();s.from=s.to=[40,0,0];const p:[number,number,number]=[41,0,0];assert(constrainKnightBody(s,p,2100));assert(Math.hypot(p[0],p[2])<=41+1e-6);assert(!constrainKnightBody(s,[...p],2100));
});

test('local and remote damage flicker ends normally and never hides defeated or withdrawn players',()=>{
 const s=battle();s.players.a.hp=4;s.players.a.invulnerable=4000;
 assert.equal(knightPlayerVisible(s,'a',3040),true);assert.equal(knightPlayerVisible(s,'a',3135),false);assert.equal(knightPlayerVisible(s,'a',4000),true);
 assert.equal(knightPlayerVisible(s,'spectator',3135),true);assert.equal(knightPlayerVisible(s,'a',3135,true),true);
 s.players.a.hp=0;assert.equal(knightPlayerVisible(s,'a',3135),true);s.players.a.hp=4;s.players.a.withdrawn=true;assert.equal(knightPlayerVisible(s,'a',3135),true);
});

test('sword lightning grows out of the contact point, fades across stage changes, and never changes health',()=>{
 for(const stage of ['open','slam','shield'] as const){
  const s=battle();s.stage=stage;s.pattern=stage==='open'?'leap':stage==='shield'?'star':'dive';
  const before=JSON.stringify(s),fx=new MetaKnightImpactLightning(),tip=new T.Vector3(3,-.2,7);
  fx.update(s,2000,tip);assert(fx.group.visible);assert.equal(fx.group.position.x,3);assert.equal(fx.group.position.z,7);
  fx.update(s,2250,tip);const cores=fx.group.getObjectByName('Sword impact lightning cores') as T.InstancedMesh;assert.equal(cores.count,176);const data=cores.instanceMatrix.array.slice();
  const other=new MetaKnightImpactLightning();other.update(structuredClone(s),2250,tip);assert.deepEqual((other.group.getObjectByName(cores.name) as T.InstancedMesh).instanceMatrix.array,data,'network snapshots produce the same branches');other.dispose();
  assert.equal(JSON.stringify(s),before);s.stage='wave';s.since=2180;fx.update(s,2400,tip);assert(fx.group.visible);fx.update(s,2800,tip);assert(!fx.group.visible);fx.dispose();
 }
});

test('the shared attack target is a complete overlay with no depth clipping in both encounters',()=>{
 const cue=new CentipedeTargetCue();cue.update([0,0,0],2000,new T.PerspectiveCamera(),true,.5);
 let draws=0;cue.group.traverse(o=>{if(o instanceof T.Mesh){draws++;for(const m of Array.isArray(o.material)?o.material:[o.material]){assert.equal(m.depthTest,false);assert.equal(m.depthWrite,false);assert(m.transparent);}o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());}});assert.equal(draws,3);
});

test('stationary solo and multiplayer fighters keep server damage ticking after a tab resumes',()=>{
 const actor:ActorState={location:'meta-knight-arena',p:[2000,0,7],q:[0,0,0,1],s:1,state:'Idle',pose:[],fruits:0,achievements:[],name:'Test',variant:0,star:0};
 for(const peers of [1,2]){
  const s=battle(),session=new NetworkSession();session.id='a';session.peerCount=peers;session.room={id:'test',host:'a',epoch:0,fruits:[],starAt:0,mill:false,locks:{},knightBattle:s};
  const frames:any[]=[];(session as any).socket={readyState:1,bufferedAmount:0,send:(value:string)=>frames.push(JSON.parse(value))};
  for(let i=0;i<20;i++)session.tick(.1,actor,()=>({} as any));assert.equal(frames.length,20);assert(frames.every(f=>f.actor),'the Worker receives a fresh stationary fighter on every damage tick');
  session.event({type:'visible',value:false});session.tick(.1,actor,()=>({} as any));
  session.event({type:'visible',value:true});for(let i=0;i<20;i++)session.tick(.1,actor,()=>({} as any));assert.equal(frames.length,41,'resuming does not return to sparse world checkpoints');
  s.stage='won';frames.length=0;for(let i=0;i<20;i++)session.tick(.1,actor,()=>({} as any));assert(frames.length<20,'the extra cadence ends with the duel');
 }
});
