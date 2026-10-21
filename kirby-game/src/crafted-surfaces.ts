import * as T from 'three';

export const OAK_TONES=['#b58b58','#c29a66','#b9915e','#c6a16e','#b28a56','#bd965f'];
const textures=new Map<string,T.DataTexture>();

/** Physical-scale UVs keep fibres and stone pores consistent across different parts. */
export function craftedUVs(g:T.BufferGeometry){
 const positions=g.getAttribute('position'),normals=g.getAttribute('normal'),uv=g.getAttribute('uv');
 for(let i=0;i<positions.count;i++){
  const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i),nx=Math.abs(normals.getX(i)),ny=Math.abs(normals.getY(i)),nz=Math.abs(normals.getZ(i));
  uv.setXY(i,(nx>ny&&nx>nz?z:x)/2.8,(ny>nz&&ny>nx?z:y)/1.25);
 }
}

/** Assign after batching, so material keys never serialize texture pixels per tiny part. */
export function applyCraftedSurfaces(root:T.Object3D){
 root.traverse(o=>{
  if(!(o instanceof T.Mesh)||!(o.material instanceof T.MeshStandardMaterial))return;
  const m=o.material,finish=m.userData.craftedFinish;
  if(['oak','stone','paint','leather','linen','wicker','plaster','rope'].includes(finish)){
   const kind=finish==='leather'?'paint':finish as Surface;
   m.map=m.bumpMap=surfaceTexture(kind);
   m.bumpScale=finish==='oak'?.025:finish==='stone'?.045:finish==='linen'?.018:finish==='wicker'?.025:finish==='rope'?.008:.012;
  }
 });
}

type Surface='oak'|'stone'|'paint'|'linen'|'wicker'|'plaster'|'rope';
function surfaceTexture(kind:Surface){
 const known=textures.get(kind);if(known)return known;
 const size=256,data=new Uint8Array(size*size*4);let seed=kind==='oak'?8721:kind==='stone'?317:9949;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/size,v=y/size,warp=Math.sin(u*Math.PI*2)*.7+Math.sin(u*Math.PI*6)*.22;
  const fibres=Math.sin(v*Math.PI*64+warp+Math.sin(u*Math.PI*4)*Math.sin(v*Math.PI*6)*.55);
  const cloud=Math.sin(u*Math.PI*4+Math.cos(v*Math.PI*6))*Math.sin(v*Math.PI*8);
  const weave=(Math.sin(u*Math.PI*128)*Math.cos(v*Math.PI*128)),reed=Math.sin(v*Math.PI*48+Math.sin(u*Math.PI*32)*.5);
  const value=kind==='oak'?237+fibres*8-Math.pow(Math.max(0,fibres),14)*13+(random()-.5)*7:
   kind==='stone'?239+cloud*7+(random()-.5)*22:kind==='linen'?239+weave*12+(random()-.5)*8:
   kind==='wicker'?234+reed*12+Math.sin(u*Math.PI*64)*5+(random()-.5)*5:
   kind==='rope'?226+Math.sin(v*Math.PI*6-u*Math.PI*56)*19+Math.sin(v*Math.PI*96-u*Math.PI*128)*6+(random()-.5)*6:
   kind==='plaster'?242+cloud*5+(random()-.5)*10:247+cloud*2+(random()-.5)*8;
  const i=(y*size+x)*4;data[i]=data[i+1]=data[i+2]=Math.round(value);data[i+3]=255;
 }
 const texture=new T.DataTexture(data,size,size);texture.name='Handcrafted '+kind+' surface';
 texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;
 texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.anisotropy=4;texture.needsUpdate=true;
 textures.set(kind,texture);return texture;
}
