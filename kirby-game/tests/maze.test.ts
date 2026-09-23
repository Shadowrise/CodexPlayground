import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Vector3 } from 'three';
import { HedgeMaze } from '../src/maze';
import { MAZE_SITE,mazeLayout,farthestMazeCell } from '../src/maze-layout';
import { CharacterController } from '../src/controller';
const center=(i:number)=>new Vector3(MAZE_SITE.x-30+(i%7)*10,0,MAZE_SITE.z-30+Math.floor(i/7)*10);
function route(){const walls=mazeLayout(),queue=[45],parent=new Map<number,number>([[45,-1]]),distances=new Map<number,number>([[45,0]]);for(let i=0;i<queue.length;i++){const cell=queue[i];for(const [d,offset] of [-7,1,7,-1].entries()){const next=cell+offset;if(!walls[cell][d] && next>=0&&next<49&&!parent.has(next)){parent.set(next,cell);distances.set(next,distances.get(cell)!+1);queue.push(next);}}}const path=[farthestMazeCell(walls)];while(path[path.length-1]!==45)path.push(parent.get(path[path.length-1])!);return {path:path.reverse(),count:parent.size,maxDistance:Math.max(...distances.values())};}
test('star is at the farthest reachable cell from the entrance',()=>{
  const {path,count,maxDistance}=route();assert.equal(count,49);assert.equal(path.length-1,maxDistance);assert(path.length>=25,`route length ${path.length}`);
  assert(mazeLayout().filter(w=>w.filter(Boolean).length===3).length>=4);
});
test('route works for normal and 400% Kirby, while high-speed airborne wall crossing is blocked',()=>{
  const maze=new HedgeMaze(),{path}=route();
  for(const size of [1,4])for(let i=1;i<path.length;i++){const from=center(path[i-1]),to=center(path[i]);maze.constrain(to,size,from);assert(to.distanceTo(center(path[i]))<1e-6);}
  const start=new Vector3(MAZE_SITE.x-45,40,MAZE_SITE.z-30),end=new Vector3(MAZE_SITE.x+45,40,MAZE_SITE.z-30);
  maze.constrain(end,1,start);assert(end.x<MAZE_SITE.x-35);assert.equal(end.y,40);
});
test('star is awarded only at its new location on foot and a restored blessing is not awarded twice',async()=>{
  const bytes=await readFile(new URL('../public/models/kirby-animated.glb',import.meta.url)),gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const c=new CharacterController(gltf.scene,gltf.animations),maze=new HedgeMaze();c.actor.position.copy(center(45));assert(!maze.update(.1,c));
  c.actor.position.copy(center(24));assert(!maze.update(.1,c));
  c.actor.position.copy(center(maze.rewardCell));c.actor.position.y=20;assert(!maze.update(.1,c));c.actor.position.y=0;assert(!maze.update(.1,c,false));
  assert(maze.update(.1,c));assert(c.starBlessed);assert(!maze.update(.1,c));assert(c.actor.getObjectByName('Golden star blessing'));
  const restored=new HedgeMaze();assert(!restored.update(.1,c));assert(c.starBlessed);
});

 test('star doubles movement and jump height for 30 seconds and reappears at 120 seconds',async()=>{
  const bytes=await readFile(new URL('../public/models/kirby-animated.glb',import.meta.url)),gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const c=new CharacterController(gltf.scene,gltf.animations),maze=new HedgeMaze();
  const speed=c.speed,backward=c.backwardSpeed;
  c.actor.position.copy(center(maze.rewardCell));assert(maze.update(0,c));
  assert.equal(c.speed,speed*2);assert.equal(c.backwardSpeed,backward*2);
  c.update(.01,{forward:false,left:false,right:false,jump:true});
  let peak=0;for(let i=0;i<80;i++){c.update(.01,{forward:false,left:false,right:false});peak=Math.max(peak,c.actor.position.y);}
  assert(Math.abs(peak-2.9)<.01);
  maze.update(30,c,false);assert.equal(c.starRemaining,0);assert.equal(c.speed,speed);assert.equal(c.backwardSpeed,backward);
  assert.equal(c.actor.getObjectByName('Golden star blessing')!.visible,false);assert(c.starBlessed);
  c.actor.position.copy(center(maze.rewardCell));assert(!maze.update(89,c));assert.equal(c.starCooldown,1);
  assert(maze.update(1,c));assert.equal(c.starRemaining,30);assert.equal(c.starCooldown,120);
 });
