const fs = require('fs');
const path = require('path');
const vertices = [], normals = [], indices = [];
const parts = [];
// Each ellipsoid is a closed, smooth mesh. Y is up; the face points toward +Z.
function ellipsoid(name, center, radius, material) {
  const p = [], n = [], ix = [], rows = 24, cols = 32;
  for (let y = 0; y <= rows; y++) {
    const theta = Math.PI * y / rows;
    for (let x = 0; x <= cols; x++) {
      const phi = 2 * Math.PI * x / cols;
      const v = [Math.sin(theta)*Math.cos(phi), Math.cos(theta), Math.sin(theta)*Math.sin(phi)];
      p.push(...v.map((a, i) => center[i] + a * radius[i]));
      const nn = v.map((a, i) => a / radius[i]);
      const len = Math.hypot(...nn);
      n.push(...nn.map(a => a / len));
    }
  }
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const a = y*(cols+1)+x, b = a+cols+1;
    if (y !== 0) ix.push(a, a+1, b);
    if (y !== rows-1) ix.push(a+1, b+1, b);
  }
  parts.push({name, p, n, ix, material});
}
const skin=0, shirt=1, pants=2, shoes=3, eyes=4;
ellipsoid('Head', [0,1.58,0], [.185,.22,.17], skin);
ellipsoid('Neck', [0,1.355,0], [.075,.1,.075], skin);
ellipsoid('Torso', [0,1.12,0], [.24,.29,.135], shirt);
ellipsoid('Hips', [0,.865,0], [.205,.14,.13], pants);
for (const s of [-1,1]) {
  const side = s === -1 ? 'Left' : 'Right';
  ellipsoid(side+' upper arm', [s*.28,1.13,0], [.08,.22,.085], shirt);
  ellipsoid(side+' forearm', [s*.32,.875,.015], [.06,.16,.065], skin);
  ellipsoid(side+' hand', [s*.325,.705,.025], [.069,.085,.055], skin);
  ellipsoid(side+' leg', [s*.105,.475,0], [.09,.39,.105], pants);
  ellipsoid(side+' shoe', [s*.105,.07,.065], [.102,.07,.175], shoes);
  ellipsoid(side+' eye', [s*.063,1.615,.158], [.021,.027,.012], eyes);
  ellipsoid(side+' ear', [s*.181,1.58,0], [.035,.055,.035], skin);
}
ellipsoid('Nose', [0,1.555,.172], [.027,.035,.035], skin);
const gltf = {
 asset:{version:'2.0',generator:'Simple Human GLB Generator'},
 scene:0, scenes:[{name:'Simple Human',nodes:[0]}],
 nodes:[{name:'Simple Human (1.8 m)',children:[]}], meshes:[],
 materials:[
  {name:'Warm skin',pbrMetallicRoughness:{baseColorFactor:[.85,.57,.36,1],metallicFactor:0,roughnessFactor:.85}},
  {name:'Blue shirt',pbrMetallicRoughness:{baseColorFactor:[.06,.37,.78,1],metallicFactor:0,roughnessFactor:.8}},
  {name:'Navy trousers',pbrMetallicRoughness:{baseColorFactor:[.035,.065,.14,1],metallicFactor:0,roughnessFactor:.9}},
  {name:'Dark shoes',pbrMetallicRoughness:{baseColorFactor:[.025,.03,.04,1],metallicFactor:0,roughnessFactor:.8}},
  {name:'Eyes',pbrMetallicRoughness:{baseColorFactor:[.015,.012,.01,1],metallicFactor:0,roughnessFactor:.5}}
 ], buffers:[],bufferViews:[],accessors:[]
};
const chunks=[]; let offset=0;
function accessor(data, type, target, bounds) {
  const buf=Buffer.from(data.buffer,data.byteOffset,data.byteLength);
  const view=gltf.bufferViews.length;
  gltf.bufferViews.push({buffer:0,byteOffset:offset,byteLength:buf.length,target});
  chunks.push(buf); offset+=buf.length;
  const pad=(4-offset%4)%4; if(pad){chunks.push(Buffer.alloc(pad));offset+=pad;}
  const a={bufferView:view,componentType:data instanceof Float32Array ? 5126 : 5123,count:data.length/(type==='VEC3'?3:1),type};
  if(bounds){a.min=[Infinity,Infinity,Infinity];a.max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<data.length;i++){const k=i%3;a.min[k]=Math.min(a.min[k],data[i]);a.max[k]=Math.max(a.max[k],data[i]);}}
  gltf.accessors.push(a);return gltf.accessors.length-1;
}
for(const part of parts){
 const POSITION=accessor(new Float32Array(part.p),'VEC3',34962,true);
 const NORMAL=accessor(new Float32Array(part.n),'VEC3',34962,false);
 const indices=accessor(new Uint16Array(part.ix),'SCALAR',34963,false);
 const mesh=gltf.meshes.length;
 gltf.meshes.push({name:part.name,primitives:[{attributes:{POSITION,NORMAL},indices,material:part.material}]});
 gltf.nodes[0].children.push(gltf.nodes.length);gltf.nodes.push({name:part.name,mesh});
}
gltf.buffers.push({byteLength:offset});
let json=Buffer.from(JSON.stringify(gltf));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
const bin=Buffer.concat(chunks),header=Buffer.alloc(12),jh=Buffer.alloc(8),bh=Buffer.alloc(8);
header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+bin.length,8);
jh.writeUInt32LE(json.length,0);jh.writeUInt32LE(0x4e4f534a,4);bh.writeUInt32LE(bin.length,0);bh.writeUInt32LE(0x004e4942,4);
const output=path.join(__dirname,'simple-human.glb');
fs.writeFileSync(output,Buffer.concat([header,jh,json,bh,bin]));
const check=fs.readFileSync(output);
if(check.readUInt32LE(8)!==check.length)throw new Error('Invalid GLB length');
for(const p of parts){if(Math.max(...p.ix)>=p.p.length/3)throw new Error('Invalid index');}
console.log(JSON.stringify({file:output,bytes:check.length,meshes:parts.length,triangles:parts.reduce((s,p)=>s+p.ix.length/3,0)}));
