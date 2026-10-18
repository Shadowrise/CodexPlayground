import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {BOSS_ARENA} from '../src/boss-arena-site';
import {META_KNIGHT_ARENA as SITE,META_KNIGHT_ANNEX as ANNEX,META_KNIGHT_PORTAL as PORTAL,PORTAL_STEPS,portalLocalFloor,metaKnightPortalFloor,nearMetaKnightPortal,insideMetaKnightPortal,constrainMetaKnightArena,insideMetaKnightArena,knightAnnexCoordinates,knightAnnexPoint} from '../src/meta-knight-arena-site';
import {createMetaKnightPortal} from '../src/meta-knight-portal';
import {flatGround} from '../src/pond-layout';
import {sceneryClearance} from '../src/landmarks';
import {Ponds} from '../src/ponds';

test('arena matches Topotushka and portal has a dry unobstructed approach',()=>{
 assert.equal(SITE.playRadius,BOSS_ARENA.playRadius);assert.equal(SITE.radius,BOSS_ARENA.radius);
 assert(Math.hypot(PORTAL.x-BOSS_ARENA.x,PORTAL.z-BOSS_ARENA.z)>300,'portal is in its own empty corner');
 assert(flatGround(PORTAL.x,PORTAL.z,PORTAL.radius));assert.equal(sceneryClearance(PORTAL.x,PORTAL.z),false);
 assert(nearMetaKnightPortal({x:PORTAL.x,y:0,z:PORTAL.z+4}));assert(insideMetaKnightPortal({x:PORTAL.x,y:0,z:PORTAL.z}));
 assert(!insideMetaKnightPortal({x:PORTAL.x+2,y:0,z:PORTAL.z}));assert(!insideMetaKnightPortal({x:PORTAL.x,y:2,z:PORTAL.z}));
});
test('arena boundary retains ground and flying players at every supported size',()=>{
 for(const size of [.3,1,3,10])for(let i=0;i<50;i++){
  const a=i*.72,p={x:SITE.x+Math.cos(a)*90,y:15,z:SITE.z+Math.sin(a)*90};constrainMetaKnightArena(p,size);
  assert(insideMetaKnightArena(p.x-SITE.x,p.z-SITE.z));assert.equal(p.y,15);
  constrainMetaKnightArena(p,size,'arena');assert(Math.hypot(p.x-SITE.x,p.z-SITE.z)<=42-size+1e-8);
 }
});

test('portal landing connects to the arena, while the closed bridge keeps both sides apart even in flight',()=>{
 for(const size of [.3,1,3]){
  for(let along=0;along<=ANNEX.portalRadius;along+=.25){const local=knightAnnexPoint(0,along),p={x:SITE.x+local.x,y:0,z:local.z};constrainMetaKnightArena(p,size);assert(Math.hypot(p.x-SITE.x-local.x,p.z-local.z)<1e-8,'the open bridge has no invisible seam');}
  for(const height of [0,5,30]){
   const inside={x:SITE.x+SITE.exitX,y:height,z:SITE.exitZ};constrainMetaKnightArena(inside,size,'arena');assert(Math.hypot(inside.x-SITE.x,inside.z)<=SITE.walkRadius-size+1e-8);assert.equal(inside.y,height);
   const outside={x:SITE.x,y:height,z:0};constrainMetaKnightArena(outside,size,'annex');assert(knightAnnexCoordinates(outside.x-SITE.x,outside.z).along>=ANNEX.gate+size-1e-8);assert.equal(outside.y,height);
   constrainMetaKnightArena(inside,size);const atPortal={x:SITE.x+SITE.exitX,y:height,z:SITE.exitZ};constrainMetaKnightArena(atPortal,size,'annex');assert(Math.hypot(atPortal.x-SITE.x-SITE.exitX,atPortal.z-SITE.exitZ)<1e-8,'spectators retain the working portal landing');
  }
 }
 assert(Math.hypot(SITE.exitX,SITE.exitZ)-ANNEX.radius>SITE.radius,'the portal is entirely outside the fighting disk');
});
test('working and dormant portals have distinct visuals and no dynamic lights',()=>{
 const p=createMetaKnightPortal(),veil=p.group.getObjectByName('Portal swirling surface')!,dormant=p.group.getObjectByName('Dormant portal surface')!;
 assert(p.working);assert(veil.visible);assert(!dormant.visible);
 const surface=(veil as T.Mesh).material as T.ShaderMaterial;assert(!surface.transparent);assert(surface.depthTest);assert(surface.depthWrite,'portal depth must occlude transparent tree-shadow overlays');
 p.setWorking(false);assert(!p.working);assert(!veil.visible);assert(dormant.visible);p.update(10);assert.equal(p.group.userData.working,false);
 p.setWorking(true);assert(veil.visible);assert(!dormant.visible);p.update(11);
 let meshes=0,lights=0,triangles=0;p.group.traverse(o=>{if(o instanceof T.Mesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;}if(o instanceof T.Light)lights++;});
 assert(meshes<=9);assert(triangles<16000);assert.equal(lights,0);p.dispose();
});
test('each physical step supports feet and flight at the same height as its model',()=>{
 const ponds=new Ponds(),c={actor:new T.Group(),surfaceY:0,swimming:false,flight:{active:false},roll:{active:false}};
 for(const step of PORTAL_STEPS){const z=step.radius-.2;c.actor.position.set(PORTAL.x,0,PORTAL.z+z);ponds.apply(c,c.actor.position.clone());assert.equal(c.surfaceY,step.height);assert.equal(c.actor.position.y,step.height);assert.equal(portalLocalFloor(0,z),step.height);assert.equal(metaKnightPortalFloor(PORTAL.x,PORTAL.z+z),step.height);}
 c.flight.active=true;c.actor.position.y+=3;const previous=c.actor.position.clone();c.actor.position.z=PORTAL.z+5.9;ponds.apply(c,previous);assert(Math.abs(c.actor.position.y-(3+.18))<1e-8,'air height remains relative to the treads');
 c.flight.active=false;c.actor.position.z=PORTAL.z+PORTAL.returnOffset;ponds.apply(c,c.actor.position.clone());assert.equal(c.surfaceY,0);assert.equal(c.actor.position.y,0);
});
