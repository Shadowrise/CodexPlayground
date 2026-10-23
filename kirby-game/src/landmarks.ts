import {BOSS_ARENA} from './boss-arena-site';
import {META_KNIGHT_PORTAL} from './meta-knight-arena-site';
import {outsideNumberGarden} from './number-garden-site';
import {MILL_BAGS} from './mill-quest';
import {MUSICAL_FLOWER_SITE,outsideMusicalFlowerClearing} from './musical-flower-site';
import {SKY_TRAIL_SITE} from './sky-trail-layout';
import {MOUNTAIN_LEDGE_SITE} from './mountain-ledges-layout';
import {FOUNTAIN_SITE} from './fountain-site';
import { spatialInstances } from './spatial-instances';
import {instancedLod} from './instanced-lod';
import {sceneryShadowBatch} from './scenery-shadows';
import {batchScenery} from './scenery-batch';
import * as T from 'three';
import { BALLOON_SITES } from './balloon-sites';
import { MAZE_SITE } from './maze-layout';
import { HOME_SITE } from './home-site';
import type {MeadowLayout,MeadowTree} from './meadow-layout';
import {MEADOW_HALF_SIZE} from './world-bounds';
import {createRockGeometry,createRockMaterial} from './rock-model';
import {createReedGeometry,createWaterLilyGeometry,createWaterPlantMaterial} from './water-plants';
import {biomeAt} from './forest';
import {makeOakBench} from './bench-model';
import {makePicnic,makeRuins} from './clearing-models';
import {makeWoodlandTimber,makeWoodlandMushroom} from './woodland-models';

import { LANDMARKS, POND_SCALE } from './landmark-sites';
export { LANDMARKS } from './landmark-sites';
import { WATER_Y, deckHeight, BRIDGES, riverClearance, outsideRivers, pondOutline, flatGround as dryGround } from './pond-layout';
import {outsideBoatRoute} from './boat-route';
export const rockHasGround=dryGround;
/** Shared by the visible flower and its baked silhouette. */
export function landmarkFlowerParts(h=.64){
 const pieces:{kind:'pole'|'ball';color?:string;position:number[];scale:number[];rotation:number[]}[]=[
  {kind:'pole',color:'#477447',position:[0,h/2,0],scale:[.025,h,.025],rotation:[0,0,0]},
  {kind:'ball',color:'#639b47',position:[.12,h*.5,0],scale:[.18,.045,.09],rotation:[0,.4,.4]},
 ];
 for(let j=0;j<5;j++){const b=j*Math.PI*2/5;pieces.push({kind:'ball',position:[Math.cos(b)*.15,h,Math.sin(b)*.15],scale:[.13,.06,.09],rotation:[0,-b,0]});}
 pieces.push({kind:'ball',color:'#e5aa35',position:[0,h+.025,0],scale:[.085,.06,.085],rotation:[0,0,0]});return pieces;
}
// Retain the original clearing so moving the sack does not reseed mature trees
// and their connecting paths elsewhere on the meadow.
const millBagClearings=[...MILL_BAGS,[76,0,61] as const,[68,0,54] as const];
export function sceneryClearance(x:number,z:number,padding=0,shorePlants=false,ownSite?:typeof LANDMARKS[number],mountainClearing=true) {
  if(Math.hypot(x-META_KNIGHT_PORTAL.x,z-META_KNIGHT_PORTAL.z)<META_KNIGHT_PORTAL.radius+padding)return false;
  if(!outsideNumberGarden(x,z,padding))return false;
  if(mountainClearing&&Math.hypot(x-MOUNTAIN_LEDGE_SITE.x,z-MOUNTAIN_LEDGE_SITE.z)<MOUNTAIN_LEDGE_SITE.radius+padding)return false;
  if(!outsideMusicalFlowerClearing(x,z,padding))return false;
  if(Math.hypot(x-BOSS_ARENA.x,z-BOSS_ARENA.z)<BOSS_ARENA.radius+padding)return false;
  if(millBagClearings.some(p=>Math.hypot(x-p[0],z-p[2])<2.3+padding))return false;
  if(BRIDGES.some(s=>{const dx=x-s.x,dz=z-s.z,cos=Math.cos(s.yaw),sin=Math.sin(s.yaw);return Math.abs(dx*cos-dz*sin)<10+padding&&Math.abs(dx*sin+dz*cos)<2.8+padding;}))return false;
  if(Math.hypot(x-FOUNTAIN_SITE.x,z-FOUNTAIN_SITE.z)<=FOUNTAIN_SITE.radius+padding)return false;
  return Math.hypot(x-SKY_TRAIL_SITE.x,z-SKY_TRAIL_SITE.z)>SKY_TRAIL_SITE.radius+padding && (shorePlants||riverClearance(x,z,padding)) && Math.hypot(x-HOME_SITE.x,z-HOME_SITE.z)>HOME_SITE.radius+padding && Math.hypot(x-MAZE_SITE.x,z-MAZE_SITE.z)>MAZE_SITE.radius+padding && BALLOON_SITES.every(p=>Math.hypot(x-p.x,z-p.z)>22+padding) && Math.hypot(x-135,z-45)>25+padding && LANDMARKS.every(p=>p===ownSite||(shorePlants&&p.kind===0)||Math.hypot(x-p.x,z-p.z)>p.radius+padding);
}
export function outsideLandmarks(x:number,z:number,padding=0,mountainClearing=true) {
  for(const p of [META_KNIGHT_PORTAL,BOSS_ARENA,FOUNTAIN_SITE,SKY_TRAIL_SITE,MUSICAL_FLOWER_SITE,...LANDMARKS,{x:135,z:45,radius:25},...BALLOON_SITES.map(p=>({...p,radius:22})),MAZE_SITE,HOME_SITE]) {
    const dx=x-p.x,dz=z-p.z,d=Math.hypot(dx,dz),r=p.radius+padding;
    if(d<=r) { const a=d>.001?Math.atan2(dz,dx):0; x=p.x+Math.cos(a)*(r+.1);z=p.z+Math.sin(a)*(r+.1); }
  }
  const moved=outsideRivers(x,z,padding);
  if(sceneryClearance(moved.x,moved.z,padding,false,undefined,mountainClearing))return moved;
  // A river bank can push a point back into an attraction in a narrow gap.
  // Search nearby dry verges instead of placing trees inside either obstacle.
  for(let radius=2;radius<=80;radius+=2)for(let i=0;i<24;i++){
    const a=i*Math.PI/12,px=moved.x+Math.cos(a)*radius,pz=moved.z+Math.sin(a)*radius;
    if(sceneryClearance(px,pz,padding,false,undefined,mountainClearing)&&dryGround(px,pz,padding))return {x:px,z:pz};
  }
  return moved;
}

/** Shared primitive meshes are batched into instances after composing each scene. */
export function createLandmarks(layout?:MeadowLayout,trees:readonly MeadowTree[]=[]) {
  const root=new T.Group(); root.name='Ponds, flowers, mushrooms, rocks, picnics and ruins';
  const sites:{x:number;z:number;radius:number;kind:string;fromX:number;fromZ:number;moved:boolean}[]=[];
  root.userData.scenerySites=sites;
  const world=new T.Vector3(),scale=new T.Vector3();
  const place=(g:T.Group,x:number,z:number,radius:number,kind:string)=>{
    g.updateWorldMatrix(true,false);world.set(x,0,z);g.localToWorld(world);g.getWorldScale(scale);
    const r=radius*Math.max(scale.x,scale.z),fromX=world.x,fromZ=world.z;
    if(!dryGround(fromX,fromZ,r))return undefined;
    if(layout&&(!layout.clearOfTrails(fromX,fromZ,r)||sites.some(p=>p.moved&&Math.hypot(fromX-p.x,fromZ-p.z)<r+p.radius+.12))){
      const own=g.userData.landmarkSite as typeof LANDMARKS[number]|undefined;
      const target=layout.moveOffTrail(fromX,fromZ,r,(px,pz)=>{
        if(Math.max(Math.abs(px),Math.abs(pz))+r>MEADOW_HALF_SIZE-2||!dryGround(px,pz,r+.1)||!sceneryClearance(px,pz,r,true,own))return false;
        if(trees.some(t=>Math.hypot(px-t.x,pz-t.z)<r+.7)||sites.some(p=>Math.hypot(px-p.x,pz-p.z)<r+p.radius+.12))return false;
        if(own?.kind===4){
          if(Math.abs(px-own.x)<2.8+r&&Math.abs(pz-own.z)<2+r)return false;
          if([[0,4],[-5,-2]].some(([x,z])=>Math.abs(px-own.x-x)<1.7+r&&Math.abs(pz-own.z-z)<.85+r))return false;
        }
        return true;
      });
      if(!target)return undefined;
      world.set(target.x,0,target.z);
    }
    sites.push({x:world.x,z:world.z,radius:r,kind,fromX,fromZ,moved:Math.hypot(world.x-fromX,world.z-fromZ)>.01});
    g.worldToLocal(world);return {x:world.x,z:world.z};
  };
  const stones=Array.from({length:3},(_,i)=>({near:createRockGeometry(i),middle:createRockGeometry(i,'middle'),far:createRockGeometry(i,'far')}));
  const lilies=Array.from({length:2},(_,i)=>({near:createWaterLilyGeometry(i),middle:createWaterLilyGeometry(i,'middle'),far:createWaterLilyGeometry(i,'far')}));
  const reeds=new Map<string,{near:T.BufferGeometry;middle:T.BufferGeometry;far:T.BufferGeometry}>();
  const stoneMaterial=createRockMaterial(),waterPlantMaterial=createWaterPlantMaterial();
  const model=(g:T.Group,geometry:T.BufferGeometry,material:T.MeshLambertMaterial,x:number,y:number,z:number,sx=1,sy=1,sz=1,ry=0)=>{
    const mesh=new T.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.rotation.y=ry;g.add(mesh);return mesh;
  };
  const geo={box:new T.BoxGeometry(1,1,1),ball:new T.SphereGeometry(1,12,8),rock:stones[0].near,
    pole:new T.CylinderGeometry(1,1,1,10),cap:new T.SphereGeometry(1,16,8,0,Math.PI*2,0,Math.PI/2),
    ring:new T.TorusGeometry(1,.025,4,32)};
  const materials=new Map<string,T.MeshStandardMaterial>();
  function put(g:T.Group,k:keyof typeof geo,c:string,x:number,y:number,z:number,sx:number,sy:number,sz:number,rx=0,ry=0,rz=0) {
    if(k==='rock'){const mesh=model(g,geo.rock,stoneMaterial,x,y,z,sx,sy,sz,ry);mesh.rotation.set(rx,ry,rz);mesh.userData.tint=c;return mesh;}
    if(!materials.has(c)) materials.set(c,new T.MeshStandardMaterial({color:c,roughness:c==='#51b7cc'?.22:.92}));
    const m=new T.Mesh(geo[k],materials.get(c));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.rotation.set(rx,ry,rz);g.add(m);return m;
  }
  const rock=(g:T.Group,x:number,z:number,s=1)=>{
    // Use the final union of lakes and rivers, including confluences and widened banks.
    // Skip the entire stone, so no fragments remain afloat.
    const p=place(g,x,z,1.45*s,'rock');if(!p)return;x=p.x;z=p.z;
    const variant=Math.abs(Math.round(x*7+z*11))%stones.length;
    const mesh=model(g,stones[variant].near,stoneMaterial,x,.60*s,z,1.2*s,.85*s,s,x);mesh.userData.tint='#838779';
  };
  function flowers(g:T.Group,cx:number,cz:number,count:number) {
    for(let i=0;i<count;i++) {
      const a=i*2.399,r=Math.sqrt((i+.5)/count)*5;
      const p=place(g,cx+Math.cos(a)*r,cz+Math.sin(a)*r,.32,'flower');if(!p)continue;
      const {x,z}=p;
      const h=.4+(i%5)*.12;
      for(const part of landmarkFlowerParts(h)){const [px,py,pz]=part.position,[sx,sy,sz]=part.scale,[rx,ry,rz]=part.rotation;put(g,part.kind,part.color??['#fff4dc','#9f91d9','#f5ce53'][i%3],x+px,py,z+pz,sx,sy,sz,rx,ry,rz);}
    }
  }
  function bench(g:T.Group,x:number,z:number) {
    const seat=makeOakBench(3,1.07);seat.position.set(x,0,z);seat.rotation.y=Math.PI;
    seat.traverse(o=>{if(o instanceof T.Mesh)o.userData.landmarkBench=true;});g.add(seat);
  }
  for(const site of BRIDGES){const g=new T.Group();g.position.set(site.x,0,site.z);g.rotation.y=site.yaw;g.scale.set(POND_SCALE,1,POND_SCALE);root.add(g);
      for(let i=0;i<50;i++) {
        const x=(i-24.5)*.2,y=deckHeight(x);
        put(g,'box',i%3?'#a37a4c':'#be9662',x,y-.08,0,.19,.16,2.6,0,0,Math.atan((deckHeight(x+.02)-deckHeight(x-.02))/.04));
        for(const z of [-1.42,1.42])put(g,'box','#bd935f',x,y+1.08,z,.22,.1,.1,0,0,Math.atan((deckHeight(x+.02)-deckHeight(x-.02))/.04));
      }
      for(const z of [-1.42,1.42])for(let i=0;i<=10;i++){
        const x=i-5,y=deckHeight(x);
        put(g,'pole','#77553b',x,y+.45,z,.075,1.2,.075);
        put(g,'ball','#d8b77a',x,y+1.13,z,.12,.08,.12);
        const wx=site.x+(x*Math.cos(site.yaw)+z*Math.sin(site.yaw))*POND_SCALE,wz=site.z+(-x*Math.sin(site.yaw)+z*Math.cos(site.yaw))*POND_SCALE;
        if(i%2===0&&outsideBoatRoute(wx,wz,.3))put(g,'pole','#634d38',x,(y-.8)/2,z,.1,y+.8,.1);
      }
  }
  for(const site of LANDMARKS) {
    const g=new T.Group();g.position.set(site.x,0,site.z);g.userData.landmarkSite=site;root.add(g);
    if(site.kind===0) {
      g.scale.set(POND_SCALE,1,POND_SCALE);
      const contour=pondOutline(LANDMARKS.filter(s=>s.kind===0).indexOf(site));
      for(let i=0;i<36;i++){const p=contour[Math.floor(i*80/35)];rock(g,p.x/POND_SCALE*1.045,p.y/POND_SCALE*1.045,.4+(i%4)*.12);}
      for(let i=0;i<8;i++) {
        const a=i*2.4,x=Math.cos(a)*7,z=Math.sin(a)*4;
        if(!outsideBoatRoute(site.x+x*POND_SCALE,site.z+z*POND_SCALE,1.15*POND_SCALE))continue;
        model(g,lilies[i%2].near,waterPlantMaterial,x,WATER_Y+.005,z,1,1,1,a);
      }
      for(let i=0;i<24;i++) {const a=i*.8,x=Math.cos(a)*12.3,z=Math.sin(a)*8.6,h=1.1+i%4*.2;
        if(!dryGround(site.x+x*POND_SCALE,site.z+z*POND_SCALE,.12*POND_SCALE))continue;
        const p=place(g,x,z,.45,'reed');if(!p)continue;
        const biome=biomeAt(site.x+x*POND_SCALE,site.z+z*POND_SCALE),key=biome+i%2;
        if(!reeds.has(key))reeds.set(key,{near:createReedGeometry(biome,i%2),middle:createReedGeometry(biome,i%2,'middle'),far:createReedGeometry(biome,i%2,'far')});
        model(g,reeds.get(key)!.near,waterPlantMaterial,p.x,0,p.z,.65,h/1.6,.65,a);}
      flowers(g,-15,-3,38);
    } else if(site.kind===1) flowers(g,0,0,120);
    else if(site.kind===2) {
      g.add(makeWoodlandTimber());
      for(let i=0;i<30;i++) {const a=i*2.4,r=2+Math.sqrt(i/30)*6,h=.25+(i%4)*.16;
        const p=place(g,Math.cos(a)*r,Math.sin(a)*r,h*.8+.08,'mushroom');if(!p)continue;const {x,z}=p;
        const mushroom=makeWoodlandMushroom(i%3);mushroom.position.set(x,0,z);mushroom.scale.set(h*1.2,h*1.18,h*1.2);mushroom.rotation.y=a;g.add(mushroom);
      }
      for(let i=0;i<6;i++){const p=place(g,Math.sin(i*2)*4,Math.cos(i*2)*4,1.15,'moss');if(p)put(g,'rock','#607949',p.x,.1,p.z,1.1,.15,.7);}
    } else if(site.kind===3) {
      for(let i=0;i<10;i++)rock(g,Math.sin(i*2.4)*(2+i*.5),Math.cos(i*2.4)*(2+i*.5),.5+(i%4)*.5);
      flowers(g,4,-4,25);
    } else if(site.kind===4) {
      const p=place(g,0,0,3,'picnic');
      if(p){
        // Blanket and basket move together; the interactive benches retain
        // their shared seat coordinates and the path's actual destinations.
        const lunch=makePicnic();lunch.position.set(p.x,0,p.z);g.add(lunch);
      }
      bench(g,0,4);bench(g,-5,-2);flowers(g,5,-5,32);
    } else {
      g.add(makeRuins());
      for(let i=0;i<6;i++)rock(g,Math.sin(i*2)*7,4+Math.cos(i*2)*3,.45);
      flowers(g,6,-4,30);
    }
  }
  root.updateMatrixWorld(true);
  const shadowGeometry=new Map<T.BufferGeometry,T.BufferGeometry>([
    [geo.box,geo.box],...stones.map(s=>[s.near,s.far] as [T.BufferGeometry,T.BufferGeometry]),
    [geo.ball,new T.SphereGeometry(1,8,6)],
    [geo.pole,new T.CylinderGeometry(1,1,1,6)],
    [geo.cap,new T.SphereGeometry(1,8,4,0,Math.PI*2,0,Math.PI/2)],
  ]);
  const shadowBatches=new Map<T.BufferGeometry,T.Matrix4[]>(),shadowSize=new T.Vector3();
  for(const geometry of shadowGeometry.keys())geometry.computeBoundingBox();
  type SurfaceMaterial=T.MeshStandardMaterial|T.MeshLambertMaterial;
  const batches=new Map<string,{geometry:T.BufferGeometry; material:SurfaceMaterial; matrices:T.Matrix4[];colors:T.Color[]}>();
  root.traverse(o=>{if(o instanceof T.Mesh){const source=o.material as SurfaceMaterial,key=[o.geometry.uuid,source.type,'roughness' in source?source.roughness:'',source.map?.uuid,source.vertexColors,source.side].join(':');
    // Colour is per instance: different petals/planks need no separate draw call.
    // Keep glossy and matte surfaces separate so their original finish is retained.
    if(!batches.has(key)){const material=source.clone();material.color.set(0xffffff);batches.set(key,{geometry:o.geometry,material,matrices:[],colors:[]});}
    batches.get(key)!.matrices.push(o.matrixWorld.clone());
    batches.get(key)!.colors.push(o.userData.tint?new T.Color(o.userData.tint):source.color.clone());
    const shadow=shadowGeometry.get(o.geometry)??(o.userData.landmarkBench||(o.userData.craftedProp&&['stone','oak','wicker'].includes(source.userData.craftedFinish))?o.geometry:undefined);
    if(shadow){if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();o.geometry.boundingBox!.clone().applyMatrix4(o.matrixWorld).getSize(shadowSize);
      // Petals and water ripples are smaller than a useful shadow-map texel.
      if(Math.max(shadowSize.x,shadowSize.y,shadowSize.z)>=.6){if(!shadowBatches.has(shadow))shadowBatches.set(shadow,[]);shadowBatches.get(shadow)!.push(o.matrixWorld.clone());}
    }
  }});
  root.clear();
  const levels=new Map<T.BufferGeometry,{name:string;middle:T.BufferGeometry;far:T.BufferGeometry}>([
    [geo.ball,{name:'Rounded meadow details',middle:new T.SphereGeometry(1,8,6),far:new T.SphereGeometry(1,6,4)}],
    [geo.cap,{name:'Meadow mushroom caps',middle:new T.SphereGeometry(1,10,5,0,Math.PI*2,0,Math.PI/2),far:new T.SphereGeometry(1,8,4,0,Math.PI*2,0,Math.PI/2)}],
    [geo.pole,{name:'Meadow stems and posts',middle:new T.CylinderGeometry(1,1,1,6),far:new T.CylinderGeometry(1,1,1,5)}],
    ...stones.map(s=>[s.near,{name:'Weathered meadow rocks',middle:s.middle,far:s.far}] as const),
    ...lilies.map(s=>[s.near,{name:'Water lilies',middle:s.middle,far:s.far}] as const),
    ...[...reeds.values()].map(s=>[s.near,{name:'Leafy shore reeds',middle:s.middle,far:s.far}] as const),
  ]);
  for(const b of batches.values()){
    const shape=levels.get(b.geometry);
    if(shape)root.add(instancedLod(shape.name,b.geometry,b.material,b.matrices.map((matrix,i)=>({matrix,color:b.colors[i],detail:0})),{middle:shape.middle,far:shape.far,middleDistance:60,farDistance:150},true));
    else {const m=new T.InstancedMesh(b.geometry,b.material,b.matrices.length);b.matrices.forEach((v,i)=>{m.setMatrixAt(i,v);m.setColorAt(i,b.colors[i]);});m.receiveShadow=true;root.add(spatialInstances(m));}
  }
  for(const material of materials.values())material.dispose();
  for(const [geometry,matrices] of shadowBatches)root.add(sceneryShadowBatch('Stable landmark shadows',geometry,matrices));
  batchScenery(root);
  return root;
}
