import {createBroadleafTree,treeWoodMaterial,treeLeafMaterial,treeFruitMaterial,type TreeKind} from './broadleaf-tree';
import {treeShadows} from './tree-shadows';
import {spruceGeometries,spruceParts,spruceNeedleMaterial,spruceBarkMaterial} from './spruce-shape';
import {batchScenery} from './scenery-batch';
import { createCoasterCurve } from './coaster';
import { createGroundMaterial } from './ground-texture';
import { meadowGeometry,MEADOW_Y } from './pond-layout';
import {BIOME_STYLE} from './biome-style';
import {MeadowLayout} from './meadow-layout';
import {growForestGroves} from './forest-groves';
import {forestInstances,type ForestPart} from './forest-lod';
import * as THREE from 'three';
import { MEADOW_HALF_SIZE as H } from './world-bounds';
import { outsideLandmarks, sceneryClearance } from './landmarks';
import { MOUNTAIN_LEDGE_SITE } from './mountain-ledges-layout';

export type Biome = 'spruce' | 'birch' | 'orchard' | 'autumn';
export function biomeAt(x: number, z: number): Biome {
  const east = x + 12 * Math.sin(z * .025) > 0;
  const north = z + 10 * Math.sin(x * .032) < 0;
  return north ? (east ? 'birch' : 'spruce') : (east ? 'orchard' : 'autumn');
}

/** Decorative instances only; tree fruit never enters the edible FruitWorld. */
export function createForest() {
  const forest = new THREE.Group(); forest.name = 'Four woodland biomes';
  const treePositions: {x:number;z:number;crownRadius:number}[]=[];forest.userData.treePositions=treePositions;
  let seed = 48137;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const geometries = spruceGeometries(),sprucePrototype=spruceParts();
  type Part = keyof typeof geometries;
  const batches = new Map<Part, ForestPart[]>();
  const trees=new Map<string,{kind:TreeKind;variation:number;parts:ForestPart[]}>();
  const dummy = new THREE.Object3D();
  const paintedShadows:THREE.Matrix4[]=[],spruceShadows:THREE.Matrix4[]=[];
  const track=createCoasterCurve().getPoints(1800);
  const atMountain=(x:number,z:number,crownRadius:number)=>Math.hypot(x-MOUNTAIN_LEDGE_SITE.x,z-MOUNTAIN_LEDGE_SITE.z)<MOUNTAIN_LEDGE_SITE.radius+crownRadius+1;
  function grow(x:number,z:number,biome:Biome,s:number,yaw:number,i:number,spread=1,crownRadius=(biome==='spruce'?2.2:biome==='birch'?6.4:4.2)*s){
    // Consume the same palette randomness for removed trees. Mature placement
    // and its paths remain deterministic everywhere outside the new corner.
    const visible=!atMountain(x,z,crownRadius);
    const radius=biome==='spruce'?s:(biome==='birch'?3.65:2.6)*s*spread;
    if(visible)(biome==='spruce'?spruceShadows:paintedShadows).push(new THREE.Matrix4().compose(new THREE.Vector3(x,.018,z),new THREE.Quaternion(),new THREE.Vector3(radius,1,radius)));
    if (biome==='spruce') {
      const hue=.33+random()*.035;
      dummy.position.set(x,0,z);dummy.rotation.set(0,yaw,0);dummy.scale.setScalar(s);dummy.updateMatrix();
      for(const p of sprucePrototype){
        const color=p.kind==='wood'?new THREE.Color('#69513b'):new THREE.Color().setHSL(hue,p.detail?.5:.48,p.detail?.24:.19+p.tier*.006,THREE.SRGBColorSpace);
        if(!batches.has(p.kind))batches.set(p.kind,[]);
        if(visible)batches.get(p.kind)!.push({matrix:dummy.matrix.clone().multiply(p.matrix),color,detail:p.detail});
      }
      return;
    }
    // Preserve the placement random stream, including the old bark marks and
    // fruit sizes: changing the model must not move a single conifer or clearing.
    if(biome==='birch')for(let b=0;b<24;b++)random();
    const pink=biome==='autumn' && i%4===3;
    const hue=biome==='autumn'?[.035,.09,.14,.96][i%4]:biome==='birch'?.27+random()*.025:.29+random()*.035;
    if(biome==='orchard')for(let f=0;f<27;f++)random();
    const variation=i%(biome==='orchard'?3:4),key=biome+variation;
    if(!trees.has(key))trees.set(key,{kind:biome,variation,parts:[]});
    const tree=trees.get(key)!;
    const width=biome==='birch'?.9+.2*((i*37%101)/100):1,depth=biome==='birch'?.9+.2*((i*61%101)/100):1;
    dummy.position.set(x,0,z);dummy.rotation.set(0,yaw,0);dummy.scale.set(s*spread*width,s,s*spread*depth);dummy.updateMatrix();
    if(visible)tree.parts.push({matrix:dummy.matrix.clone(),color:new THREE.Color().setHSL(hue,pink?.6:BIOME_STYLE[biome].canopySaturation,pink?.48:BIOME_STYLE[biome].canopyLightness,THREE.SRGBColorSpace),detail:0});
  }

  let foothillTrees=0;
  // Preserve the mature anchors and their established routes/attraction clearings.
  for (let i=0; i<20000 && (i<800 || foothillTrees<153); i++) {
    const angle=random()*Math.PI*2, radius=17+Math.sqrt(random())*75;
    let x=i<140 ? Math.cos(angle)*radius : (random()*2-1)*(H-10);
    let z=i<140 ? Math.sin(angle)*radius : (random()*2-1)*(H-10);
    if(i>=800){const edge=220+random()*26,along=(random()*2-1)*(H-10),side=i%4;if(Math.sin(along*.045+side)<-.5)continue;x=side<2?(side===0?-edge:edge):along;z=side>=2?(side===2?-edge:edge):along;}
    ({x,z}=outsideLandmarks(x,z,6,false));
    if((i<800&&Math.max(Math.abs(x),Math.abs(z))>218) || (Math.abs(x)<19 && z>207))continue;
    if (Math.hypot(x,z)<14) continue;
    const biome=biomeAt(x,z), s=.65+random()*1.2, yaw=random()*Math.PI*2;
    const crownRadiusLimit=(biome==='spruce'?2.2:biome==='birch'?6.4:4.2)*s;
    if(Math.max(Math.abs(x),Math.abs(z))+crownRadiusLimit>H-2)continue;
    if(!sceneryClearance(x,z,crownRadiusLimit+1,false,undefined,false))continue;
    if(treePositions.some(p=>Math.hypot(x-p.x,z-p.z)<crownRadiusLimit+p.crownRadius+1.2))continue;
    if(track.some(p=>Math.hypot(x-p.x,z-p.z)<crownRadiusLimit+5))continue;
    treePositions.push({x,z,crownRadius:crownRadiusLimit});
    if(Math.max(Math.abs(x),Math.abs(z))>218)foothillTrees++;
    grow(x,z,biome,s,yaw,i);
  }
  const layout=new MeadowLayout(treePositions),baseTrees=treePositions.length;
  const groves=growForestGroves(treePositions,layout,track,biomeAt);
  layout.fruitClearings.push(...groves.fruitClearings);
  groves.trees.forEach((tree,i)=>{treePositions.push(tree);grow(tree.x,tree.z,tree.biome,tree.scale,tree.yaw,baseTrees+i,tree.spread,tree.crownRadius);});
  const clearedBaseTrees=treePositions.slice(0,baseTrees).filter(p=>atMountain(p.x,p.z,p.crownRadius));
  for(let i=treePositions.length-1;i>=0;i--)if(atMountain(treePositions[i].x,treePositions[i].z,treePositions[i].crownRadius))treePositions.splice(i,1);
  forest.userData.clearedBaseTrees=clearedBaseTrees;
  forest.userData.baseTreeCount=baseTrees-clearedBaseTrees.length;forest.userData.groves=groves.groves;forest.userData.trailGroves=groves.trailGroves;
  forest.userData.meadowLayout=layout;
  const woodShadow=new THREE.CylinderGeometry(.7,1,1,6);
  // Original conifer shapes, per-part colours and distance levels are retained.
  for(const [kind,instances] of batches){
    const material=kind==='wood'?spruceBarkMaterial():spruceNeedleMaterial();
    const middle=kind==='wood'?woodShadow:new THREE.ConeGeometry(1,1,8,2),far=kind==='wood'?woodShadow:new THREE.ConeGeometry(1,1,6);
    forest.add(forestInstances('Decorative forest '+kind,geometries[kind],material,instances,{middle,far,middleDistance:kind==='wood'?48:64,farDistance:kind==='wood'?120:160,middleDetail:kind==='wood'?1:0,farDetail:0},true));
  }
  forest.userData.broadleafTrees=[];
  for(const {kind,variation,parts} of trees.values()){
    const near=createBroadleafTree(kind,variation),middle=createBroadleafTree(kind,variation,'middle'),far=createBroadleafTree(kind,variation,'far');
    const white=parts.map(p=>({...p,color:new THREE.Color('white')}));
    const prefix=kind==='birch'?'birchLeaves':'leaves';
    forest.add(forestInstances('Decorative forest '+prefix+' '+kind+' '+variation,near.leaves,treeLeafMaterial(),parts,{middle:middle.leaves,far:far.leaves},false));
    forest.add(forestInstances('Decorative forest wood '+kind+' '+variation,near.wood,treeWoodMaterial(kind==='birch'),white,{middle:middle.wood,far:far.wood},true));
    if(near.fruit.attributes.position.count)forest.add(forestInstances('Decorative forest fruit '+kind+' '+variation,near.fruit,treeFruitMaterial(),white,{middle:middle.fruit,far:far.fruit,middleDetail:-1,farDetail:-1},false));
    forest.userData.broadleafTrees.push({kind,variation,parts});
  }
  forest.add(treeShadows(paintedShadows,spruceShadows));batchScenery(forest);
  // Bake biome colours once instead of subdividing every shoreline triangle.
  const ground=meadowGeometry(H);ground.rotateX(-Math.PI/2);
  const floor=new THREE.Mesh(ground,createGroundMaterial(H,layout));floor.name='Biome ground';
  floor.position.y=MEADOW_Y;floor.receiveShadow=true;forest.add(floor);
  return forest;
}
