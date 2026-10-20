import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Vector3,Raycaster} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {CharacterController,type Input} from '../src/controller';
import {MountainLedges} from '../src/mountain-ledges';
import {MOUNTAIN_STEPS as STEPS,MOUNTAIN_MAIN_STEP_COUNT as MAIN_COUNT,MOUNTAIN_UPPER_STEPS as UPPER,MOUNTAIN_PEAK as PEAK,MOUNTAIN_PEAK_VERTEX,MOUNTAIN_SUMMIT as SUMMIT,mountainWorld,mountainLocal,mountainCourseEnvelope,isInsideMountainPeak,type MountainLedge} from '../src/mountain-ledges-layout';
import {MEADOW_HALF_SIZE,MOUNTAIN_WIDTH,insideMeadow} from '../src/world-bounds';
import {mountainElevation,mountainSurfaceHeight} from '../src/mountain-surface';
import {breadFloor} from '../src/bread-state';
import {createMountains} from '../src/mountains';

const idle:Input={forward:false,left:false,right:false};
async function player(){
 const bytes=await readFile(new URL('../public/models/kirby-animated.glb',import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 return new CharacterController(gltf.scene,gltf.animations);
}
const ledgePosition=(ledge:MountainLedge)=>{const p=mountainWorld(ledge.tangent,ledge.radial);return new Vector3(p.x,ledge.y,p.z);};
function towards(c:CharacterController,target:Vector3){
 const dx=target.x-c.actor.position.x,dz=target.z-c.actor.position.z,delta=Math.atan2(Math.sin(Math.atan2(dx,dz)-c.yaw),Math.cos(Math.atan2(dx,dz)-c.yaw));
 return {...idle,forward:Math.hypot(dx,dz)>.055,steer:Math.max(-1,Math.min(1,delta*10))};
}
function tick(world:MountainLedges,c:CharacterController,input=idle,dt=1/60){
 c.positionConstraint=world.constrainTravel;const previous=c.actor.position.clone();world.update(dt,[c]);c.update(dt,input);world.apply(c,previous,dt);
}
function validPosition(p:Vector3,size=1){
 assert(Number.isFinite(p.x+p.y+p.z));assert(p.y>=0);
 assert(Math.max(Math.abs(p.x),Math.abs(p.z))<MEADOW_HALF_SIZE+MOUNTAIN_WIDTH-1,'never reaches the map exterior');
 if(insideMeadow(p,size))return;
 assert(p.y>0,'ground feet always return inside the original meadow');
 const local=mountainLocal(p.x,p.z),bounds=mountainCourseEnvelope(p.y,local.tangent,size);
 assert(local.tangent>=bounds.minT-.001&&local.tangent<=bounds.maxT+.001,'air movement stays between course sides');
 assert(local.radial<=bounds.radial+.001,'air and falling cannot pass the height-dependent outer edge');
}

test('bread overlook leads through twenty ordinary double-jump flights to the true permanent peak',async()=>{
 const c=await player(),world=new MountainLedges();c.actor.position.copy(ledgePosition(SUMMIT));c.surfaceY=SUMMIT.y;world.restorePosition(c);
 assert.equal(MAIN_COUNT,11);assert.equal(STEPS.length,31);assert.equal(UPPER.length,20);
 for(const [i,ledge] of [...UPPER,PEAK].entries()){
  const target=ledgePosition(ledge),from=c.actor.position.clone();c.yaw=Math.atan2(target.x-from.x,target.z-from.z);c.actor.rotation.y=c.yaw;
  for(let frame=0;frame<13;frame++)tick(world,c,towards(c,target));
  for(let frame=0;frame<240;frame++){tick(world,c,{...towards(c,target),jump:frame===0||frame===18});validPosition(c.actor.position);}
  assert(Math.abs(c.actor.position.y-ledge.y)<.03,`upper ledge ${i+1}: ${c.actor.position.y} versus ${ledge.y}`);
  assert(!c.flight.active);assert.equal(c.actor.scale.x,1);assert.equal(c.fruitBoost.multiplier,1);
 }
 assert(isInsideMountainPeak(c.actor.position.x,c.actor.position.z,1),'normal landing reaches the peak pickup footprint');
 for(let frame=0;frame<600;frame++)tick(world,c);
 assert.equal(c.actor.position.y,PEAK.y,'the final platform stays permanent');
 assert.equal(SUMMIT.y,30.72);assert(PEAK.y>SUMMIT.y+50);
});

test('the round peak is part of the highest terrain and supports walking and bread around its whole circumference',async()=>{
 let highest=0;
 for(const side of [1,2])for(let row=1;row<40;row++)for(let column=0;column<=240;column++){
  const r=MEADOW_HALF_SIZE+MOUNTAIN_WIDTH*row/40,t=(column/240*2-1)*r,x=side===1?r:-t,z=side===1?t:r,local=mountainLocal(x,z);
  if(Math.abs(local.tangent)<=25&&local.radial>25&&local.radial<95)highest=Math.max(highest,mountainElevation(x,z)-.025);
 }
 assert(Math.abs(PEAK.y-highest)<.001);assert.equal(PEAK.y,mountainSurfaceHeight(MOUNTAIN_PEAK_VERTEX.x,MOUNTAIN_PEAK_VERTEX.z));
 const world=new MountainLedges(),c=await player(),p=ledgePosition(PEAK);world.group.updateMatrixWorld(true);
 const ray=new Raycaster(p.clone().add(new Vector3(0,2,0)),new Vector3(0,-1,0));assert(Math.abs(ray.intersectObject(world.peak)[0].point.y-PEAK.y)<.001);
 assert.equal(PEAK.shape,'circle');assert.equal(PEAK.width,PEAK.depth);assert(!world.peak.visible,'no separate stone slab is rendered over the summit');
 const mountains=createMountains();mountains.updateMatrixWorld(true);
 for(let angle=0;angle<Math.PI*2;angle+=Math.PI/12)for(const fraction of [0,.6,.95]){
  const xy=mountainWorld(PEAK.tangent+Math.cos(angle)*PEAK.width/2*fraction,PEAK.radial+Math.sin(angle)*PEAK.depth/2*fraction);
  assert(Math.abs(mountainSurfaceHeight(xy.x,xy.z)-PEAK.y)<.001,'the actual terrain is flat under every part of the circular landing');
  ray.set(new Vector3(xy.x,PEAK.y+2,xy.z),new Vector3(0,-1,0));const hit=ray.intersectObject(mountains)[0];assert(hit&&Math.abs(hit.point.y-PEAK.y)<.001,'visible mountain triangles support the landing, including the rear half');
  assert(Math.abs(breadFloor(xy.x,xy.z,PEAK.y)-PEAK.y)<.001);
  c.setActivity('Idle');c.actor.position.set(xy.x,PEAK.y,xy.z);c.surfaceY=PEAK.y;world.restorePosition(c);
  for(let frame=0;frame<8;frame++)tick(world,c);
  assert.equal(c.actor.position.y,PEAK.y);assert(Math.hypot(c.actor.position.x-xy.x,c.actor.position.z-xy.z)<.001,'standing on the plateau does not push the player down the mountain');
 }
 c.actor.position.copy(p);c.surfaceY=PEAK.y;world.restorePosition(c);assert(world.surfaces(c).some(surface=>surface.index===STEPS.length+1));
 assert(isInsideMountainPeak(p.x,p.z));const back=mountainWorld(PEAK.tangent,PEAK.radial+PEAK.depth/2+.1);assert(!isInsideMountainPeak(back.x,back.z,10),'size never extends pickup beyond the circular landing');
});

test('upper landing arcs are clear of mountain spikes and contoured backs meet the slope and stay attached while retracting',async()=>{
 const world=new MountainLedges(),c=await player(),ray=new Raycaster(),trimmed=STEPS.map((p,i)=>({p,i})).filter(({p})=>p.seam);
 assert.equal(trimmed.length,UPPER.length);
 for(const {p,i} of trimmed){
  for(let x=-p.width/2;x<=p.width/2;x+=.12)for(let z=-p.depth/2;z<=p.depth/2;z+=.12){
   if((x/(p.width/2))**2+((z-p.depth/2)/p.depth)**2>1)continue;
   const point=mountainWorld(p.tangent+x,p.radial+z);assert(mountainSurfaceHeight(point.x,point.z)<p.y-.01,`no terrain on step ${i+1}`);
  }
  const back=Math.max(...p.seam!);
  for(let sample=0;sample<p.seam!.length;sample++){const t=p.tangent-p.width/2+p.width*sample/(p.seam!.length-1),xy=mountainWorld(t,p.seam![sample]);assert(mountainSurfaceHeight(xy.x,xy.z)>=p.y-.001,`the full back of step ${i+1} meets the real mountain`);}
  for(const elapsed of [0,.1,.2,.3,.4,.55,.69]){
   world.networkApply(STEPS.map((_,index)=>index===i?[1,elapsed,0]:[0,0,0]));world.group.updateMatrixWorld(true);
   const mesh=world.steps[i].mesh,vertices=mesh.geometry.getAttribute('position');
   for(let vertex=0;vertex<vertices.count;vertex++)assert(vertices.getZ(vertex)*mesh.scale.z+mesh.position.z<=back+.00001,'neither top nor underside sticks out behind the fixed seam');
   c.setActivity('Idle');c.actor.scale.setScalar(.1);c.yaw=Math.PI/4;
   for(let z=p.radial-p.depth/2-.1;z<=back+.1;z+=.1){
    const xy=mountainWorld(p.tangent,z);c.actor.position.set(xy.x,p.y,xy.z);ray.set(c.actor.position.clone().add(new Vector3(0,.5,0)),new Vector3(0,-1,0));
    if(mesh.visible&&mountainSurfaceHeight(xy.x,xy.z)<p.y-.02&&ray.intersectObject(mesh).some(hit=>Math.abs(hit.point.y-p.y)<.001)){
     assert(world.surfaces(c).some(surface=>surface.index===i),'visible retracting rock supports feet');
     assert.equal(breadFloor(xy.x,xy.z,p.y,world.networkState()),p.y,'the authoritative bread floor matches the visible retracting rock');
    }
   }
  }
 }
 assert(Math.PI*PEAK.width/2*PEAK.depth/2>2*Math.PI*3.8**2/2,'peak landing area more than doubles');
 const vertices=world.peak.geometry.getAttribute('position');for(let vertex=0;vertex<vertices.count;vertex++)assert(Math.hypot(vertices.getX(vertex),vertices.getZ(vertex))<=PEAK.width/2+.00001,'the landing footprint is a full circle');
});

test('old IDs remain fixed and eleven/thirteen-row snapshots restore omitted new traps ready',()=>{
 const world=new MountainLedges();
 assert.deepEqual(STEPS.slice(0,MAIN_COUNT).map(p=>p.tangent),[-4.2,4.8,-3.8,5.2,.5,6.9,2.2,8.8,3.6,10.2,4.8]);
 for(const legacyLength of [11,13]){
  world.networkApply(STEPS.map(()=>[2,1,0]));world.networkApply(STEPS.slice(0,legacyLength).map(()=>[0,0,0]));
  for(const step of world.steps){assert.equal(step.phase,'ready');assert.equal(step.slide,0);assert(step.mesh.visible);}
 }
});

test('walking, sprinting and jumping off every upper-course edge stay safe on rock or inside the meadow',async()=>{
 const c=await player(),world=new MountainLedges();
 for(const origin of [UPPER[4],UPPER[13],PEAK])for(const heading of [Math.PI/4,-Math.PI/4,Math.PI*3/4,-Math.PI*3/4])for(const jump of [false,true]){
  world.resetPlayer();c.setActivity('Idle');c.actor.position.copy(ledgePosition(origin));c.surfaceY=origin.y;world.restorePosition(c);c.yaw=heading;c.actor.rotation.y=heading;
  for(let frame=0;frame<480;frame++){
   tick(world,c,{...idle,forward:frame<200,sprint:true,jump:jump&&(frame===0||frame===18)},1/30);validPosition(c.actor.position);
  }
  // A descent may pause on several lower traps. Remove those temporary rests
  // to exercise the complete worst-case fall rather than stopping mid-descent.
  world.networkApply(STEPS.map(()=>[2,0,0]));
  for(let frame=0;frame<90;frame++){tick(world,c,idle,1/30);validPosition(c.actor.position);}
  assert(insideMeadow(c.actor.position,1)||world.surfaces(c).some(surface=>Math.abs(surface.height-c.actor.position.y)<.03),`finish on a real safe ledge or inside meadow: origin ${origin.y}, heading ${heading}, jump ${jump}, position ${c.actor.position.toArray()}, flight ${c.flight.active}`);
 }
});

test('large bodies and lag frames cannot escape behind the peak or fall beyond the map',async()=>{
 const c=await player(),world=new MountainLedges();
 for(const size of [.3,2,10])for(const dt of [.25,1.5])for(const heading of [Math.PI/4,-Math.PI/4,Math.PI*3/4,-Math.PI*3/4]){
  world.resetPlayer();c.setActivity('Idle');c.resizeTo(size,true);c.actor.position.copy(ledgePosition(PEAK));c.surfaceY=PEAK.y;world.restorePosition(c);c.yaw=heading;
  for(let frame=0;frame<90;frame++){tick(world,c,{...idle,forward:frame<15,sprint:true,jump:frame===0||frame===2},dt);validPosition(c.actor.position,size);}
  assert(insideMeadow(c.actor.position,size)||world.surfaces(c).some(surface=>Math.abs(surface.height-c.actor.position.y)<.03),'lag ends on a supported ledge or in the meadow');
 }
 // apply() also repairs an external displacement which skipped controller constraints.
 c.resizeTo(1,true);world.resetPlayer();c.setActivity('Idle');const previous=ledgePosition(PEAK);c.actor.position.copy(previous);c.surfaceY=PEAK.y;world.restorePosition(c);
 c.actor.position.set(1000,-20,1000);world.apply(c,previous,2);validPosition(c.actor.position);assert(insideMeadow(c.actor.position));assert.equal(c.actor.position.y,0);
});

test('normal follow orbit keeps useful distance and terrain clearance around every upper landing',()=>{
 const world=new MountainLedges();
 for(const ledge of [SUMMIT,...UPPER,PEAK])for(let angle=0;angle<16;angle++)for(const elevation of [0,.25,.7]){
  const target=ledgePosition(ledge).add(new Vector3(0,.9,0)),azimuth=angle*Math.PI/8,horizontal=10*Math.cos(elevation),camera=new Vector3(target.x+horizontal*Math.sin(azimuth),target.y+10*Math.sin(elevation),target.z+horizontal*Math.cos(azimuth));
  world.constrainCamera(camera,target);
  assert(Math.abs(camera.distanceTo(target)-10)<.02,'ridge avoidance retains the default distance instead of filling the screen with Kirby');
  assert(Math.max(Math.abs(camera.x),Math.abs(camera.z))<MEADOW_HALF_SIZE+MOUNTAIN_WIDTH,'camera remains within the rendered mountain ring');
  for(let i=1;i<=60;i++){const p=target.clone().lerp(camera,i/60);assert(mountainSurfaceHeight(p.x,p.z)<p.y-.20,`clear sightline at height ${ledge.y}, angle ${angle}, elevation ${elevation}`);}
 }
});
