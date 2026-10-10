import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,MeshBasicMaterial,Raycaster,Vector3} from 'three';
import {createForest} from '../src/forest';
import {MeadowLayout,onMeadowBridge,meadowPathHalfWidth} from '../src/meadow-layout';
import {BANK_RINGS,flatGround as dryGround,WATER_Y,BRIDGES} from '../src/pond-layout';
import {Ponds} from '../src/ponds';

test('shared trails reach entrances and keep full clearance from trunks and water',()=>{
 const forest=createForest(),trees=forest.userData.treePositions,layout=forest.userData.meadowLayout as MeadowLayout;
 assert(layout.paths.length>=layout.entrances.length);
 for(const p of layout.entrances)assert(layout.trailDistance(p.x,p.z)<1,`unconnected entrance ${p.x},${p.z}`);
 for(const path of layout.paths)for(let i=1;i<path.points.length;i++)for(const t of [0,.25,.5,.75,1]){
  const a=path.points[i-1],b=path.points[i],p={x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t};
  const half=meadowPathHalfWidth(path,a)*(1-t)+meadowPathHalfWidth(path,b)*t;
  assert(onMeadowBridge(p.x,p.z)||dryGround(p.x,p.z,half),`trail in sloping bank/water at ${p.x},${p.z}`);
  assert(trees.every((tree:any)=>Math.hypot(p.x-tree.x,p.z-tree.z)>half+.7),'trail crosses a trunk');
 }
 const floor=forest.getObjectByName('Biome ground') as Mesh;
 assert(floor.geometry.index!.count/3<2000);
 const map=(floor.material as any).map;
 assert.equal(map.image.data.length,512*512*4);assert.equal((floor.material as any).transparent,false);
 assert(map.image.data.some((value:number,index:number)=>index%4===3&&value<100),'wear uses the existing map');
});

test('sloping banks are continuous, upward facing and support walking down to water',()=>{
 const ponds=new Ponds(),bank=ponds.group.getObjectByName('Soft sloping river banks') as Mesh;
 const ray=new Raycaster(),p=new Vector3(),normals=bank.geometry.attributes.normal;
 for(let i=0;i<normals.count;i++)assert(normals.getY(i)>.15,'bank must face upward');
 assert(bank.geometry.index!.count/3<5000);assert(!bank.castShadow);
 const testMesh=new Mesh(bank.geometry,new MeshBasicMaterial());testMesh.updateMatrixWorld();
 let samples=0;
 for(const ring of BANK_RINGS)for(let i=0;i<ring.water.length-1;i+=19){
  const a=ring.water[i],b=ring.land[i];
  for(const t of [.2,.7]){
   p.set(b[0]+(a[0]-b[0])*t,3,b[1]+(a[1]-b[1])*t);ray.set(p,new Vector3(0,-1,0));
   const hit=ray.intersectObject(testMesh)[0];assert(hit,'no missing bank triangles');
   assert(hit.point.y<0&&hit.point.y>=WATER_Y+.0199,'dry bank stays above the water surface');
   if(!BRIDGES.some(b=>Math.hypot(b.x-p.x,b.z-p.z)<10)){
    const c={actor:new Group(),swimming:false,surfaceY:0,flight:{active:false},roll:{active:false}};c.actor.position.copy(p).setY(0);
    ponds.apply(c,c.actor.position.clone());assert(Math.abs(c.actor.position.y-hit.point.y)<.0001,'walking support matches the bank');
   }
   samples++;
  }
 }
 assert(samples>90);
});
