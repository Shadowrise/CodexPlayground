import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {CharacterController} from '../src/controller';
import {createPigeon} from '../src/pigeon-model';

async function character(name='kirby'){
 const bytes=await readFile(new URL('../public/models/'+name+'-animated.glb',import.meta.url)),g=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');return new CharacterController(g.scene,g.animations);
}
test('defeated Kirby truly sits with attached forward feet and spiral eyes, then fully restores on retry',async()=>{
 const c=await character(),body=c.actor.getObjectByName('Body_motion')!,foot=c.actor.getObjectByName('Left_foot_pivot')!,eyes=c.actor.getObjectByName('Left_eyelid_pivot')!;
 c.updateActivity(.2);const standing=body.position.clone(),boot=foot.position.clone();c.setActivity('Sitting');
 for(let i=0;i<600;i++){
  c.updateActivity(1/60);c.updateDuelDazedPose(i*1000/60,true);
  assert(body.position.y<standing.y-.15);assert(foot.position.z>boot.z+.35);assert.equal(eyes.visible,false);assert(c.actor.getObjectByName('Duel dazed eyes')!.visible);
 }
 c.actor.updateMatrixWorld(true);let minY=Infinity;const vertex=new T.Vector3();foot.traverse(node=>{if(node instanceof T.Mesh){const positions=node.geometry.getAttribute('position');for(let i=0;i<positions.count;i++){vertex.fromBufferAttribute(positions,i).applyMatrix4(node.matrixWorld);minY=Math.min(minY,vertex.y);}}});assert(minY>-.01,'the seated boot remains on top of the floor');assert(minY<.2);
 const spiral=c.actor.getObjectByName('Left dazed spiral eye') as T.Mesh;assert(spiral.geometry instanceof T.TubeGeometry);assert.equal(spiral.geometry.parameters.tubularSegments,96);
 c.setActivity('Idle');c.updateActivity(.2);assert(eyes.visible);assert(!c.actor.getObjectByName('Duel dazed eyes')!.visible);assert(body.position.distanceTo(standing)<.03);assert(foot.position.distanceTo(boot)<.01);
 c.disposeEffects();assert(!c.actor.getObjectByName('Duel dazed eyes'));
});
test('boss spiral eyes replace his sharp eyes without undoing the battle body pose',async()=>{
 const c=await character('meta-knight'),body=c.actor.getObjectByName('Body_motion')!,eyes=c.actor.getObjectByName('Eyes_glow')!;body.position.set(0,.92,-.18);
 c.updateDuelDazedPose(1000,true,false);assert(!eyes.visible);assert(c.actor.getObjectByName('Right dazed spiral eye'));body.position.y=.95;c.clearDuelDazedPose();assert.equal(body.position.y,.95,'face-only cleanup cannot restore an old body pose');assert(eyes.visible);
 c.setActivity('Sitting');c.updateActivity(.2);c.updateDuelDazedPose(2000,true);assert.equal(c.actor.getObjectByName('Left_foot_pivot')!.position.z,.35);
 c.disposeEffects();assert(eyes.visible);
});
test('native Pidgie keeps his sitting animation and replaces both pupils with spirals',()=>{
 const p=createPigeon(),wrapper=new T.Group();wrapper.add(p.root);const c=new CharacterController(wrapper,p.clips);c.setActivity('Sitting');
 for(let i=0;i<30;i++){c.updateActivity(1/60);c.updateDuelDazedPose(i*1000/60,true);}
 assert(c.actor.getObjectByName('Body')!.position.y<.46);assert(!c.actor.getObjectByName('Left_pupil')!.visible);assert(c.actor.getObjectByName('Left dazed spiral eye'));assert(c.actor.getObjectByName('Right dazed spiral eye'));
 c.setActivity('Idle');c.updateActivity(.2);assert(c.actor.getObjectByName('Left_pupil')!.visible);assert(c.actor.getObjectByName('Body')!.position.y>.6);c.disposeEffects();
});
