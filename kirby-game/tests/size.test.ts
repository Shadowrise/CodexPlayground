import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {CharacterController} from '../src/controller';
import {MAX_BODY_SIZE,MIN_BODY_SIZE,stepBodySize} from '../src/body-size';

test('admin size steps by half a body and clamps between 10% and 1000%',()=>{
 assert.equal(stepBodySize(1,.5),1.5);
 assert.equal(stepBodySize(1,-.5),.5);
 assert.equal(stepBodySize(1.1,.5),1.6);
 assert.equal(stepBodySize(.5,-.5),MIN_BODY_SIZE);
 assert.equal(stepBodySize(.15,-.5),MIN_BODY_SIZE);
 assert.equal(stepBodySize(9.6,.5),MAX_BODY_SIZE);
 assert.equal(stepBodySize(10,.5),MAX_BODY_SIZE);
});

test('resize sets the saved size without counting a fruit, and the fountain floor is 10%',async()=>{
 const bytes=await readFile(new URL('../public/models/kirby-animated.glb',import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const c=new CharacterController(gltf.scene,gltf.animations);
 c.fruitsEaten=4;c.resizeTo(1.5);
 for(let i=0;i<30;i++)c.update(1/60,{forward:false,left:false,right:false});
 assert.equal(c.savedSize,1.5);assert.equal(c.fruitsEaten,4);assert.equal(c.actor.scale.x,1.5);
 c.resizeTo(20);
 for(let i=0;i<30;i++)c.update(1/60,{forward:false,left:false,right:false});
 assert.equal(c.savedSize,MAX_BODY_SIZE);assert.equal(c.actor.scale.x,MAX_BODY_SIZE);
 c.actor.scale.setScalar(2);
 c.shrink(3);assert.equal(c.savedSize,MIN_BODY_SIZE);assert.equal(c.fruitsEaten,4);
});
