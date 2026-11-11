import assert from 'node:assert/strict';
import {test} from 'node:test';
import {BufferGeometry,Group,Mesh,MeshBasicMaterial,SphereGeometry} from 'three';
import {CHARACTER_FULL_DISTANCE,CHARACTER_SIMPLE_DISTANCE,updateCharacterDetail} from '../src/character-detail';

test('distant characters use welded sculpts and return to the authored geometry without flicker',()=>{
 const actor=new Group(),dense=new SphereGeometry(1,192,128),small=new SphereGeometry(.1,8,6);
 const body=new Mesh(dense,new MeshBasicMaterial()),eye=new Mesh(small,new MeshBasicMaterial());actor.add(body,eye);
 const triangles=(geometry:BufferGeometry)=>geometry.index!.count/3;
 updateCharacterDetail(actor,10**2);assert.equal(body.geometry,dense);
 updateCharacterDetail(actor,(CHARACTER_SIMPLE_DISTANCE+1)**2);
 assert.notEqual(body.geometry,dense);assert(triangles(body.geometry)<triangles(dense)/3,'the dense sculpt is welded');
 assert.equal(eye.geometry,small,'small parts are already cheap');
 assert.deepEqual(body.geometry.boundingBox!.max.toArray(),dense.boundingBox!.max.toArray(),'attachment points keep the authored bounds');
 const simple=body.geometry;
 updateCharacterDetail(actor,(CHARACTER_FULL_DISTANCE+2)**2);assert.equal(body.geometry,simple,'no switch inside the hysteresis band');
 updateCharacterDetail(actor,(CHARACTER_FULL_DISTANCE-1)**2);assert.equal(body.geometry,dense);
 // Geometry replaced by game code while distant is never overwritten.
 updateCharacterDetail(actor,100**2);const replaced=new SphereGeometry(1,8,6);body.geometry=replaced;
 updateCharacterDetail(actor,1);assert.equal(body.geometry,replaced);
});
