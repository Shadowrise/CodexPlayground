import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Group,Vector3} from 'three';
import {updateVisibility} from '../src/visibility';
test('models remain visible beyond mist range; consumed fruit stays hidden',()=>{
 const root=new Group(),mist=new Group();mist.name='Fruit colored mist';root.add(mist);const camera=new Vector3();
 root.position.x=40;updateVisibility(root,camera);assert(root.visible&&mist.visible);
 root.position.x=60;updateVisibility(root,camera);assert(root.visible);assert(!mist.visible);
 root.position.x=85;updateVisibility(root,camera);assert(!root.visible);
 root.position.x=10;updateVisibility(root,camera,false);assert(!root.visible);
 updateVisibility(root,camera);assert(root.visible&&mist.visible);
 root.position.x=90;updateVisibility(root,camera,true,true);assert(root.visible);assert(!mist.visible);
});
