import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Vector3} from 'three';
import {CharacterController} from '../src/controller';
import {MountainLedges} from '../src/mountain-ledges';
import {MOUNTAIN_SUMMIT,MOUNTAIN_PEAK,mountainWorld} from '../src/mountain-ledges-layout';
import {mountainSurfaceHeight} from '../src/mountain-surface';
import {actorState,restoreNetworkPlayer} from '../src/network-actors';
import {validActor} from '../src/network-protocol';
import {insideMeadow} from '../src/world-bounds';
const idle={forward:false,left:false,right:false};
async function player(){const bytes=await readFile(new URL('../public/models/kirby-animated.glb',import.meta.url));const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');return new CharacterController(gltf.scene,gltf.animations);}
const position=(rest:typeof MOUNTAIN_SUMMIT)=>{const p=mountainWorld(rest.tangent,rest.radial);return new Vector3(p.x,rest.y,p.z);};

test('grounded bread and peak landings unlock the latest recovery flag, including network resume',async()=>{
  const c=await player(),sounds:string[]=[],world=new MountainLedges(undefined,s=>sounds.push(s));
  c.positionConstraint=world.constrainTravel;
  c.actor.position.copy(world.recovery.trampoline.position);assert.equal(world.prompt(c),'');assert(!world.start(c));
  c.actor.position.copy(position(MOUNTAIN_SUMMIT));c.actor.position.y-=.2;world.apply(c,c.actor.position.clone().setY(MOUNTAIN_SUMMIT.y-.3),.016);assert.equal(c.mountainCheckpoint,0,'passing below the platform does not unlock it');
  for(const [index,rest] of [MOUNTAIN_SUMMIT,MOUNTAIN_PEAK].entries()){
    c.setActivity('Idle');c.actor.position.copy(position(rest));c.surfaceY=rest.y;world.restorePosition(c);world.apply(c,c.actor.position.clone(),0);
    assert.equal(c.mountainCheckpoint,index+1);world.apply(c,c.actor.position.clone(),0);
    assert.equal(sounds.length,index+1,'each flag chimes once');
  }
  c.actor.position.copy(position(MOUNTAIN_SUMMIT));c.surfaceY=MOUNTAIN_SUMMIT.y;world.restorePosition(c);world.apply(c,c.actor.position.clone(),0);assert.equal(c.mountainCheckpoint,2,'descending never downgrades the peak flag');
  const saved=actorState(c,'Кирби',0),restored=await player();assert(validActor(saved));restoreNetworkPlayer(restored,saved);assert.equal(restored.mountainCheckpoint,2);
  for(const bad of [-1,3,1.1,'2'])assert(!validActor({...saved,progress:{...saved.progress!,mountainCheckpoint:bad}}));
  const legacy=structuredClone(saved);delete legacy.progress!.mountainCheckpoint;assert(validActor(legacy));restoreNetworkPlayer(restored,legacy);assert.equal(restored.mountainCheckpoint,0);
});

test('recovery lands on fabric before launching, clears terrain, and ends on either permanent platform',async()=>{
  const c=await player(),sounds:string[]=[],world=new MountainLedges(undefined,s=>sounds.push(s));
  c.positionConstraint=world.constrainTravel;
  world.group.updateMatrixWorld(true);
  assert(world.recovery.trampoline.getWorldPosition(new Vector3()).distanceTo(world.recovery.trampoline.position)<.001,'pad is rendered at its interaction position');
  for(const [index,rest] of [MOUNTAIN_SUMMIT,MOUNTAIN_PEAK].entries()){
    c.mountainCheckpoint=index+1;c.actor.position.copy(world.recovery.trampoline.position);c.surfaceY=0;world.resetPlayer();
    assert(world.prompt(c));assert(world.start(c));assert(!world.start(c));
    world.update(.3,[],true,c);assert(c.actor.position.y<2);assert.equal(sounds.length,index);
    world.update(.3,[],true,c);assert(c.actor.position.distanceTo(world.recovery.trampoline.position)<1);assert.equal(sounds.length,index);
    for(let frame=0;frame<230;frame++){
      world.update(1/60,[],true,c);
      assert(mountainSurfaceHeight(c.actor.position.x,c.actor.position.z)<c.actor.position.y+.02,'scripted jump stays outside the mountain');
    }
    assert.equal(world.active,false);assert(c.actor.position.distanceTo(position(rest))<.001);assert.equal(c.surfaceY,rest.y);assert.equal(sounds.at(-1),'bounce');
    for(let frame=0;frame<30;frame++){const previous=c.actor.position.clone();c.update(1/60,idle);world.apply(c,previous,1/60);}
    assert.equal(c.actor.position.y,rest.y,'ordinary movement retains the trampoline landing');
  }
  c.actor.position.copy(world.recovery.trampoline.position);assert(world.start(c));world.update(.6,[],true,c);world.cancel();assert(!world.active);assert.equal(c.state,'Idle');
  assert.equal(world.recovery.trampoline.getObjectByName('Spring pad')!.position.y,.52);
});

test('the summit trampoline carries Kirby clear of the ridge into soft leaves and permits another ascent',async()=>{
  const c=await player(),sounds:string[]=[],world=new MountainLedges(undefined,s=>sounds.push(s));c.positionConstraint=world.constrainTravel;
  assert(insideMeadow(world.recovery.landing,10),'even the largest body lands inside the playable meadow');
  c.mountainCheckpoint=2;c.actor.position.copy(world.recovery.upper.position);c.surfaceY=MOUNTAIN_PEAK.y;world.restorePosition(c);
  assert.match(world.prompt(c),/листья/);assert.equal(world.recovery.target(c),world.recovery.upper);assert(world.start(c));
  for(let frame=0;frame<300;frame++){
    world.update(1/60,[],true,c);
    assert(mountainSurfaceHeight(c.actor.position.x,c.actor.position.z)<c.actor.position.y+.02,'descent clears the ridge before losing height');
  }
  assert(!world.active);assert(c.actor.position.distanceTo(world.recovery.landing)<.001);assert.equal(c.surfaceY,0);assert.equal(c.state,'Idle');assert.equal(c.mountainCheckpoint,2);
  assert.deepEqual(sounds,['bounce','leaves']);
  const pile=world.recovery.group.getObjectByName('Layered autumn leaves')!;assert(pile);assert(pile.children[1].visible,'landing scatters the leaf pile');
  for(let frame=0;frame<30;frame++){const previous=c.actor.position.clone();c.update(1/60,idle);world.apply(c,previous,1/60);}assert.equal(c.actor.position.y,0);
  c.actor.position.copy(world.recovery.trampoline.position);assert(world.start(c));world.update(5,[],true,c);assert(!world.active);assert(c.actor.position.distanceTo(position(MOUNTAIN_PEAK))<.001);
});
