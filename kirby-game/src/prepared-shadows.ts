import * as T from 'three';
import type {Daylight} from './day-cycle';
import {CELESTIAL_MAX_HEIGHT} from './day-cycle';
import {scenerySources,sceneryCellBounds} from './scenery-batch';
import {GROUND_SHADOW_OPACITY,groundShadowOpacity} from './ground-shadow-style';
import {startupTask,startupBudget} from './startup-tasks';

export const SHADOW_MASK_SIZE=128;
const SIZE=SHADOW_MASK_SIZE,PADDING=8,TILE=SIZE+PADDING*2,DIRECTIONS=8,SLOPE=1.35,MAX_STRETCH=1.55;
const DISTANCE_RANGE=8;
/** Shared affine projection for the track and its moving cart footprints. */
export function groundShadowProjection(time:Daylight,target=new T.Vector2()){
 target.set(time.shadowDirection[0],time.shadowDirection[2]);
 if(target.lengthSq()>.0001)target.normalize();else target.set(0,1);
 return target.multiplyScalar(SLOPE*(.85+.7*(1-Math.abs(time.sunDirection[1])/CELESTIAL_MAX_HEIGHT)));
}
export function projectGroundShadow(point:T.Vector3,projection:T.Vector2,receiver=0,target=new T.Vector3()){
 return target.set(point.x+projection.x*(point.y-receiver),receiver+.019,point.z+projection.y*(point.y-receiver));
}
export const GRASS_SHADOW_FADE={near:24,far:52};
export const SCENERY_SHADOW_FADE={near:145,far:205};
export type ShadowPart={geometry:T.BufferGeometry;matrix:T.Matrix4};
export type ShadowProfile={index:number;center:T.Vector3;radius:number;masks:Uint8Array[]};
const distanceMasks=new WeakMap<Uint8Array,Uint8Array>();
type Stamp={profile:ShadowProfile;matrix:T.Matrix4;receiver:number;strength:number;grass:boolean};
type MovingStamp={root:T.Object3D;profile:ShadowProfile;receiver:()=>number;strength:number};
type ShadowOptions={receiver?:number;strength?:number;grass?:boolean};

/** Mark the model, rather than guessing from a mesh/material name. Accessories
 * below this node inherit the character's ordinary shadow-map permission. */
export function characterShadow(root:T.Object3D){root.userData.characterShadow=true;return root;}
export function isCharacterShadow(object:T.Object3D){
 for(let p:T.Object3D|null=object;p;p=p.parent)if(p.userData.characterShadow)return true;
 return false;
}
export function restrictShadowCasters(root:T.Object3D){
 root.traverse(o=>{
  if(!(o instanceof T.Mesh)||isCharacterShadow(o))return;
  o.castShadow=false;
  const materials=Array.isArray(o.material)?o.material:[o.material];
  if(materials.every(m=>!m.colorWrite&&!m.depthWrite))o.visible=false;
 });
}

/** The original meshes may have been replaced by multi-draw cells. Read their
 * retained prototypes/transforms, selecting only the first level of each LOD. */
export function shadowParts(root:T.Object3D,include:(mesh:T.Mesh)=>boolean=()=>true){
 root.updateWorldMatrix(true,true);
 const inverse=root.matrixWorld.clone().invert(),parts:ShadowPart[]=[],instance=new T.Matrix4();
 const visit=(object:T.Object3D,matrix:T.Matrix4)=>{
  if(object.userData.characterShadow||object.userData.preparedShadow||object.userData.renderOnlyDetail||sceneryCellBounds(object)||object.name==='Soft patterned tree shadows')return;
  if(object instanceof T.Mesh&&scenerySources(object).length){
   for(const source of scenerySources(object)){
    let duplicate=false;
    for(let p:T.Object3D|null=source.visibility;p&&p!==root;p=p.parent)if(p.parent instanceof T.LOD&&p!==p.parent.levels[0]?.object){duplicate=true;break;}
    if(!duplicate)visit(source.mesh,inverse.clone().multiply(source.visibility.matrixWorld));
   }
   return;
  }
  if(object instanceof T.Mesh&&include(object)){
   const materials=Array.isArray(object.material)?object.material:[object.material];
   if(materials.every(m=>m.visible&&(!m.transparent||m.opacity>=.75))&&object.geometry.attributes.position){
    if(object instanceof T.InstancedMesh){for(let i=0;i<object.count;i++){object.getMatrixAt(i,instance);parts.push({geometry:object.geometry,matrix:matrix.clone().multiply(instance)});}}
    else parts.push({geometry:object.geometry,matrix:matrix.clone()});
   }
  }
  const children=object instanceof T.LOD?object.levels.slice(0,1).map(l=>l.object):object.children;
  for(const child of children)visit(child,inverse.clone().multiply(child.matrixWorld));
 };
 visit(root,new T.Matrix4());return parts;
}

/** Bake eight fixed silhouettes once. Only the small masks survive; source
 * triangles never enter a shadow pass or get projected again during play. */
export function bakeShadowProfile(parts:readonly ShadowPart[],index=0,slope=SLOPE):ShadowProfile{
 const {center,radius}=shadowProfileBounds(parts,slope);
 const vertex=new T.Vector3();
 const masks:Uint8Array[]=[],points:Float32Array[]=[];
 for(const part of parts){
  const p=part.geometry.attributes.position,positions=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++){vertex.fromBufferAttribute(p,i).applyMatrix4(part.matrix).sub(center);vertex.toArray(positions,i*3);}
  points.push(positions);
 }
 const edge=(ax:number,ay:number,bx:number,by:number,x:number,y:number)=>(x-ax)*(by-ay)-(y-ay)*(bx-ax);
 for(let direction=0;direction<DIRECTIONS;direction++){
  masks.push(bakeDirection(parts,points,radius,direction,slope,edge));
 }
 return {index,center,radius,masks};
}

function shadowProfileBounds(parts:readonly ShadowPart[],slope=SLOPE){
 const bounds=new T.Box3(),partBounds=new T.Box3();
 for(const part of parts){
  if(!part.geometry.boundingBox)part.geometry.computeBoundingBox();
  partBounds.copy(part.geometry.boundingBox!).applyMatrix4(part.matrix);bounds.union(partBounds);
 }
 if(bounds.isEmpty())throw new Error('Cannot prepare an empty shadow');
 const center=bounds.getCenter(new T.Vector3());center.y=bounds.min.y;
 const size=bounds.getSize(new T.Vector3());
 const radius=Math.max(.08,Math.hypot(size.x,size.z)/2+size.y*slope)*1.08;
 return {center,radius};
}

function bakeDirection(parts:readonly ShadowPart[],points:Float32Array[],radius:number,direction:number,slope:number,edge:(ax:number,ay:number,bx:number,by:number,x:number,y:number)=>number){
  const angle=direction*Math.PI*2/DIRECTIONS,dx=Math.sin(angle)*slope,dz=Math.cos(angle)*slope,mask=new Uint8Array(SIZE*SIZE);
  for(let partIndex=0;partIndex<parts.length;partIndex++){
   const geometry=parts[partIndex].geometry,p=points[partIndex],uv=new Float32Array(p.length/3*2);
   for(let i=0;i<p.length/3;i++){uv[i*2]=(.5+(p[i*3]+p[i*3+1]*dx)/(2*radius))*SIZE;uv[i*2+1]=(.5+(p[i*3+2]+p[i*3+1]*dz)/(2*radius))*SIZE;}
   const count=geometry.index?.count??p.length/3,start=geometry.drawRange.start,end=Math.min(count,start+geometry.drawRange.count);
   for(let i=start;i+2<end;i+=3){
    const a=(geometry.index?.getX(i)??i)*2,b=(geometry.index?.getX(i+1)??i+1)*2,c=(geometry.index?.getX(i+2)??i+2)*2;
    const ax=uv[a],ay=uv[a+1],bx=uv[b],by=uv[b+1],cx=uv[c],cy=uv[c+1],area=edge(ax,ay,bx,by,cx,cy);
    if(Math.abs(area)<1e-5)continue;
    const sign=Math.sign(area),minX=Math.max(0,Math.floor(Math.min(ax,bx,cx))),maxX=Math.min(SIZE-1,Math.ceil(Math.max(ax,bx,cx)));
    const minY=Math.max(0,Math.floor(Math.min(ay,by,cy))),maxY=Math.min(SIZE-1,Math.ceil(Math.max(ay,by,cy)));
    for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
     const at=y*SIZE+x;if(mask[at])continue;
     if(edge(ax,ay,bx,by,x+.5,y+.5)*sign>=0&&edge(bx,by,cx,cy,x+.5,y+.5)*sign>=0&&edge(cx,cy,ax,ay,x+.5,y+.5)*sign>=0)mask[at]=255;
    }
   }
  }
  // A small separable tent keeps thin stems visible and edges stable under
  // minification. Atlas padding prevents neighbouring directions bleeding in.
  const temp=new Uint8Array(mask.length),soft=new Uint8Array(mask.length);
  for(let y=1;y<SIZE-1;y++)for(let x=1;x<SIZE-1;x++){const i=y*SIZE+x;temp[i]=(mask[i-1]+2*mask[i]+mask[i+1])/4;}
  for(let y=1;y<SIZE-1;y++)for(let x=1;x<SIZE-1;x++){const i=y*SIZE+x;soft[i]=(temp[i-SIZE]+2*temp[i]+temp[i+SIZE])/4;}
  return soft;
}

/** Blend the boundary of adjacent silhouettes, rather than their opacity.
 * Opacity crossfades leave two separate shadows under a single light. */
export function shadowDistanceMask(mask:Uint8Array,size=SIZE){
 const distanceTo=(inside:boolean)=>{
  const distance=Float32Array.from(mask,value=>(value>=128)===inside?0:size*2),diagonal=Math.SQRT2;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const i=y*size+x;
   if(x)distance[i]=Math.min(distance[i],distance[i-1]+1);
   if(y){distance[i]=Math.min(distance[i],distance[i-size]+1);if(x)distance[i]=Math.min(distance[i],distance[i-size-1]+diagonal);if(x+1<size)distance[i]=Math.min(distance[i],distance[i-size+1]+diagonal);}
  }
  for(let y=size-1;y>=0;y--)for(let x=size-1;x>=0;x--){
   const i=y*size+x;
   if(x+1<size)distance[i]=Math.min(distance[i],distance[i+1]+1);
   if(y+1<size){distance[i]=Math.min(distance[i],distance[i+size]+1);if(x)distance[i]=Math.min(distance[i],distance[i+size-1]+diagonal);if(x+1<size)distance[i]=Math.min(distance[i],distance[i+size+1]+diagonal);}
  }
  return distance;
 };
 const toFilled=distanceTo(true),toEmpty=distanceTo(false);
 return Uint8Array.from(mask,(value,i)=>{
  const signed=value>=128?toEmpty[i]-.5:.5-toFilled[i];
  return Math.round(255*T.MathUtils.clamp(.5+signed/(2*DISTANCE_RANGE),0,1));
 });
}

export class PreparedShadows{
 readonly group=new T.Group();
 readonly grass=new T.Group();
 readonly material:T.MeshBasicMaterial;
 private profiles:ShadowProfile[]=[];
 private geometryProfiles=new WeakMap<T.BufferGeometry,ShadowProfile>();
 private stamps:Stamp[]=[];
 private moving:MovingStamp[]=[];
 private movingMesh?:T.InstancedMesh;
 private geometry=new T.PlaneGeometry(2,2).rotateX(-Math.PI/2);
 private direction={value:new T.Vector2(0,1)};
 private stretch={value:1};
 private atlasLayout={value:new T.Vector3(1,TILE*4,TILE*2)};
 private eye={value:new T.Vector3()};
 private matrix=new T.Matrix4();
 private colour=new T.Color();
 private movingPosition=new T.Vector3();
 private movingScale=new T.Vector3();
 private movingRotation=new T.Quaternion();
 private movingAngles=new T.Euler(0,0,0,'YXZ');
 private up=new T.Vector3(0,1,0);
 private lastProfileCount=0;
 private cullCells:{mesh:T.InstancedMesh;bounds:T.Box2;distance:number}[]=[];
 private cullEye=new T.Vector2();
 private pendingProfiles?:{profile:ShadowProfile;parts:readonly ShadowPart[]}[];
 constructor(){
  this.group.name='Prepared scenery shadows';this.group.userData.preparedShadow=true;
  this.grass.name='Prepared grass shadows';this.group.add(this.grass);
  this.material=new T.MeshBasicMaterial({color:'black',transparent:true,opacity:GROUND_SHADOW_OPACITY,depthWrite:false,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  this.material.name='Shared prepared silhouette atlas';
  this.material.customProgramCacheKey=()=> 'prepared-scenery-shadows-v4';
  this.material.onBeforeCompile=shader=>{
   Object.assign(shader.uniforms,{preparedDirection:this.direction,preparedStretch:this.stretch,preparedAtlas:this.atlasLayout,preparedEye:this.eye});
   shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
    uniform vec2 preparedDirection;uniform float preparedStretch;uniform vec3 preparedEye;
    flat varying vec3 vPrepared;flat varying float vPreparedFrame;flat varying float vPreparedFeather;varying vec2 vPreparedUv;flat varying vec4 vPreparedRotations;`)
    .replace('#include <begin_vertex>',`#include <begin_vertex>
     mat4 placement=modelMatrix*instanceMatrix;
     vec2 bx=placement[0].xz/max(.0001,length(placement[0].xz)),bz=placement[2].xz/max(.0001,length(placement[2].xz));
     vec2 localDirection=vec2(dot(preparedDirection,bx),dot(preparedDirection,bz));
     localDirection=length(localDirection)>.0001?normalize(localDirection):vec2(0.,1.);
     vPreparedFrame=mod(atan(localDirection.x,localDirection.y)+6.28318530718,6.28318530718)*1.27323954474;
     vPreparedUv=uv;
     float angleA=fract(vPreparedFrame)*.785398163397,angleB=angleA-.785398163397;
     vPreparedRotations=vec4(cos(angleA),sin(angleA),cos(angleB),sin(angleB));
     float texelWorld=2.*max(length(placement[0].xz),length(placement[2].xz))*max(1.,preparedStretch)/${SIZE.toFixed(1)};
     vPreparedFeather=.10/(${(2*DISTANCE_RANGE).toFixed(1)}*max(.0001,texelWorld));
     float verticalRatio=clamp(length(placement[1].xyz)/max(.0001,sqrt(length(placement[0].xyz)*length(placement[2].xyz))),.15,200.);
     transformed.xz+=localDirection*dot(transformed.xz,localDirection)*(preparedStretch*verticalRatio-1.);
     float receiver=instanceColor.b;
     vec3 world=(placement*vec4(transformed,1.)).xyz;
     world.xz+=preparedDirection*max(0.,placement[3].y-receiver)*${SLOPE.toFixed(2)}*preparedStretch;
     world.y=receiver+.018;
     float distanceToEye=distance(placement[3].xz,preparedEye.xz);
     float isGrass=step(4.,instanceColor.g);
     float fade=mix(1.-smoothstep(${SCENERY_SHADOW_FADE.near.toFixed(1)},${SCENERY_SHADOW_FADE.far.toFixed(1)},distanceToEye),1.-smoothstep(${GRASS_SHADOW_FADE.near.toFixed(1)},${GRASS_SHADOW_FADE.far.toFixed(1)},distanceToEye),isGrass);
     vPrepared=vec3(instanceColor.r,mod(instanceColor.g,4.),fade);`)
    .replace('#include <project_vertex>','vec4 mvPosition=viewMatrix*vec4(world,1.);gl_Position=projectionMatrix*mvPosition;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
    uniform vec3 preparedAtlas;flat varying vec3 vPrepared;flat varying float vPreparedFrame;flat varying float vPreparedFeather;varying vec2 vPreparedUv;flat varying vec4 vPreparedRotations;
    vec2 preparedUv(float frame,vec2 rotation){
     // Atlas IDs are integers. Perspective interpolation of an ID exactly on
     // a row boundary can round down and sample another object's silhouette.
     float profile=floor(vPrepared.x+.5);
     vec2 block=vec2(mod(profile,preparedAtlas.x)*4.,floor(profile/preparedAtlas.x)*2.);
     vec2 tile=block+vec2(mod(frame,4.),floor(frame/4.));
     vec2 uv=clamp(mat2(rotation.x,rotation.y,-rotation.y,rotation.x)*(vPreparedUv-.5)+.5,0.,1.);
     return (tile*${TILE.toFixed(1)}+${PADDING.toFixed(1)}+uv*${SIZE.toFixed(1)})/preparedAtlas.yz;
    }`)
    .replace('#include <map_fragment>',`float frame=mod(floor(vPreparedFrame),8.);
     // Align both baked rays with the current single light before morphing
     // their distance fields. Tall objects keep one continuous shadow.
     float boundary=mix(texture2D(map,preparedUv(frame,vPreparedRotations.xy)).r,texture2D(map,preparedUv(mod(frame+1.,8.),vPreparedRotations.zw)).r,fract(vPreparedFrame));
     float feather=min(.49,max(fwidth(boundary)*.75,vPreparedFeather));
     float mask=smoothstep(.5-feather,.5+feather,boundary);
     diffuseColor.a*=pow(mask,.8)*vPrepared.y*vPrepared.z;if(diffuseColor.a<.003)discard;`);
  };
  const uv=this.geometry.attributes.uv;for(let i=0;i<uv.count;i++)uv.setY(i,1-uv.getY(i));
 }
 /** Registration can remain synchronous while its raster work yields to input. */
 deferPreparation(){this.pendingProfiles??=[];}
 async finishPreparation(){
  if(!this.pendingProfiles)return;
  const budget=startupBudget(),vertex=new T.Vector3();
  for(const {profile,parts} of this.pendingProfiles){
   const points:Float32Array[]=[];
   for(const part of parts){
    const p=part.geometry.attributes.position,positions=new Float32Array(p.count*3);
    for(let i=0;i<p.count;i++){vertex.fromBufferAttribute(p,i).applyMatrix4(part.matrix).sub(profile.center);vertex.toArray(positions,i*3);}
    points.push(positions);const pause=budget();if(pause)await pause;
   }
   const edge=(ax:number,ay:number,bx:number,by:number,x:number,y:number)=>(x-ax)*(by-ay)-(y-ay)*(bx-ax);
   for(let direction=0;direction<DIRECTIONS;direction++){
    const mask=bakeDirection(parts,points,profile.radius,direction,SLOPE,edge);profile.masks.push(mask);
    let pause=budget();if(pause)await pause;
    distanceMasks.set(mask,shadowDistanceMask(mask));pause=budget();if(pause)await pause;
   }
  }
  this.pendingProfiles=undefined;await startupTask();this.commit();
 }
 profile(parts:readonly ShadowPart[]){
  const profile=this.pendingProfiles?{index:this.profiles.length,...shadowProfileBounds(parts),masks:[]}:bakeShadowProfile(parts,this.profiles.length);
  this.profiles.push(profile);this.pendingProfiles?.push({profile,parts});return profile;
 }
 geometryProfile(geometry:T.BufferGeometry){
  let profile=this.geometryProfiles.get(geometry);
  if(!profile){profile=this.profile([{geometry,matrix:new T.Matrix4()}]);this.geometryProfiles.set(geometry,profile);}
  return profile;
 }
 add(profile:ShadowProfile,matrix:T.Matrix4,options:ShadowOptions={}){
  this.stamps.push({profile,matrix:matrix.clone(),receiver:options.receiver??0,strength:options.strength??1,grass:options.grass??false});
 }
 addObject(root:T.Object3D,include?:(mesh:T.Mesh)=>boolean,options:ShadowOptions={}){
  const parts=shadowParts(root,include);if(!parts.length)return;
  const profile=this.profile(parts);this.add(profile,root.matrixWorld,options);return profile;
 }
 addMoving(root:T.Object3D,profile:ShadowProfile,receiver:()=>number=()=>0,strength=1){this.moving.push({root,profile,receiver,strength});}
 addMovingObject(root:T.Object3D,include?:(mesh:T.Mesh)=>boolean,receiver:()=>number=()=>0){
  const parts=shadowParts(root,include);if(!parts.length)return;
  const profile=this.profile(parts);this.addMoving(root,profile,receiver);return profile;
 }
 private placement(profile:ShadowProfile,source:T.Matrix4){
  return this.matrix.copy(source).multiply(new T.Matrix4().makeTranslation(...profile.center.toArray())).scale(new T.Vector3(profile.radius,profile.radius,profile.radius));
 }
 private movingPlacement(profile:ShadowProfile,source:T.Matrix4){
  source.decompose(this.movingPosition,this.movingRotation,this.movingScale);
  const nonzero=Math.min(Math.abs(this.movingScale.x),Math.abs(this.movingScale.y),Math.abs(this.movingScale.z))>.000001;
  const yaw=nonzero?this.movingAngles.setFromQuaternion(this.movingRotation,'YXZ').y:0;
  this.movingRotation.setFromAxisAngle(this.up,yaw);
  // Follow the actual pivot/centre while keeping the ground quad horizontal.
  // Carts must retain a shadow in vertical loops, and bread when laid flat.
  this.movingPosition.copy(profile.center).applyMatrix4(source);this.movingScale.multiplyScalar(profile.radius);
  return this.matrix.compose(this.movingPosition,this.movingRotation,this.movingScale);
 }
 /** Commit after registration. Static transforms are uploaded only here;
  * subsequent frames update shared uniforms and the small transport batch. */
 commit(){
  if(this.pendingProfiles)return;
  if(this.group.parent)this.moving=this.moving.filter(stamp=>{for(let p:T.Object3D|null=stamp.root;p;p=p.parent)if(p===this.group.parent)return true;return false;});
  if(this.profiles.length!==this.lastProfileCount){
   const columns=Math.max(1,Math.ceil(Math.sqrt(this.profiles.length/2))),rows=Math.ceil(this.profiles.length/columns),width=columns*TILE*4,height=rows*TILE*2;
   // Coverage is one scalar. Avoid uploading three unused colour channels.
   const pixels=new Uint8Array(width*height);
   for(const profile of this.profiles)for(let d=0;d<DIRECTIONS;d++){
    const source=profile.masks[d],mask=distanceMasks.get(source)??shadowDistanceMask(source);distanceMasks.set(source,mask);
    const ox=(profile.index%columns*4+d%4)*TILE+PADDING,oy=(Math.floor(profile.index/columns)*2+Math.floor(d/4))*TILE+PADDING;
    for(let y=0;y<SIZE;y++)pixels.set(mask.subarray(y*SIZE,(y+1)*SIZE),(oy+y)*width+ox);
   }
   const map=new T.DataTexture(pixels,width,height,T.RedFormat);map.generateMipmaps=true;map.magFilter=T.LinearFilter;map.minFilter=T.LinearMipmapLinearFilter;map.anisotropy=4;map.needsUpdate=true;
   this.material.map?.dispose();this.material.map=map;this.material.needsUpdate=true;this.atlasLayout.value.set(columns,width,height);this.lastProfileCount=this.profiles.length;
  }
  const cells=new Map<string,Stamp[]>();
  for(const stamp of this.stamps){const p=this.placement(stamp.profile,stamp.matrix).elements,cellSize=stamp.grass?24:64,key=`${stamp.grass?'grass':'props'}:${Math.floor(p[12]/cellSize)},${Math.floor(p[14]/cellSize)}`;const cell=cells.get(key)??[];cell.push(stamp);cells.set(key,cell);}
  for(const [key,stamps] of cells){
   const mesh=new T.InstancedMesh(this.geometry,this.material,stamps.length),bounds=new T.Box3(),fadeBounds=new T.Box2();mesh.name=key.startsWith('grass')?'Prepared grass cell':'Prepared scenery cell';mesh.userData.preparedShadow=true;mesh.renderOrder=1;
   stamps.forEach((stamp,i)=>{
    const matrix=this.placement(stamp.profile,stamp.matrix);mesh.setMatrixAt(i,matrix);mesh.setColorAt(i,this.colour.setRGB(stamp.profile.index,stamp.strength+(stamp.grass?4:0),stamp.receiver,T.LinearSRGBColorSpace));
    const p=new T.Vector3().setFromMatrixPosition(matrix),s=new T.Vector3().setFromMatrixScale(matrix),radius=Math.max(s.x,s.y,s.z)*MAX_STRETCH+Math.max(0,p.y-stamp.receiver)*SLOPE*MAX_STRETCH;
    fadeBounds.expandByPoint(new T.Vector2(p.x,p.z));
    bounds.expandByPoint(new T.Vector3(p.x-radius,stamp.receiver,p.z-radius));bounds.expandByPoint(new T.Vector3(p.x+radius,stamp.receiver+.025,p.z+radius));
   });
   mesh.boundingBox=bounds;mesh.boundingSphere=bounds.getBoundingSphere(new T.Sphere());mesh.matrixAutoUpdate=false;
   const grass=key.startsWith('grass');
   // The shader fades by the placement centre, not the stretched footprint.
   // Cull only after every placement in the cell has reached zero opacity.
   this.cullCells.push({mesh,bounds:fadeBounds,distance:grass?GRASS_SHADOW_FADE.far:SCENERY_SHADOW_FADE.far});
   (grass?this.grass:this.group).add(mesh);
  }
  this.stamps=[];
  if(this.movingMesh?.count!==this.moving.length){
   if(this.movingMesh){this.movingMesh.removeFromParent();this.movingMesh.dispose();this.movingMesh=undefined;}
   if(this.moving.length){
    this.movingMesh=new T.InstancedMesh(this.geometry,this.material,this.moving.length);this.movingMesh.name='Prepared moving object shadows';this.movingMesh.frustumCulled=false;this.movingMesh.renderOrder=1;this.movingMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.moving.forEach((stamp,i)=>{this.movingMesh!.setMatrixAt(i,this.movingPlacement(stamp.profile,stamp.root.matrixWorld));this.movingMesh!.setColorAt(i,this.colour.setRGB(stamp.profile.index,0,stamp.receiver(),T.LinearSRGBColorSpace));});
    this.group.add(this.movingMesh);
   }
  }
 }
 update(time:Daylight,camera:T.Vector3){
  this.direction.value.set(time.shadowDirection[0],time.shadowDirection[2]);if(this.direction.value.lengthSq()>.0001)this.direction.value.normalize();else this.direction.value.set(0,1);
  this.stretch.value=.85+.7*(1-Math.abs(time.sunDirection[1])/CELESTIAL_MAX_HEIGHT);this.eye.value.copy(camera);
  this.material.opacity=groundShadowOpacity(time);
  this.cullEye.set(camera.x,camera.z);
  for(const {mesh,bounds,distance} of this.cullCells)mesh.visible=bounds.distanceToPoint(this.cullEye)<distance;
  if(this.movingMesh){
   this.moving.forEach((stamp,i)=>{
    let visible=true,connected=false;for(let p:T.Object3D|null=stamp.root;p;p=p.parent){if(!p.visible)visible=false;if(p===this.group.parent)connected=true;}visible&&=connected;
    stamp.root.updateWorldMatrix(true,false);const matrix=this.movingPlacement(stamp.profile,stamp.root.matrixWorld);
    this.movingMesh!.setMatrixAt(i,matrix);this.movingMesh!.setColorAt(i,this.colour.setRGB(stamp.profile.index,visible?stamp.strength:0,stamp.receiver(),T.LinearSRGBColorSpace));
   });this.movingMesh.instanceMatrix.needsUpdate=true;this.movingMesh.instanceColor!.needsUpdate=true;
  }
 }
 get inventory(){return {profiles:this.profiles.length,moving:this.moving.length,grassCells:this.grass.children.length,atlasBytes:(this.material.map?.image.data as Uint8Array|undefined)?.byteLength??0};}
}
