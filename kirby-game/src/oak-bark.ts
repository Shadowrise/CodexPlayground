import * as T from 'three';
let material:T.MeshStandardMaterial|undefined;
/** One small, seamless bark tile; relief is shading only, with no added geometry. */
export function oakBarkMaterial(){
 if(material)return material;
 const width=256,height=512,color=new Uint8Array(width*height*4),relief=new Uint8Array(width*height*4),tau=Math.PI*2;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const u=x/width,v=y/height;
  const bend=.21*Math.sin(v*tau*2)+.11*Math.sin(v*tau*5+u*tau*2);
  const grain=u*13+bend+.065*Math.sin(v*tau*11+u*tau*3);
  const furrow=Math.pow((1+Math.cos(grain*tau))/2,18);
  const fine=Math.pow((1+Math.cos((u*43+.12*Math.sin(v*tau*7))*tau))/2,24);
  const plates=Math.sin(v*tau*9+Math.sin(u*tau*13)*1.6);
  const cracks=Math.pow(Math.max(0,plates),30)*Math.pow(Math.max(0,Math.sin(u*tau*7+v*tau)),2);
  const noise=((Math.imul(x+13,374761393)^Math.imul(y+71,668265263))>>>0)%101/100;
  const shade=12*Math.sin(grain*tau-.7)+7*Math.sin(u*tau*4+v*tau)-43*furrow-10*fine-22*cracks+(noise-.5)*12;
  const i=(y*width+x)*4;
  color[i]=T.MathUtils.clamp(112+shade,0,255);color[i+1]=T.MathUtils.clamp(81+shade*.83,0,255);color[i+2]=T.MathUtils.clamp(56+shade*.65,0,255);color[i+3]=255;
  const h=T.MathUtils.clamp(155-115*furrow-40*cracks-18*fine+shade*.5,0,255);relief[i]=relief[i+1]=relief[i+2]=h;relief[i+3]=255;
 }
 const tile=(data:Uint8Array)=>{const t=new T.DataTexture(data,width,height,T.RGBAFormat);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(3,7);t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=4;t.needsUpdate=true;return t;};
 const map=tile(color);map.colorSpace=T.SRGBColorSpace;
 material=new T.MeshStandardMaterial({map,bumpMap:tile(relief),bumpScale:.075,roughness:.94});return material;
}
