import * as T from 'three';
import type {Coaster} from './coaster';
import type {Daylight} from './day-cycle';
import {bakeShadowProfile,groundShadowProjection,projectGroundShadow,shadowParts,SHADOW_MASK_SIZE} from './prepared-shadows';
import {GROUND_SHADOW_OPACITY,groundShadowOpacity} from './ground-shadow-style';

type Track=Pick<Coaster,'length'|'pose'>;
type Ribbon={a:T.Vector3;b:T.Vector3;tangentA:T.Vector3;tangentB:T.Vector3;width:number;opacity:number};
const RAIL_OFFSET=1.2,RAIL_HALF_WIDTH=.16,TIE_HALF_WIDTH=.19,TIE_SPACING=2.4;
export function projectedTrackCenter(track:Track,distance:number,projection:T.Vector2){return projectGroundShadow(track.pose(distance).p,projection);}

/** The two rails follow the real banked/looping frames. Ribbons have a constant
 * ground-space width, so no long segment can inflate a rail or sleeper stamp. */
export function prepareTrackRibbons(track:Track,samples=2400){
 const railPoints=[[] as T.Vector3[],[] as T.Vector3[]],ribbons:Ribbon[]=[];
 for(let i=0;i<=samples;i++){
  const {p,q}=track.pose(i/samples*track.length);
  for(let rail=0;rail<2;rail++)railPoints[rail].push(new T.Vector3(rail?RAIL_OFFSET:-RAIL_OFFSET,0,0).applyQuaternion(q).add(p));
 }
 for(const points of railPoints)for(let i=0;i<samples;i++){
  const tangentA=points[i+1].clone().sub(points[Math.max(0,i-1)]),tangentB=points[Math.min(samples,i+2)].clone().sub(points[i]);
  ribbons.push({a:points[i],b:points[i+1],tangentA,tangentB,width:RAIL_HALF_WIDTH,opacity:1});
 }
 for(let distance=0;distance<track.length;distance+=TIE_SPACING){
  const {p,q}=track.pose(distance),a=new T.Vector3(-1.5,0,0).applyQuaternion(q).add(p),b=new T.Vector3(1.5,0,0).applyQuaternion(q).add(p),tangent=b.clone().sub(a);
  ribbons.push({a,b,tangentA:tangent,tangentB:tangent,width:TIE_HALF_WIDTH,opacity:.8});
 }
 return ribbons;
}

function ribbonGeometry(ribbons:readonly Ribbon[]){
 const positions:number[]=[],tangents:number[]=[],sides:number[]=[],widths:number[]=[],opacities:number[]=[],indices:number[]=[];
 for(const ribbon of ribbons){
  const first=positions.length/3;
  for(const [point,tangent] of [[ribbon.a,ribbon.tangentA],[ribbon.b,ribbon.tangentB]])for(const side of [-1,1]){
   positions.push(point.x,point.y,point.z);tangents.push(tangent.x,tangent.y,tangent.z);sides.push(side);widths.push(ribbon.width);opacities.push(ribbon.opacity);
  }
  indices.push(first,first+1,first+2,first+1,first+3,first+2);
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('shadowTangent',new T.Float32BufferAttribute(tangents,3));geometry.setAttribute('shadowSide',new T.Float32BufferAttribute(sides,1));geometry.setAttribute('shadowWidth',new T.Float32BufferAttribute(widths,1));geometry.setAttribute('shadowOpacity',new T.Float32BufferAttribute(opacities,1));geometry.setIndex(indices);
 // Projection can move an elevated rail towards a camera outside its source
 // cell. Include the largest sun/moon displacement in fixed culling bounds.
 const bounds=new T.Box3();
 for(const ribbon of ribbons)for(const p of [ribbon.a,ribbon.b]){const r=Math.abs(p.y)*2.1+ribbon.width;bounds.expandByPoint(new T.Vector3(p.x-r,0,p.z-r));bounds.expandByPoint(new T.Vector3(p.x+r,.03,p.z+r));}
 geometry.boundingBox=bounds;geometry.boundingSphere=bounds.getBoundingSphere(new T.Sphere());return geometry;
}

export class CoasterShadows{
 readonly group=new T.Group();
 readonly rails:T.MeshBasicMaterial;
 readonly cartMaterial:T.MeshBasicMaterial;
 readonly carts:T.InstancedMesh;
 private projection={value:new T.Vector2(0,1.35)};
 private eye={value:new T.Vector3()};
 private matrix=new T.Matrix4();
 private hidden=new T.Matrix4().makeScale(0,0,0);
 constructor(track:Track,private sources:readonly T.Object3D[]){
  this.group.name='Prepared continuous railway shadows';this.group.userData.preparedShadow=true;
  this.rails=new T.MeshBasicMaterial({color:'black',transparent:true,opacity:GROUND_SHADOW_OPACITY,depthWrite:false,side:T.DoubleSide,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  this.rails.name='Continuous rail and sleeper silhouettes';
  this.rails.customProgramCacheKey=()=> 'prepared-rail-ribbons-v1';
  this.rails.onBeforeCompile=shader=>{
   shader.uniforms.groundShadowProjection=this.projection;shader.uniforms.shadowEye=this.eye;
   shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
    uniform vec2 groundShadowProjection;uniform vec3 shadowEye;
    attribute vec3 shadowTangent;attribute float shadowSide;attribute float shadowWidth;attribute float shadowOpacity;
    varying float vShadowSide;varying float vShadowOpacity;varying float vShadowFade;`)
    .replace('#include <begin_vertex>',`#include <begin_vertex>
     vec3 world=(modelMatrix*vec4(position,1.)).xyz;
     vec3 tangent=mat3(modelMatrix)*shadowTangent;
     vec2 along=tangent.xz+groundShadowProjection*tangent.y;
     along=length(along)>.00001?normalize(along):vec2(0.,1.);
     world.xz+=groundShadowProjection*world.y+vec2(-along.y,along.x)*shadowSide*shadowWidth;world.y=.019;
     vShadowSide=shadowSide;vShadowOpacity=shadowOpacity;vShadowFade=1.-smoothstep(160.,230.,distance(world.xz,shadowEye.xz));`)
    .replace('#include <project_vertex>','vec4 mvPosition=viewMatrix*vec4(world,1.);gl_Position=projectionMatrix*mvPosition;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vShadowSide;varying float vShadowOpacity;varying float vShadowFade;')
    .replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a*=(1.-smoothstep(.7,1.,abs(vShadowSide)))*vShadowOpacity*vShadowFade;if(diffuseColor.a<.003)discard;');
  };
  const cells=new Map<string,Ribbon[]>();
  for(const ribbon of prepareTrackRibbons(track)){const key=`${Math.floor((ribbon.a.x+ribbon.b.x)/128)},${Math.floor((ribbon.a.z+ribbon.b.z)/128)}`,cell=cells.get(key)??[];cell.push(ribbon);cells.set(key,cell);}
  for(const ribbons of cells.values()){const mesh=new T.Mesh(ribbonGeometry(ribbons),this.rails);mesh.name='Continuous railway shadow cell';mesh.renderOrder=1;mesh.matrixAutoUpdate=false;this.group.add(mesh);}

  // Bake the real cart from above, anchored on its wheel/rail plane. Its full
  // bank/loop transform and the railway use the exact same affine projection.
  const profile=bakeShadowProfile(shadowParts(sources[0]),0,0),pixels=new Uint8Array(SHADOW_MASK_SIZE*SHADOW_MASK_SIZE*4);
  for(let i=0;i<profile.masks[0].length;i++)pixels[i*4+3]=profile.masks[0][i];
  const map=new T.DataTexture(pixels,SHADOW_MASK_SIZE,SHADOW_MASK_SIZE);map.generateMipmaps=true;map.minFilter=T.LinearMipmapLinearFilter;map.magFilter=T.LinearFilter;map.needsUpdate=true;
  const geometry=new T.PlaneGeometry(profile.radius*2,profile.radius*2).rotateX(-Math.PI/2);geometry.translate(profile.center.x,0,profile.center.z);
  const uv=geometry.attributes.uv;for(let i=0;i<uv.count;i++)uv.setY(i,1-uv.getY(i));
  this.cartMaterial=new T.MeshBasicMaterial({color:'black',map,transparent:true,opacity:GROUND_SHADOW_OPACITY,depthWrite:false,side:T.DoubleSide,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  this.cartMaterial.name='Cart silhouettes attached to projected rails';this.cartMaterial.customProgramCacheKey=()=> 'prepared-track-cart-v1';
  this.cartMaterial.onBeforeCompile=shader=>{
   shader.uniforms.groundShadowProjection=this.projection;shader.uniforms.shadowEye=this.eye;
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform vec2 groundShadowProjection;uniform vec3 shadowEye;varying float vCartShadowFade;')
    .replace('#include <begin_vertex>',`#include <begin_vertex>
     vec3 world=(modelMatrix*instanceMatrix*vec4(position,1.)).xyz;
     world.xz+=groundShadowProjection*world.y;world.y=.021;
     vCartShadowFade=1.-smoothstep(160.,230.,distance(world.xz,shadowEye.xz));`)
    .replace('#include <project_vertex>','vec4 mvPosition=viewMatrix*vec4(world,1.);gl_Position=projectionMatrix*mvPosition;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vCartShadowFade;').replace('#include <map_fragment>','#include <map_fragment>\ndiffuseColor.a*=vCartShadowFade;if(diffuseColor.a<.003)discard;');
  };
  this.carts=new T.InstancedMesh(geometry,this.cartMaterial,sources.length);this.carts.name='Cart shadows on railway';this.carts.instanceMatrix.setUsage(T.DynamicDrawUsage);this.carts.frustumCulled=false;this.carts.renderOrder=2;this.group.add(this.carts);
 }
 update(time:Daylight,camera:T.Vector3){
  groundShadowProjection(time,this.projection.value);this.eye.value.copy(camera);
  this.rails.opacity=this.cartMaterial.opacity=groundShadowOpacity(time);
  this.sources.forEach((source,i)=>{source.updateWorldMatrix(true,false);this.matrix.copy(source.matrixWorld);this.carts.setMatrixAt(i,source.visible?this.matrix:this.hidden);});this.carts.instanceMatrix.needsUpdate=true;
 }
}
