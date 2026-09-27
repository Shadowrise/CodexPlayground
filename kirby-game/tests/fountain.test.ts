import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Vector3} from 'three';
import {CharacterController} from '../src/controller';
import {RainbowFountain} from '../src/fountain';
import {FOUNTAIN_SITE,FOUNTAIN_WATER_Y} from '../src/fountain-site';
import {Ponds} from '../src/ponds';
import {scoreOf,validAchievements} from '../src/score';
import {sortedTasks} from '../src/tasks';
import {actorState} from '../src/network-actors';
import {validActor} from '../src/network-protocol';
import {createForest} from '../src/forest';
import {inWater} from '../src/pond-layout';

async function player(){const bytes=await readFile(new URL('../public/models/kirby-animated.glb',import.meta.url));const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');return new CharacterController(gltf.scene,gltf.animations);}
test('fountain ring floats at the waterline for different sizes and disappears on exit or flight',async()=>{
 const c=await player(),ponds=new Ponds();
 for(const size of [1,2,4]){
  c.actor.scale.setScalar(size);c.actor.position.set(FOUNTAIN_SITE.x+6,0,FOUNTAIN_SITE.z);ponds.apply(c,c.actor.position.clone());
  const ring=c.actor.getObjectByName('Rainbow swim ring')!;assert(ring.visible);assert(c.swimming);
  c.actor.updateMatrixWorld(true);assert(Math.abs(ring.getWorldPosition(new Vector3()).y-FOUNTAIN_WATER_Y)<.05);
  c.update(.02,{forward:false,left:false,right:false});assert.equal(actorState(c,'Кирби',0).state,'Swim');
 }
 c.update(.02,{forward:false,left:false,right:false,jump:true});ponds.apply(c,c.actor.position.clone());assert(!c.actor.getObjectByName('Rainbow swim ring')!.visible);
 c.flight.reset();c.actor.position.set(FOUNTAIN_SITE.x+12,0,FOUNTAIN_SITE.z);ponds.apply(c,c.actor.position.clone());assert(!c.swimming);assert(!c.actor.getObjectByName('Rainbow swim ring')!.visible);
});
test('bathing shrinks gradually, preserves fruit points, awards once and stops on exit',async()=>{
 const c=await player(),f=new RainbowFountain(),ponds=new Ponds();c.actor.scale.setScalar(2);c.fruitsEaten=10;c.actor.position.set(FOUNTAIN_SITE.x+6,0,FOUNTAIN_SITE.z);
 const step=(dt:number)=>{ponds.apply(c,c.actor.position.clone());f.bathe(dt,c);};
 step(.1);assert(c.swimming);assert(c.actor.scale.x<2&&c.actor.scale.x>1.9);assert(!c.achievements.has('swim'));assert(!c.achievements.has('fountain'));
 for(let i=0;i<20;i++)step(.1);assert(c.achievements.has('fountain'));assert.equal(scoreOf(c),13);assert.equal(c.fruitsEaten,10);
 c.actor.position.x+=20;const size=c.savedSize;step(1);assert(!c.swimming);assert.equal(c.savedSize,size);
 c.actor.position.x-=20;for(let i=0;i<100;i++)step(.1);assert.equal(c.savedSize,1);assert.equal(scoreOf(c),13);
 c.grow();for(let i=0;i<30;i++)c.update(1/60,{forward:false,left:false,right:false});assert(Math.abs(c.savedSize-1.1)<1e-8);assert.equal(scoreOf(c),14);
 assert(validAchievements([...c.achievements]));assert(validActor(actorState(c,'Кирби',0)));assert(sortedTasks(c.achievements).some(t=>t.id==='fountain'&&t.done));
});
test('flying over the fountain does not shrink or complete its task, and the centre is solid',async()=>{
 const c=await player(),f=new RainbowFountain(),ponds=new Ponds();c.actor.scale.setScalar(3);c.actor.position.set(FOUNTAIN_SITE.x+6,5,FOUNTAIN_SITE.z);c.flight.press();
 ponds.apply(c,c.actor.position.clone());f.bathe(5,c);assert.equal(c.savedSize,3);assert(!c.achievements.has('fountain'));
 c.flight.reset();c.actor.position.set(FOUNTAIN_SITE.x,0,FOUNTAIN_SITE.z);ponds.apply(c,c.actor.position.clone());assert(c.actor.position.distanceTo(new Vector3(FOUNTAIN_SITE.x,0,FOUNTAIN_SITE.z))>3);
});
test('fountain has clear ground and crowns cannot overlap its reserved plaza',()=>{
 const trees=createForest().userData.treePositions;
 for(const tree of trees)assert(Math.hypot(tree.x-FOUNTAIN_SITE.x,tree.z-FOUNTAIN_SITE.z)>FOUNTAIN_SITE.radius+tree.crownRadius);
 for(let i=0;i<40;i++){const a=i/40*Math.PI*2;assert(!inWater(FOUNTAIN_SITE.x+12*Math.cos(a),FOUNTAIN_SITE.z+12*Math.sin(a)));}
});
