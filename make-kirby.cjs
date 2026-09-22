const fs=require('fs'),path=require('path'),zlib=require('zlib');
const parts=[];
const materials=[];
function mat(name,color,roughness,coat=0){materials.push({name,pbrMetallicRoughness:{baseColorFactor:[...color,1],metallicFactor:0,roughnessFactor:roughness},...(coat?{extensions:{KHR_materials_clearcoat:{clearcoatFactor:coat,clearcoatRoughnessFactor:.2}}}:{})});return materials.length-1;}
const pink=mat('Kirby • soft candy pink',[1,.36,.56],.4,.16);
const red=mat('Feet • cherry red',[.72,.014,.065],.3,.3);
const black=mat('Eyes • deep midnight',[.006,.009,.025],.17,.45);
const blue=mat('Iris • sapphire gradient',[1,1,1],.24,.3);
const white=mat('Eye reflections • porcelain white',[1,1,1],.2);
const cheek=mat('Cheeks • rosy blush',[1,1,1],.55);
const mouth=mat('Smile • deep burgundy',[.115,.003,.022],.65);
const tongue=mat('Tongue • strawberry pink',[1,.13,.28],.42);
function ellipsoid(name,c,r,m,rows=64,cols=96,rz=0,ry=0){
 const p=[],n=[],ix=[];const cz=Math.cos(rz),sz=Math.sin(rz),cy=Math.cos(ry),sy=Math.sin(ry);
 function rot(v){const x=v[0]*cz-v[1]*sz,y=v[0]*sz+v[1]*cz;return[x*cy+v[2]*sy,y,-x*sy+v[2]*cy];}
 for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
  const t=Math.PI*j/rows,f=2*Math.PI*i/cols,v=[Math.sin(t)*Math.cos(f),Math.cos(t),Math.sin(t)*Math.sin(f)];
  p.push(...rot(v.map((v,k)=>v*r[k])).map((v,k)=>v+c[k]));
  const normal=rot(v.map((v,k)=>v/r[k])),l=Math.hypot(...normal);n.push(...normal.map(v=>v/l));
 }
 for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=j*(cols+1)+i,b=a+cols+1;if(j)ix.push(a,a+1,b);if(j<rows-1)ix.push(a+1,b+1,b);}
 parts.push({name,p,n,ix,m});
}
const bodyCenter=1.17;
function front(x,y){return .84*Math.sqrt(Math.max(.001,1-x*x-((y-bodyCenter)/.96)**2));}
// Face elements follow the spherical body; bevels lift their centers subtly.
function patch(name,c,rx,ry,m,lift=.008,colorFn=null,shape=null){
 const p=[],n=[],ix=[],colors=[],rings=32,segs=128;
 function point(u,v){const x=c[0]+rx*u,y=c[1]+(shape?shape(v):ry*v);return[x,y,front(x,y)+lift+.008*(1-u*u-v*v)];}
 function vertex(u,v){const q=point(u,v),e=.0001,a=point(u+e,v),b=point(u,v+e);const du=a.map((x,k)=>x-q[k]),dv=b.map((x,k)=>x-q[k]);const nn=[du[1]*dv[2]-du[2]*dv[1],du[2]*dv[0]-du[0]*dv[2],du[0]*dv[1]-du[1]*dv[0]],len=Math.hypot(...nn);p.push(...q);n.push(...nn.map(x=>x/len));if(colorFn)colors.push(...colorFn(u,v));}
 vertex(0,0);
 for(let j=1;j<=rings;j++)for(let i=0;i<segs;i++){const t=2*Math.PI*i/segs;vertex(j/rings*Math.cos(t),j/rings*Math.sin(t));}
 for(let i=0;i<segs;i++)ix.push(0,1+i,1+(i+1)%segs);
 for(let j=1;j<rings;j++)for(let i=0;i<segs;i++){const a=1+(j-1)*segs+i,b=1+(j-1)*segs+(i+1)%segs,c=a+segs,d=b+segs;ix.push(a,c,d,a,d,b);}
 // Ring order above is clockwise: reverse to preserve outward-facing triangles.
 
 parts.push({name,p,n,ix,m,colors:colorFn?colors:null});
}
ellipsoid('Body • high resolution smooth sphere',[0,bodyCenter,0],[1,.96,.84],pink,160,256);
for(const s of [-1,1]){
 const side=s<0?'Left':'Right';
 ellipsoid(side+' foot',[s*.49,.245,.18],[.45,.245,.64],red,80,128,0,s*.22);
 ellipsoid(side+' arm',[s*.99,1.13,-.015],[.40,.275,.30],pink,80,128,s*.38);
 patch(side+' cheek',[s*.57,1.19],.175,.071,cheek,.007,(u,v)=>{const fade=Math.pow(Math.min(1,Math.hypot(u,v)),1.7);return[1,.13+.23*fade,.30+.26*fade];});
 patch(side+' eye • black outline',[s*.255,1.54],.103,.239,black,.013);
 patch(side+' eye • blue iris',[s*.255,1.416],.077,.102,blue,.026,(u,v)=>{const t=(v+1)/2;return[.028*(1-t)+.006*t,.30*(1-t)+.038*t,.88*(1-t)+.19*t];});
 patch(side+' eye • large catchlight',[s*.255-.014,1.633],.047,.082,white,.039);
 patch(side+' eye • small catchlight',[s*.255+.027,1.424],.017,.024,white,.041);
}
patch('Open smiling mouth',[0,1.087],.165,.14,mouth,.014,null,v=>v>=0?v*.023:v*.145);
patch('Rounded tongue',[0,.996],.095,.035,tongue,.03);
const gltf={asset:{version:'2.0',generator:'Detailed procedural Kirby',copyright:'Fan art. Kirby character belongs to Nintendo / HAL Laboratory.'},extensionsUsed:['KHR_materials_clearcoat'],scene:0,scenes:[{name:'Kirby',nodes:[0]}],nodes:[{name:'Kirby',children:[]}],meshes:[],materials,buffers:[],bufferViews:[],accessors:[]};
let offset=0;const chunks=[];
function acc(values,type,indices=false){const data=indices?new Uint32Array(values):new Float32Array(values),buf=Buffer.from(data.buffer),view=gltf.bufferViews.length;gltf.bufferViews.push({buffer:0,byteOffset:offset,byteLength:buf.length,target:indices?34963:34962});chunks.push(buf);offset+=buf.length;const a={bufferView:view,componentType:indices?5125:5126,count:values.length/(type==='VEC3'?3:1),type};if(type==='VEC3'){a.min=[Infinity,Infinity,Infinity];a.max=[-Infinity,-Infinity,-Infinity];values.forEach((v,i)=>{a.min[i%3]=Math.min(a.min[i%3],v);a.max[i%3]=Math.max(a.max[i%3],v);});}gltf.accessors.push(a);return gltf.accessors.length-1;}
for(const part of parts){const attributes={POSITION:acc(part.p,'VEC3'),NORMAL:acc(part.n,'VEC3')};if(part.colors)attributes.COLOR_0=acc(part.colors,'VEC3');gltf.meshes.push({name:part.name,primitives:[{attributes,indices:acc(part.ix,'SCALAR',true),material:part.m}]});gltf.nodes[0].children.push(gltf.nodes.length);gltf.nodes.push({name:part.name,mesh:gltf.meshes.length-1});}
gltf.buffers.push({byteLength:offset});let json=Buffer.from(JSON.stringify(gltf));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);const bin=Buffer.concat(chunks),h=Buffer.alloc(12),jh=Buffer.alloc(8),bh=Buffer.alloc(8);h.writeUInt32LE(0x46546c67);h.writeUInt32LE(2,4);h.writeUInt32LE(28+json.length+bin.length,8);jh.writeUInt32LE(json.length);jh.writeUInt32LE(0x4e4f534a,4);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);fs.writeFileSync(path.join(__dirname,'kirby-detailed.glb'),Buffer.concat([h,jh,json,bh,bin]));
// Render the actual mesh into a small, dependency-free PNG for visual inspection.
const W=900,H=900,pixels=Buffer.alloc(W*H*4),depth=new Float32Array(W*H).fill(-Infinity);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4,shadow=Math.exp(-(((x-450)/260)**2)-((y-780)/42)**2)*.16;pixels[i]=Math.round(245*(1-shadow));pixels[i+1]=Math.round(242*(1-shadow));pixels[i+2]=Math.round(250*(1-shadow));pixels[i+3]=255;}
const az=-.13,el=.10,ca=Math.cos(az),sa=Math.sin(az),ce=Math.cos(el),se=Math.sin(el);
function rotate(x,y,z){const a=ca*x+sa*z,b=-sa*x+ca*z;return[a,ce*y-se*b,se*y+ce*b];}
for(const part of parts){const base=materials[part.m].pbrMetallicRoughness.baseColorFactor,vs=[];for(let i=0;i<part.p.length;i+=3){const q=rotate(part.p[i],part.p[i+1]-1.1,part.p[i+2]);vs.push([W/2+q[0]*285,H/2-q[1]*285,q[2]]);}
 for(let t=0;t<part.ix.length;t+=3){const ids=part.ix.slice(t,t+3),[a,b,c]=ids.map(i=>vs[i]),area=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);if(area>=-1e-8)continue;const xmin=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0]))),xmax=Math.min(W-1,Math.ceil(Math.max(a[0],b[0],c[0]))),ymin=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1]))),ymax=Math.min(H-1,Math.ceil(Math.max(a[1],b[1],c[1])));
  for(let y=ymin;y<=ymax;y++)for(let x=xmin;x<=xmax;x++){const u=((b[0]-x)*(c[1]-y)-(b[1]-y)*(c[0]-x))/area,v=((c[0]-x)*(a[1]-y)-(c[1]-y)*(a[0]-x))/area,w=1-u-v;if(u<0||v<0||w<0)continue;const z=u*a[2]+v*b[2]+w*c[2],pos=y*W+x;if(z<=depth[pos])continue;depth[pos]=z;const weights=[u,v,w],nn=[0,0,0],color=[0,0,0];for(let j=0;j<3;j++)for(let k=0;k<3;k++){nn[k]+=weights[j]*part.n[ids[j]*3+k];color[k]+=weights[j]*(part.colors?part.colors[ids[j]*3+k]:1)*base[k];}const norm=rotate(...nn),l=Math.hypot(...norm),diff=Math.max(0,(-.4*norm[0]+.65*norm[1]+.65*norm[2])/l),spec=Math.pow(Math.max(0,(-.22*norm[0]+.35*norm[1]+.91*norm[2])/l),45)*.17;for(let k=0;k<3;k++)pixels[pos*4+k]=Math.round(Math.min(1,Math.pow(color[k]*(.48+.52*diff)+spec,1/2.2))*255);}
 }
}
const crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function chunk(type,data){const b=Buffer.concat([Buffer.from(type),data]);let crc=0xffffffff;for(const v of b)crc=crcTable[(crc^v)&255]^(crc>>>8);const h=Buffer.alloc(4),tail=Buffer.alloc(4);h.writeUInt32BE(data.length);tail.writeUInt32BE((crc^0xffffffff)>>>0);return Buffer.concat([h,b,tail]);}
const ih=Buffer.alloc(13);ih.writeUInt32BE(W);ih.writeUInt32BE(H,4);ih[8]=8;ih[9]=6;const scan=Buffer.alloc((W*4+1)*H);for(let y=0;y<H;y++)pixels.copy(scan,y*(W*4+1)+1,y*W*4,(y+1)*W*4);fs.writeFileSync(path.join(__dirname,'kirby-preview.png'),Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ih),chunk('IDAT',zlib.deflateSync(scan)),chunk('IEND',Buffer.alloc(0))]));
let triangles=0;for(const p of parts){triangles+=p.ix.length/3;for(const i of p.ix)if(i<0||i>=p.p.length/3)throw Error('Invalid vertex index');for(const v of [...p.p,...p.n])if(!Number.isFinite(v))throw Error('Nonfinite geometry');}
console.log(JSON.stringify({file:'kirby-detailed.glb',triangles,meshes:parts.length,bytes:28+json.length+bin.length}));

