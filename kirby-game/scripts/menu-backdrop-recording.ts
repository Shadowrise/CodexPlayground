import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createBroadleafTree,treeLeafMaterial,treeWoodMaterial,treeFruitMaterial} from '../src/broadleaf-tree';
import {createMountains} from '../src/mountains';
import {Watermill} from '../src/watermill';
import {createGroundMaterial} from '../src/ground-texture';
import {createShrubGeometry,createShrubMaterial} from '../src/shrub-model';
import {createGrassGeometry,createGrassMaterial} from '../src/grass-model';
import {cloneVariant,KIRBY_VARIANTS} from '../src/variants';
import {Firefly} from '../src/firefly';
import {SkyTrail} from '../src/sky-trail';
import {makeBoat} from '../src/boat-model';
import {createWaterSurface} from '../src/water-surface';
import {createMeadowPlantGeometry} from '../src/meadow-decor';
import {softMist,softMistMaterial} from '../src/soft-mist';
import {standingFootprint} from '../src/standing-footprint';
const referenceOnly=new URL(import.meta.url).searchParams.has('reference');

// Authoring only: none of these world generators are imported by the menu.
const scene=new T.Scene();scene.background=new T.Color('#b3d9ef');scene.fog=new T.Fog('#d8e9eb',130,370);
const camera=new T.PerspectiveCamera(48,16/9,.5,550);camera.position.set(26,15,48);camera.lookAt(0,5,-18);
camera.updateMatrixWorld();
const groundPoint=(x:number,y:number)=>{
 const ray=new T.Raycaster();ray.setFromCamera(new T.Vector2(x*2-1,1-y*2),camera);
 return ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),0),new T.Vector3())!;
};
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1280,720);renderer.setPixelRatio(1);
renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
document.body.style.cssText='margin:0;overflow:hidden';document.body.append(renderer.domElement);
scene.add(new T.HemisphereLight('#e6f4ff','#6b8252',2.5));
const sun=new T.DirectionalLight('#fff1d2',4);sun.position.set(-30,65,35);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{left:-75,right:75,top:75,bottom:-75,near:1,far:180});sun.shadow.bias=-.0002;scene.add(sun);
const groundGeometry=new T.PlaneGeometry(260,260),groundUV=groundGeometry.attributes.uv,groundPositions=groundGeometry.attributes.position;
// The game's ground texture uses metre-based UVs, as in meadowGeometry.
for(let i=0;i<groundUV.count;i++)groundUV.setXY(i,groundPositions.getX(i),groundPositions.getY(i));
const ground=new T.Mesh(groundGeometry,createGroundMaterial(130));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
const mountains=createMountains();for(const child of [...mountains.children])child.removeFromParent();mountains.scale.setScalar(.45);mountains.rotation.y=Math.PI-.5;mountains.position.z=-8;scene.add(mountains);
let seed=731;const random=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
const treeTemplates=new Map<string,ReturnType<typeof createBroadleafTree>>();
const orchardTrees:T.Group[]=[];
for(const [index,[x,z]] of [[-35,4],[-30,-16],[-20,-27],[-36,-37],[-43,-58],[-21,-58],[-7,-53],[9,-61],[24,-62],[39,-56],[47,-35],[45,-11],[39,9],[49,25],[-37,28]].entries()){
 const kind=index%4===0?'birch':'orchard',variation=index%3,key=kind+variation;
 let model=treeTemplates.get(key);if(!model){model=createBroadleafTree(kind,variation);treeTemplates.set(key,model);}
 const tree=new T.Group();tree.position.set(x,0,z);tree.scale.set(1.5,1.25,1.5).multiplyScalar(.85+random()*.35);tree.rotation.y=random()*Math.PI*2;
 const wood=new T.Mesh(model.wood,treeWoodMaterial(kind==='birch')),leaves=new T.Mesh(model.leaves,treeLeafMaterial().clone());
 leaves.material.color.set(kind==='birch'?'#86ad52':'#679c45');tree.add(wood,leaves);
 if(model.fruit.attributes.position.count)tree.add(new T.Mesh(model.fruit,treeFruitMaterial()));
 tree.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;}});scene.add(tree);
 orchardTrees.push(tree);
}
const mill=new Watermill();mill.group.position.set(10,0,-23);mill.quest.stage='running';for(let i=0;i<80;i++)mill.update(.1);scene.add(mill.group);
mill.group.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;}});
const skyTrail=new SkyTrail();skyTrail.group.position.set(-50,0,-35);skyTrail.group.scale.setScalar(.58);skyTrail.group.rotation.y=.4;scene.add(skyTrail.group);
const riverCurve=new T.CatmullRomCurve3([new T.Vector3(-110,0,-53),new T.Vector3(-36,0,-48),new T.Vector3(2,0,-28),new T.Vector3(28,0,-8),new T.Vector3(48,0,6),new T.Vector3(85,0,18)]);
const riverPoints=riverCurve.getPoints(180);
const riverGeometry=(halfWidth:number)=>{
 const positions:number[]=[],uvs:number[]=[],indices:number[]=[];
 riverPoints.forEach((p,i)=>{
  const tangent=riverCurve.getTangent(i/180),normal=new T.Vector3(-tangent.z,0,tangent.x);
  for(const side of [-1,1]){const q=p.clone().addScaledVector(normal,halfWidth*side);positions.push(q.x,.06,q.z);uvs.push(q.x,-q.z);}
  if(i<180){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
 });
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
};
const bank=new T.Mesh(riverGeometry(4.8),new T.MeshLambertMaterial({color:'#bdc58a'}));bank.position.y=-.02;scene.add(bank);
const water=createWaterSurface(),river=new T.Mesh(riverGeometry(3.6),water.material);river.receiveShadow=true;scene.add(river);
const boat=makeBoat(0);boat.scale.setScalar(1.8);scene.add(boat);
const distantBoat=makeBoat(4);distantBoat.scale.setScalar(2.4);scene.add(distantBoat);
const dry=(x:number,z:number)=>riverPoints.every(p=>(p.x-x)**2+(p.z-z)**2>5.2**2);
// Use the continuous bank and the game's complete foot envelope for actors.
const riverDistance=(x:number,z:number)=>{
 let distanceSq=Infinity;
 for(let i=1;i<riverPoints.length;i++){
  const a=riverPoints[i-1],b=riverPoints[i],dx=b.x-a.x,dz=b.z-a.z;
  const t=T.MathUtils.clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz),0,1);
  distanceSq=Math.min(distanceSq,(x-a.x-t*dx)**2+(z-a.z-t*dz)**2);
 }
 return Math.sqrt(distanceSq);
};
const groundClearance=(model:T.Group)=>{
 const f=standingFootprint(model.scale.x,model.rotation.y),x=model.position.x+f.dx,z=model.position.z+f.dz;
 let clearance=riverDistance(x,z)-4.8;
 for(let i=0;i<128;i++){
  const angle=i/128*Math.PI*2,px=f.rx*Math.cos(angle),pz=f.rz*Math.sin(angle);
  clearance=Math.min(clearance,riverDistance(x+px*f.cos+pz*f.sin,z-px*f.sin+pz*f.cos)-4.8);
 }
 return clearance;
};
const grass=new T.InstancedMesh(createGrassGeometry(),createGrassMaterial(),9500),dummy=new T.Object3D();
for(let i=0;i<grass.count;i++){let x:number,z:number;do{x=(random()-.5)*80;z=random()*65-30;}while(!dry(x,z));dummy.position.set(x,0,z);dummy.scale.setScalar(.8+random()*.8);dummy.rotation.y=random()*Math.PI*2;dummy.updateMatrix();grass.setMatrixAt(i,dummy.matrix);grass.setColorAt(i,new T.Color('#739048'));}scene.add(grass);
const shrubs=new T.InstancedMesh(createShrubGeometry('orchard'),createShrubMaterial({value:0}),28);
for(let i=0;i<shrubs.count;i++){const side=i%2?1:-1;dummy.position.set(side*(27+random()*13),0,random()*65-40);dummy.scale.setScalar(1+random()*1.3);dummy.rotation.y=random()*Math.PI*2;dummy.updateMatrix();shrubs.setMatrixAt(i,dummy.matrix);}scene.add(shrubs);
const flowerMaterial=new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide});
const flowerSites:{x:number;z:number;radius:number}[]=[];
for(let variant=2;variant<9;variant++){
 const flowers=new T.InstancedMesh(createMeadowPlantGeometry('flowers','orchard',variant),flowerMaterial,110);
 const positions=flowers.geometry.attributes.position;let radius=0,count=0;
 for(let i=0;i<positions.count;i++)radius=Math.max(radius,Math.hypot(positions.getX(i),positions.getZ(i)));
 for(let i=0;i<110;i++){
  let x:number,z:number;do{x=(random()-.5)*65;z=random()*52-20;}while(!dry(x,z));
  const scale=1.4+random()*1.7,yaw=random()*Math.PI*2,footprint=radius*scale;
  // Consume the original seed sequence; only thin flowers, without moving other scenery.
  if(!referenceOnly&&(count>=42||flowerSites.some(p=>Math.hypot(p.x-x,p.z-z)<p.radius+footprint+.3)))continue;
  flowerSites.push({x,z,radius:footprint});
  dummy.position.set(x,0,z);dummy.scale.setScalar(scale);dummy.rotation.y=yaw;dummy.updateMatrix();flowers.setMatrixAt(count++,dummy.matrix);
 }flowers.count=count;scene.add(flowers);
}
const foregroundFlowers=flowerSites.length;

const loader=new GLTFLoader(),[kirby,bug]=await Promise.all([loader.loadAsync('/models/kirby-animated.glb'),loader.loadAsync('/models/firefly-animated.glb')]);
const friends:{mixer:T.AnimationMixer;duration:number;phase:number}[]=[];
const models:T.Group[]=[];
const referenceScales=[2.8,2.8,2.2,2.2,2.3,2.3];
const referencePositions:T.Vector3[]=[];
const previousPositions:T.Vector3[]=[];
const rowPosition=(wrapper:T.Group,x:number,targetY:number)=>{
 let near=.98,far=.5;
 for(let step=0;step<24;step++){
  const footY=(near+far)/2;wrapper.position.copy(groundPoint(x,footY));wrapper.lookAt(camera.position.x,0,camera.position.z);
  const centre=new T.Box3().setFromObject(wrapper).getCenter(new T.Vector3()).project(camera);
  if((1-centre.y)/2>targetY)near=footY;else far=footY;
 }
};
for(const [index,[x,y]] of [[.14,.78],[.24,.98],[.88,.99],[.78,.87],[.425,.97],[.59,.98]].entries()){
 const model=cloneVariant(kirby.scene,KIRBY_VARIANTS[[0,5,2,8,1,4][index]],false),wrapper=new T.Group();wrapper.position.copy(groundPoint(x,y));wrapper.scale.setScalar(referenceScales[index]);
 referencePositions.push(wrapper.position.clone());
 wrapper.lookAt(camera.position.x,0,camera.position.z);wrapper.add(model);scene.add(wrapper);
 models.push(wrapper);
 const mixer=new T.AnimationMixer(model),clip=kirby.animations.find(c=>c.name==='Idle')!;mixer.clipAction(clip).play();friends.push({mixer,duration:clip.duration,phase:index*.7});
 if(!referenceOnly&&[1,4,5].includes(index)){
  // Reference screenshot: load-save button centre is y=508 in a 1440x900 viewport.
  mixer.setTime(index*.7);rowPosition(wrapper,x,(508+18)/936);
  previousPositions[index]=wrapper.position.clone();
  if(index===4||index===5){
   rowPosition(wrapper,x,.58);
   // Bring them towards the camera, keeping the entire foot envelope on land.
   for(let offset=1;groundClearance(wrapper)<.5&&offset<=60;offset++)rowPosition(wrapper,x-offset*.002,.58);
   if(groundClearance(wrapper)<.5)throw new Error('Kirby must stand fully clear of the river bank');
  }
 }
}
if(!referenceOnly){
 // A separate seed keeps every original tree and shrub exactly where it was.
 let orchardSeed=4271;const orchardRandom=()=>((orchardSeed=Math.imul(orchardSeed,1664525)+1013904223|0)>>>0)/4294967296;
 for(const [index,[x,y]] of [[.035,.52],[.09,.50],[.145,.54],[.19,.51],[.055,.57],[.12,.57],[.185,.565]].entries()){
  const point=groundPoint(x,y);if(!dry(point.x,point.z))continue;
  const variation=index%3,key='orchard'+variation;let model=treeTemplates.get(key);
  if(!model){model=createBroadleafTree('orchard',variation);treeTemplates.set(key,model);}
  const tree=new T.Group();tree.name='Added left orchard';tree.position.copy(point);tree.scale.set(1.5,1.25,1.5).multiplyScalar(.85+orchardRandom()*.35);tree.rotation.y=orchardRandom()*Math.PI*2;
  const leaves=new T.Mesh(model.leaves,treeLeafMaterial().clone());leaves.material.color.set('#679c45');
  tree.add(new T.Mesh(model.wood,treeWoodMaterial()),leaves,new T.Mesh(model.fruit,treeFruitMaterial()));
  tree.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;}});scene.add(tree);
  orchardTrees.push(tree);
 }
}
const orchardShrubs=new T.InstancedMesh(createShrubGeometry('orchard'),createShrubMaterial({value:0}),1800);
const orchardGrassMaterial=createGrassMaterial();
// The fixed recording camera needs distant blades too. Keep the game's native
// geometry, texture and sizes; omit its gameplay-only distance fade here.
orchardGrassMaterial.onBeforeCompile=()=>{};
orchardGrassMaterial.customProgramCacheKey=()=> 'menu-recording-visible-grass';
const orchardGrass=new T.InstancedMesh(createGrassGeometry(),orchardGrassMaterial,110000);
const shrubSites:{x:number;z:number;radius:number}[]=[];
const plantingCoverage={leftGrass:0,backGrass:0,leftShrubs:0,backShrubs:0,leftFlowers:0,backFlowers:0};
if(!referenceOnly){
 let undergrowthSeed=9741,shrubCount=0,grassCount=0;
 const undergrowthRandom=()=>((undergrowthSeed=Math.imul(undergrowthSeed,1664525)+1013904223|0)>>>0)/4294967296;
 const screenPoint=new T.Vector3();
 const inFrame=(x:number,z:number)=>{
  screenPoint.set(x,0,z).project(camera);
  return screenPoint.z<1&&Math.abs(screenPoint.x)<1.06&&screenPoint.y<.2&&screenPoint.y>-1.06;
 };
 const nearTree=(x:number,z:number,radius:number)=>orchardTrees.some(tree=>Math.hypot(tree.position.x-x,tree.position.z-z)<radius);
 const clearOfProps=(x:number,z:number,radius:number)=>Math.hypot(x-10,z+23)>8+radius&&
  models.every(model=>Math.hypot(model.position.x-x,model.position.z-z)>model.scale.x+radius+.35)&&
  orchardTrees.every(tree=>Math.hypot(tree.position.x-x,tree.position.z-z)>.75+radius*.3);
 const coverage=(kind:'Grass'|'Shrubs'|'Flowers',x:number,z:number)=>{
  screenPoint.set(x,0,z).project(camera);
  if(screenPoint.x<-.5)plantingCoverage[`left${kind}`]++;
  if(z<-30)plantingCoverage[`back${kind}`]++;
 };
 // A continuous, jittered grass carpet fills the formerly empty back and side
 // ground, including the left birches. Denser groves connect between trunks.
 for(let x=-128;x<128;x+=.65)for(let z=-128;z<50;z+=.65){
  const px=x+undergrowthRandom()*.65,pz=z+undergrowthRandom()*.65;
  if(!inFrame(px,pz)||(pz>=-27&&Math.abs(px)<38&&!nearTree(px,pz,10))||riverDistance(px,pz)<5.15||!clearOfProps(px,pz,.2))continue;
  dummy.position.set(px,0,pz);dummy.scale.setScalar(.95+undergrowthRandom()*.5);dummy.rotation.y=undergrowthRandom()*Math.PI*2;dummy.updateMatrix();
  orchardGrass.setMatrixAt(grassCount,dummy.matrix);orchardGrass.setColorAt(grassCount++,new T.Color('#739048'));
  coverage('Grass',px,pz);
 }
 for(let x=-125;x<125;x+=2.8)for(let z=-125;z<45;z+=2.8){
  const px=x+undergrowthRandom()*1.4,pz=z+undergrowthRandom()*1.4,scale=.95+undergrowthRandom()*.4,radius=1.16*scale;
  if(!inFrame(px,pz)||!nearTree(px,pz,10.5)||riverDistance(px,pz)<4.8+radius+.3||!clearOfProps(px,pz,radius))continue;
  if(flowerSites.some(p=>Math.hypot(p.x-px,p.z-pz)<p.radius+radius+.2)||shrubSites.some(p=>Math.hypot(p.x-px,p.z-pz)<p.radius+radius+.15))continue;
  dummy.position.set(px,0,pz);dummy.scale.setScalar(scale);dummy.rotation.y=undergrowthRandom()*Math.PI*2;dummy.updateMatrix();orchardShrubs.setMatrixAt(shrubCount++,dummy.matrix);
  shrubSites.push({x:px,z:pz,radius});coverage('Shrubs',px,pz);
 }
 const flowers=Array.from({length:7},(_,i)=>new T.InstancedMesh(createMeadowPlantGeometry('flowers','orchard',i+2),flowerMaterial,400));
 const flowerRadii=flowers.map(mesh=>{
  const positions=mesh.geometry.attributes.position;let radius=0;
  for(let i=0;i<positions.count;i++)radius=Math.max(radius,Math.hypot(positions.getX(i),positions.getZ(i)));return radius;
 });
 const flowerCounts=flowers.map(()=>0);
 for(let x=-125;x<125;x+=2.2)for(let z=-125;z<45;z+=2.2){
  const px=x+undergrowthRandom()*1.5,pz=z+undergrowthRandom()*1.5;
  if(!inFrame(px,pz)||!nearTree(px,pz,11))continue;
  const variant=Math.floor(undergrowthRandom()*7),scale=1.05+undergrowthRandom()*.4,radius=flowerRadii[variant]*scale;
  if(flowerCounts[variant]>=400||riverDistance(px,pz)<4.8+radius+.3||!clearOfProps(px,pz,radius))continue;
  if(flowerSites.some(p=>Math.hypot(p.x-px,p.z-pz)<p.radius+radius+.3)||shrubSites.some(p=>Math.hypot(p.x-px,p.z-pz)<p.radius+radius+.2))continue;
  dummy.position.set(px,0,pz);dummy.scale.setScalar(scale);dummy.rotation.y=undergrowthRandom()*Math.PI*2;dummy.updateMatrix();flowers[variant].setMatrixAt(flowerCounts[variant]++,dummy.matrix);
  flowerSites.push({x:px,z:pz,radius});coverage('Flowers',px,pz);
 }
 for(const [i,mesh] of flowers.entries()){
  mesh.count=flowerCounts[i];mesh.receiveShadow=true;scene.add(mesh);
  }
 orchardShrubs.count=shrubCount;orchardShrubs.castShadow=true;orchardShrubs.receiveShadow=true;orchardGrass.count=grassCount;scene.add(orchardShrubs,orchardGrass);
}
const glowColor='#58ff76',firefly=new Firefly(bug);firefly.setMode('Fly');firefly.setGlowColor(glowColor);const flight=new T.Group();flight.scale.setScalar(1.5);flight.add(firefly.object);scene.add(flight);
firefly.mixer.stopAllAction();firefly.mixer.clipAction(bug.animations.find(c=>c.name==='Fly')!).reset().stopFading().setEffectiveWeight(1).play();
firefly.object.traverse(o=>{if(o instanceof T.Mesh)o.castShadow=false;if(o instanceof T.PointLight){o.intensity=2;o.distance=6;}});
let glowMesh:T.Mesh|undefined;firefly.object.traverse(o=>{if(o instanceof T.Mesh&&(Array.isArray(o.material)?o.material:[o.material]).some(m=>m.name==='Firefly_Glow'))glowMesh=o;});
const halo=softMist(softMistMaterial(glowColor,.325));halo.material.blending=T.AdditiveBlending;halo.material.fog=false;halo.scale.setScalar(1.1);flight.add(halo);
const glowPosition=new T.Vector3();
const loopSeconds=12;
const draw=(seconds:number)=>{
 const t=seconds%loopSeconds,phase=t/loopSeconds*Math.PI*2;
 friends.forEach(friend=>friend.mixer.setTime(t/loopSeconds*friend.duration*4+friend.phase));
 firefly.mixer.setTime(t/loopSeconds*bug.animations.find(c=>c.name==='Fly')!.duration*24);
 // The native firefly faces +Z. Its nose follows the circle's exact tangent.
 if(referenceOnly)flight.position.set(3+Math.sin(phase)*13,21,5+Math.cos(phase)*13);
 else flight.position.set(11+Math.sin(phase)*3.5,17,27+Math.cos(phase)*3.5);
 flight.rotation.set(0,Math.PI/2+phase,0);
 if(glowMesh){glowMesh.getWorldPosition(glowPosition);halo.position.copy(flight.worldToLocal(glowPosition));}
 mill.wheel.rotation.x=-phase;halo.material.opacity=.325+Math.sin(phase*3)*.075;
 const boatT=.65+Math.sin(phase)*.025;boat.position.copy(riverCurve.getPoint(boatT));boat.position.y=.12+Math.sin(phase*2)*.07;
 const tangent=riverCurve.getTangent(boatT);boat.rotation.set(Math.sin(phase)*.025,Math.atan2(tangent.x,tangent.z),Math.cos(phase)*.025);
 const distantT=.16+Math.sin(phase)*.014;distantBoat.position.copy(riverCurve.getPoint(distantT));distantBoat.position.y=.12+Math.sin(phase*2)*.05;
 const distantTangent=riverCurve.getTangent(distantT);distantBoat.rotation.y=Math.atan2(distantTangent.x,distantTangent.z);
 water.texture.offset.set(Math.sin(phase)*.15,Math.cos(phase)*.15);
 renderer.render(scene,camera);
};
await renderer.compileAsync(scene,camera);draw(0);renderer.shadowMap.autoUpdate=false;
const characterCenters=models.map(model=>{
 const point=new T.Box3().setFromObject(model).getCenter(new T.Vector3()).project(camera);
 return {x:(point.x+1)/2,y:(1-point.y)/2};
});
(window as any).menuRecording={renderer,scene,camera,draw,loopSeconds,characterCenters,models,flight,firefly,glowMesh,halo,dry,groundClearance,referenceScales,referencePositions,previousPositions,flowerSites,foregroundFlowers,orchardShrubs,orchardGrass,plantingCoverage};
