import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,MeshBasicMaterial,Raycaster,Vector3} from 'three';
import {createForest} from '../src/forest';
import {MeadowLayout,onMeadowBridge,meadowPathHalfWidth} from '../src/meadow-layout';
import {BANK_RINGS,flatGround as dryGround,WATER_Y,BRIDGES} from '../src/pond-layout';
import {Ponds} from '../src/ponds';
import {MAZE_SITE,MAZE_ENTRY_POSTS} from '../src/maze-layout';
import {roundMeadowPath} from '../src/meadow-path';
import {MILL_BAGS} from '../src/mill-quest';
import {META_KNIGHT_PORTAL_APPROACH} from '../src/meta-knight-arena-site';

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
 for(const [x,,z] of MILL_BAGS)assert(layout.trailDistance(x,z)>1.2,'the full sack mat stays on the grass beside the path');
 for(const p of MAZE_ENTRY_POSTS){
  const radius=.65;
  assert(layout.trailDistance(MAZE_SITE.x+p.x,MAZE_SITE.z+p.z)>radius+1.4,'maze entrance decorations remain beside the complete path and its soft rim');
 }
 for(const path of layout.paths)for(let i=1;i<path.points.length-1;i++){
  const a=path.points[i-1],p=path.points[i],b=path.points[i+1],ux=p.x-a.x,uz=p.z-a.z,vx=b.x-p.x,vz=b.z-p.z;
  const lengths=Math.hypot(ux,uz)*Math.hypot(vx,vz);if(lengths<1e-8)continue;
  assert((ux*vx+uz*vz)/lengths>Math.cos(Math.PI*25/180),'every actual approach, obstacle detour and bend turns progressively instead of having a right-angle corner');
 }
 // The north foothill clearing slightly reroutes the bridge approach.
 const portalPaths=layout.paths.filter(p=>Math.hypot(p.points[0].x-META_KNIGHT_PORTAL_APPROACH.x,p.points[0].z-META_KNIGHT_PORTAL_APPROACH.z)<1);
 assert.equal(portalPaths.length,1,'the new corner portal has one connected approach');
 const portalSamples=portalPaths.reduce((n,p)=>n+p.points.length,0);
 assert(portalSamples<1500,'the long portal approach has a separate bounded raster budget');
 assert(layout.paths.reduce((n,p)=>n+p.points.length,0)-portalSamples<3500,'existing trail raster/placement budget stays bounded');
});

test('rounding preserves endpoints and detours around an obstacle instead of cutting through it',()=>{
 const source=[{x:-12,z:0},{x:0,z:0},{x:0,z:12},{x:12,z:12}],free=(x:number,z:number)=>!(x>1&&x<7&&z<10);
 const points=roundMeadowPath(source,free);
 assert.deepEqual(points[0],source[0]);assert.deepEqual(points.at(-1),source.at(-1));
 assert(points.some(p=>p.x<0&&p.z>0),'round the first corner with a visible arc');
 for(let i=1;i<points.length;i++)for(let step=0;step<=10;step++){
  const a=points[i-1],b=points[i],t=step/10;assert(free(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t));
 }
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
