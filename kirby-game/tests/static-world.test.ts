import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Bone,Group,Scene} from 'three';
import {StaticWorldMatrices} from '../src/static-world';
import {CosmeticClock} from '../src/cosmetic-clock';

test('static world avoids repeated hierarchy updates while new actors, bones and lights keep world poses current',()=>{
 const scene=new Scene(),forest=new Group(),tree=new Group(),actor=new Group(),bone=new Bone();forest.add(tree);actor.add(bone);scene.add(forest,actor);
 forest.position.x=5;tree.position.x=2;actor.position.x=8;bone.position.x=1;
 const matrices=new StaticWorldMatrices(scene);matrices.add(forest);let updates=0;const old=tree.updateMatrixWorld;tree.updateMatrixWorld=function(force){updates++;old.call(this,force);};
 for(let i=0;i<5;i++){actor.position.x++;matrices.update();assert.equal(bone.matrixWorld.elements[12],actor.position.x+1);assert.equal(tree.matrixWorld.elements[12],7);}
 assert.equal(updates,0);
 const newActor=new Group();newActor.position.y=3;scene.add(newActor);matrices.update();assert.equal(newActor.matrixWorld.elements[13],3);
 scene.position.x=10;matrices.update();assert.equal(tree.matrixWorld.elements[12],17);assert.equal(bone.matrixWorld.elements[12],actor.position.x+11);assert.equal(updates,1);
});

test('decorative clocks keep close idle animation full-rate and preserve elapsed time at distance or when hidden',()=>{
 const near=new CosmeticClock();for(let i=0;i<10;i++)assert.equal(near.step(1/60,25),1/60);
 const far=new CosmeticClock();let total=0,updates=0;for(let i=0;i<60;i++){const dt=far.step(1/60,200**2);if(dt)updates++;total+=dt;}assert.equal(updates,10);assert(Math.abs(total-1)<1e-8);
 for(let i=0;i<120;i++)assert.equal(far.step(1/60,200**2,false),0);assert(Math.abs(far.step(1/60,1)-121/60)<1e-8);
});
