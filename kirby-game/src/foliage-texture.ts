import * as T from 'three';

export type FoliageKind='broadleaf'|'birch'|'spruce';
/** Opaque seamless detail: existing crown geometry and instancing stay intact. */
export function createFoliageTexture(kind:FoliageKind,size=512){
  const data=new Uint8Array(size*size*4);
  let seed=kind==='spruce'?511:kind==='birch'?917:1321;
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
  if(kind==='spruce'){
    for(let i=0;i<180;i++){
      const x=random()*size,y=random()*size,a=-Math.PI/2+(random()-.5)*1.2,length=28+random()*42;
      const c=Math.cos(a),s=Math.sin(a);
      stroke(x,y,x+c*length,y+s*length,1.1,190);
      for(let j=0;j<11;j++)for(const side of [-1,1]){
        const t=(j+1)/12,baseX=x+c*length*t,baseY=y+s*length*t;
        const n=(9+random()*11)*(1-t*.45),tipX=baseX+c*n*.6-s*n*side,tipY=baseY+s*n*.6+c*n*side;
        stroke(baseX+1,baseY+1,tipX+1,tipY+1,1.3,119);
        stroke(baseX,baseY,tipX,tipY,.65,201+random()*48);
      }
    }
  }else{
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
  return texture;
}
