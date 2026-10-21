import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Group,Mesh,Scene,Texture,Vector3,type BufferAttribute} from 'three';
import {GLTFLoader,type GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {PidgieNpc} from '../src/pidgie-npc';
import {KIRBY_VARIANTS,isPigeonVariant} from '../src/variant-palette';
import {createPlayerModel} from '../src/player-model';
import {CharacterController} from '../src/controller';
import {actorState,RemotePlayers} from '../src/network-actors';
import {validActor,validWorld} from '../src/network-protocol';
import {applyBread,breadOffering,canPickBread,grantBread,newBread,validBread} from '../src/bread-state';
import {CharacterUnlocks,SNOWBALL_UNLOCK_KEY} from '../src/character-unlocks';
import {parseSave} from '../src/save-game';
import {pidgieFixture} from './pidgie-fixture';
import {remainingVariants,styleVariant} from '../src/variants';
import {lockedCharacterHint} from '../src/locked-character-tooltip';

const bytes=await readFile(new URL('../public/models/pigeon-animated.glb',import.meta.url)),loader=new GLTFLoader();
loader.register(()=>({name:'NodeTextureMetadata',loadTexture:()=>Promise.resolve(new Texture())}));
const pigeon=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const snowBytes=await readFile(new URL('../public/models/snowball-animated.glb',import.meta.url));
const snowball=await loader.parseAsync(snowBytes.buffer.slice(snowBytes.byteOffset,snowBytes.byteOffset+snowBytes.byteLength),'');
const snowVariant=KIRBY_VARIANTS.find(v=>v[0]==='Снежок')!;
const kirby={scene:new Group(),animations:[]} as unknown as GLTF;
const create=(kind:'pidgie'|'snowball')=>new PidgieNpc(kind==='snowball'?snowball:pigeon,{kind,seed:131,safeGround:()=>true});

test('Snowball appends a native pigeon selection and remote model without moving saved IDs',()=>{
 assert.equal(KIRBY_VARIANTS[17][0],'Пиджи');assert.equal(KIRBY_VARIANTS[18][0],'Meta Knight');assert.equal(KIRBY_VARIANTS.indexOf(snowVariant),19);
 assert.equal(remainingVariants(snowVariant).length,14);
 const rig=createPlayerModel(kirby,snowVariant,pigeon,false,undefined,snowball),native=createPlayerModel(kirby,KIRBY_VARIANTS[17],pigeon);
 assert.equal(rig.character,'pigeon');assert.equal(rig.clips,snowball.animations);
 assert.throws(()=>createPlayerModel(kirby,snowVariant,pigeon),/Снежка/);
 assert.deepEqual(snowball.animations.map(c=>[c.name,c.duration]),pigeon.animations.map(c=>[c.name,c.duration]));
 const c=new CharacterController(rig.model,rig.clips);assert(c.isPigeon);
 const state=actorState(c,'Снежок',19);assert(validActor(state));
 const remote=new RemotePlayers(new Scene(),kirby,pigeon,undefined,undefined,snowball);remote.update(new Map([['snow',state]]),.05);
 assert(remote.players.get('snow')?.isPigeon);
 const own=new Set<unknown>(),source=new Set<unknown>();
 rig.model.traverse(n=>{if(n instanceof Mesh)own.add(n.material);});native.model.traverse(n=>{if(n instanceof Mesh)source.add(n.material);});
 assert([...own].every(m=>!source.has(m)));
 for(const root of [rig.model,remote.players.get('snow')!.actor,create('snowball').model]){
  const paints=new Set<string>();root.traverse(n=>{if(n instanceof Mesh)for(const m of Array.isArray(n.material)?n.material:[n.material])if(m.userData.characterTexture)paints.add(m.userData.characterTexture);});
  assert.deepEqual(paints,new Set(['snowball']));
 }
 native.model.traverse(n=>{if(n instanceof Mesh)for(const m of Array.isArray(n.material)?n.material:[n.material])assert(!m.userData.snowballPaint);});
});

test('Snowball embeds its own atlas and native matte materials without changing the authored pigeon geometry',async()=>{
 const length=snowBytes.readUInt32LE(12),json=JSON.parse(snowBytes.subarray(20,20+length).toString()),view=json.bufferViews[json.images[0].bufferView];
 const atlas=await readFile(new URL('../design/snowball/snowball-paint-atlas.png',import.meta.url));
 assert.deepEqual(snowBytes.subarray(28+length+view.byteOffset,28+length+view.byteOffset+view.byteLength),atlas);
 snowball.scene.traverse(node=>{
  if(!(node instanceof Mesh))return;
  const original=pigeon.scene.getObjectByName(node.name) as Mesh;assert(original);
  for(const attribute of ['position','normal','uv','skinIndex','skinWeight']){
   const actual=node.geometry.getAttribute(attribute) as BufferAttribute,expected=original.geometry.getAttribute(attribute);
   if(expected)assert.deepEqual(actual.array,expected.array,`${node.name} / ${attribute}`);
  }
  for(const material of Array.isArray(node.material)?node.material:[node.material]){
   assert.equal(material.userData.characterTexture,'snowball');assert(!material.customProgramCacheKey().includes('snowball-'));
   if(material.name!=='Warm ivory eyes')assert.equal(material.roughness,.97);
  }
 });
 const beak=snowball.scene.getObjectByName('Lower_beak_sculpt_paint') as Mesh,color=beak.geometry.getAttribute('color');
 assert(color.getX(0)>color.getY(0)*1.5,'native vertex paint keeps the beak pink');
});

test('both wild pigeons greet either pigeon player, retain bread priority, and fear other characters',()=>{
 for(const kind of ['pidgie','snowball'] as const)for(const name of ['Пиджи','Снежок','Классический']){
  const bird=create(kind),player={id:'player',position:bird.actor.position.clone().add(new Vector3(0,0,9)),hasBread:false,isPigeon:isPigeonVariant(name)};
  bird.update(.05,[player.position],undefined,[player]);
  assert.equal(bird.phase,player.isPigeon?'greet':'fear',`${kind} / ${name}`);
  if(player.isPigeon){
   for(let i=0;i<90;i++)bird.update(.05,[player.position],undefined,[player]);assert.equal(bird.fearCount,0);
   player.hasBread=true;bird.update(.05,[player.position],undefined,[player]);assert.equal(bird.phase,'follow');
  }
 }
});

test('feeding each bird reserves its own loaf and leaves the other bird independent',()=>{
 const pidgie=create('pidgie'),snow=create('snowball');
 snow.actor.position.copy(pidgie.actor.position).add(new Vector3(20,0,0));
 let bread=newBread();
 for(const [id,bird] of [['pidgie',pidgie],['snowball',snow]] as const){
  const p=bird.actor.position,a={id,p:[p.x,0,p.z-4],yaw:0,size:1,available:true};
  bread=grantBread(bread,a,1000);bread=applyBread(bread,{kind:'feed',bird:id},a,2000,undefined,bird.networkState());
  const offering=breadOffering(bread,id)!;assert(offering);assert.equal(offering.target,id);
  assert(bird.acceptBread(offering));assert(!(id==='pidgie'?snow:pidgie).acceptBread(offering));
  assert.equal(bird.phase,'joy');
 }
 assert(validBread(bread));assert(breadOffering(bread,'pidgie'));assert(breadOffering(bread,'snowball'));
 const {offering,...stale}=bread;assert.equal(offering?.target,'snowball');
 assert(!canPickBread(stale,{id:'thief',p:bread.p,yaw:0,size:1,available:true},100000,[pidgie.networkState(),snow.networkState()]));
 assert(!validBread({...bread,offering:{...offering,target:'unknown'}}));
 for(let i=0;i<200;i++){pidgie.update(.05,[]);snow.update(.05,[]);}
 assert.equal(pidgie.phase,'feast');assert.equal(snow.phase,'feast');
});

test('Snowball unlock persists independently and survives denied storage',()=>{
 const values=new Map<string,string>(),storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);}};
 const unlocks=new CharacterUnlocks(storage);assert(unlocks.isLocked('Снежок'));unlocks.unlockPidgie();assert(unlocks.isLocked('Снежок'));
 assert(unlocks.unlockSnowball());assert(!unlocks.unlockSnowball());assert.equal(values.get(SNOWBALL_UNLOCK_KEY),'1');
 assert(!new CharacterUnlocks(storage).isLocked('Снежок'));
 const denied=new CharacterUnlocks({getItem:()=>{throw Error();},setItem:()=>{throw Error();}});assert(denied.unlockSnowball());assert(!denied.isLocked('Снежок'));
 assert.match(lockedCharacterHint('Снежок'),/хлебушком/);
 const classes=new Set(),element={style:{setProperty(){}},classList:{toggle:(c:string,on:boolean)=>on?classes.add(c):classes.delete(c)}} as unknown as HTMLElement;
 styleVariant(element,snowVariant);assert(classes.has('snowball-character'));styleVariant(element,KIRBY_VARIANTS[17]);assert(!classes.has('snowball-character'));assert(classes.has('pigeon-character'));
});

test('Snowball checkpoint and friendship round-trip in saves and reject malformed network state',()=>{
 const bird=pidgieFixture(),actor={variant:'Снежок',x:0,z:0,yaw:0,size:1,fruitsEaten:0,achievements:['snowballFriend']};
 const save={version:1,savedAt:'2026-10-20',player:actor,npcs:KIRBY_VARIANTS.slice(0,14).map(v=>({...actor,variant:v[0],achievements:[]})),fruits:Array(70).fill(false),pidgie:bird,snowball:{...bird,seed:5}};
 assert.equal(parseSave(JSON.stringify(save)).snowball!.seed,5);assert.throws(()=>parseSave(JSON.stringify({...save,snowball:{...bird,p:[NaN,0,0]}})));
 const a={p:[0,0,0],q:[0,0,0,1],s:1,state:'Idle',pose:[],fruits:0,achievements:[],name:'Кирби',variant:0,star:0};
 const world={npcs:Array.from({length:14},()=>a),npcLife:Array.from({length:14},()=>Array(15).fill(0)),carts:Array.from({length:12},()=>Array(4).fill(0)),balloons:Array.from({length:3},()=>[0,'parked',...Array(14).fill(0)]),bugs:Array.from({length:40},()=>Array(10).fill(0)),pidgie:bird,snowball:bird};
 assert(validWorld(world));assert(!validWorld({...world,snowball:null}));assert(!validWorld({...world,snowball:{...bird,phase:'invalid'}}));
});
