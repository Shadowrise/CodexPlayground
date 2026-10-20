import {Color,Mesh,MeshStandardMaterial,type Material,type Object3D} from 'three';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';

type Paint='native'|'body'|'feathers'|'beak';
const pink=new Color('#f5a6b7');

/** Reuse the authored paint and rig; each actor owns only its materials. */
export function clonePigeon(template:Object3D,snowball=false){
 const model=cloneSkeleton(template),materials=new Map<Material,Map<Paint,Material>>();
 model.userData.character='pigeon';
 model.traverse(node=>{
  if(!(node instanceof Mesh))return;
  const name=node.name.replaceAll('_',' ');
  const paint:Paint=!snowball?'native':name==='Continuous pigeon body'?'body':/^(Beak|Lower beak) sculpt paint$/.test(name)?'beak':/wing vane|^Tail |^Forehead tuft |eyelid/.test(name)?'feathers':'native';
  const own=(source:Material)=>{
   let variants=materials.get(source);if(!variants){variants=new Map();materials.set(source,variants);}
   let material=variants.get(paint);
   if(!material){
    material=source.clone();variants.set(paint,material);
    if(paint!=='native'&&material instanceof MeshStandardMaterial){
     material.userData.snowballPaint=paint;
     material.customProgramCacheKey=()=>`snowball-${paint}-v1`;
     material.onBeforeCompile=shader=>{
      if(paint==='body'){
       shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying float snowballHeight;').replace('#include <begin_vertex>','#include <begin_vertex>\nsnowballHeight=position.y;');
       shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float snowballHeight;');
      }
      const neck=paint==='body'?'smoothstep(1.45,1.68,snowballHeight)*(1.0-smoothstep(2.16,2.36,snowballHeight))':'0.0';
      const recolor=paint==='beak'
       ?`diffuseColor.rgb=mix(diffuseColor.rgb,vec3(${pink.toArray().join(',')})*(0.85+0.15*snowballInk),step(0.08,snowballInk));`
       :`float snowballNeck=${neck};\ndiffuseColor.rgb=mix(vec3(0.82+0.17*sqrt(snowballInk)),diffuseColor.rgb,snowballNeck);`;
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>\nfloat snowballInk=clamp(dot(diffuseColor.rgb,vec3(0.2126,0.7152,0.0722)),0.0,1.0);\n${recolor}`);
      // Keep the green/plum collar and give those feathers their satin sheen.
      if(paint==='body')shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,0.38,snowballNeck);');
     };
    }
   }
   return material;
  };
  node.material=Array.isArray(node.material)?node.material.map(own):own(node.material);
  node.castShadow=node.receiveShadow=true;
 });
 return model;
}
