import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {MetaKnightCrescent} from '../src/meta-knight-crescent';
import {KNIGHT,knightProjectile,startKnightBattle} from '../src/meta-knight-battle';

test('crescent is a centered bevelled solid, twice the size and remains above the arena at every heading',()=>{
 const shot=new MetaKnightCrescent(),solid=shot.group.getObjectByName('Solid golden beveled crescent') as T.Mesh;
 assert(solid.material instanceof T.MeshPhysicalMaterial);assert.equal(solid.material.depthWrite,true);assert(!solid.material.transparent);solid.geometry.computeBoundingBox();assert(solid.geometry.boundingBox!.getSize(new T.Vector3()).z>.5);
 assert.equal(shot.group.scale.x,2);
 for(let i=0;i<16;i++){shot.group.rotation.y=i*Math.PI/8;shot.group.position.y=KNIGHT.projectileHeight;shot.update(i*125,i%2===0);shot.group.updateMatrixWorld(true);const box=new T.Box3().setFromObject(shot.group);assert(box.min.y>.15,`floor clearance at heading ${i}`);}
 shot.group.traverse(o=>{if(o instanceof T.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])assert(m.depthTest,'glow respects world occlusion');});shot.dispose();
});
test('incoming and reflected trajectories preserve clearance, including shots aimed at grounded players',()=>{
 const s=startKnightBattle([{id:'a',p:[0,0,-2],yaw:0,available:true}],'a',1000)!;Object.assign(s,{stage:'shot',since:2000,until:3800,from:[0,0,0],to:[0,0,8],height:.5});
 for(let t=2000;t<3800;t+=25)assert(knightProjectile(s,t)![1]>=KNIGHT.projectileHeight);
});
