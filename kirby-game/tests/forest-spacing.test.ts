import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createForest,biomeAt} from '../src/forest';
import {LOD,Mesh,PerspectiveCamera,InstancedMesh,Matrix4,Color} from 'three';
import {sceneryClearance} from '../src/landmarks';
import {createCoasterCurve} from '../src/coaster';

test('tall tree crowns leave clearance between trees, attractions and the track',()=>{
  const forest=createForest();
  const trees=forest.userData.treePositions as {x:number;z:number;crownRadius:number}[];
  assert(trees.length>100);
  const base=forest.userData.baseTreeCount;
  assert(trees.length>=base*4.8&&trees.length<=base*5,`about five times as many trees, with a bounded total: ${trees.length}/${base}`);
  const edge=trees.filter(p=>Math.max(Math.abs(p.x),Math.abs(p.z))>218);
  assert.equal(trees.slice(0,base).filter(p=>Math.max(Math.abs(p.x),Math.abs(p.z))>218).length,153,'preserve mature mountain anchors');
  assert(edge.length>450);
  for(const side of [0,1,2,3])assert(edge.some(p=>side===0?p.x< -218:side===1?p.x>218:side===2?p.z< -218:p.z>218));
  forest.traverse(o=>{if(o.name.startsWith('Decorative forest leaves')||o.name.startsWith('Decorative forest birchLeaves'))o.traverse(child=>{if('castShadow' in child)assert(!child.castShadow);});});
  assert(forest.children.some(o=>o.name==='Soft patterned tree shadows'));
  const painted=forest.getObjectByName('Soft patterned tree shadows')!,shadowMatrix=new Matrix4(),profile=new Color();let silhouettes=0,spruceSilhouettes=0;
  painted.traverse(o=>{if(o instanceof InstancedMesh)for(let i=0;i<o.count;i++){
    o.getMatrixAt(i,shadowMatrix);o.getColorAt(i,profile);
    const spruce=biomeAt(shadowMatrix.elements[12],shadowMatrix.elements[14])==='spruce';
    assert.equal(profile.r,spruce?1:0,'each tree uses its own biome silhouette');silhouettes++;if(spruce)spruceSilhouettes++;
  }});
  assert.equal(silhouettes,trees.length);assert(spruceSilhouettes>150);
  forest.traverse(o=>{if(o instanceof Mesh)assert(!o.castShadow,'Trees use stable painted shadows instead of changing depth-map silhouettes');});
  const track=createCoasterCurve().getPoints(1800);
  for(const [i,p] of trees.entries()){
    assert(sceneryClearance(p.x,p.z,p.crownRadius+1));
    for(const q of trees.slice(i+1))assert(Math.hypot(p.x-q.x,p.z-q.z)>=p.crownRadius+q.crownRadius+1.2);
    for(const q of track)assert(Math.hypot(p.x-q.x,p.z-q.z)>=p.crownRadius+5);
  }
  for(const p of trees.slice(base))assert(forest.userData.meadowLayout.clearOfTrails(p.x,p.z,p.crownRadius+.5),'a grove must leave the path and its rim clear');
  assert(forest.userData.trailGroves>100);
  for(const biome of ['spruce','birch','orchard','autumn'])assert(trees.filter(p=>biomeAt(p.x,p.z)===biome).length>150);
  assert(trees.filter(p=>trees.some(q=>q!==p&&Math.hypot(p.x-q.x,p.z-q.z)<20)).length>trees.length*.95,'trees grow in groups rather than isolated dots');
  forest.updateMatrixWorld(true);
  const camera=new PerspectiveCamera();camera.position.set(2000,500,2000);camera.updateMatrixWorld();
  let lods=0;
  forest.traverse(o=>{if(o instanceof LOD){lods++;assert.equal(o.levels.length,3);assert(o.levels[1].hysteresis>0);o.update(camera);}});
  assert(lods>50);
  let farTriangles=0;
  forest.traverseVisible(o=>{if(o instanceof Mesh)farTriangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*((o as any).isInstancedMesh?(o as any).count:1);});
  assert(farTriangles<1500000,`distant forest budget: ${farTriangles}`);
});
