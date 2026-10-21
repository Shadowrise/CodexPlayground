import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {Coaster} from '../src/coaster';
import {CoasterShadows,prepareTrackRibbons,projectedTrackCenter} from '../src/coaster-shadows';
import {daylight,phaseAtHour} from '../src/day-cycle';
import {groundShadowProjection,projectGroundShadow} from '../src/prepared-shadows';
import {groundShadowOpacity} from '../src/ground-shadow-style';

test('rails are two uninterrupted narrow ribbons and sleepers keep their real dimensions',()=>{
 const coaster=new Coaster(),samples=120,ribbons=prepareTrackRibbons(coaster,samples);
 for(let rail=0;rail<2;rail++)for(let i=0;i<samples;i++){
  const ribbon=ribbons[rail*samples+i],next=ribbons[rail*samples+(i+1)%samples];
  assert(ribbon.b.distanceTo(next.a)<1e-6);assert.equal(ribbon.width,.16);
 }
 for(const sleeper of ribbons.slice(samples*2)){assert(Math.abs(sleeper.a.distanceTo(sleeper.b)-3)<1e-5);assert.equal(sleeper.width,.19);}
});

test('cart shadows stay centred between the projected rails through loops, rolls and daylight changes',()=>{
 const coaster=new Coaster(),sources=coaster.group.children.filter(o=>o.name.startsWith('Rounded coaster cart ')||o.name==='Meta Knight coaster cart');
 const shadows=new CoasterShadows(coaster,sources),matrix=new T.Matrix4();
 for(const hour of [9,12,17,23]){
  const time=daylight(phaseAtHour(hour)),projection=groundShadowProjection(time);
  for(let i=0;i<96;i++){
   const distance=coaster.length*i/96,pose=coaster.pose(distance),source=sources[0];source.position.copy(pose.p);source.quaternion.copy(pose.q);
   shadows.update(time,pose.p);shadows.carts.getMatrixAt(0,matrix);
   assert.equal(shadows.rails.opacity,groundShadowOpacity(time));assert.equal(shadows.cartMaterial.opacity,groundShadowOpacity(time));
   const cartAnchor=projectGroundShadow(new T.Vector3().applyMatrix4(matrix),projection),left=projectGroundShadow(new T.Vector3(-1.2,0,0).applyQuaternion(pose.q).add(pose.p),projection),right=projectGroundShadow(new T.Vector3(1.2,0,0).applyQuaternion(pose.q).add(pose.p),projection);
   assert(cartAnchor.distanceTo(left.add(right).multiplyScalar(.5))<.00005,'cart and railway must use the same world-space projection');
   assert(cartAnchor.distanceTo(projectedTrackCenter(coaster,distance,projection))<.00005);
   assert(matrix.elements.every(Number.isFinite));
  }
 }
 assert.equal(shadows.carts.castShadow,false);assert.equal(shadows.carts.receiveShadow,false);
 assert(shadows.rails.opacity>0&&shadows.cartMaterial.opacity>0);
});
