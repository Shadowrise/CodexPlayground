import { createCoasterCurve } from './coaster';
import { createFoliageTexture } from './foliage-texture';
import { createGroundMaterial } from './ground-texture';
import { meadowGeometry } from './pond-layout';
import * as THREE from 'three';
import { MEADOW_HALF_SIZE as H } from './world-bounds';
import { outsideLandmarks, sceneryClearance } from './landmarks';

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
  const geometries = {
    wood: new THREE.CylinderGeometry(.7, 1, 1, 9),
    bark: new THREE.CylinderGeometry(1, 1, 1, 9, 1, true, 0, Math.PI * 1.2),
    leaves: new THREE.IcosahedronGeometry(1, 2),
    birchLeaves: new THREE.IcosahedronGeometry(1, 2),
    needles: new THREE.ConeGeometry(1, 1, 12, 3),
    fruit: new THREE.SphereGeometry(1, 10, 8),
  };
  type Part = keyof typeof geometries;
  const batches = new Map<Part, { matrix: THREE.Matrix4; color: THREE.Color }[]>();
  const dummy = new THREE.Object3D();
  const heightScale=new THREE.Matrix4().makeScale(1,2,1);
  const track=createCoasterCurve().getPoints(1800);
  function part(kind: Part, x: number, y: number, z: number, sx: number, sy: number, sz: number, color: THREE.ColorRepresentation, yaw = 0) {
    dummy.position.set(x,y,z); dummy.scale.set(sx,sy,sz); dummy.rotation.set(0,yaw,0); dummy.updateMatrix();
    if (!batches.has(kind)) batches.set(kind, []);
    batches.get(kind)!.push({ matrix: dummy.matrix.clone().premultiply(heightScale), color: new THREE.Color(color) });
  }
  function branch(from: THREE.Vector3, to: THREE.Vector3, radius: number, color: string) {
    dummy.position.copy(from).add(to).multiplyScalar(.5);
    dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), to.clone().sub(from).normalize());
    dummy.scale.set(radius, from.distanceTo(to), radius); dummy.updateMatrix();
    if (!batches.has('wood')) batches.set('wood', []);
    batches.get('wood')!.push({ matrix: dummy.matrix.clone().premultiply(heightScale), color: new THREE.Color(color) });
  }
  for (let i=0; i<800; i++) {
    // Keep all four species visible near the starting clearing as well as across the map.
    const angle=random()*Math.PI*2, radius=17+Math.sqrt(random())*75;
    let x=i<140 ? Math.cos(angle)*radius : (random()*2-1)*(H-10);
    let z=i<140 ? Math.sin(angle)*radius : (random()*2-1)*(H-10);
    ({x,z}=outsideLandmarks(x,z,6));
    if(Math.max(Math.abs(x),Math.abs(z))>218 || (Math.abs(x)<19 && z>207))continue;
    if (Math.hypot(x,z)<14) continue;
    const biome=biomeAt(x,z), s=.65+random()*1.2, yaw=random()*Math.PI*2;
    const crownRadiusLimit=(biome==='spruce'?2.2:biome==='birch'?2.9:4.2)*s;
    if(!sceneryClearance(x,z,crownRadiusLimit+1))continue;
    if(treePositions.some(p=>Math.hypot(x-p.x,z-p.z)<crownRadiusLimit+p.crownRadius+1.2))continue;
    if(track.some(p=>Math.hypot(x-p.x,z-p.z)<crownRadiusLimit+5))continue;
    treePositions.push({x,z,crownRadius:crownRadiusLimit});
    const h=(biome==='spruce'?7.5:biome==='birch'?6.3:4.8)*s;
    const trunk=biome==='birch'?'#eee9d5':biome==='spruce'?'#69513b':'#866044';
    const thickness=(biome==='birch'?.16:.25)*s;
    part('wood',x,h*.38,z,thickness,h*.76,thickness,trunk,yaw);
    // Flared roots anchor the trunk rather than ending in a straight cylinder.
    for (let r=0;r<4;r++) {
      const a=yaw+r*Math.PI/2;
      branch(new THREE.Vector3(x,.6*s,z),new THREE.Vector3(x+Math.cos(a)*.7*s,.07,z+Math.sin(a)*.7*s),thickness*.65,trunk);
    }
    if (biome==='birch') {
      for (let b=0;b<12;b++) part('bark',x,h*(.05+b*.052),z,thickness*1.015*(1-.3*(.05+b*.052)/.76),(.035+random()*.07)*s,thickness*1.015*(1-.3*(.05+b*.052)/.76),'#514b43',random()*Math.PI*2);
    }
    if (biome==='spruce') {
      const hue=.33+random()*.035;
      for (let tier=0;tier<7;tier++) {
        const y=h*(.22+tier*.1), width=(1-tier*.115)*2*s;
        part('needles',x,y+.8*s,z,width,2.7*s,width,new THREE.Color().setHSL(hue,.48,.19+tier*.006,THREE.SRGBColorSpace),yaw+tier*.5);
        for (let arm=0;arm<5;arm++) {
          const a=yaw+arm*Math.PI*2/5+tier*.55;
          const tx=x+Math.cos(a)*width*.65,tz=z+Math.sin(a)*width*.65;
          branch(new THREE.Vector3(x,y,z),new THREE.Vector3(tx,y-.13*s,tz),.045*s,trunk);
          part('needles',tx,y+.12*s,tz,width*.38,1.05*s,width*.38,new THREE.Color().setHSL(hue,.5,.24,THREE.SRGBColorSpace),a);
        }
      }
      continue;
    }
    const fruitKind=i%3;
    const pink=biome==='autumn' && i%4===3;
    const hue=biome==='autumn'?[.035,.09,.14,.96][i%4]:biome==='birch'?.24+random()*.035:.29+random()*.035;
    const crownRadius=(biome==='birch'?1.15:1.7)*s;
    for (let limb=0;limb<7;limb++) {
      const a=yaw+limb*2.4;
      const cx=x+Math.cos(a)*crownRadius*.85, cz=z+Math.sin(a)*crownRadius*.85;
      const cy=h*(.58+limb*.045);
      branch(new THREE.Vector3(x,h*.36,z),new THREE.Vector3(cx,cy,cz),.09*s,trunk);
      for (let cluster=0;cluster<4;cluster++) {
        const ca=a+cluster*1.9, cr=crownRadius*(.45+random()*.23);
        part(biome==='birch'?'birchLeaves':'leaves',cx+Math.cos(ca)*cr*.5,cy+(random()-.25)*s,cz+Math.sin(ca)*cr*.5,
          cr,cr*(biome==='birch'?1.35:.85),cr,new THREE.Color().setHSL(hue+(random()-.5)*.035,biome==='autumn'?.6:.48,
            pink ? .32+random()*.15 : .25+random()*.11, pink ? THREE.LinearSRGBColorSpace : THREE.SRGBColorSpace),ca);
      }
      if (biome==='orchard') for (let f=0;f<3;f++) {
        const fa=a+f*2.1, fx=cx+Math.cos(fa)*crownRadius*.55, fz=cz+Math.sin(fa)*crownRadius*.55;
        const fy=cy-.45*s, fs=(.16+random()*.035)*s;
        const fc=['#e74b39','#f9a52d','#b8cf46'][fruitKind];
        part('fruit',fx,fy,fz,fs,fs*(fruitKind===2?1.35:.95),fs,fc);
        if(fruitKind===2) part('fruit',fx,fy+fs*.8,fz,fs*.58,fs*.65,fs*.58,fc);
        part('wood',fx,fy+fs*1.3,fz,.018*s,.17*s,.018*s,'#69503a');
        part('leaves',fx+.07*s,fy+fs*1.55,fz,.12*s,.035*s,.065*s,'#43833b',fa);
      }
    }
  }
  const foliageMaps={leaves:createFoliageTexture('broadleaf'),birchLeaves:createFoliageTexture('birch'),needles:createFoliageTexture('spruce')};
  for (const [kind, instances] of batches) {
    const mesh=new THREE.InstancedMesh(geometries[kind],new THREE.MeshStandardMaterial({roughness:kind==='fruit'?.55:1,map:kind in foliageMaps?foliageMaps[kind as keyof typeof foliageMaps]:null}),instances.length);
    mesh.name=`Decorative forest ${kind}`;
    instances.forEach((p,i)=>{mesh.setMatrixAt(i,p.matrix);mesh.setColorAt(i,p.color);});
    mesh.castShadow=true;mesh.receiveShadow=true;
    forest.add(spatialInstances(mesh));
  }
  // Bake biome colours once instead of subdividing every shoreline triangle.
  const ground=meadowGeometry(H);ground.rotateX(-Math.PI/2);
  const floor=new THREE.Mesh(ground,createGroundMaterial(H));floor.name='Biome ground';
  floor.position.y=-.012;floor.receiveShadow=true;forest.add(floor);
  return forest;
}
import { spatialInstances } from './spatial-instances';
