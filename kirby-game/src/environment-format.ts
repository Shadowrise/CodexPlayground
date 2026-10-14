export const ENVIRONMENT_MAGIC=0x4b574c44;
export const ENVIRONMENT_VERSION=1;
export type BinaryArray={binary:number;type:string};
export type ArrayInfo={offset:number;bytes:number;type:string};
// Three's own object/material JSON is retained; numeric arrays live in a separate binary section.
export type EnvironmentDocument={version:number;scene:Record<string,any>;arrays:ArrayInfo[];shaders:Record<string,{key:string;detail?:string}>;bounds:Record<string,{sphere?:number[];box?:number[];draw?:number[]}>};

export async function decodeEnvironment(buffer:ArrayBuffer){
 // Vite/CDNs may apply Content-Encoding:gzip; fetch then returns decoded bytes.
 const decoded=buffer.byteLength>=4&&new DataView(buffer).getUint32(0,true)===ENVIRONMENT_MAGIC;
 const raw=decoded?buffer:await new Response(new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer(),header=new DataView(raw);
 if(raw.byteLength<12||header.getUint32(0,true)!==ENVIRONMENT_MAGIC||header.getUint32(4,true)!==ENVIRONMENT_VERSION)throw new Error('Unsupported meadow data');
 const length=header.getUint32(8,true),start=Math.ceil((12+length)/8)*8;
 if(start>raw.byteLength)throw new Error('Incomplete meadow data');
 const doc=JSON.parse(new TextDecoder().decode(new Uint8Array(raw,12,length))) as EnvironmentDocument;
 if(doc.version!==ENVIRONMENT_VERSION||!Array.isArray(doc.arrays))throw new Error('Unsupported meadow document');
 const constructors:Record<string,new(buffer:ArrayBuffer,offset:number,length:number)=>ArrayBufferView>={Float32Array,Float64Array,Uint8Array,Uint8ClampedArray,Uint16Array,Uint32Array,Int8Array,Int16Array,Int32Array};
 const sizes:Record<string,number>={Float32Array:4,Float64Array:8,Uint8Array:1,Uint8ClampedArray:1,Uint16Array:2,Uint32Array:4,Int8Array:1,Int16Array:2,Int32Array:4};
 const views=doc.arrays.map(a=>{
  const Constructor=constructors[a.type],size=sizes[a.type];
  if(!Constructor||a.offset<0||a.bytes<0||a.offset%size||a.bytes%size||start+a.offset+a.bytes>raw.byteLength)throw new Error('Invalid meadow buffer');
  return new Constructor(raw,start+a.offset,a.bytes/size);
 });
 const revive=(value:any):any=>{
  if(!value||typeof value!=='object')return value;
  if(Number.isInteger(value.binary)&&typeof value.type==='string'){
   const view=views[value.binary];if(!view||view.constructor.name!==value.type)throw new Error('Invalid meadow array');return view;
  }
  for(const key of Object.keys(value))value[key]=revive(value[key]);return value;
 };
 revive(doc.scene);return {doc,raw};
}
