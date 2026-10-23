import * as T from 'three';
import {clusteredGeometry} from './geometry-detail';

type Source={object:T.Object3D;color:T.Color};
type Part={sources:T.Mesh[];levels:T.InstancedMesh[]};
export const FIREFLY_FULL_DETAIL_DISTANCE=28;
export const FIREFLY_COARSE_DISTANCE=80;

/** Nearby and ridden fireflies keep the native model. Other bugs share one draw
 * per animated part and distance level. All matrices come from the live rig. */
export class FireflyInstances{
 readonly group=new T.Group();
 enabled=true;
 private parts:Part[]=[];
 private matrix=new T.Matrix4();
 private inverse=new T.Matrix4();
 private position=new T.Vector3();
 private frustum=new T.Frustum();
 private projection=new T.Matrix4();
 private sphere=new T.Sphere();
 constructor(private sources:Source[]){
  this.group.name='Instanced distant fireflies';
  const meshes=sources.map(source=>{const result:T.Mesh[]=[];source.object.traverse(o=>{if(o instanceof T.Mesh)result.push(o);});return result;});
  for(let p=0;p<meshes[0].length;p++){
   const source=meshes[0][p];
   if(source instanceof T.SkinnedMesh||source.morphTargetInfluences||Array.isArray(source.material))throw Error('Firefly instances require rigid single-material parts');
   let material=source.material;
   if(material instanceof T.MeshStandardMaterial&&material.name==='Firefly_Glow'){
    material=material.clone();(material as T.MeshStandardMaterial).color.set('white');(material as T.MeshStandardMaterial).emissive.set('white');
    const compile=material.onBeforeCompile;
    material.onBeforeCompile=function(shader,renderer){
     compile.call(this,shader,renderer);
     // Three exposes instance colour as USE_COLOR in the fragment shader.
     shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n#ifdef USE_COLOR\n totalEmissiveRadiance *= vColor.rgb;\n#endif');
    };
    material.customProgramCacheKey=()=> 'instanced-firefly-glow-v2';
   }
   const levels=[source.geometry,clusteredGeometry(source.geometry,14)].map(geometry=>{
    const mesh=new T.InstancedMesh(geometry,material,sources.length);mesh.name=source.name+' · firefly instances';mesh.count=0;
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.receiveShadow=source.receiveShadow;mesh.castShadow=false;
    mesh.boundingSphere=new T.Sphere();mesh.setColorAt(0,WHITE);this.group.add(mesh);return mesh;
   });
   this.parts.push({sources:meshes.map(list=>list[p]),levels});
  }
 }
 /** Called after riders/network have finished moving the source poses. */
 update(camera:T.Vector3,visible:(index:number)=>boolean,exact:(index:number)=>boolean,view?:T.Camera){
  this.group.visible=this.enabled;
  const levels:number[]=[],counts=[0,0];
  if(view){this.projection.multiplyMatrices(view.projectionMatrix,view.matrixWorldInverse);this.frustum.setFromProjectionMatrix(this.projection);}
  this.group.updateWorldMatrix(true,false);this.inverse.copy(this.group.matrixWorld).invert();
  for(let i=0;i<this.sources.length;i++){
   const source=this.sources[i];source.object.getWorldPosition(this.position);
   const distance=this.position.distanceTo(camera),full=!this.enabled||exact(i)||distance<FIREFLY_FULL_DETAIL_DISTANCE;
   source.object.visible=visible(i)&&full;
   this.sphere.set(this.position,3*source.object.matrixWorld.getMaxScaleOnAxis());
   const level=visible(i)&&!full&&(!view||this.frustum.intersectsSphere(this.sphere))?(distance<FIREFLY_COARSE_DISTANCE?0:1):-1;levels.push(level);
   if(level>=0){counts[level]++;source.object.updateWorldMatrix(true,true);}
  }
  for(const part of this.parts){
   const cursors=[0,0];
   for(let i=0;i<this.sources.length;i++){
    const level=levels[i];if(level<0)continue;
    const mesh=part.levels[level],index=cursors[level]++;
    this.matrix.multiplyMatrices(this.inverse,part.sources[i].matrixWorld);mesh.setMatrixAt(index,this.matrix);
    const material=part.sources[i].material;
    mesh.setColorAt(index,material instanceof T.MeshStandardMaterial&&material.name==='Firefly_Glow'?this.sources[i].color:WHITE);
   }
   for(let level=0;level<2;level++){
    const mesh=part.levels[level];mesh.count=counts[level];mesh.visible=counts[level]>0;
    if(mesh.count){mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();}
   }
  }
 }
}
const WHITE=new T.Color('white');
