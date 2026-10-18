import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {MetaKnightCrescent} from '../src/meta-knight-crescent';
import {KNIGHT,knightProjectile,knightShotPath,startKnightBattle} from '../src/meta-knight-battle';
import {META_KNIGHT_ARENA} from '../src/meta-knight-arena-site';

test('crescent is a centered bevelled solid, twice the size and remains above the arena at every heading',()=>{
 const shot=new MetaKnightCrescent(),solid=shot.group.getObjectByName('Solid golden beveled crescent') as T.Mesh;
 assert(solid.material instanceof T.MeshPhysicalMaterial);assert.equal(solid.material.depthWrite,true);assert(!solid.material.transparent);solid.geometry.computeBoundingBox();assert(solid.geometry.boundingBox!.getSize(new T.Vector3()).z>.5);
 assert.equal(shot.group.scale.x,2);
 assert.equal(shot.group.getObjectByName('Crescent parallel to the ground')!.scale.y,1.6,'the whole crescent is60% wider across its flight path');
 assert(solid.geometry.boundingBox!.max.x>Math.abs(solid.geometry.boundingBox!.min.x),'convex edge leads along local +X');
 for(let i=0;i<16;i++){shot.group.rotation.y=i*Math.PI/8;shot.group.position.y=KNIGHT.projectileHeight;shot.update(i*125,i%2===0);shot.group.updateMatrixWorld(true);const box=new T.Box3().setFromObject(shot.group);assert(box.min.y>.15,`floor clearance at heading ${i}`);
  assert(Math.abs(new T.Vector3(0,0,1).transformDirection(solid.matrixWorld).y)>.999,'broad faces lie parallel to the ground');
 }
 shot.group.traverse(o=>{if(o instanceof T.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])assert(m.depthTest,'glow respects world occlusion');});shot.dispose();
});
test('incoming and reflected crescents stay at the same low height regardless of boss or target altitude',()=>{
 const s=startKnightBattle([{id:'a',p:[0,0,-2],yaw:0,available:true}],'a',1000)!;Object.assign(s,{stage:'shot',since:2000,until:3800,from:[0,0,0],to:[0,0,8],height:.5});
 assert.equal(knightProjectile(s,2000+KNIGHT.shotReleaseMs-1),undefined,'the blade must finish its swing before a crescent exists');
 assert(KNIGHT.hoverHeight<1.5);
 for(const bossY of [0,KNIGHT.hoverHeight,5])for(const playerY of [0,2,7]){
  s.stage='shot';s.height=bossY;s.from[1]=bossY;s.to[1]=playerY;
  const end=2000+KNIGHT.shotReleaseMs+knightShotPath(s).duration;
  for(let t=2000+KNIGHT.shotReleaseMs;t<end;t+=25)assert.equal(knightProjectile(s,t)![1],KNIGHT.projectileHeight);
  s.stage='return';s.returnFrom=[12,9,8];s.to=[0,bossY,0];
  for(let t=2000;t<3800;t+=25)assert.equal(knightProjectile(s,t)![1],KNIGHT.projectileHeight);
 }
});

test('every locked crescent continues past close and distant targets to the arena rim',()=>{
 const s=startKnightBattle([{id:'a',p:[0,0,-2],yaw:0,available:true}],'a',1000)!;
 for(const from of [[0,0,0],[24,0,12],[-30,0,0]] as [number,number,number][])for(let i=0;i<12;i++){
  const yaw=i*Math.PI/6;Object.assign(s,{stage:'shot',since:2000,from,yaw,to:[from[0]+Math.sin(yaw)*9,0,from[2]+Math.cos(yaw)*9]});
  const path=knightShotPath(s),finish=s.since+KNIGHT.shotReleaseMs+path.duration;
  const last=knightProjectile(s,finish-.001)!;assert(last);assert(Math.hypot(last[0],last[2])>META_KNIGHT_ARENA.radius+2,'disappears only once the entire blade is beyond the rim');
  assert.equal(knightProjectile(s,finish+1),undefined);assert.equal(last[1],KNIGHT.projectileHeight);
 }
});
