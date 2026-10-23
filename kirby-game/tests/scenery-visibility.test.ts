import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {SceneryVisibility} from '../src/scenery-visibility';
import {instancedLod} from '../src/instanced-lod';
import {parseViewDistance} from '../src/view-distance';

const camera=()=>{const c=new T.PerspectiveCamera(48,1,.75,1200);c.updateMatrixWorld();return c;};
test('scenery culling keeps intersecting bounds and restores cells on camera movement',()=>{
 const root=new T.Group(),material=new T.MeshBasicMaterial();
 const near=new T.Mesh(new T.BoxGeometry(2,2,2),material),far=near.clone(),edge=new T.Mesh(new T.BoxGeometry(20,2,20),material),hidden=near.clone();
 near.position.z=-20;far.position.z=-400;edge.position.z=-365;hidden.visible=false;
 root.add(near,far,edge,hidden);root.position.x=10;
 const visibility=new SceneryVisibility([root]),c=camera();c.position.x=10;c.updateMatrixWorld();
 visibility.update(c,360);assert(near.visible);assert(!far.visible);assert(edge.visible,'a large cell remains until all of it is behind the fog');assert(!hidden.visible);
 visibility.update(c,750);assert(far.visible,'changing the range immediately restores scenery');
 c.rotation.y=Math.PI;c.updateMatrixWorld();visibility.update(c,360);assert(!near.visible);
 c.position.z=-410;c.updateMatrixWorld();visibility.update(c,360);assert(far.visible,'turning back restores a culled cell');assert(!hidden.visible);
});

test('culling LOD cells never overrides their active detail level',()=>{
 const geometry=new T.BoxGeometry(2,2,2),root=instancedLod('Trees',geometry,new T.MeshBasicMaterial(),[{matrix:new T.Matrix4().makeTranslation(0,0,-400),color:new T.Color('green'),detail:0}],{middle:geometry,far:geometry,middleDistance:60,farDistance:150},false);
 const visibility=new SceneryVisibility([root]),lod=root.children[0] as T.LOD,c=camera();lod.update(c);
 const levels=lod.levels.map(l=>l.object.visible);visibility.update(c,360);assert(!lod.visible);assert.deepEqual(lod.levels.map(l=>l.object.visible),levels);
 c.position.z=-395;c.updateMatrixWorld();visibility.update(c,360);assert(lod.visible);lod.update(c);
 assert.equal(lod.getCurrentLevel(),0);assert.equal(lod.levels.filter(l=>l.object.visible).length,1);
});

test('an offscreen mesh parent cannot hide a visible child outside its own geometry',()=>{
 const parent=new T.Mesh(new T.BoxGeometry(),new T.MeshBasicMaterial()),child=parent.clone();
 parent.position.x=500;child.position.set(-500,0,-10);parent.add(child);
 const visibility=new SceneryVisibility([parent]);visibility.update(camera(),360);
 assert(parent.visible&&child.visible);
});

test('only supported saved distances are accepted',()=>{
 assert.equal(parseViewDistance(null),360);assert.equal(parseViewDistance('bad'),360);assert.equal(parseViewDistance('-1'),360);assert.equal(parseViewDistance('Infinity'),360);
 for(const d of [240,360,750])assert.equal(parseViewDistance(String(d)),d);
});
