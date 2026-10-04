import * as T from 'three';
import {WATER_Y} from './pond-layout';

// One shared draw per boat: soft foam patches that expand and dissolve on the water.
// Animation stays on the GPU; no particle objects, textures or per-frame allocations.
const time={value:0};
const positions:number[]=[],uvs:number[]=[],seeds:number[]=[],indices:number[]=[];
for(let i=0;i<18;i++){
 const phase=i/18,side=Math.sin(i*2.39996),size=.13+(i%5)*.025;
 for(const [x,z,u,v] of [[-1,-1,0,0],[1,-1,1,0],[1,1,1,1],[-1,1,0,1]]){
  positions.push(x,0,z);uvs.push(u,v);seeds.push(phase,side,size);
 }
 const n=i*4;indices.push(n,n+2,n+1,n,n+3,n+2);
}
const geometry=new T.BufferGeometry();
geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));
geometry.setAttribute('wakeSeed',new T.Float32BufferAttribute(seeds,3));
geometry.setIndex(indices);geometry.computeVertexNormals();
geometry.boundingSphere=new T.Sphere(new T.Vector3(0,0,-3),3.5);
const material=new T.MeshLambertMaterial({color:'#c5e4df',transparent:true,opacity:.42,depthWrite:false,side:T.DoubleSide});
material.onBeforeCompile=shader=>{
 shader.uniforms.wakeTime=time;
 shader.vertexShader='uniform float wakeTime; attribute vec3 wakeSeed; varying vec2 foamUv; varying float foamAlpha;\n'+shader.vertexShader;
 shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`
  float age=fract(wakeTime*.62+wakeSeed.x);
  float radius=wakeSeed.z*(.65+age*2.3);
  vec3 transformed=position*radius;
  transformed.x+=wakeSeed.y*(.32+age*.65)+sin(age*7.+wakeSeed.x*24.)*.07;
  transformed.z+=-1.85-age*2.65;
  foamUv=uv*2.-1.;
  foamAlpha=smoothstep(0.,.16,age)*(1.-smoothstep(.35,1.,age));
 `);
 // The boat rocks; the foam must stay flat at the river surface instead of rocking with it.
 shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`
  vec4 foamWorld=modelMatrix*vec4(transformed,1.);
  foamWorld.y=${(WATER_Y+.028).toFixed(4)};
  vec4 mvPosition=viewMatrix*foamWorld;
  gl_Position=projectionMatrix*mvPosition;
 `);
 shader.fragmentShader='varying vec2 foamUv; varying float foamAlpha;\n'+shader.fragmentShader;
 shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`
  #include <color_fragment>
  float r=length(foamUv);
  float rim=smoothstep(.38,.62,r)*(1.-smoothstep(.65,.98,r));
  float softCenter=(1.-smoothstep(0.,.85,r))*.25;
  diffuseColor.a*=foamAlpha*(rim*.7+softCenter);
 `);
};
material.customProgramCacheKey=()=> 'boat-soft-foam-v1';

export function makeBoatWake(){
 const wake=new T.Mesh(geometry,material);wake.name='Boat foam';return wake;
}
export function updateBoatWake(seconds:number){time.value=seconds;}
