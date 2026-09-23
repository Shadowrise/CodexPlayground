import * as T from 'three';

/** A single static colour map: no extra meshes, lights, shader samples or frame updates. */
export function createGroundTexture(half:number,resolution=2048){
  const data=new Uint8Array(resolution*resolution*4);
  let seed=91357;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const weights=(x:number,z:number)=>({east:.5+.5*Math.tanh((x+12*Math.sin(z*.025))/18),south:.5+.5*Math.tanh((z+10*Math.sin(x*.032))/18)});
  // Bake the existing biome palette at low resolution, then blend it under fine markings.
  const low=128,palette=new Float32Array(low*low*3);
  const nw=new T.Color('#72976c'),ne=new T.Color('#b7ca79'),sw=new T.Color('#a9b95e'),se=new T.Color('#9fc767');
  const c=new T.Color(),other=new T.Color();
  for(let y=0;y<low;y++)for(let x=0;x<low;x++){
    const wx=(x/(low-1)-.5)*2*half,wz=(.5-y/(low-1))*2*half;
    const {east,south}=weights(wx,wz);
    c.copy(nw).lerp(ne,east).lerp(other.copy(sw).lerp(se,east),south);
    const mottling=Math.sin(wx*.34+Math.sin(wz*.21))*Math.cos(wz*.29+Math.sin(wx*.19));
    c.multiplyScalar(.48+.025*mottling).convertLinearToSRGB();
    palette.set([c.r*255,c.g*255,c.b*255],(y*low+x)*3);
  }
  for(let y=0;y<resolution;y++)for(let x=0;x<resolution;x++){
    const u=x/(resolution-1)*(low-1),v=y/(resolution-1)*(low-1);
    const ix=Math.min(low-2,Math.floor(u)),iy=Math.min(low-2,Math.floor(v)),fx=u-ix,fy=v-iy;
    const a=(iy*low+ix)*3,b=a+low*3,i=(y*resolution+x)*4;
    const grain=(random()-.5)*7;
    for(let ch=0;ch<3;ch++)data[i+ch]=Math.round(T.MathUtils.lerp(T.MathUtils.lerp(palette[a+ch],palette[a+3+ch],fx),T.MathUtils.lerp(palette[b+ch],palette[b+3+ch],fx),fy)+grain);
    data[i+3]=255;
  }
  // Short, tapered painted blades. Sparse needles, fallen leaves and petals vary by biome.
  const paint=(x:number,y:number,dx:number,dy:number,width:number,color:number[],opacity:number)=>{
    const length=dx*dx+dy*dy;
    for(let py=Math.floor(Math.min(y,y+dy)-width);py<=Math.ceil(Math.max(y,y+dy)+width);py++){
      if(py<0 || py>=resolution)continue;
      for(let px=Math.floor(Math.min(x,x+dx)-width);px<=Math.ceil(Math.max(x,x+dx)+width);px++){
        if(px<0 || px>=resolution)continue;
        const t=T.MathUtils.clamp(((px-x)*dx+(py-y)*dy)/length,0,1);
        const distance=Math.hypot(px-x-dx*t,py-y-dy*t);
        const alpha=T.MathUtils.clamp((width*(1-.65*t)+.4-distance),0,1)*opacity;
        if(alpha===0)continue;
        const i=(py*resolution+px)*4;
        for(let ch=0;ch<3;ch++)data[i+ch]=Math.round(data[i+ch]*(1-alpha)+color[ch]*alpha);
      }
    }
  };
  const density=Math.round(resolution*resolution*.07);
  for(let i=0;i<density;i++){
    const x=random()*resolution,y=random()*resolution,angle=random()*Math.PI*2;
    const {east,south}=weights((x/resolution-.5)*2*half,(.5-y/resolution)*2*half);
    const accent=random()<.1;
    let color:number[],width=.65,length=1.6+random()*2.3;
    if(accent){
      const eastern=random()<east,southern=random()<south;
      if(!southern && !eastern){color=[112,100,61];width=.55;length=3.5;}
      else if(southern && !eastern){color=random()<.5?[164,121,56]:[149,91,45];width=1.3;length=2.6;}
      else if(southern){color=random()<.45?[189,148,146]:[146,161,84];width=1;length=1.5;}
      else {color=[158,152,87];width=1;length=2;}
    }else color=random()<.5?[78,108,52]:[145,163,92];
    paint(x,y,Math.cos(angle)*length,Math.sin(angle)*length,width,color,accent?.48:.38);
  }
  const map=new T.DataTexture(data,resolution,resolution);map.name='Baked grass, needles, leaves and petals';
  map.colorSpace=T.SRGBColorSpace;map.magFilter=T.LinearFilter;map.minFilter=T.LinearMipmapLinearFilter;map.generateMipmaps=true;
  map.repeat.set(1/(2*half),1/(2*half));map.offset.set(.5,.5);map.needsUpdate=true;
  return map;
}
