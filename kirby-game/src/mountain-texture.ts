import * as T from 'three';

/** Seamless baked rock detail shared by all four sides of the mountain ring. */
export function createMountainTexture(size=512){
  const data=new Uint8Array(size*size*4);
  const hash=(x:number,y:number)=>{let h=Math.imul(x+127,374761393)^Math.imul(y+311,668265263);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;};
  const noise=(u:number,v:number,cells:number)=>{
    const x=u*cells,y=v*cells,ix=Math.floor(x),iy=Math.floor(y);
    const wrap=(n:number)=>(n%cells+cells)%cells;
    const fx=x-ix,fy=y-iy,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
    return T.MathUtils.lerp(T.MathUtils.lerp(hash(wrap(ix),wrap(iy)),hash(wrap(ix+1),wrap(iy)),sx),T.MathUtils.lerp(hash(wrap(ix),wrap(iy+1)),hash(wrap(ix+1),wrap(iy+1)),sx),sy);
  };
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=x/size,v=y/size,broad=noise(u,v,8),medium=noise(u,v,32),fine=noise(u,v,128);
    const warp=.028*Math.sin(u*Math.PI*4)+.014*Math.sin(u*Math.PI*10);
    const layers=Math.sin((v+warp)*Math.PI*32);
    const seams=Math.pow(Math.max(0,layers),18);
    const fractures=Math.pow(Math.max(0,1-Math.abs(noise(u,v,16)-.5)*35),3);
    const value=T.MathUtils.clamp(.81+(broad-.5)*.15+(medium-.5)*.15+(fine-.5)*.09-seams*.12-fractures*.055,0,1);
    const i=(y*size+x)*4;
    data[i]=data[i+1]=data[i+2]=Math.round(value*255);data[i+3]=255;
  }
  const texture=new T.DataTexture(data,size,size);texture.name='Baked layered stone and fine scree';
  texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;
  texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;
  return texture;
}
