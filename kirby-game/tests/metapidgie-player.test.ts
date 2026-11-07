import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Group,Mesh,Scene,SkinnedMesh,Texture} from 'three';
import {GLTFLoader,type GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {CharacterUnlocks,METAPIDGIE_UNLOCK_KEY} from '../src/character-unlocks';
import {KIRBY_VARIANTS,isPigeonVariant} from '../src/variant-palette';
import {WILD_PIGEONS,wildPigeonId} from '../src/wild-pigeons';
import {parseChatCommand,commandSuggestions} from '../src/chat-commands';
import {lockedCharacterHint,METAPIDGIE_LOCK_HINT} from '../src/locked-character-tooltip';
import {setLocale,t} from '../src/i18n';
import {createPlayerModel} from '../src/player-model';
import {CharacterController} from '../src/controller';
import {PIGEON_CLIPS} from '../src/pigeon-clips';
import {actorState,RemotePlayers} from '../src/network-actors';
import {validActor} from '../src/network-protocol';
import {SCORE_ACTIONS} from '../src/score';

const variant=KIRBY_VARIANTS.find(v=>v[0]==='Мета Пиджи')!;
const index=KIRBY_VARIANTS.indexOf(variant);

test('Meta Pidgie starts locked; achievements and other bird unlocks cannot unlock it',()=>{
 const values=new Map<string,string>(),storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);}};
 const unlocks=new CharacterUnlocks(storage);
 assert(unlocks.isLocked(variant[0]));unlocks.complete(SCORE_ACTIONS);
 for(const id of WILD_PIGEONS)unlocks.unlockPigeon(id);
 unlocks.unlockMetaKnight();assert(unlocks.isLocked(variant[0]));
 assert(unlocks.unlockMetapidgie());assert(!unlocks.isLocked(variant[0]));assert(!unlocks.unlockMetapidgie());
 assert.equal(values.get(METAPIDGIE_UNLOCK_KEY),'1');assert(!new CharacterUnlocks(storage).isLocked(variant[0]));
 for(const storage of [undefined,{getItem:()=>{throw Error('denied');},setItem:()=>{throw Error('denied');}}]){
  const denied=new CharacterUnlocks(storage);assert(denied.isLocked(variant[0]));assert(denied.unlockMetapidgie());assert(!denied.isLocked(variant[0]));
 }
 assert(new CharacterUnlocks({getItem:()=> 'true',setItem:()=>{}}).isLocked(variant[0]));
});

test('Meta Pidgie appends to stable IDs and is a playable bird outside the wild flock',()=>{
 assert.equal(index,23);assert.equal(KIRBY_VARIANTS[17][0],'Пиджи');assert.equal(KIRBY_VARIANTS[18][0],'Meta Knight');assert.equal(KIRBY_VARIANTS[22][0],'Курлык');
 assert(isPigeonVariant(variant[0]));assert.equal(wildPigeonId(variant[0]),undefined);assert.equal(WILD_PIGEONS.length,5);
});

test('complete solo command unlocks Meta Pidgie and suggestions and mystery hint localize',()=>{
 for(const text of ['/unlock metapidgie',' /UNLOCK   METAPIDGIE '])assert.deepEqual(parseChatCommand(text,true,[]),{command:{kind:'unlock',character:'metapidgie'}});
 for(const text of ['/unlock metapid','/unlock metapidgie extra','/unlock Мета Пиджи'])assert(parseChatCommand(text,true,[])?.error);
 assert(parseChatCommand('/unlock metapidgie',false,[])?.error);assert.deepEqual(commandSuggestions('/unlock metapidgie',false,[]),[]);
 assert.deepEqual(commandSuggestions('/unlock meta',true,[]).map(s=>s.value),['/unlock meta-knight','/unlock metapidgie']);
 assert.equal(lockedCharacterHint(variant[0]),METAPIDGIE_LOCK_HINT);assert.doesNotMatch(METAPIDGIE_LOCK_HINT,/unlock|команд|хлеб|победи/i);
 try{for(const locale of ['ru','en','bg'] as const){
  setLocale(locale);const [suggestion]=commandSuggestions('/unlock metap',true,[]);
  assert.equal(suggestion.value,'/unlock metapidgie');assert.equal(suggestion.description,t(variant[0]));
  assert.match(t(parseChatCommand('/unlock',true,[])!.error!),/\/unlock metapidgie/);
  if(locale==='en')assert.equal(suggestion.description,'Meta Pidgie');
  if(locale!=='ru')assert.notEqual(t(METAPIDGIE_LOCK_HINT),METAPIDGIE_LOCK_HINT);
 }}finally{setLocale('ru');}
});

async function load(){
 const bytes=await readFile(new URL('../public/models/metapidgie-animated.glb',import.meta.url));
 const loader=new GLTFLoader();loader.register(()=>({name:'NodeTextureMetadata',loadTexture:()=>Promise.resolve(new Texture())}));
 return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
}
const model=load(),kirby={scene:new Group(),animations:[]} as unknown as GLTF;

test('actual armored model has every player clip and isolated native skeletons and materials',async()=>{
 const source=await model;
 assert.deepEqual(new Set(source.animations.map(c=>c.name)),new Set(PIGEON_CLIPS.map(c=>c.name)));
 const make=()=>createPlayerModel(kirby,variant,undefined,false,undefined,undefined,{metapidgie:source});
 const first=make(),second=make();assert.equal(first.character,'pigeon');
 assert(first.model.getObjectByName('Metapidgie_helmet_shell'));
 let armor=0,skins=0;
 first.model.traverse(n=>{
  if(n.name.startsWith('Commander_'))armor++;
  if(!(n instanceof Mesh))return;
  const original=source.scene.getObjectByName(n.name) as Mesh,other=second.model.getObjectByName(n.name) as Mesh;
  assert.equal(n.geometry,original.geometry);assert.notEqual(n.material,original.material);assert.notEqual(n.material,other.material);
  if(n instanceof SkinnedMesh){skins++;assert.notEqual(n.skeleton,(other as SkinnedMesh).skeleton);assert.notEqual(n.skeleton.bones[0],(other as SkinnedMesh).skeleton.bones[0]);}
 });
 assert(armor>5);assert(skins>0);
 const controller=new CharacterController(first.model,first.clips);assert(controller.isPigeon);assert(!controller.isMetaKnight);
 for(const {name} of PIGEON_CLIPS){controller.setActivity(name);controller.mixer.update(.15);controller.actor.updateMatrixWorld(true);assert.equal(controller.state,name);}
 controller.setActivity('Idle');assert(controller.startEmote('Peck'));assert.equal(controller.state,'Peck');
 assert.throws(()=>createPlayerModel(kirby,variant),/Мета Пиджи/);
});

test('remote players wait for the armored asset and then render its bird states',async()=>{
 const source=await model,rig=createPlayerModel(kirby,variant,source,false,undefined,undefined,{metapidgie:source}),c=new CharacterController(rig.model,rig.clips);
 const models:{metapidgie?:GLTF}={},remote=new RemotePlayers(new Scene(),kirby,source,undefined,undefined,undefined,models);
 c.setActivity('Fly');const snapshot=actorState(c,'PG',index);assert(validActor(snapshot));
 remote.update(new Map([['pg',snapshot]]),1/60);assert.equal(remote.players.size,0);
 models.metapidgie=source;
 for(const state of ['Run','Fly','Swim','Sleep','Hello','Joy','Peck']){
  c.setActivity(state);c.mixer.update(.3);const snapshot=actorState(c,'PG',index);assert(validActor(snapshot));
  remote.update(new Map([['pg',snapshot]]),1/60);assert(remote.players.get('pg')!.isPigeon);assert(!remote.players.get('pg')!.isMetaKnight);assert.equal(remote.players.get('pg')!.state,state);
 }
 remote.clear();assert.equal(remote.players.size,0);
});
