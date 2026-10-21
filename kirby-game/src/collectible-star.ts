import * as T from 'three';
import {softMist,softMistMaterial} from './soft-mist';

const surfaces=new Map<string,{body:T.MeshStandardMaterial;glow:T.MeshBasicMaterial}>();
let geometry:T.BufferGeometry|undefined;
let grain:T.DataTexture|undefined;

/** Two shared draws: one continuous smooth sculpt and the firefly's volume glow. */
export function makeCollectibleStar(color:T.ColorRepresentation='#ffd35a',size=1,halo:{color?:T.ColorRepresentation;opacity?:number}={}){
 geometry??=sculptStar();
 const tint=new T.Color(color),glowTint=new T.Color(halo.color??color),opacity=halo.opacity??.2;
 const key=tint.getHexString()+':'+glowTint.getHexString()+':'+opacity;let finish=surfaces.get(key);
 if(!finish){
  const body=new T.MeshStandardMaterial({color:tint,emissive:tint,emissiveIntensity:.16,
   metalness:.32,roughness:.46,roughnessMap:goldGrain(),vertexColors:true,envMapIntensity:.45});
  body.name='Satin collectible star';
  const glow=softMistMaterial(glowTint,opacity);glow.blending=T.AdditiveBlending;glow.fog=false;
  finish={body,glow};surfaces.set(key,finish);
 }
 const root=new T.Group();root.name='Detailed collectible star';root.userData.collectibleStar=true;root.scale.setScalar(size);
 const body=new T.Mesh(geometry,finish.body);body.name='Smooth sculpted star';
 const glow=softMist(finish.glow);glow.name='Collectible star volume glow';glow.scale.set(1.9,1.9,1.55);
 root.add(body,glow);return root;
}

function starOutline(){
 const corners=Array.from({length:10},(_,i)=>{const a=Math.PI/2+i*Math.PI/5,r=i%2?.455:1;return new T.Vector2(Math.cos(a)*r,Math.sin(a)*r);});
 const shape=new T.Shape();
 corners.forEach((point,i)=>{
  const cut=i%2?.055:.13,enter=point.clone().lerp(corners[(i+9)%10],cut),exit=point.clone().lerp(corners[(i+1)%10],cut);
  if(i===0)shape.moveTo(enter.x,enter.y);else shape.lineTo(enter.x,enter.y);
  shape.quadraticCurveTo(point.x,point.y,exit.x,exit.y);
 });shape.closePath();return shape;
}

/** Radial rings make a real curved front and back, rather than a flat extruded cap. */
function sculptStar(){
 const outline=starOutline().getSpacedPoints(100).slice(0,-1),n=outline.length;
 const profile=Array.from({length:13},(_,i)=>{const angle=(i+1)*Math.PI/14;return [Math.sin(angle),.37*Math.cos(angle)];});
 const positions:number[]=[],uvs:number[]=[],colors:number[]=[],indices:number[]=[];
 const vertex=(x:number,y:number,z:number)=>{
  positions.push(x,y,z);uvs.push(x*.5+.5,y*.5+.5);
  const edge=.63+.37*Math.pow(Math.min(1,Math.abs(z)/.37),.3),value=edge*(.91+y*.07);
  colors.push(value,value*(.96+.04*edge),value*(.87+.13*edge));
 };
 for(const [radius,z] of profile)for(const p of outline){
  // Circular inner rings avoid pinched ridges where all five arms meet the dome.
  const length=p.length(),blend=T.MathUtils.smoothstep(radius,.15,.85),r=radius*T.MathUtils.lerp(.7,length,blend)/length;
  vertex(p.x*r,p.y*r,z);
 }
 for(let ring=0;ring<profile.length-1;ring++)for(let i=0;i<n;i++){
  const a=ring*n+i,b=ring*n+(i+1)%n,c=a+n,d=b+n;indices.push(a,c,d,a,d,b);
 }
 const front=positions.length/3;vertex(0,0,.37);const back=positions.length/3;vertex(0,0,-.37);
 for(let i=0;i<n;i++){indices.push(front,i,(i+1)%n);const a=(profile.length-1)*n+i,b=(profile.length-1)*n+(i+1)%n;indices.push(a,back,b);}
 const body=new T.BufferGeometry();body.setAttribute('position',new T.Float32BufferAttribute(positions,3));body.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));
 body.setAttribute('color',new T.Float32BufferAttribute(colors,3));body.setIndex(indices);body.computeVertexNormals();body.computeBoundingSphere();
 return body;
}

/** One tiny mipmapped roughness map gives the gold a fine satin finish without shimmer. */
function goldGrain(){
 if(grain)return grain;
 const size=128,pixels=new Uint8Array(size*size*4);let seed=7523;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;const value=Math.round(200+Math.sin(y*Math.PI/4)*5+(seed/4294967296-.5)*13),i=(y*size+x)*4;
  pixels[i]=pixels[i+1]=pixels[i+2]=value;pixels[i+3]=255;
 }
 grain=new T.DataTexture(pixels,size,size);grain.name='Fine satin gold roughness';grain.wrapS=grain.wrapT=T.RepeatWrapping;
 grain.magFilter=T.LinearFilter;grain.minFilter=T.LinearMipmapLinearFilter;grain.generateMipmaps=true;grain.needsUpdate=true;return grain;
}
