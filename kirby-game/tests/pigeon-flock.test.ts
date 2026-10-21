import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {PigeonFlock,pigeonSlot,FLOCK_RADIUS} from '../src/pigeon-flock';
import {PIGEON_FLOCK_BATCH,validPigeonCheckpoint,type SummonedPigeon} from '../src/pigeon-flock-state';
import {PidgieNpc} from '../src/pidgie-npc';

const load=async(file:string)=>{
 const bytes=await readFile(new URL('../public/models/'+file,import.meta.url)),loader=new GLTFLoader();
 loader.register(()=>({name:'NodeTextureMetadata',loadTexture:()=>Promise.resolve(new T.Texture())}));
 return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
};
const [pidgie,snowball]=await Promise.all([load('pigeon-animated.glb'),load('snowball-animated.glb')]);
const specs=(count:number):SummonedPigeon[]=>Array.from({length:count},(_,i)=>({id:'bird-'+i,playerId:'target',skin:i%2?'snowball':'pidgie',seed:(Math.imul(i+1,2654435761))>>>0,order:i}));
const player={id:'target',position:new T.Vector3(),hasBread:false};
const create=(hello:()=>void=()=>{})=>new PigeonFlock({pidgie,snowball},{safeGround:()=>true},hello);
test('collision radius encloses both real plumages throughout flight, running and greeting',()=>{
 for(const template of [pidgie,snowball]){
  const npc=new PidgieNpc(template,{safeGround:()=>true,summoned:true});
  for(const clip of ['Fly','Run','Hello','Fear'] as const){
   npc.mixer.stopAllAction();const action=npc.actions.get(clip)!;action.reset().play();
   for(let frame=0;frame<12;frame++){
    npc.mixer.update(action.getClip().duration/12);npc.actor.updateMatrixWorld(true);
    npc.model.traverse(node=>{
     if(!(node instanceof T.Mesh))return;
     const point=new T.Vector3();for(let i=0;i<node.geometry.attributes.position.count;i++){
      node.getVertexPosition(i,point).applyMatrix4(node.matrixWorld);assert(Math.hypot(point.x,point.y-1.2,point.z)<=FLOCK_RADIUS,`${clip}: ${point.toArray()}`);
     }
    });
   }
  }
 }
});
function clearance(flock:PigeonFlock){
 const birds=Array.from(flock.birds.values()).filter(b=>b.npc.actor.visible);
 for(let i=0;i<birds.length;i++)for(let j=i+1;j<birds.length;j++){
  const d=birds[i].npc.actor.position.distanceTo(birds[j].npc.actor.position);
  assert(d>=FLOCK_RADIUS*2-.001,`${birds[i].spec.id}/${birds[j].spec.id}: ${d}`);
 }
}

test('expanding formation reserves distinct places for a thousand pigeons',()=>{
 const slots=Array.from({length:1000},(_,i)=>pigeonSlot(i));
 for(let i=0;i<slots.length;i++)for(let j=i+1;j<slots.length;j++)assert(slots[i].distanceTo(slots[j])>=FLOCK_RADIUS*2);
});

test('a flock arrives, lands, greets repeatedly with sound and chases a breadless player without intersections',()=>{
 player.position.set(0,0,0);let hello=0;const flock=create(()=>hello++),birds=specs(18);
 for(let frame=0;frame<600;frame++){flock.update(.05,birds,true,[player],[]);clearance(flock);}
 assert.equal(flock.birds.size,18);
 assert(Array.from(flock.birds.values()).every(b=>b.npc.phase==='follow'),'all birds land');
 assert(hello>=36,'every bird greets more than once');
 const before=Array.from(flock.birds.values(),b=>b.npc.actor.position.clone());
 for(let frame=0;frame<400;frame++){
  player.position.set(frame*.06,0,Math.sin(frame*.01)*8);flock.update(.05,birds,true,[player],[]);clearance(flock);
 }
 assert(Array.from(flock.birds.values()).every((b,i)=>b.npc.actor.position.distanceTo(before[i])>8),'the whole flock follows');
 const checkpoints=Array.from({length:Math.ceil(birds.length/PIGEON_FLOCK_BATCH)},()=>flock.checkpoints()).flat();
 assert(checkpoints.every(validPigeonCheckpoint));assert.equal(new Set(checkpoints.map(c=>c.id)).size,birds.length);
 assert(JSON.stringify(checkpoints.slice(0,8)).length<8000);
 flock.clear();assert.equal(flock.group.children.length,0);
});

test('late joins and a host change preserve arrivals and greeting clocks without replaying old coos',()=>{
 player.position.set(0,0,0);const birds=specs(6),host=create();
 for(let i=0;i<160;i++)host.update(.05,birds,true,[player],[]);
 const saved=host.checkpoints();for(const b of birds)b.checkpoint=saved.find(c=>c.id===b.id);
 let sounds=0;const successor=create(()=>sounds++),remote=create(()=>sounds++);
 successor.update(0,birds,false,[player],[]);remote.update(0,birds,false,[player],[]);assert.equal(sounds,0);
 for(let i=0;i<60;i++){host.update(.05,birds,true,[player],[]);successor.update(.05,birds,true,[player],[]);}
 const a=host.checkpoints(),b=successor.checkpoints();
 for(const original of a){const next=b.find(c=>c.id===original.id)!;assert.equal(next.helloCount,original.helloCount);assert(Math.abs(next.helloIn-original.helloIn)<1e-6);assert(new T.Vector3().fromArray(next.bird.p).distanceTo(new T.Vector3().fromArray(original.bird.p))<.1);}
 host.clear();successor.clear();remote.clear();
});

test('blocked landing sites use separate safe slots, and removing summons disposes the flock',()=>{
 const flock=new PigeonFlock({pidgie,snowball},{safeGround:(x,z)=>x>0&&Math.hypot(x,z)>10}),birds=specs(12);
 player.position.set(0,0,0);
 for(let i=0;i<300;i++){flock.update(.05,birds,true,[player],[]);clearance(flock);}
 for(const bird of flock.birds.values())assert(bird.npc.actor.position.y>0||bird.npc.actor.position.x>0);
 flock.update(.05,[],true,[player],[]);assert.equal(flock.birds.size,0);assert.equal(flock.group.children.length,0);
});

test('large arrivals and delayed remote presentation keep bird bodies apart',()=>{
 player.position.set(0,0,0);const host=create(),remote=create(),birds=specs(80),remoteBirds=structuredClone(birds);
 for(let frame=0;frame<100;frame++){
  player.position.x=frame*.03;host.update(.05,birds,true,[player],[]);clearance(host);
  if(frame%2===0)for(const c of host.checkpoints())remoteBirds.find(b=>b.id===c.id)!.checkpoint=c;
  remote.update(.05,remoteBirds,false,[player],[]);clearance(remote);
 }
 host.clear();remote.clear();
});

test('twenty arrivals avoid world obstacles that the ground mask does not know about',()=>{
 player.position.set(0,0,0);const flock=create(),birds=specs(20);
 const world=(point:T.Vector3,_size:number,previous:T.Vector3)=>{if(point.y<1&&Math.hypot(point.x,point.z)<20)point.copy(previous);};
 for(let i=0;i<800;i++){flock.update(.05,birds,true,[player],[],world);clearance(flock);}
 for(const bird of flock.birds.values()){assert.equal(bird.npc.phase,'follow',bird.spec.id);assert(bird.npc.actor.position.length()>=20);}
 flock.dispose();
});

test('an obstructed cached approach retries and lands even while its player stands still',()=>{
 player.position.set(0,0,0);const flock=create(),birds=specs(20);let obstacle:T.Vector3|undefined;
 const world=(point:T.Vector3,_size:number,previous:T.Vector3)=>{if(obstacle&&point.y<1&&Math.hypot(point.x-obstacle.x,point.z-obstacle.z)<6)point.copy(previous);};
 for(let i=0;i<1400;i++){
  flock.update(.05,birds,true,[player],[],world);clearance(flock);
  const first=flock.birds.get(birds[0].id)!;
  if(!obstacle&&first.npc.phase==='landing'&&first.npc.actor.position.y<10)obstacle=first.goal!.clone();
 }
 assert(obstacle);for(const bird of flock.birds.values())assert.equal(bird.npc.phase,'follow',bird.spec.id);
 flock.dispose();
});

test('dismissal plays Fear once, scatters into the sky, then hides only far from the player without intersections',()=>{
 player.position.set(0,0,0);let scares=0;
 const flock=new PigeonFlock({pidgie,snowball},{safeGround:()=>true,onScare:()=>scares++}),birds=specs(24);
 for(let i=0;i<700;i++)flock.update(.05,birds,true,[player],[]);
 const origins=Array.from(flock.birds.values(),b=>b.npc.actor.position.clone());
 for(const bird of birds)bird.dismissedAt=1000;
 flock.update(.05,birds,true,[player],[]);assert.equal(scares,24);assert(Array.from(flock.birds.values()).every(b=>b.npc.state==='Fear'&&b.npc.actor.visible));
 for(let i=0;i<360;i++){flock.update(.05,birds,true,[player],[]);clearance(flock);}
 assert.equal(scares,24);
 for(const [i,bird] of Array.from(flock.birds.values()).entries()){
  assert(bird.departed&&!bird.npc.actor.visible,bird.spec.id);assert(bird.npc.actor.position.y>=26);assert(bird.npc.actor.position.distanceTo(origins[i])>=100);
 }
 assert(flock.checkpoints().every(c=>c.departed&&validPigeonCheckpoint(c)));
 flock.clear();
});
