import {writeFile} from 'node:fs/promises';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {Mesh} from 'three';
import {createCentipede} from '../src/centipede-model';
// Browser-compatible GLTFExporter file reader for the offline Node generator.
Object.assign(globalThis,{FileReader:class{result:unknown;onloadend?:()=>void;readAsArrayBuffer(blob:Blob){void blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}readAsDataURL(blob:Blob){void blob.arrayBuffer().then(result=>{this.result=`data:${blob.type};base64,${Buffer.from(result).toString('base64')}`;this.onloadend?.();});}}});
const {root,clips}=createCentipede();
const data=await new GLTFExporter().parseAsync(root,{binary:true,animations:clips,onlyVisible:false}) as ArrayBuffer;
await writeFile(new URL('../public/models/centipede-animated.glb',import.meta.url),Buffer.from(data));
let meshes=0,triangles=0;root.traverse(o=>{if(o instanceof Mesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;}});
console.log(JSON.stringify({bytes:data.byteLength,meshes,triangles,clips:clips.map(c=>c.name)},null,2));
