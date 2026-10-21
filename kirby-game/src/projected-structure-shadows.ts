import * as T from 'three';
import type {Daylight} from './day-cycle';
import {groundShadowProjection} from './prepared-shadows';
import {GROUND_SHADOW_OPACITY,groundShadowOpacity} from './ground-shadow-style';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const GROUND_Y=.022;
let archGeometry:T.BufferGeometry|undefined;

/** Continuous masonry envelope of makeRuins(): keep both piers, the open
 * archway and companion columns, without tessellated bevels or mortar cracks. */
export function connectedArchShadowGeometry(){
 if(archGeometry)return archGeometry;
 const parts:T.BufferGeometry[]=[],box=(w:number,h:number,d:number,x:number,y:number,z:number)=>parts.push(new T.BoxGeometry(w,h,d).translate(x,y,z));
 for(const x of [-3,3]){box(1.4,4.4,1.68,x,2.2,0);box(1.94,.5,2.04,x,.25,0);box(1.68,.35,1.85,x,4.25,0);}
 const arch=new T.Shape();arch.moveTo(2.36,4.3);arch.lineTo(3.65,4.3);arch.absarc(0,4.3,3.65,0,Math.PI,false);arch.lineTo(-2.36,4.3);arch.absarc(0,4.3,2.36,Math.PI,0,true);arch.closePath();
 parts.push(new T.ExtrudeGeometry(arch,{depth:1.5,curveSegments:16,bevelEnabled:false,steps:1}).translate(0,0,-.75));
 for(const x of [-6,6]){box(2,.5,2,x,.25,3);parts.push(new T.CylinderGeometry(.56,.56,2.35,12).translate(x,1.55,3));box(1.64,.35,1.64,x,2.85,3);}
 // Use one triangle layout; only positions survive in the saved proxy.
 const triangles=parts.map(g=>{const p=g.index?g.toNonIndexed():g;for(const name of Object.keys(p.attributes))if(name!=='position')p.deleteAttribute(name);return p;});
 archGeometry=mergeGeometries(triangles)!;for(const p of new Set([...parts,...triangles]))p.dispose();archGeometry.computeBoundingBox();return archGeometry;
}

/** A prepared rigid silhouette for structures with narrow connected spans.
 * Project the saved vertices directly: interpolating separate bitmap outlines
 * can cut an arch's far pier away from its crown. No shadow-map pass is used. */
export class ProjectedStructureShadows{
 readonly group=new T.Group();
 readonly material:T.MeshBasicMaterial;
 private projection={value:new T.Vector2()};
 private eye={value:new T.Vector3()};
 private pending=new Map<T.BufferGeometry,T.Matrix4[]>();
 constructor(private opacityScale=1,name='Prepared connected structure shadows'){
  this.group.name=name;this.group.userData.preparedShadow=true;
  // GroundShadowPass resolves the maximum coverage of every face. These
  // silhouettes never write depth or compete with one another's faces.
  this.material=new T.MeshBasicMaterial({color:'black',transparent:true,opacity:GROUND_SHADOW_OPACITY*opacityScale,depthWrite:false,depthFunc:T.LessEqualDepth,side:T.DoubleSide,forceSinglePass:true,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  this.material.name='Connected structural silhouette';
  this.material.customProgramCacheKey=()=> 'prepared-connected-structures-v2';
  this.material.onBeforeCompile=shader=>{
   Object.assign(shader.uniforms,{structureProjection:this.projection,structureEye:this.eye});
   shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
    uniform vec2 structureProjection;uniform vec3 structureEye;varying float vStructureFade;`)
    .replace('#include <begin_vertex>',`#include <begin_vertex>
     vec3 world=(modelMatrix*instanceMatrix*vec4(position,1.)).xyz;
     world.xz+=structureProjection*world.y;world.y=${GROUND_Y};
     vStructureFade=1.-smoothstep(145.,205.,distance(world.xz,structureEye.xz));`)
    .replace('#include <project_vertex>','vec4 mvPosition=viewMatrix*vec4(world,1.);gl_Position=projectionMatrix*mvPosition;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
    varying float vStructureFade;`)
    .replace('#include <color_fragment>',`#include <color_fragment>
     diffuseColor.a*=vStructureFade;if(diffuseColor.a<.003)discard;`);
  };
 }
 add(geometry:T.BufferGeometry,matrix:T.Matrix4){const list=this.pending.get(geometry)??[];list.push(matrix.clone());this.pending.set(geometry,list);}
 commit(){
  for(const [source,matrices] of this.pending){
   // Reuse the saved position/index buffers; normals, UVs and textures are not
   // needed by the black silhouette and no per-frame geometry is generated.
   const geometry=new T.BufferGeometry();geometry.setAttribute('position',source.attributes.position);geometry.setIndex(source.index);geometry.setDrawRange(source.drawRange.start,source.drawRange.count);
   const mesh=new T.InstancedMesh(geometry,this.material,matrices.length),bounds=new T.Box3();mesh.name='Prepared connected arch shadows';mesh.renderOrder=3;mesh.matrixAutoUpdate=false;
   if(!source.boundingBox)source.computeBoundingBox();
   matrices.forEach((matrix,i)=>{
    mesh.setMatrixAt(i,matrix);const box=source.boundingBox!.clone().applyMatrix4(matrix),radius=Math.max(Math.abs(box.min.y),Math.abs(box.max.y))*2.1;
    bounds.expandByPoint(new T.Vector3(box.min.x-radius,GROUND_Y,box.min.z-radius));bounds.expandByPoint(new T.Vector3(box.max.x+radius,GROUND_Y,box.max.z+radius));
   });
   mesh.boundingBox=bounds;mesh.boundingSphere=bounds.getBoundingSphere(new T.Sphere());
   this.group.add(mesh);
  }
  this.pending.clear();
 }
 update(time:Daylight,camera:T.Vector3){groundShadowProjection(time,this.projection.value);this.eye.value.copy(camera);this.material.opacity=groundShadowOpacity(time)*this.opacityScale;}
}
