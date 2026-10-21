import * as T from 'three';
import {NEEDLE_SIZE,NEEDLE_PALETTE,NEEDLE_PIXELS} from './generated/spruce-needle-image';

export type FoliageKind='broadleaf'|'birch'|'spruce';
const shared=new Map<string,T.DataTexture>();
/** Opaque seamless detail: existing crown geometry and instancing stay intact. */
export function createFoliageTexture(kind:FoliageKind,size=512){
  const key=kind+size,existing=shared.get(key);if(existing)return existing;
  const data=new Uint8Array(size*size*4);
  if(kind==='spruce'){
    const packed=atob(NEEDLE_PIXELS);
    // Original instance colours and the old tile's linear brightness are kept.
    // Only the neutral needle pattern changes, without a yellow/green tint or
    // the sRGB conversion that would otherwise alter the original appearance.
    const counts=new Uint32Array(16),lights=NEEDLE_PALETTE.map(c=>.2126*c[0]+.7152*c[1]+.0722*c[2]);
    for(let i=0;i<packed.length;i++){const byte=packed.charCodeAt(i);counts[byte>>4]++;counts[byte&15]++;}
    const pixels=NEEDLE_SIZE*NEEDLE_SIZE,mean=lights.reduce((sum,v,i)=>sum+v*counts[i],0)/pixels;
    const deviation=Math.sqrt(lights.reduce((sum,v,i)=>sum+(v-mean)**2*counts[i],0)/pixels);
    // Measured from the original 512px procedural spruce tile.
    const shades=lights.map(v=>Math.round(T.MathUtils.clamp(163.55779266357422+(v-mean)*26.073666488266237/deviation,0,255)));
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const source=Math.floor(y*NEEDLE_SIZE/size)*NEEDLE_SIZE+Math.floor(x*NEEDLE_SIZE/size),byte=packed.charCodeAt(source>>1),shade=shades[source%2?byte&15:byte>>4],i=(y*size+x)*4;data[i]=data[i+1]=data[i+2]=shade;data[i+3]=255;
    }
    const map=new T.DataTexture(data,size,size);map.name='Detailed spruce foliage';map.wrapS=map.wrapT=T.RepeatWrapping;map.repeat.set(2,1);map.magFilter=T.LinearFilter;map.minFilter=T.LinearMipmapLinearFilter;map.generateMipmaps=true;map.anisotropy=4;map.userData.photographicNeedles=true;map.needsUpdate=true;shared.set(key,map);return map;
  }
  let seed=kind==='birch'?917:1321;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<size*size;i++){const v=160+Math.round(random()*12);data.set([v,v,v,255],i*4);}
  const pixel=(x:number,y:number,value:number,alpha=1)=>{
    const i=(((y%size+size)%size)*size+(x%size+size)%size)*4;
    const v=Math.round(data[i]*(1-alpha)+value*alpha);data[i]=data[i+1]=data[i+2]=v;
  };
  const stroke=(ax:number,ay:number,bx:number,by:number,width:number,value:number)=>{
    const dx=bx-ax,dy=by-ay,length=dx*dx+dy*dy;
    for(let y=Math.floor(Math.min(ay,by)-width);y<=Math.ceil(Math.max(ay,by)+width);y++)for(let x=Math.floor(Math.min(ax,bx)-width);x<=Math.ceil(Math.max(ax,bx)+width);x++){
      const t=T.MathUtils.clamp(((x-ax)*dx+(y-ay)*dy)/length,0,1);
      const a=T.MathUtils.clamp(width+.45-Math.hypot(x-ax-dx*t,y-ay-dy*t),0,1);
      if(a>0)pixel(x,y,value,a);
    }
  };
  {
    const birch=kind==='birch';
    for(let i=0;i<(birch?340:230);i++){
      const x=random()*size,y=random()*size,a=random()*Math.PI*2,c=Math.cos(a),s=Math.sin(a);
      const length=(birch?16:25)+random()*(birch?19:27),width=length*(birch?.35:.29),shade=202+random()*42;
      const radius=length+width;
      for(let py=Math.floor(y-radius);py<=Math.ceil(y+radius);py++)for(let px=Math.floor(x-radius);px<=Math.ceil(x+radius);px++){
        const dx=px-x,dy=py-y,u=(dx*c+dy*s)/length+.5,v=-dx*s+dy*c;
        if(u<=0 || u>=1)continue;
        const edge=width*Math.pow(Math.sin(Math.PI*u),birch?.75:.65)*(birch?1-.09*Math.abs(Math.sin(u*Math.PI*15)):1);
        const coverage=T.MathUtils.clamp(edge-Math.abs(v)+.5,0,1);
        if(!coverage)continue;
        const midrib=Math.max(0,1-Math.abs(v)/.85);
        const vein=Math.max(0,1-Math.abs(Math.sin((u-Math.abs(v)/length*.8)*Math.PI*9))*8)*.45;
        const value=shade-17*Math.abs(v)/edge+(v<0?7:-10)+12*midrib+9*vein;
        pixel(px,py,Math.min(255,value),coverage);
      }
      stroke(x-c*length*.5,y-s*length*.5,x-c*length*.64,y-s*length*.64,.6,181);
    }
  }
  const texture=new T.DataTexture(data,size,size);texture.name=`Detailed ${kind} foliage`;
  texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(2,1);
  texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.anisotropy=2;texture.needsUpdate=true;
  shared.set(key,texture);return texture;
}
