import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CharacterController } from '../src/controller';
import { MazeTrampoline } from '../src/maze-trampoline';
import { HedgeMaze } from '../src/maze';
import { MAZE_SITE } from '../src/maze-layout';
test('reward trampoline clears every hedge, lands in leaves and restores control and size',async()=>{
 const bytes=await readFile(new URL('../public/models/kirby-animated.glb',import.meta.url)),model=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const c=new CharacterController(model.scene,model.animations),maze=new HedgeMaze(),events:string[]=[],trampoline=new MazeTrampoline(kind=>events.push(kind));
 c.actor.position.copy(trampoline.position);assert(!trampoline.start(c));c.starBlessed=true;c.actor.scale.setScalar(2);assert(trampoline.start(c));assert(trampoline.savePosition(c));
 let maxY=0;
 for(let i=0;i<290;i++){
   trampoline.update(1/60);maxY=Math.max(maxY,c.actor.position.y);
   const x=c.actor.position.x-MAZE_SITE.x,z=c.actor.position.z-MAZE_SITE.z;
   if(maze.walls.some(w=>Math.abs(x-w.x)<w.hx+.8 && Math.abs(z-w.z)<w.hz+.8))assert(c.actor.position.y>6);
 }
 assert(maxY>18);assert(!trampoline.active);assert.equal(c.state,'Idle');assert.equal(c.actor.position.y,0);assert.equal(c.actor.scale.x,2);assert.equal(c.animationRoot.scale.y,1);
 assert(!maze.contains(c.actor.position,5));assert.deepEqual(events,['bounce','leaves']);assert(c.starBlessed);
 const before=c.actor.position.clone();c.update(.1,{forward:true,left:false,right:false});assert(c.actor.position.distanceTo(before)>0);
});
