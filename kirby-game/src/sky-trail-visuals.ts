import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/** Decorative glass needs tint and a rim highlight, not the meadow's physical lighting. */
export function skyGlass(color:string){
 const material=new T.MeshBasicMaterial({color,transparent:true,opacity:.32,depthWrite:false});
 material.onBeforeCompile=shader=>{
  const varyings='varying vec3 skyNormal; varying vec3 skyView; varying float skyTop;\n';
  shader.vertexShader=varyings+shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
   skyNormal=normalize(normalMatrix*normal);skyView=-mvPosition.xyz;skyTop=max(normal.y,0.0);`);
  shader.fragmentShader=varyings+shader.fragmentShader.replace('#include <opaque_fragment>',`
   float rim=pow(1.0-abs(dot(normalize(skyNormal),normalize(skyView))),3.0);
   outgoingLight+=vec3(.22)*rim;
   diffuseColor.a=opacity+rim*.16+skyTop*.18;
   #include <opaque_fragment>`);
 };
 material.customProgramCacheKey=()=> 'sky-glass-rim-v1';
 return material;
}

/** Merge static decorations in height bands, retaining useful frustum culling. */
export function mergeSkyDetails(root:T.Group,objects:(T.Mesh|T.LineSegments)[],lines=false){
 root.updateWorldMatrix(true,true);
 const inverse=root.matrixWorld.clone().invert();
 const bands=new Map<number,T.BufferGeometry[]>();
 for(const object of objects){
  const matrix=new T.Matrix4().multiplyMatrices(inverse,object.matrixWorld),band=Math.floor(new T.Vector3().setFromMatrixPosition(matrix).y/12);
  const geometry=object.geometry.index?object.geometry.toNonIndexed():object.geometry.clone();
  geometry.applyMatrix4(matrix);
  const color=(object.material as T.MeshBasicMaterial).color,values=new Float32Array(geometry.getAttribute('position').count*3);
  for(let i=0;i<values.length;i+=3)color.toArray(values,i);
  geometry.setAttribute('color',new T.BufferAttribute(values,3));
  // All these surfaces glow: normals/UVs are unnecessary for the unlit pass.
  for(const key of Object.keys(geometry.attributes))if(key!=='position'&&key!=='color')geometry.deleteAttribute(key);
  if(!bands.has(band))bands.set(band,[]);bands.get(band)!.push(geometry);
  object.removeFromParent();
 }
 const material=lines?new T.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.9}):new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide});
 for(const parts of bands.values()){
  const geometry=mergeGeometries(parts);parts.forEach(p=>p.dispose());
  const object=lines?new T.LineSegments(geometry,material):new T.Mesh(geometry,material);
  object.name=lines?'Sky Trail batched frames':'Sky Trail batched glow';root.add(object);
 }
}

/** Keep trampoline metal in its own group so interaction outlines still follow it. */
export function mergeSkyMetal(parent:T.Group,objects:T.Mesh[],material:T.Material){
 const parts=objects.map(object=>{object.updateMatrix();const geometry=object.geometry.clone().applyMatrix4(object.matrix);object.removeFromParent();return geometry;});
 const geometry=mergeGeometries(parts);parts.forEach(part=>part.dispose());
 parent.add(new T.Mesh(geometry,material));
}

/** Moving decorations keep their transforms but share instanced draws by shape/height. */
export class SkyMovingDetails{
 private batches:{mesh:T.InstancedMesh;items:{source:T.Mesh;parent:T.Matrix4}[]}[]=[];
 private matrix=new T.Matrix4();
 constructor(root:T.Group,objects:T.Mesh[]){
  root.updateWorldMatrix(true,true);
  const inverse=root.matrixWorld.clone().invert();
  const groups=new Map<string,{source:T.Mesh;parent:T.Matrix4}[]>();
  for(const source of objects){
   const parent=new T.Matrix4().multiplyMatrices(inverse,source.parent!.matrixWorld),position=new T.Vector3().setFromMatrixPosition(new T.Matrix4().multiplyMatrices(inverse,source.matrixWorld));
   const key=source.geometry.uuid+':'+Math.floor(position.y/12);
   if(!groups.has(key))groups.set(key,[]);groups.get(key)!.push({source,parent});
   source.visible=false;
  }
  const material=new T.MeshBasicMaterial();
  for(const items of groups.values()){
   const mesh=new T.InstancedMesh(items[0].source.geometry,material,items.length);
   mesh.name='Sky Trail moving glow';mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
   items.forEach(({source},i)=>mesh.setColorAt(i,(source.material as T.MeshBasicMaterial).color));
   root.add(mesh);this.batches.push({mesh,items});
  }
  this.update();
  for(const {mesh} of this.batches){mesh.computeBoundingSphere();mesh.boundingSphere!.radius+=1;}
 }
 update(){
  for(const {mesh,items} of this.batches){
   items.forEach(({source,parent},i)=>{source.updateMatrix();mesh.setMatrixAt(i,this.matrix.multiplyMatrices(parent,source.matrix));});
   mesh.instanceMatrix.needsUpdate=true;
  }
 }
}
