import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {SkyTrailShadows,SKY_GLASS_SHADOW_DENSITY} from '../src/sky-trail-shadows';
import {SKY_PLATFORMS,SKY_TRAIL_SITE,platformThickness} from '../src/sky-trail-layout';
import {daylight,phaseAtHour} from '../src/day-cycle';
import {groundShadowProjection,projectGroundShadow} from '../src/prepared-shadows';
import {groundShadowOpacity} from '../src/ground-shadow-style';

test('glass platform shadows retain the actual prism dimensions and elevated placement',()=>{
 const world=new T.Matrix4().makeTranslation(SKY_TRAIL_SITE.x,0,SKY_TRAIL_SITE.z),shadows=new SkyTrailShadows(world),mesh=shadows.group.children[0] as T.InstancedMesh,matrix=new T.Matrix4(),center=new T.Vector3(),scale=new T.Vector3(),light=daylight(phaseAtHour(9)),projection=groundShadowProjection(light);
 assert.equal(mesh.count,SKY_PLATFORMS.length);
 for(let i=0;i<mesh.count;i++){
  const p=SKY_PLATFORMS[i],thickness=platformThickness(i);mesh.getMatrixAt(i,matrix);center.setFromMatrixPosition(matrix);scale.setFromMatrixScale(matrix);
  assert(Math.abs(center.x-p.x-SKY_TRAIL_SITE.x)<1e-5);assert(Math.abs(center.y-(p.y-thickness/2))<1e-5);
  assert(Math.abs(scale.x-p.size)<1e-5&&Math.abs(scale.y-thickness)<1e-5&&Math.abs(scale.z-p.size)<1e-5,'a thin platform must not squeeze its horizontal shadow footprint');
  const projected=projectGroundShadow(center,projection),offset=new T.Vector2(projected.x-center.x,projected.z-center.z);
  assert(offset.length()>.1,'even the first step must use its real nonzero height');
  assert(Math.abs(offset.length()-center.y*projection.length())<1e-6);
 }
 assert.equal(mesh.castShadow,false);
});

test('translucent platform shadows attenuate light by the glass density throughout the day and night',()=>{
 const shadows=new SkyTrailShadows(new T.Matrix4());
 for(const hour of [9,12,17,23]){const light=daylight(phaseAtHour(hour));shadows.update(light,new T.Vector3());assert.equal(shadows.material.opacity,groundShadowOpacity(light)*SKY_GLASS_SHADOW_DENSITY);assert(shadows.material.opacity<.2);}
});
