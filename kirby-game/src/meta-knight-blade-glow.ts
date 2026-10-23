import * as T from 'three';

export const GALAXIA_GLOW_COLOR=0xffb52b;

/** Warm light in the metal and a restrained silhouette aura, without extra lights. */
export class MetaKnightBladeGlow{
 private originals:{mesh:T.Mesh;material:T.Material|T.Material[]}[]=[];
 private materials:T.MeshStandardMaterial[]=[];private halos:T.Mesh[]=[];
 private haloMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.BackSide,blending:T.AdditiveBlending,toneMapped:false,
  uniforms:{strength:{value:1}},
  vertexShader:'varying vec3 glowNormal;varying vec3 glowView;void main(){vec4 p=modelViewMatrix*vec4(position+normal*.045,1.);glowNormal=normalize(normalMatrix*normal);glowView=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',
  fragmentShader:'varying vec3 glowNormal;varying vec3 glowView;uniform float strength;void main(){float rim=pow(1.-abs(dot(normalize(glowNormal),normalize(glowView))),1.8);gl_FragColor=vec4(1.,.56,.09,(.06+.22*rim)*strength);\n#include <colorspace_fragment>\n}'});
 constructor(blade:T.Object3D){
  const meshes:T.Mesh[]=[];blade.traverse(o=>{if(o instanceof T.Mesh)meshes.push(o);});
  const clones=new Map<T.MeshStandardMaterial,T.MeshStandardMaterial>();
  for(const mesh of meshes){
   const original=mesh.material;let changed=false;
   const materials=(Array.isArray(original)?original:[original]).map(source=>{
    if(!(source instanceof T.MeshStandardMaterial)||!source.name.includes('gold'))return source;
    changed=true;let copy=clones.get(source);if(!copy){copy=source.clone();copy.metalness=.55;copy.roughness=.20;copy.emissive.setHex(GALAXIA_GLOW_COLOR);copy.emissiveIntensity=.85;clones.set(source,copy);this.materials.push(copy);}return copy;
   });
   if(!changed)continue;this.originals.push({mesh,material:original});mesh.material=Array.isArray(original)?materials:materials[0];
   const halo=new T.Mesh(mesh.geometry,this.haloMaterial);halo.name='Galaxia warm blade aura';halo.position.copy(mesh.position);halo.quaternion.copy(mesh.quaternion);halo.scale.copy(mesh.scale);halo.renderOrder=3;mesh.parent!.add(halo);this.halos.push(halo);
  }
 }
 update(now:number,charged:boolean,visible=true){
  const pulse=1+.045*Math.sin(now*.006);
  // Arena travel temporarily replaces mesh materials with isolated copies.
  for(const {mesh} of this.originals)for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])if(material instanceof T.MeshStandardMaterial&&material.name.includes('gold'))material.emissiveIntensity=(charged?1.2:.82)*pulse;
  for(const halo of this.halos){halo.visible=visible;(halo.material as T.ShaderMaterial).uniforms.strength.value=(charged?1.2:.8)*pulse;}
 }
 dispose(){for(const {mesh,material} of this.originals)mesh.material=material;for(const halo of this.halos)halo.removeFromParent();this.materials.forEach(m=>m.dispose());this.haloMaterial.dispose();}
}
