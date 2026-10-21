import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Vector3, InstancedMesh, Mesh, Matrix4, Quaternion, Raycaster, Texture } from 'three';
import { CharacterController } from '../src/controller';
import { Treehouse, TREEHOUSE_SITE, type TreehouseSound } from '../src/treehouse';
import { sceneryClearance } from '../src/landmarks';
import {META_KNIGHT_SEAL_SITES,isInsideSealPickup} from '../src/meta-knight-seal-sites';
async function character(){const bytes=await readFile(new URL('../public/models/kirby-animated.glb',import.meta.url));const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');return new CharacterController(gltf.scene,gltf.animations);}
const idle={forward:false,left:false,right:false};
test('climb, explore, leap into leaves and recover normal controls without losing size',async()=>{
  const sounds:TreehouseSound[]=[],house=new Treehouse(kind=>sounds.push(kind)),c=await character();
  c.actor.scale.setScalar(1.5);c.actor.position.copy(TREEHOUSE_SITE).add(new Vector3(-4,0,11));
  assert(house.prompt(c.actor.position));house.interact(c);assert(house.active);
  for(let i=0;i<320;i++)house.update(1/60);
  assert.equal(c.state,'Lookout');assert.equal(c.actor.position.y,18);
  for(let i=0;i<600;i++)house.update(1/60,{...idle,forward:true});
  assert(c.actor.position.z>=TREEHOUSE_SITE.z+2.5 && c.actor.position.z<=TREEHOUSE_SITE.z+7);
  house.update(1/60,idle,true);assert.equal(c.state,'LeafDive');
  for(let i=0;i<180;i++)house.update(1/60);
  assert(!house.active);assert.equal(c.actor.position.y,0);assert.equal(c.actor.scale.x,1.5);
  assert.equal(c.actor.position.x,TREEHOUSE_SITE.x+8);assert.equal(c.actor.position.z,TREEHOUSE_SITE.z+13);
  assert.equal(c.state,'Idle');assert.equal(c.animationRoot.scale.y,1);
  assert(sounds.includes('ladder') && sounds.includes('leaves') && sounds.includes('cheer'));
  const z=c.actor.position.z;c.update(.1,{...idle,forward:true});assert(c.actor.position.z>z);
});
test('swing mounts smoothly, moves with the ropes and can be left using interaction',async()=>{
  const sounds:TreehouseSound[]=[],house=new Treehouse(kind=>sounds.push(kind)),c=await character();
  c.actor.position.copy(TREEHOUSE_SITE).add(new Vector3(-11,0,3));house.interact(c);house.update(1/60);
  assert(c.actor.position.y<.05);for(let i=0;i<120;i++)house.update(1/60);
  assert.equal(c.state,'Swing');const position=c.actor.position.clone();house.update(.2);assert(position.distanceTo(c.actor.position)>.01);
  assert(sounds.includes('creak'));house.interact(c);assert(!house.active);assert.equal(c.actor.position.y,0);assert.equal(c.actor.rotation.x,0);
});

test('ladder and swing have independent leases and remote rocking remains visible throughout a treehouse visit',async()=>{
  const house=new Treehouse(),swingClient=new Treehouse(),climber=await character(),swinger=await character();
  const ladder=TREEHOUSE_SITE.clone().add(new Vector3(-4,0,11)),swing=TREEHOUSE_SITE.clone().add(new Vector3(-11,0,3));
  assert.equal(house.networkKey(new Vector3()),undefined);
  assert.equal(house.networkKey(ladder.clone().setY(18)),undefined);
  assert.equal(house.networkKey(ladder),'tree:0');assert.equal(house.networkKey(swing),'swing:0');
  climber.actor.position.copy(ladder);house.interact(climber);
  swinger.actor.position.copy(swing);swingClient.interact(swinger);
  const sync=()=>{const angle=swingClient.swing.rotation.x;house.networkSwing(angle);assert.equal(house.swing.rotation.x,angle);};
  for(let frame=0;frame<320;frame++){
    house.update(1/60);swingClient.update(1/60);sync();
    assert.equal(house.networkKey(climber.actor.position),'tree:0');
    assert.equal(swingClient.networkKey(swinger.actor.position),'swing:0');
    const localAngle=swingClient.swing.rotation.x;swingClient.networkSwing(-2);assert.equal(swingClient.swing.rotation.x,localAngle,'only its local passenger controls the swing');
  }
  assert(house.onBalcony(climber));assert(climber.achievements.has('treehouse'));assert(swinger.achievements.has('swing'));
  house.update(1/60,idle,true);assert.equal(climber.state,'LeafDive');
  for(let frame=0;frame<180;frame++){house.update(1/60);swingClient.update(1/60);sync();}
  assert(!house.active);assert(swingClient.active,'the leaf jump never dismounts the other player');
  swingClient.interact(swinger);assert(!swingClient.active);
});

test('Pidgie plants both feet on the real swing planks throughout the seated animation and rocking',async()=>{
  const bytes=await readFile(new URL('../public/models/pigeon-animated.glb',import.meta.url)),loader=new GLTFLoader();
  loader.register(()=>({name:'NodeTextureMetadata',loadTexture:()=>Promise.resolve(new Texture())}));
  const asset=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const house=new Treehouse(),c=new CharacterController(asset.scene,asset.animations);
  const feet=['Left','Right'].map(side=>c.actor.getObjectByName(`${side}_foot`)!.children.find(node=>node instanceof Mesh) as Mesh);
  const inverse=new Matrix4(),up=new Vector3(),point=new Vector3(),contact=new Vector3(),ray=new Raycaster();
  const planted:Vector3[]=[];
  c.actor.scale.setScalar(1.5);c.actor.position.copy(TREEHOUSE_SITE).add(new Vector3(-11,0,3));house.interact(c);
  for(let frame=0;frame<600;frame++){
    house.update(1/60);
    if(frame<60||frame%4)continue;
    house.group.updateMatrixWorld(true);c.actor.updateMatrixWorld(true);inverse.copy(house.swing.matrixWorld).invert();
    up.set(0,1,0).applyQuaternion(house.swing.getWorldQuaternion(new Quaternion()));
    feet.forEach((foot,index)=>{
      const p=foot.geometry.attributes.position;let lowest=Infinity;
      for(let vertex=0;vertex<p.count;vertex++){
        foot.getVertexPosition(vertex,point).applyMatrix4(foot.matrixWorld).applyMatrix4(inverse);
        if(point.y<lowest){lowest=point.y;contact.copy(point);}
      }
      if(!planted[index])planted[index]=contact.clone();
      assert(contact.distanceTo(planted[index])<.00001,'feet cannot paddle or slide over the seat');
      point.copy(contact).applyMatrix4(house.swing.matrixWorld);
      ray.set(point.clone().add(up),up.clone().negate());
      const hit=ray.intersectObject(house.swing,true)[0];assert(hit,'the foot must be over a wooden plank');
      assert(Math.abs(point.clone().sub(hit.point).dot(up))<.001,'the sole must touch the plank without hovering or penetrating it');
    });
  }
  assert.equal(c.savedSize,1.5);assert(c.achievements.has('swing'));
  house.interact(c);assert(!house.active);assert.equal(c.state,'Idle');assert.equal(c.actor.position.y,0);assert.equal(c.actor.scale.x,1.5);
});

test('the seal is on the actual balcony and ordinary deck movement reaches it before the leaf jump',async()=>{
 const house=new Treehouse(),c=await character(),site=META_KNIGHT_SEAL_SITES.find(s=>s.id==='treehouse')!;
 c.actor.position.copy(TREEHOUSE_SITE).add(new Vector3(-4,0,11));house.interact(c);
 for(let i=0;i<320;i++)house.update(1/60);
 assert(house.onBalcony(c));assert.equal(c.actor.position.y,site.surfaceY);
 c.yaw=Math.PI/2;c.actor.rotation.y=c.yaw;
 for(let i=0;i<150;i++)house.update(1/60,{...idle,forward:true});
 assert(isInsideSealPickup(site,c.actor.position,1),'six metres across the real balcony reaches the floating seal');
 house.update(1/60,idle,true);assert(!house.onBalcony(c));assert.equal(c.state,'LeafDive');
 for(let i=0;i<180;i++)house.update(1/60);
 assert(!house.active);assert.equal(c.actor.position.y,0);
});
test('treehouse clearing and trunk collision keep scenery clear; detail is batched',()=>{
  const house=new Treehouse(),trunk=TREEHOUSE_SITE.clone().add(new Vector3(0,0,-6)),p=trunk.clone();house.constrain(p,1);
  assert(p.distanceTo(trunk)>=3);assert(!sceneryClearance(TREEHOUSE_SITE.x,TREEHOUSE_SITE.z));
  let batches=0,parts=0;house.group.traverse(node=>{if(node instanceof InstancedMesh){batches++;parts+=node.count;}});
  assert(parts>1000);assert(batches<85);
});
