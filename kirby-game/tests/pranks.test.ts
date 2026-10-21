import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Group,Vector3,InstancedMesh,Mesh,Texture} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {CharacterController} from '../src/controller';
import {PrankEffects} from '../src/prank-effects';
import {isPrankKind,makePrank} from '../src/pranks';
test('cosmetic events animate, restore poses, bound trails and expire without changing gameplay coordinates',()=>{
 assert(isPrankKind('hiccup'));assert(!isPrankKind('constructor'));assert(!isPrankKind('unknown'));
 const actor=new Group(),root=new Group();actor.add(root);const target={actor,root,grounded:true},sounds:string[]=[];
 const effects=new PrankEffects(kind=>sounds.push(kind)),event=makePrank('one','hiccup',0,[0,0,0],1);
 effects.update([event],event.startsAt+80,()=>target,new Vector3());assert(root.position.y>0);assert.equal(actor.position.y,0);
 effects.beginFrame();assert.equal(root.position.y,0);assert.equal(root.scale.y,1);
 for(let i=0;i<30;i++){effects.beginFrame();effects.update([event],event.startsAt+80+i,()=>target,new Vector3());}assert.equal(sounds.filter(s=>s==='hiccup').length,1);
 effects.beginFrame();effects.update([event],event.endsAt,()=>target,new Vector3());assert.equal(effects.group.children.length,0);
 const trail=makePrank('one','rainbow',0,[0,0,0],1);
 for(let i=0;i<100;i++){actor.position.x=i*.6;effects.update([trail],trail.startsAt+i*50,()=>target,new Vector3(60,0,0));}
 const stamps=effects.group.children[0].children[0] as InstancedMesh;assert(stamps.count>0&&stamps.count<=36);
 target.grounded=false;for(let i=0;i<50;i++){actor.position.x+=.7;effects.update([trail],trail.startsAt+5000+i*100,()=>target,actor.position);}assert.equal(stamps.count,0,'no tracks in midair');
 const gift=makePrank('one','gift',10000,[0,0,0],20);assert.equal(gift.scale,2.5);
 effects.update([gift],gift.startsAt+100,()=>target,actor.position);actor.position.set(1,0,0);
 effects.update([gift],gift.startsAt+3700,()=>target,actor.position);effects.update([gift],gift.startsAt+4400,()=>target,actor.position);
 assert(sounds.includes('unbox'));assert(sounds.includes('quack'));effects.update([],gift.endsAt,()=>target,actor.position);assert.equal(effects.group.children.length,0);effects.dispose();
});

test('both pigeon plumages emit hiccup bubbles from the animated beak at every heading and size',async()=>{
 for(const file of ['pigeon-animated.glb','snowball-animated.glb']){
  const bytes=await readFile(new URL('../public/models/'+file,import.meta.url));
  const loader=new GLTFLoader();loader.register(()=>({name:'NodeTextureMetadata',loadTexture:()=>Promise.resolve(new Texture())}));
  const gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const c=new CharacterController(gltf.scene,gltf.animations),beak=c.actor.getObjectByName('Beak')!;
  const surface=beak.getObjectByName('Beak_sculpt_paint') as Mesh;surface.geometry.computeBoundingBox();
  const tip=surface.geometry.boundingBox!.max.z;
  const effects=new PrankEffects(()=>{}),event=makePrank('bird','hiccup',0,[0,0,0],1);
  const target={actor:c.actor,root:c.animationRoot,grounded:true};
  for(const size of [.5,1,7])for(const yaw of [0,Math.PI/2,-2.1])for(const clip of ['Idle','Run','Fly','Peck']){
   effects.beginFrame();c.setActivity(clip);c.mixer.update(.31);
   c.actor.position.set(13,4,-17);c.actor.rotation.y=yaw;c.actor.scale.setScalar(size);
   const originalPosition=c.animationRoot.position.clone(),originalScale=c.animationRoot.scale.clone();
   // Every bubble must start at the beak, including the later bubbles in a burst.
   for(const index of [0,5,11]){
    effects.beginFrame();effects.update([event],event.startsAt+index*65+1,()=>target,c.actor.position);
    const bubble=effects.group.children[0].children[index];assert(bubble.visible);
    const position=beak.worldToLocal(bubble.getWorldPosition(new Vector3()));
    const label=`${file}, ${clip}, size ${size}, yaw ${yaw}, bubble ${index}: ${position.toArray()}`;
    assert(Math.abs(position.x)<.025,label);
    assert(position.y>-.1&&position.y<.025,label);
    assert(Math.abs(position.z-tip)<.04,label);
   }
   effects.beginFrame();assert(c.animationRoot.position.equals(originalPosition));assert(c.animationRoot.scale.equals(originalScale));
  }
  effects.dispose();c.mixer.stopAllAction();
 }
});
