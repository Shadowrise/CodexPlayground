import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Bone,Group,Scene,SkinnedMesh} from 'three';
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

test('render-only roots skip hidden branches and refresh them completely when shown again',()=>{
 const scene=new Scene(),swarm=new Group(),bug=new Group(),wing=new Bone(),near=new Group();swarm.add(bug,near);bug.add(wing);scene.add(swarm);
 bug.position.x=1;wing.position.x=2;wing.matrixAutoUpdate=false;wing.updateMatrix();
 const matrices=new StaticWorldMatrices(scene);matrices.skipHidden(swarm);
 matrices.update();assert.equal(wing.matrixWorld.elements[12],3);
 bug.visible=false;bug.position.x=10;near.position.x=4;matrices.update();
 assert.equal(wing.matrixWorld.elements[12],3,'a hidden branch keeps its previous pose');
 assert.equal(near.matrixWorld.elements[12],4,'visible siblings stay current');
 bug.getWorldPosition(wing.position.clone());assert.equal(bug.matrixWorld.elements[12],10,'explicit reads still refresh a hidden node');
 bug.visible=true;matrices.update();
 assert.equal(wing.matrixWorld.elements[12],12,'descendants without automatic matrices follow the shown branch');
 swarm.visible=false;swarm.position.y=5;matrices.update();assert.equal(near.matrixWorld.elements[13],0);
 swarm.visible=true;matrices.update();assert.equal(near.matrixWorld.elements[13],5);assert.equal(wing.matrixWorld.elements[13],5);
 scene.position.z=7;matrices.update();assert.equal(wing.matrixWorld.elements[14],7);
});

test('render-only traversal keeps class-specific world updates such as skinned bind matrices',()=>{
 const scene=new Scene(),root=new Group(),mesh=new SkinnedMesh();root.add(mesh);scene.add(root);root.position.x=3;
 const matrices=new StaticWorldMatrices(scene);matrices.skipHidden(root);root.position.x=6;matrices.update();
 assert.equal(mesh.matrixWorld.elements[12],6);assert.equal(mesh.bindMatrixInverse.elements[12],-6);
});

test('hidden dynamic roots are skipped and catch up with their bones as soon as they are shown',()=>{
 const scene=new Scene(),actor=new Group(),arm=new Bone(),other=new Group();actor.add(arm);scene.add(actor,other);arm.position.x=1;arm.matrixAutoUpdate=false;arm.updateMatrix();
 const matrices=new StaticWorldMatrices(scene);actor.visible=false;actor.position.x=20;other.position.x=2;matrices.update();
 assert.equal(arm.matrixWorld.elements[12],1);assert.equal(other.matrixWorld.elements[12],2);
 arm.updateWorldMatrix(true,false);assert.equal(arm.matrixWorld.elements[12],21,'carried items refresh a hidden carrier explicitly');
 actor.position.x=30;actor.visible=true;matrices.update();assert.equal(arm.matrixWorld.elements[12],31);
});
