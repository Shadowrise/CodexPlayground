import * as T from 'three';

/** Quiet warm paving, with all grain and ornament baked into one colour map. */
export function createArenaFloorTexture(){
 const size=512,canvas=document.createElement('canvas');canvas.width=canvas.height=size;
 const ctx=canvas.getContext('2d')!;let seed=9271;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const pixels=ctx.createImageData(size,size);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const grain=(random()-.5)*4,soft=Math.sin(x/size*Math.PI*2)*Math.cos(y/size*Math.PI*2)*1.1,index=(y*size+x)*4;
  pixels.data.set([224+grain+soft,221+grain+soft,214+grain+soft,255],index);
 }
 ctx.putImageData(pixels,0,0);
 // Wide, faint interwoven arcs: no contrasting grout or tiny repeating checks.
 ctx.strokeStyle='rgba(97,89,70,.055)';ctx.lineWidth=3;ctx.lineCap='round';
 for(let row=-1;row<3;row++){
  ctx.beginPath();
  for(let x=0;x<=size;x+=2){const y=row*size/2+size/4+Math.sin(x/size*Math.PI*2)*size*.11;x?ctx.lineTo(x,y):ctx.moveTo(x,y);}
  ctx.stroke();
 }
 const texture=new T.CanvasTexture(canvas);texture.name='Subtle woven arena paving';texture.colorSpace=T.SRGBColorSpace;
 texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(6,6);texture.anisotropy=2;
 return texture;
}
