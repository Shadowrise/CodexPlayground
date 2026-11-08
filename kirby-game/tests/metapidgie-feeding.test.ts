import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newPigeonFeeding,recordPigeonFeeding,validPigeonFeeding,allPigeonsFed,openFedPigeonPortal} from '../src/metapidgie-feeding';
import {WILD_PIGEONS} from '../src/wild-pigeons';
import {createMetaKnightPortal} from '../src/meta-knight-portal';
import {parseSave} from '../src/save-game';
import {KIRBY_VARIANTS} from '../src/variants';
import {METAPIDGIE_LOCK_HINT} from '../src/locked-character-tooltip';
import {METAPIDGIE_FEEDING_PORTAL_MESSAGE,metaKnightSealLogs} from '../src/world-log';
import {setLocale,t} from '../src/i18n';
import {Mesh,ShaderMaterial} from 'three';
import {pidgieFixture} from './pidgie-fixture';

test('five distinct meadow friends are counted once across players, with immutable progress',()=>{
 const empty=newPigeonFeeding();let progress=empty;
 for(const [i,id] of WILD_PIGEONS.entries()){
  const previous=progress;progress=recordPigeonFeeding(progress,id,i%2?'guest':'host',1000+i);
  assert.notEqual(progress,previous);assert(!previous.fed[id]);assert(validPigeonFeeding(progress));assert.equal(allPigeonsFed(progress),i===4);
  assert.equal(recordPigeonFeeding(progress,id,'other',2000),progress);
 }
 assert.deepEqual(empty,newPigeonFeeding());assert.equal(recordPigeonFeeding(progress,'summoned:1' as any,'host',1000),progress);
 assert.deepEqual(JSON.parse(JSON.stringify(progress)),progress);
 for(const value of [null,[],{}, {fed:[]},{fed:{unknown:{by:'a',at:1}}},{fed:{pidgie:{by:'',at:1}}},{fed:{pidgie:{by:'a',at:-1}}},{fed:{pidgie:{by:'a',at:1,unlock:true}}},{fed:{},open:true}])assert(!validPigeonFeeding(value));
});

test('last friend replaces a previously open Knight portal and battle, without altering badges',()=>{
 const room:any={pigeonFeeding:newPigeonFeeding(),metaKnightPortalOpen:true,portalBoss:'meta-knight',knightBattle:{stage:'intro'},knightSides:{a:'boss'},sealProgress:{collected:{maze:{by:'a',at:1}}}};
 const seals=structuredClone(room.sealProgress);
 for(const [i,id] of WILD_PIGEONS.entries()){room.pigeonFeeding=recordPigeonFeeding(room.pigeonFeeding,id,'a',i);assert.equal(openFedPigeonPortal(room),i===4);}
 assert.equal(room.portalBoss,'metapidgie');assert.equal(room.metaKnightPortalOpen,true);assert.equal(room.knightBattle,undefined);assert.deepEqual(room.knightSides,{});assert.deepEqual(room.sealProgress,seals);
 room.knightBattle={stage:'intro',boss:'metapidgie'};assert.equal(openFedPigeonPortal(room),false);assert(room.knightBattle,'idempotent calls preserve the new fight');
 assert.equal(metaKnightSealLogs('a',3,false).length,1,'later badges do not announce a replacement Knight portal');
});

test('solo saves preserve feathers and reject malformed progress while old saves remain valid',()=>{
 const actor=(variant:string)=>({variant,x:0,z:0,yaw:0,size:1,fruitsEaten:0});
 const save={version:1,savedAt:'2026-11-08',player:actor(KIRBY_VARIANTS[14][0]),npcs:KIRBY_VARIANTS.slice(0,14).map(v=>actor(v[0])),fruits:Array(70).fill(false)};
 const pigeonFeeding=recordPigeonFeeding(newPigeonFeeding(),'snowball','solo',123);
 assert.deepEqual(parseSave(JSON.stringify({...save,pigeonFeeding})).pigeonFeeding,pigeonFeeding);
 assert.deepEqual(parseSave(JSON.stringify(save)).pigeonFeeding,newPigeonFeeding());
 const birds=Object.fromEntries(WILD_PIGEONS.map(id=>[id,{...pidgieFixture(),phase:'feast',friend:{by:'solo',at:123,bird:[0,0,4],bread:[0,0,2],target:id}}]));
 const migrated=parseSave(JSON.stringify({...save,...birds,portal:{open:true,boss:'meta-knight'}}));
 assert(allPigeonsFed(migrated.pigeonFeeding!));assert.deepEqual(migrated.portal,{open:true,override:true,boss:'metapidgie'});
 assert.throws(()=>parseSave(JSON.stringify({...save,pigeonFeeding:{fed:{fake:{by:'solo',at:1}}}})));
});

test('both gateways can switch their actual circular surface and feather, preserving dormant and Knight states',()=>{
 const portal=createMetaKnightPortal(),veil=portal.group.getObjectByName('Portal swirling surface') as Mesh;
 const shader=veil.material as ShaderMaterial,feather=portal.group.getObjectByName('Meta Pidgie portal feather')!;
 assert.equal(shader.uniforms.pidgey.value,0);assert(!feather.visible);
 portal.setBoss('metapidgie');assert.equal(shader.uniforms.pidgey.value,1);assert(feather.visible);
 portal.setWorking(false);assert(!veil.visible);assert(!feather.visible);
 portal.setWorking(true);assert(veil.visible);assert(feather.visible);
 portal.setBoss('meta-knight');assert.equal(shader.uniforms.pidgey.value,0);assert(!feather.visible);portal.dispose();
});

test('the feeding hint and announcement are localized in all three languages',()=>{
 try{for(const locale of ['en','bg'] as const){setLocale(locale);for(const message of [METAPIDGIE_LOCK_HINT,METAPIDGIE_FEEDING_PORTAL_MESSAGE,'Перышки Мета Пиджи','Все друзья сыты! Портал Мета Пиджи открыт!'])assert.notEqual(t(message),message);}}finally{setLocale('ru');}
 assert.match(METAPIDGIE_LOCK_HINT,/все его друзья.*сыты/);
});
