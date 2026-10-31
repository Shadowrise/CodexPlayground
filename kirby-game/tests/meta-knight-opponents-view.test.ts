import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Scene,Group,Texture} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {CharacterController} from '../src/controller';
import {createPlayerModel} from '../src/player-model';
import {KIRBY_VARIANTS} from '../src/variant-palette';
import {startKnightBattle} from '../src/meta-knight-battle';
import {MetaKnightOpponentsView} from '../src/meta-knight-opponents-view';

test('both Kirby feet follow the real running clip across short movement pauses and damage',async()=>{
 const loader=new GLTFLoader();loader.register(()=>({name:'TestTextures',loadTexture:()=>Promise.resolve(new Texture())}));const bytes=await readFile(new URL('../public/models/kirby-animated.glb',import.meta.url)),gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const s=startKnightBattle([{id:'helper',p:[0,0,-2],yaw:0,available:true,metaKnight:true,side:'boss'}],'helper',100000)!;
 const view=new MetaKnightOpponentsView(()=>{const m=createPlayerModel(gltf,KIRBY_VARIANTS[0]);return new CharacterController(m.model,m.clips);}),scene=new Scene(),frame=new Group();scene.add(frame);
 view.update(s,scene,frame,100000,1/60);const c=view.characters.get('knight-ai:0')!,left=c.actor.getObjectByName('Left_foot_pivot')!,right=c.actor.getObjectByName('Right_foot_pivot')!;assert(left&&right);assert.equal(c.actor.userData.location,'meta-knight-arena','the ascent effect must discover AI bodies just like human bodies');
 const positions:number[][]=[],rotations:number[][]=[];
 for(let i=1;i<=75;i++){
  const a=s.opponents!['knight-ai:0'];a.moving=i%7!==0;if(a.moving)a.p[0]+=.1;if(i===35){s.teamHp!--;for(const p of Object.values(s.players))if(p.side!=='boss')p.hp=s.teamHp!;}
  view.update(s,scene,frame,100000+i*1000/60,1/60);positions.push([...left.position.toArray(),...right.position.toArray()]);rotations.push([...left.quaternion.toArray(),...right.quaternion.toArray()]);assert.equal(c.state,'Run');
 }
 for(const offset of [0,3])assert(Math.max(...positions.map(p=>p[offset+2]))-Math.min(...positions.map(p=>p[offset+2]))>.08,'each foot must take visible steps');
 for(const offset of [0,4])assert(rotations.some(p=>Math.hypot(...p.slice(offset,offset+4).map((v,i)=>v-rotations[0][offset+i]))>.05),'both feet must change angle');
 view.dispose();assert.equal(view.characters.size,0);
});
