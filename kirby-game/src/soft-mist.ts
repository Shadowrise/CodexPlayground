import {IcosahedronGeometry,Mesh,MeshBasicMaterial} from 'three';
import type {ColorRepresentation} from 'three';

// A shared, small proxy encloses a soft ellipsoid. The shader integrates its
// thickness analytically: no ray marching, depth texture or extra render pass.
const geometry=new IcosahedronGeometry(1,2);
export function softMistMaterial(color:ColorRepresentation,opacity:number){
 const material=new MeshBasicMaterial({color,opacity,transparent:true,depthWrite:false,depthTest:true,toneMapped:false});
 material.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
varying vec3 mistPoint;
varying vec3 mistCamera;
`).replace('#include <begin_vertex>',`#include <begin_vertex>
mistPoint=position;
vec3 mistDelta=cameraPosition-modelMatrix[3].xyz;
mistCamera=vec3(
 dot(mistDelta,modelMatrix[0].xyz)/dot(modelMatrix[0].xyz,modelMatrix[0].xyz),
 dot(mistDelta,modelMatrix[1].xyz)/dot(modelMatrix[1].xyz,modelMatrix[1].xyz),
 dot(mistDelta,modelMatrix[2].xyz)/dot(modelMatrix[2].xyz,modelMatrix[2].xyz));
`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
varying vec3 mistPoint;
varying vec3 mistCamera;
`).replace('#include <color_fragment>',`#include <color_fragment>
vec3 mistRay=normalize(mistPoint-mistCamera);
float mistB=dot(mistCamera,mistRay);
float mistChord=sqrt(max(0.0,mistB*mistB-dot(mistCamera,mistCamera)+1.0));
float mistNear=max(0.0,-mistB-mistChord);
float mistLength=max(0.0,-mistB+mistChord-mistNear);
vec3 mistMiddle=mistCamera+mistRay*(mistNear+mistLength*0.5);
float mistClouds=0.86+0.09*sin(mistMiddle.x*6.0+mistMiddle.y*4.0)*sin(mistMiddle.z*6.0-mistMiddle.y*3.0)
 +0.05*cos(mistMiddle.y*7.0+mistMiddle.z*2.0);
float mistDensity=clamp(mistLength*0.5,0.0,1.0);
diffuseColor.a*=mistDensity*mistDensity*mistClouds;
`);
 };
 material.customProgramCacheKey=()=> 'soft-volume-mist-v1';
 return material;
}

export function softMist(material:MeshBasicMaterial){
 const mist=new Mesh(geometry,material);
 mist.name='Fruit colored mist';
 // Render only the camera-facing shell, keeping ordinary scene occlusion.
 mist.castShadow=mist.receiveShadow=false;
 return mist;
}
