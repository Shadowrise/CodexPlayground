import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Mesh,PerspectiveCamera,Vector3,Box3} from 'three';
import {CentipedeTargetCue} from '../src/centipede-target-cue';

test('a readable target cue follows elevated instruments with a floating downward arrow and a small rendering budget',()=>{
 const cue=new CentipedeTargetCue(),camera=new PerspectiveCamera();camera.position.set(10,6,12);camera.lookAt(0,4,0);
 const target=new Vector3(4,4.76,2);cue.update(target,1000,camera);cue.group.updateMatrixWorld(true);
 assert(cue.group.position.equals(target));assert(!cue.group.visible,'no idle marker');
 const tip=new Box3().setFromObject(cue.arrow).min.y;
 assert(tip>target.y+.7,'the pointer floats above the target rather than through it');
 assert(cue.arrow.quaternion.angleTo(camera.quaternion)<1e-8,'arrow is readable from the camera');
 let meshes=0,triangles=0;cue.group.traverse(o=>{if(o instanceof Mesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;assert(!o.castShadow);assert.equal((o.material as any).toneMapped,false,'night readability is independent of exposure');}});
 assert.equal(meshes,3);assert(triangles<2000);
 cue.update([6,1.2,-3],1100,camera,true);assert.deepEqual(cue.group.position.toArray(),[6,1.2,-3]);
 cue.group.traverse(o=>{if(o instanceof Mesh){o.geometry.dispose();(o.material as any).dispose();}});
});
