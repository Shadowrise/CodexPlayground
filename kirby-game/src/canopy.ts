import * as T from 'three';

/** A whole crown made of folded pointed leaves, never intersecting foliage spheres. */
export function createCanopyGeometry(kind:'broadleaf'|'birch'|'oak'='broadleaf',variation=0){
 const count=kind==='oak'?2600:kind==='birch'?820:1050;
 const positions:number[]=[],normals:number[]=[],uvs:number[]=[],colors:number[]=[];
 let seed=(kind==='birch'?172:kind==='oak'?919:431)+variation*7919;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const up=new T.Vector3(),side=new T.Vector3(),normal=new T.Vector3(),center=new T.Vector3();
 const points=[[-1,0,0],[0,.15,-.46],[1,0,0],[0,.15,.46],[0,.26,0]];
 for(let i=0;i<count;i++){
  const az=i*2.399963,ny=1-2*(i+.5)/count,ring=Math.sqrt(1-ny*ny);
  const radius=.48+.52*Math.pow(random(),.3);
  const lobe=1+.10*Math.sin(az*3+ny*4)+.065*Math.cos(az*5-ny*3);
  center.set(Math.cos(az)*ring*radius*lobe,ny*radius,Math.sin(az)*ring*radius*lobe);
  // Soft asymmetric shoulders and a tapered top, not a perfect ellipsoid.
  center.x+=.12*center.y*center.y;center.z+=.09*Math.sin(center.y*4);
  if(kind==='birch'){
   // Different shoulders, gaps and gently drooping sides for each shared silhouette.
   const phase=variation*1.73,spread=1+.12*Math.sin(az*(3+variation%2)+phase)*(1-ny*ny);
   center.x*=.87*spread;center.z*=.87*spread;
   center.x+=.10*Math.sin(ny*3+phase)*(1-Math.abs(ny));
   center.y-=Math.pow(ring,3)*(.08+.05*variation)*(1+.4*Math.sin(az*3+phase));
  }
  normal.copy(center).normalize().lerp(new T.Vector3(0,1,0),.45).normalize();
  side.set(Math.sin(az),.3*(random()-.5),Math.cos(az)).cross(normal).normalize();
  up.crossVectors(normal,side).normalize();
  const angle=random()*Math.PI*2;side.multiplyScalar(Math.cos(angle)).addScaledVector(up,Math.sin(angle));up.copy(normal).cross(side).normalize();
  const size=(kind==='oak'?.038:.065)+random()*(kind==='oak'?.044:.065);
  const shade=.64+random()*.28+.12*Math.max(0,ny);
  const vertices=points.map(([x,y,z])=>center.clone().addScaledVector(side,x*size).addScaledVector(up,z*size).addScaledVector(normal,y*size));
  for(const [a,b,c] of [[0,1,4],[1,2,4],[2,3,4],[3,0,4]]){
   const n=new T.Vector3().subVectors(vertices[b],vertices[a]).cross(new T.Vector3().subVectors(vertices[c],vertices[a])).normalize();
   for(const index of [a,b,c]){positions.push(...vertices[index].toArray());normals.push(...n.toArray());uvs.push((points[index][0]+1)/2,(points[index][2]/.46+1)/2);const v=shade*(index===4?1.06:1);colors.push(v,v,v);}
  }
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.computeBoundingSphere();return geometry;
}

/** Subtle veins for a single leaf, shared across entire crowns. */
export function createLeafSurface(){
 const size=64,data=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/(size-1),v=y/(size-1)-.5;
  const rib=Math.exp(-Math.abs(v)*95),vein=Math.pow(Math.max(0,Math.cos((u-Math.abs(v)*.6)*Math.PI*14)),22);
  const value=Math.min(255,210+18*(1-Math.abs(v)*2)+20*rib+9*vein);
  const i=(y*size+x)*4;data[i]=data[i+1]=data[i+2]=value;data[i+3]=255;
 }
 const texture=new T.DataTexture(data,size,size);texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;return texture;
}

/** A continuous crown silhouette prevents sub-texel leaves from sparkling in shadow maps. */
export function createCanopyShadowGeometry(){
 const geometry=new T.IcosahedronGeometry(.94,2),position=geometry.getAttribute('position');
 for(let i=0;i<position.count;i++){const x=position.getX(i),y=position.getY(i),z=position.getZ(i),a=Math.atan2(z,x),lobe=1+.07*Math.sin(a*3+y*4)+.04*Math.cos(a*5-y*3);position.setXYZ(i,x*lobe+.1*y*y,y,z*lobe+.07*Math.sin(y*4));}
 geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
}
