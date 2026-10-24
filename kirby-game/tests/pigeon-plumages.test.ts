import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Group,Mesh,Scene,Texture,Vector3} from 'three';
import {GLTFLoader,type GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {WILD_PIGEONS,pigeonFriendAchievement,wildPigeonName,type WildPigeonId} from '../src/wild-pigeons';
import {KIRBY_VARIANTS,isPigeonVariant} from '../src/variant-palette';
import {createPlayerModel} from '../src/player-model';
import {CharacterController} from '../src/controller';
import {actorState,RemotePlayers} from '../src/network-actors';
import {CharacterUnlocks,UGOLYOK_UNLOCK_KEY,RYZHIK_UNLOCK_KEY} from '../src/character-unlocks';
import {PidgieNpc} from '../src/pidgie-npc';
import {PigeonFlock} from '../src/pigeon-flock';
import {applyBread,breadOffering,grantBread,newBread,validBread} from '../src/bread-state';
import {validWorld} from '../src/network-protocol';
import {parseSave} from '../src/save-game';
import {achievementPoints} from '../src/score';
import {lockedCharacterHint} from '../src/locked-character-tooltip';
import {pidgieFriendLog,pidgieScareLog,pidgieInterestLog} from '../src/world-log';
import {setLocale,t} from '../src/i18n';
import {pidgieFixture} from './pidgie-fixture';

const loader=new GLTFLoader();loader.register(()=>({name:'NodeTextureMetadata',loadTexture:()=>Promise.resolve(new Texture())}));
const load=async(id:string)=>{
 const bytes=await readFile(new URL(`../public/models/${id==='pidgie'?'pigeon':id}-animated.glb`,import.meta.url));
 return {bytes,model:await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')};
};
const sources=Object.fromEntries(await Promise.all(WILD_PIGEONS.map(async id=>[id,await load(id)]))) as Record<WildPigeonId,{bytes:Buffer;model:GLTF}>;
const templates=Object.fromEntries(WILD_PIGEONS.map(id=>[id,sources[id].model])) as Record<typeof WILD_PIGEONS[number],GLTF>;
const kirby={scene:new Group(),animations:[]} as unknown as GLTF;

test('new plumages embed their own feather atlases and preserve the complete authored rig and animations',async()=>{
 for(const id of ['ugolyok','ryzhik'] as const){
  const {bytes,model}=sources[id],length=bytes.readUInt32LE(12),gltf=JSON.parse(bytes.subarray(20,20+length).toString());
  const view=gltf.bufferViews[gltf.images[0].bufferView],atlas=await readFile(new URL(`../design/${id}/${id}-paint-atlas.png`,import.meta.url));
  assert.deepEqual(bytes.subarray(28+length+view.byteOffset,28+length+view.byteOffset+view.byteLength),atlas);
  assert.equal(model.animations.length,templates.pidgie.animations.length);
  for(const [i,clip] of model.animations.entries()){
   const original=templates.pidgie.animations[i];assert.equal(clip.name,original.name);assert.equal(clip.duration,original.duration);assert.equal(clip.tracks.length,original.tracks.length);
   for(const [j,track] of clip.tracks.entries()){assert.equal(track.name,original.tracks[j].name);assert.deepEqual(track.times,original.tracks[j].times);assert.deepEqual(track.values,original.tracks[j].values);}
  }
  model.scene.traverse(node=>{
   if(!(node instanceof Mesh))return;
   const original=templates.pidgie.scene.getObjectByName(node.name) as Mesh;assert(original);
   for(const attribute of ['position','normal','uv','skinIndex','skinWeight']){
    const expected=original.geometry.getAttribute(attribute);if(expected)assert.deepEqual(node.geometry.getAttribute(attribute).array,expected.array,`${id}/${node.name}/${attribute}`);
   }
   assert.deepEqual(node.geometry.index?.array,original.geometry.index?.array);
   for(const kind of ['position','normal'] as const)for(const [i,morph] of (original.geometry.morphAttributes[kind]??[]).entries())assert.deepEqual(node.geometry.morphAttributes[kind]![i].array,morph.array);
   for(const material of Array.isArray(node.material)?node.material:[node.material])assert.equal(material.userData.characterTexture,id);
  });
 }
});

test('new selectable players and remote players use their native paint and pigeon controller without moving saved variant IDs',()=>{
 assert.deepEqual(KIRBY_VARIANTS.slice(17).map(v=>v[0]),['Пиджи','Meta Knight','Снежок','Уголёк','Рыжик']);
 const remote=new RemotePlayers(new Scene(),kirby,templates.pidgie,undefined,undefined,templates.snowball,templates);
 for(const id of ['ugolyok','ryzhik'] as const){
  const variant=KIRBY_VARIANTS.find(v=>v[0]===wildPigeonName(id))!,index=KIRBY_VARIANTS.indexOf(variant);
  assert(isPigeonVariant(variant[0]));assert.throws(()=>createPlayerModel(kirby,variant,templates.pidgie));
  const rig=createPlayerModel(kirby,variant,templates.pidgie,false,undefined,templates.snowball,templates),player=new CharacterController(rig.model,rig.clips);
  assert(player.isPigeon);assert.equal(rig.clips,templates[id].animations);
  remote.update(new Map([[id,actorState(player,variant[0],index)]]),.05);
  assert(remote.players.get(id)?.isPigeon);
  for(const root of [rig.model,remote.players.get(id)!.actor]){
   const paints=new Set<string>();root.traverse(node=>{if(node instanceof Mesh)for(const material of Array.isArray(node.material)?node.material:[node.material])if(material.userData.characterTexture)paints.add(material.userData.characterTexture);});
   assert.deepEqual(paints,new Set([id]));
  }
 }
 remote.clear();
});

test('all four wild birds use identical bread, scare and greeting rules, and reserve separate offerings',()=>{
 let bread=newBread();const birds=WILD_PIGEONS.map((id,i)=>{
  const npc=new PidgieNpc(templates[id],{kind:id,seed:131,safeGround:()=>true});
  npc.actor.position.set(i*30,0,0);return {id,npc};
 });
 for(const {id,npc} of birds){
  const position=npc.actor.position.clone().add(new Vector3(0,0,-4)),actor={id,p:position.toArray(),yaw:0,size:1,available:true};
  assert.equal(applyBread(bread,{kind:'feed',bird:id},actor,1000,undefined,npc.networkState()),bread);
  bread=grantBread(bread,actor,1000);
  assert.equal(applyBread(bread,{kind:'feed',bird:id},{...actor,yaw:Math.PI},2000,undefined,npc.networkState()),bread);
  bread=applyBread(bread,{kind:'feed',bird:id},actor,2000,undefined,npc.networkState());
  const offering=breadOffering(bread,id)!;assert(offering);assert(npc.acceptBread(offering));
  for(const other of birds.filter(b=>b.id!==id))assert(!other.npc.acceptBread(offering));
  for(let step=0;step<240;step++)npc.update(.05,[]);assert.equal(npc.phase,'feast');
  const wild=new PidgieNpc(templates[id],{kind:id,seed:131,safeGround:()=>true});
  const near=wild.actor.position.clone().add(new Vector3(0,0,9));wild.update(.05,[near],undefined,[{id:'player',position:near,hasBread:false,isPigeon:false}]);assert.equal(wild.phase,'fear');
  const social=new PidgieNpc(templates[id],{kind:id,seed:131,safeGround:()=>true});
  const friend=social.actor.position.clone().add(new Vector3(0,0,9));social.update(.05,[friend],undefined,[{id:'player',position:friend,hasBread:false,isPigeon:true}]);assert.equal(social.phase,'greet');
 }
 assert(validBread(bread));for(const id of WILD_PIGEONS)assert.equal(breadOffering(bread,id)?.target,id);
});

test('feeding unlocks each new character independently, persists through reload and denied storage, and awards ten points',()=>{
 const values=new Map<string,string>(),storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);}},progress=new CharacterUnlocks(storage);
 for(const [id,key] of [['ugolyok',UGOLYOK_UNLOCK_KEY],['ryzhik',RYZHIK_UNLOCK_KEY]] as const){
  const name=wildPigeonName(id);assert(progress.isLocked(name));assert(progress.unlockPigeon(id));assert(!progress.unlockPigeon(id));
  assert.equal(values.get(key),'1');assert(!new CharacterUnlocks(storage).isLocked(name));assert(progress.isLocked('Пиджи'));assert(progress.isLocked('Снежок'));
  assert.equal(achievementPoints([pigeonFriendAchievement(id)]),10);assert.match(lockedCharacterHint(name),new RegExp(name));
  const denied=new CharacterUnlocks({getItem(){throw Error();},setItem(){throw Error();}});assert(denied.unlockPigeon(id));assert(!denied.isLocked(name));
  for(const locale of ['en','bg'] as const){
   setLocale(locale);for(const text of [name,lockedCharacterHint(name),pidgieFriendLog('{0}',id).text,pidgieScareLog('{0}',id).text,pidgieInterestLog('{0}',id).text])assert.notEqual(t(text),text,`${locale}/${text}`);
  }setLocale('ru');
 }
});

test('four bird checkpoints and earned friendships round-trip in saves and reject malformed network data',()=>{
 const bird=pidgieFixture(),actor={variant:'Уголёк',x:0,z:0,yaw:0,size:1,fruitsEaten:0,achievements:['ugolyokFriend','ryzhikFriend']};
 const checkpoints=Object.fromEntries(WILD_PIGEONS.map((id,i)=>[id,{...bird,seed:i+1}]));
 const save={version:1,savedAt:'2026-10-24',player:actor,npcs:KIRBY_VARIANTS.slice(0,14).map(v=>({...actor,variant:v[0],achievements:[]})),fruits:Array(70).fill(false),...checkpoints};
 const restored=parseSave(JSON.stringify(save));assert.equal(restored.ugolyok?.seed,3);assert.equal(restored.ryzhik?.seed,4);
 const a={p:[0,0,0],q:[0,0,0,1],s:1,state:'Idle',pose:[],fruits:0,achievements:[],name:'Кирби',variant:0,star:0};
 const world={npcs:Array.from({length:14},()=>a),npcLife:Array.from({length:14},()=>Array(15).fill(0)),carts:Array.from({length:12},()=>Array(4).fill(0)),balloons:Array.from({length:3},()=>[0,'parked',...Array(14).fill(0)]),bugs:Array.from({length:40},()=>Array(10).fill(0)),...checkpoints};
 assert(validWorld(world));
 for(const id of WILD_PIGEONS){assert(!validWorld({...world,[id]:null}));assert.throws(()=>parseSave(JSON.stringify({...save,[id]:{...bird,phase:'invalid'}})));}
});

test('admin flocks render and synchronize every native plumage with the same shared behavior',()=>{
 const flock=new PigeonFlock(templates,{safeGround:()=>true}),player={id:'target',position:new Vector3(),hasBread:false};
 const specs=WILD_PIGEONS.map((skin,i)=>({id:skin,playerId:'target',skin,seed:i+1,order:i}));
 for(let step=0;step<240;step++)flock.update(.05,specs,true,[player],[player.position]);
 assert.equal(flock.birds.size,4);
 for(const id of WILD_PIGEONS){const bird=flock.birds.get(id)!;assert.equal(bird.spec.skin,id);assert.equal(bird.npc.phase,'follow');}
 const paints=new Set<string>();flock.group.traverse(node=>{if(node instanceof Mesh)for(const material of Array.isArray(node.material)?node.material:[node.material])if(material.userData.characterTexture)paints.add(material.userData.characterTexture);});
 assert.deepEqual(paints,new Set(['snowball','ugolyok','ryzhik']));
 flock.clear();
});
