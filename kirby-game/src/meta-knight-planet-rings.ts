import * as T from 'three';

const INNER=86,OUTER=130,SEGMENTS=384;

/** Shared boundaries keep the three broad bands joined despite their fine, uneven rim. */
export function planetRingGeometry(inner:number,outer:number,seed:number){
 const geometry=new T.RingGeometry(inner,outer,SEGMENTS,6),positions=geometry.getAttribute('position'),uv=geometry.getAttribute('uv');
 for(let i=0;i<positions.count;i++){
  const x=positions.getX(i),y=positions.getY(i),radius=Math.hypot(x,y),angle=Math.atan2(y,x);
  const edge=.26*Math.sin(angle*19+seed)+.13*Math.sin(angle*47-seed*.7)+.065*Math.sin(angle*113+seed*.3);
  const r=radius+edge,z=.035*Math.sin(angle*23+seed)+.018*Math.sin(radius*1.8+angle*11);
  positions.setXYZ(i,Math.cos(angle)*r,Math.sin(angle)*r,z);
  // Polar UVs carry continuous concentric dust strata across every band boundary.
  uv.setXY(i,i%(SEGMENTS+1)/SEGMENTS,(radius-INNER)/(OUTER-INNER));
 }
 geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
}

/** A matte, granular dust sheet, baked once; angular frequencies wrap without a seam. */
export function planetRingTexture(seed:number){
 const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=512;
 const context=canvas.getContext('2d')!,image=context.createImageData(canvas.width,canvas.height);
 let state=177+Math.floor(seed*1000);const random=()=>((state=Math.imul(state,1664525)+1013904223|0)>>>0)/4294967296;
 for(let y=0;y<canvas.height;y++){
  const radius=INNER+(OUTER-INNER)*y/(canvas.height-1);
  const strata=.80+.085*Math.sin(radius*2.7+seed)+.045*Math.sin(radius*9.3+Math.sin(radius*1.2)*2)+.032*Math.sin(radius*27.1);
  // Narrow dark grooves follow the orbit, with interrupted, less regular fine filaments.
  const groove=Math.pow(.5+.5*Math.sin(radius*5.4+Math.sin(radius*.73)*2.3+seed),14)*.13;
  for(let x=0;x<canvas.width;x++){
   const angle=x/canvas.width*Math.PI*2;
   const clouds=.038*Math.sin(angle*7+radius*1.3+seed)+.024*Math.sin(angle*23-radius*3.7);
   const threads=.035*Math.sin(radius*39+Math.sin(angle*17+radius)*.9);
   const grain=(random()-.5)*.21,fleck=random()>.987?-.16:0;
   const value=Math.round(T.MathUtils.clamp(strata-groove+clouds+threads+grain+fleck,.40,1)*255),offset=(y*canvas.width+x)*4;
   image.data[offset]=image.data[offset+1]=image.data[offset+2]=value;image.data[offset+3]=255;
  }
 }
 context.putImageData(image,0,0);
 const texture=new T.CanvasTexture(canvas);texture.name='Granular concentric planetary dust';texture.colorSpace=T.SRGBColorSpace;
 texture.wrapS=T.RepeatWrapping;texture.anisotropy=4;return texture;
}
