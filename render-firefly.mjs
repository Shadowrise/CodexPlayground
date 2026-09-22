import * as T from './kirby-game/node_modules/three/build/three.module.js';
import { GLTFLoader } from './kirby-game/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { readFileSync,writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
const bytes=readFileSync(new URL('./firefly-animated.glb',import.meta.url));
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const W=1100,H=650,pixels=Buffer.alloc(W*H*4),depth=new Float32Array(W*H).fill(-Infinity);
for(let i=0;i<W*H;i++){pixels[i*4]=18;pixels[i*4+1]=30;pixels[i*4+2]=41;pixels[i*4+3]=255;}
const az=.85,el=.27,ca=Math.cos(az),sa=Math.sin(az),ce=Math.cos(el),se=Math.sin(el);
const rotate=v=>new T.Vector3(ca*v.x-sa*v.z,ce*v.y-se*(sa*v.x+ca*v.z),se*v.y+ce*(sa*v.x+ca*v.z));
const mixer=new T.AnimationMixer(gltf.scene),light=new T.Vector3(-.4,.8,1).normalize();
for(const [panel,mode] of ['Sit','Fly'].entries()){
 mixer.stopAllAction();mixer.clipAction(gltf.animations.find(c=>c.name===mode)).reset().play();mixer.setTime(mode==='Sit'?.5:.18);gltf.scene.updateMatrixWorld(true);
 const project=v=>{const p=rotate(v.clone().sub(new T.Vector3(0,.85,0)));return [275+550*panel+p.x*165,340-p.y*165,p.z];};
 const glow=gltf.scene.getObjectByName('Glow_Abdomen'),halo=project(glow.getWorldPosition(new T.Vector3()));
 for(let y=0;y<H;y++)for(let x=panel*550;x<(panel+1)*550;x++){const a=Math.exp(-((x-halo[0])**2+(y-halo[1])**2)/5300)*.32,i=(y*W+x)*4;pixels[i]=pixels[i]*(1-a)+160*a;pixels[i+1]=pixels[i+1]*(1-a)+225*a;pixels[i+2]=pixels[i+2]*(1-a)+65*a;}
 const meshes=[];gltf.scene.traverse(o=>{if(o.isMesh)meshes.push(o);});meshes.sort((a,b)=>Number(a.material.transparent)-Number(b.material.transparent));
 for(const mesh of meshes){
  const geo=mesh.geometry,mat=mesh.material,positions=geo.attributes.position,normals=geo.attributes.normal,normalMatrix=new T.Matrix3().getNormalMatrix(mesh.matrixWorld),verts=[],ns=[];
  for(let i=0;i<positions.count;i++){verts.push(project(new T.Vector3().fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld)));ns.push(new T.Vector3().fromBufferAttribute(normals,i).applyMatrix3(normalMatrix).normalize());}
  const count=geo.index?.count??positions.count;
  for(let i=0;i<count;i+=3){const ids=[0,1,2].map(j=>geo.index?geo.index.getX(i+j):i+j),[a,b,c]=ids.map(j=>verts[j]),area=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);if(Math.abs(area)<1e-8 || (area>0&&mat.side!==T.DoubleSide))continue;
   const xmin=Math.max(panel*550,Math.floor(Math.min(a[0],b[0],c[0]))),xmax=Math.min((panel+1)*550-1,Math.ceil(Math.max(a[0],b[0],c[0]))),ymin=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1]))),ymax=Math.min(H-1,Math.ceil(Math.max(a[1],b[1],c[1])));
   for(let y=ymin;y<=ymax;y++)for(let x=xmin;x<=xmax;x++){const u=((b[0]-x)*(c[1]-y)-(b[1]-y)*(c[0]-x))/area,v=((c[0]-x)*(a[1]-y)-(c[1]-y)*(a[0]-x))/area,w=1-u-v;if(u<0||v<0||w<0)continue;const z=u*a[2]+v*b[2]+w*c[2],p=y*W+x;if(z<depth[p])continue;
    const n=ns[ids[0]].clone().multiplyScalar(u).addScaledVector(ns[ids[1]],v).addScaledVector(ns[ids[2]],w).normalize(),shade=.35+.65*Math.max(0,n.dot(light)),base=mat.color.toArray(),emission=mat.emissive?.toArray()??[0,0,0],alpha=mat.opacity;
    for(let k=0;k<3;k++){const value=base[k]*shade+emission[k]*(mat.emissiveIntensity??1);const color=255*Math.pow(value/(1+value),1/2.2);pixels[p*4+k]=Math.round(pixels[p*4+k]*(1-alpha)+color*alpha);}if(alpha>.99)depth[p]=z;
   }
  }
 }
}
const table=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function chunk(type,data){const body=Buffer.concat([Buffer.from(type),data]);let crc=0xffffffff;for(const v of body)crc=table[(crc^v)&255]^(crc>>>8);const size=Buffer.alloc(4),tail=Buffer.alloc(4);size.writeUInt32BE(data.length);tail.writeUInt32BE((crc^0xffffffff)>>>0);return Buffer.concat([size,body,tail]);}
const header=Buffer.alloc(13);header.writeUInt32BE(W);header.writeUInt32BE(H,4);header[8]=8;header[9]=6;const scan=Buffer.alloc((W*4+1)*H);for(let y=0;y<H;y++)pixels.copy(scan,y*(W*4+1)+1,y*W*4,(y+1)*W*4);
writeFileSync(new URL('./firefly-preview.png',import.meta.url),Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(scan)),chunk('IEND',Buffer.alloc(0))]));
