import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Group,Scene,Texture,PerspectiveCamera} from 'three';
import {GLTFLoader,type GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {KIRBY_VARIANTS} from '../src/variant-palette';
import {knightHelperEligible} from '../src/knight-boss';
import {startKnightBattle,advanceKnightBattle,type KnightActor} from '../src/meta-knight-battle';
import {advanceKnightSideChoices} from '../src/meta-knight-side-choice';
import {HELPER,helperOrbs,startHelperAbility} from '../src/meta-knight-helper';
import {pushKnightOpponent} from '../src/meta-knight-opponents-contact';
import {createPlayerModel} from '../src/player-model';
import {CharacterController} from '../src/controller';
import {MetaKnightHelperView} from '../src/meta-knight-helper-view';

const variant=KIRBY_VARIANTS.findIndex(v=>v[0]==='Мета Пиджи'),epoch=10000;
const actor=():KnightActor=>({id:'bird',variant,metaKnight:false,available:true,p:[0,0,-2],yaw:Math.PI});
function fixture(){const a={...actor(),side:'boss' as const},s=startKnightBattle([a],a.id,epoch,'metapidgie')!;s.stage='rest';s.since=epoch;s.until=epoch+1e6;return {a,s,h:s.players[a.id].helper!};}

test('Meta Pidgie chooses a side only in its own encounter without changing native rig identity',()=>{
 const a=actor(),room={knightBattle:startKnightBattle([a],a.id,epoch,'metapidgie')!,knightSides:{bird:'boss' as const}};
 assert.equal(room.knightBattle.stage,'side-choice');assert.equal(a.metaKnight,false);
 assert(advanceKnightSideChoices(room,[a],epoch+100));assert.equal(room.knightBattle.boss,'metapidgie');
 assert.equal(room.knightBattle.players.bird.side,'boss');assert.equal(room.knightBattle.players.bird.hp,HELPER.hearts);
 assert(Object.keys(room.knightBattle.opponents!).length>0);assert(Object.values(room.knightBattle.opponents!).every(a=>a.variant!==variant));
 assert.equal(startKnightBattle([a],a.id,epoch)!.stage,'intro');
 assert(!knightHelperEligible({variant:17},'metapidgie'));assert(!knightHelperEligible({variant:20},'metapidgie'));
 assert(knightHelperEligible({metaKnight:true}));assert(knightHelperEligible({metaKnight:true},'metapidgie'));
});
test('the side deadline defaults to players and mixed helpers must all choose',()=>{
 const a=actor(),knight={...a,id:'knight',metaKnight:true,variant:18},actors=[a,knight];
 const room={knightBattle:startKnightBattle(actors,a.id,epoch,'metapidgie')!,knightSides:{bird:'boss' as const} as Record<string,'boss'|'players'>};
 assert(!advanceKnightSideChoices(room,actors,epoch+1));assert.equal(room.knightBattle.stage,'side-choice');
 assert(advanceKnightSideChoices(room,actors,epoch+15000));assert.equal(room.knightSides.knight,'players');assert.equal(room.knightBattle.players.bird.side,'boss');assert.equal(room.knightBattle.opponents,undefined);
 const solo={knightBattle:startKnightBattle([a],a.id,epoch,'metapidgie')!,knightSides:{} as Record<string,'boss'|'players'>};
 advanceKnightSideChoices(solo,[a],epoch+15000);assert.equal(solo.knightSides.bird,'players');assert.equal(solo.knightBattle.players.bird.helper,undefined);
});
test('the bird casts all three attacks, damages the NPC pool and can request the united storm',()=>{
 for(const ability of [1,2,3] as const){
  const {a,s,h}=fixture();a.p=[0,0,0];a.yaw=0;const bots=Object.values(s.opponents!);
  for(const [i,bot] of bots.entries()){bot.p=i===0?[0,0,7]:[25+i*2,0,-20];bot.goal=[...bot.p];bot.thinkAt=1e12;bot.shoveReady=1e12;}
  assert(startHelperAbility(s,a,ability,epoch));const cast=h.cast!,hp=s.teamHp!;
  if(ability===3)assert.equal(helperOrbs(cast,cast.release+1).length,1);
  // At this sample, every attack crosses the NPC at z=7.
  advanceKnightBattle(s,[a],cast.release+250);advanceKnightBattle(s,[a],cast.release+450);assert(s.teamHp!<hp,`ability ${ability}`);assert.equal(s.hp,12);assert.equal(s.players.bird.hp,HELPER.hearts);
 }
 const {a,s}=fixture();assert.equal(startHelperAbility(s,a,4,epoch),true);delete s.duet;
 const restored=structuredClone(s);assert(startHelperAbility(restored,a,1,epoch));assert.equal(restored.players.bird.side,'boss');
});
test('ordinary shoves work both ways for the bird and NPCs',()=>{
 const {a,s}=fixture(),bot=Object.values(s.opponents!)[0];a.p=[-12,0,0];a.yaw=Math.PI/2;bot.p=[-9,0,0];bot.goal=[...bot.p];bot.thinkAt=1e12;
 const hp=s.players.bird.hp;assert.equal(pushKnightOpponent(s,a,epoch),bot.id);assert(s.players[bot.id].bump);assert.equal(s.players.bird.hp,hp);
 delete s.players[bot.id].bump;bot.shove={at:epoch,release:epoch+300,target:a.id,yaw:-Math.PI/2};
 advanceKnightBattle(s,[a],epoch+350);assert(s.players.bird.bump,'NPC counter shove targets a bird helper');
});
test('actual bird helper presentation uses native poses and finite effects without sword joints',async()=>{
 const bytes=await readFile(new URL('../public/models/metapidgie-animated.glb',import.meta.url)),loader=new GLTFLoader();loader.register(()=>({name:'NodeTextureMetadata',loadTexture:()=>Promise.resolve(new Texture())}));
 const gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),''),model=createPlayerModel({scene:new Group(),animations:[]} as unknown as GLTF,KIRBY_VARIANTS[variant],undefined,false,undefined,undefined,{metapidgie:gltf});
 const c=new CharacterController(model.model,model.clips),scene=new Scene();scene.add(c.actor);
 const view=new MetaKnightHelperView(c,()=>{});assert(view.prepareEyes());assert(c.isPigeon&&!c.isMetaKnight);
 for(const ability of [1,2,3] as const){const {a,s,h}=fixture();assert(startHelperAbility(s,a,ability,epoch));const cast=h.cast!;
  for(const now of [cast.at,cast.release-1,cast.release+100,cast.end+100,cast.recoverUntil+1]){
   view.update(s,a.id,now,1/60,new PerspectiveCamera());scene.updateMatrixWorld(true);
   scene.traverse(n=>assert(n.matrixWorld.elements.every(Number.isFinite),n.name));assert(view.group.visible);
  }
 }
 view.update(undefined,'bird',epoch,0);assert(!view.group.visible);view.dispose();assert(!view.group.parent);
});
test('charcoal asset uses Cinder feather paint while retaining the golden beak material',async()=>{
 const bytes=await readFile(new URL('../public/models/metapidgie-animated.glb',import.meta.url)),length=bytes.readUInt32LE(12),j=JSON.parse(bytes.subarray(20,20+length).toString()),binary=bytes.subarray(28+length),atlas=await readFile(new URL('../design/ugolyok/ugolyok-paint-atlas.png',import.meta.url));
 for(const name of ['Soft painted plumage','Sketch feather paint']){const m=j.materials.find((m:any)=>m.name===name),image=j.images[j.textures[m.pbrMetallicRoughness.baseColorTexture.index].source],view=j.bufferViews[image.bufferView];assert.deepEqual(binary.subarray(view.byteOffset,view.byteOffset+view.byteLength),atlas);}
 const beak=j.materials.find((m:any)=>m.name==='Galaxia luminous gold beak');assert.deepEqual(beak.emissiveFactor,[1,0.46207699964472876,0.024157632443547246]);assert.equal(beak.pbrMetallicRoughness.baseColorTexture,undefined);
 assert.equal(KIRBY_VARIANTS[variant][1],KIRBY_VARIANTS[20][1]);
});
