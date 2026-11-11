import {Material,Mesh,Texture,type Object3D} from 'three';

const identities=new WeakMap<object,number>();let nextIdentity=1;
const identity=(value:object)=>{let id=identities.get(value);if(!id){id=nextIdentity++;identities.set(value,id);}return id;};
const SKIP=new Set(['uuid','id','version','name']);

/** Every own property takes part: plain values, colours and vectors by
 * content, textures and other objects by identity. Shader hooks restored per
 * material are compared by their program key and source: with every other
 * property (including the textures they receive) equal, they are the same hook. */
export function materialSignature(material:Material){
 const parts:string[]=[material.type];
 for(const key of Object.keys(material).sort()){
  if(SKIP.has(key))continue;
  const value=(material as unknown as Record<string,unknown>)[key];
  let text:string;
  if(value===null||value===undefined||typeof value==='number'||typeof value==='string'||typeof value==='boolean')text=String(value);
  else if(value instanceof Texture)text='t'+identity(value);
  else if(typeof value==='function')text=key==='customProgramCacheKey'?'k'+(value as ()=>string).call(material):'f'+value.toString();
  else if(typeof (value as {toArray?:unknown}).toArray==='function')text=(value as {toArray():unknown[]}).toArray().join(',');
  else if(key==='userData'||key==='defines'){try{text=JSON.stringify(value);}catch{text='o'+identity(value as object);}}
  else text='o'+identity(value as object);
  parts.push(key+'='+text);
 }
 return parts.join(';');
}

/** The restored environment carries one copy of the same material per cell.
 * Give equal surfaces within a root one instance: Three then keeps its state
 * across their consecutive draws. Returns the number of meshes reassigned. */
export function shareIdenticalMaterials(roots:readonly Object3D[]){
 let reassigned=0;
 for(const root of roots){
  const canonical=new Map<string,Material>();
  root.traverse(object=>{
   if(!(object instanceof Mesh)||Array.isArray(object.material))return;
   const key=materialSignature(object.material),first=canonical.get(key);
   if(!first)canonical.set(key,object.material);
   else if(first!==object.material){object.material=first;reassigned++;}
  });
 }
 return reassigned;
}
