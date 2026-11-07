/** Reuse Cinder's feather atlas while retaining Meta Pidgie's gold beak and armor. */
export function applyMetapidgiePlumage(gltf:any,binary:Buffer,atlas:Buffer){
 let image=gltf.images.findIndex((i:any)=>i.name==='Meta Pidgie charcoal feathers');
 if(image<0){
  const padding=(4-binary.length%4)%4,offset=binary.length+padding;
  const view=gltf.bufferViews.push({buffer:0,byteOffset:offset,byteLength:atlas.length})-1;
  image=gltf.images.push({bufferView:view,mimeType:'image/png',name:'Meta Pidgie charcoal feathers'})-1;
  binary=Buffer.concat([binary,Buffer.alloc(padding),atlas,Buffer.alloc((4-atlas.length%4)%4)]);
 }
 let texture=gltf.textures.findIndex((t:any)=>t.source===image);
 if(texture<0)texture=gltf.textures.push({...gltf.textures[0],source:image})-1;
 for(const material of gltf.materials){
  if(!['Soft painted plumage','Sketch feather paint'].includes(material.name))continue;
  material.pbrMetallicRoughness.baseColorTexture={index:texture};
  material.pbrMetallicRoughness.roughnessFactor=.97;
  material.extras={...material.extras,characterTexture:'metapidgie',sourceAtlas:'ugolyok-paint-atlas.png'};
 }
 for(const scene of gltf.scenes)scene.extras={...scene.extras,plumage:'metapidgie',featherPaint:'ugolyok'};
 gltf.buffers[0].byteLength=binary.length;
 return binary;
}
