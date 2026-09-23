import * as T from 'three';

/** Low-frequency biome colour; fine grass is tiled independently below. */
export function createGroundTexture(half:number,resolution=512){
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
  const map=new T.DataTexture(data,resolution,resolution);map.name='Smooth biome ground colours';
  map.colorSpace=T.SRGBColorSpace;map.magFilter=T.LinearFilter;map.minFilter=T.LinearMipmapLinearFilter;map.generateMipmaps=true;
  map.repeat.set(1/(2*half),1/(2*half));map.offset.set(.5,.5);map.needsUpdate=true;
  return map;
}

/** Eight metres per tile gives each painted blade dozens of texels, not one or two. */
export function createGrassDetail(){
  const size=512,data=new Uint8Array(size*size*4);
  let seed=8712;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<size*size;i++){const v=112+Math.round(random()*14);data.set([v,v,v,255],i*4);}
  const dab=(x:number,y:number,r:number,value:number)=>{
    for(let py=Math.floor(y-r);py<=Math.ceil(y+r);py++)for(let px=Math.floor(x-r);px<=Math.ceil(x+r);px++){
      const alpha=T.MathUtils.clamp(r+.35-Math.hypot(px-x,py-y),0,1)*.65;
      if(!alpha)continue;
      const index=(((py%size+size)%size)*size+(px%size+size)%size)*4;
      const v=Math.round(data[index]*(1-alpha)+value*alpha);
      data[index]=data[index+1]=data[index+2]=v;
    }
  };
  for(let i=0;i<4700;i++){
    const x=random()*size,y=random()*size,angle=random()*Math.PI*2;
    const length=6+random()*18,bend=(random()-.5)*9,width=.7+random()*.8;
    const light=random()<.5,value=light?180+random()*48:50+random()*35;
    for(let step=0;step<=length;step++){
      const t=step/length,curve=Math.sin(t*Math.PI)*bend;
      dab(x+Math.cos(angle)*step-Math.sin(angle)*curve,y+Math.sin(angle)*step+Math.cos(angle)*curve,width*(1-t*.85),value);
    }
  }
  const texture=new T.DataTexture(data,size,size);texture.name='Fine seamless curved grass blades';
  texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.magFilter=T.LinearFilter;
  texture.minFilter=T.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.anisotropy=4;texture.needsUpdate=true;
  return texture;
}

export function createGroundMaterial(half:number){
  const material=new T.MeshStandardMaterial({map:createGroundTexture(half),roughness:1});
  const detail=createGrassDetail();
  material.onBeforeCompile=shader=>{
    shader.uniforms.groundDetail={value:detail};
    shader.vertexShader='varying vec2 vGroundDetail;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvGroundDetail=uv/8.0;');
    shader.fragmentShader='uniform sampler2D groundDetail;\nvarying vec2 vGroundDetail;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\ndiffuseColor.rgb *= .62 + texture2D(groundDetail,vGroundDetail).r * .82;');
  };
  material.customProgramCacheKey=()=> 'biome-ground-detail-v1';
  material.addEventListener('dispose',()=>{detail.dispose();material.map?.dispose();});
  return material;
}
