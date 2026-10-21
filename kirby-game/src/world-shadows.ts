import * as T from 'three';
import {PreparedShadows,shadowParts,restrictShadowCasters,type ShadowProfile,type ShadowPart} from './prepared-shadows';
import {WATER_Y} from './pond-layout';
import {SkyTrailShadows} from './sky-trail-shadows';
import {createMeadowPlantGeometry,type Kind} from './meadow-decor';
import type {Biome} from './forest';
import {landmarkFlowerParts} from './landmarks';
import {CoasterShadows} from './coaster-shadows';
import type {Coaster} from './coaster';
import type {Daylight} from './day-cycle';
import {ProjectedStructureShadows,connectedArchShadowGeometry} from './projected-structure-shadows';

type DecorSite={x:number;z:number;radius:number;kind:Kind;biome:Biome;variant?:number;yaw?:number};

/** Registration lives beside the scene composition. Environment masks are
 * prepared once from its saved placement data, without re-generating the world. */
export class WorldShadows extends PreparedShadows{
 private flowers:ShadowProfile;
 private plants=new Map<string,ShadowProfile>();
 private registered=new WeakSet<T.Object3D>();
 private breadProfile?:ShadowProfile;
 private railway?:CoasterShadows;
 private structures=new ProjectedStructureShadows();
 private sky?:SkyTrailShadows;
 constructor(private scene:T.Scene,private coasterSource:Coaster){
  super();
  const ball=new T.SphereGeometry(1,12,8),pole=new T.CylinderGeometry(1,1,1,10);
  this.flowers=this.profile(landmarkFlowerParts().map(p=>({geometry:p.kind==='ball'?ball:pole,matrix:new T.Matrix4().compose(new T.Vector3(...p.position),new T.Quaternion().setFromEuler(new T.Euler(...p.rotation)),new T.Vector3(...p.scale))})));
  ball.dispose();pole.dispose();this.group.add(this.structures.group);this.scene.add(this.group);
 }
 private plantProfile(kind:Kind,biome:Biome,variant:number){
  // Colours vary by biome; these rigid plant silhouettes share their geometry.
  const key=kind+(kind==='flowers'?variant%2:kind==='stump'?variant:0);let profile=this.plants.get(key);
  if(!profile){const geometry=createMeadowPlantGeometry(kind,biome,variant);profile=this.geometryProfile(geometry);geometry.dispose();this.plants.set(key,profile);}
  return profile;
 }
 private casters(root:T.Object3D,connectedStructures=false){
  for(const part of shadowParts(root,m=>m.castShadow)){
   if(!part.geometry.boundingBox)part.geometry.computeBoundingBox();
   const size=part.geometry.boundingBox!.getSize(new T.Vector3());
   if(connectedStructures&&size.y>4&&Math.max(size.x,size.z)>5){this.structures.add(connectedArchShadowGeometry(),root.matrixWorld.clone().multiply(part.matrix));continue;}
   const profile=this.geometryProfile(part.geometry);
   this.add(profile,root.matrixWorld.clone().multiply(part.matrix));
  }
 }
 private meadow(root:T.Object3D){
  for(const site of root.userData.sites as DecorSite[]??[]){
   if(site.kind==='bush'||site.kind==='reeds')continue;
   const scale=site.radius/({flowers:.42,mushrooms:.48,stump:.8,bush:1.3,fern:1.15,reeds:.68}[site.kind]);
   const yaw=site.yaw??Math.sin(site.x*12.9+site.z*7.2)*Math.PI;
   this.add(this.plantProfile(site.kind,site.biome,site.variant??0),new T.Matrix4().compose(new T.Vector3(site.x,0,site.z),new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),yaw),new T.Vector3(scale,scale,scale)));
  }
  for(const plants of root.children)if(plants.name==='Leafy meadow shrubs'||/^Leafy .* reeds$/.test(plants.name)){
   for(const part of shadowParts(plants))this.add(this.geometryProfile(part.geometry),plants.matrixWorld.clone().multiply(part.matrix));
  }
  const grass=root.getObjectByName('Meadow grass');if(!grass)return;
  for(const part of shadowParts(grass))this.add(this.geometryProfile(part.geometry),grass.matrixWorld.clone().multiply(part.matrix),{grass:true});
 }
 private landmarks(root:T.Object3D){
  this.casters(root,true);
  for(const site of root.userData.scenerySites as {x:number;z:number;kind:string}[]??[])if(site.kind==='flower')this.add(this.flowers,new T.Matrix4().makeTranslation(site.x,0,site.z));
 }
 private coaster(root:T.Object3D){
  const carts=root.children.filter(o=>/^(Rounded coaster cart |Meta Knight coaster cart)/.test(o.name));
  if(carts.length){this.railway=new CoasterShadows(this.coasterSource,carts);this.group.add(this.railway.group);}
  for(const child of root.children){
   if(carts.includes(child)||child.name==='Detailed coaster rail'||child.name==='Stable continuous coaster shadow')continue;
   if(child instanceof T.InstancedMesh)this.casters(child);
   else this.addObject(child,undefined);
  }
 }
 private balloons(root:T.Object3D){
  const balloons=root.children.filter(o=>/^Balloon \d+$/.test(o.name));
  if(balloons.length){const profile=this.addMovingObject(balloons[0]);if(profile)for(const balloon of balloons.slice(1))this.addMoving(balloon,profile);}
  for(const port of root.children)if(!balloons.includes(port))this.addObject(port,undefined);
 }
 /** Run on scene creation and after loading models. Already registered scenery
  * is left alone, including geometry hidden after its original caster retired. */
 prepare(){
  this.scene.updateMatrixWorld(true);
  for(const root of [...this.scene.children]){
   if(this.registered.has(root)||root===this.group||root instanceof T.Light)continue;
   this.registered.add(root);
   switch(root.name){
    case 'Biome meadow details':this.meadow(root);break;
    case 'Ponds, flowers, mushrooms, rocks, picnics and ruins':this.landmarks(root);break;
    case 'Mountain circuit roller coaster':this.coaster(root);break;
    case 'Colourful river boats':{
     const boats=root.children;if(boats.length){const profile=this.addMovingObject(boats[0],m=>!m.name.includes('wake'),()=>WATER_Y);if(profile)for(const boat of boats.slice(1))this.addMoving(boat,profile,()=>WATER_Y);}
     break;
    }
    case 'Three colourful balloon ports':this.balloons(root);break;
    case 'Oak treehouse, lookout, swing and leaf pile':{
     // The oak has its own unioned crown/bough/building silhouette now, rather
     // than a second generic birch shadow under the same canopy.
     const swing=root.getObjectByProperty('name','Prepared swing source');
     if(swing)this.addMovingObject(swing);
     this.addObject(root,m=>!swing||!isBelow(m,swing));
     root.traverse(o=>{if(o.name==='Soft patterned tree shadows')o.visible=false;});break;
    }
    case 'Stone maze and golden star':case 'Hedge maze and golden star':this.casters(root);break;
    case 'Four woodland biomes':case 'Continuous square mountain range':case 'Swimmable lakes':break;
    case 'Fresh bakery bread':case 'Фрукты на поляне':break; // Registered by their moving roots.
    case 'Kirby home and bed':case 'Interactive watermill':this.addObject(root,m=>m.castShadow);break;
    case 'Meta Knight portal':this.addObject(root,undefined);break;
    case 'Seven musical flowers':{
     const parts=root.children.filter((o):o is T.InstancedMesh=>o instanceof T.InstancedMesh),instance=new T.Matrix4();
     for(const flower of root.children)if(/^Musical flower \d+$/.test(flower.name)){
      const index=Number(flower.name.split(' ').at(-1)),inverse=flower.matrixWorld.clone().invert();
      const source=parts.map(mesh=>{mesh.getMatrixAt(index,instance);return {geometry:mesh.geometry,matrix:inverse.clone().multiply(mesh.matrixWorld).multiply(instance)};});
      this.add(this.profile(source),flower.matrixWorld);
     }break;
    }
    case 'Звонкие циферки · Number garden':case 'Rainbow wishing fountain':case 'Арена Топотушки':this.addObject(root,undefined);break;
    default:{
     if(root.name.startsWith('Небесная тропа')){
      this.sky=new SkyTrailShadows(root.matrixWorld);this.group.add(this.sky.group);
      const star=root.getObjectByName('Sky Trail summit reward');if(star)this.addMovingObject(star);
     }else if(!root.userData.characterShadow&&!root.name.startsWith('NPC ')){
      const casts=(m:T.Mesh)=>m.castShadow;
      const parts=shadowParts(root,casts);
      if(parts.length)this.addObject(root,casts);
      else{
       const solid=(m:T.Mesh)=>!Array.isArray(m.material)&&(m.material instanceof T.MeshStandardMaterial||m.material instanceof T.MeshLambertMaterial||m.material instanceof T.MeshPhongMaterial)&&!m.material.transparent;
       const physical=shadowParts(root,solid),bounds=new T.Box3();
       for(const part of physical){if(!part.geometry.boundingBox)part.geometry.computeBoundingBox();bounds.union(part.geometry.boundingBox!.clone().applyMatrix4(part.matrix));}
       // Sky, terrain and scenery backdrops have no finite prop footprint.
       if(!bounds.isEmpty()&&bounds.getSize(new T.Vector3()).length()<120)this.addObject(root,solid);
      }
     }
    }
   }
  }
  this.structures.commit();this.commit();restrictShadowCasters(this.scene);
 }
 prepareBread(root:T.Object3D){
  if(this.registered.has(root)||!root.children.length)return;this.registered.add(root);
  if(!this.breadProfile)this.breadProfile=this.addMovingObject(root);else this.addMoving(root,this.breadProfile);
  this.commit();restrictShadowCasters(root);
 }
 prepareFruits(fruits:readonly {type:string;object:T.Object3D;shadow?:ShadowPart[]}[]){
  const profiles=new Map<string,ShadowProfile>();
  for(const fruit of fruits){
   if(!fruit.shadow?.length)continue;
   let profile=profiles.get(fruit.type);if(!profile){profile=this.profile(fruit.shadow);profiles.set(fruit.type,profile);}
   this.addMoving(fruit.object,profile);
  }
  this.commit();
 }
 override update(time:Daylight,camera:T.Vector3){super.update(time,camera);this.railway?.update(time,camera);this.structures.update(time,camera);this.sky?.update(time,camera);}
}
function isBelow(object:T.Object3D,root:T.Object3D){for(let p:T.Object3D|null=object;p;p=p.parent)if(p===root)return true;return false;}
