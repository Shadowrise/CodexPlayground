import * as T from 'three';

let bark:T.MeshStandardMaterial|undefined;
let woodland:T.MeshLambertMaterial|undefined;
/** Thousands of small trunks need the same bark image, without paying for
 * per-pixel bump derivatives and the hero tree's physical lighting model. */
export function woodlandBarkMaterial(){return woodland??=new T.MeshLambertMaterial({name:'Shared oak bark for woodland',vertexColors:true,map:treeBarkMaterial().map});}
/** Shared opaque bark plates and relief from the approved great oak. */
export function treeBarkMaterial(){
 if(bark)return bark;
 const w=256,h=512,data=new Uint8Array(w*h*4),relief=new Uint8Array(w*h*4);
 const noise=(x:number,y:number,px:number,py:number)=>{
  const ix=Math.floor(x),iy=Math.floor(y),u=x-ix,v=y-iy,s=u*u*(3-2*u),t=v*v*(3-2*v);
  const hash=(a:number,b:number)=>{const n=Math.sin(((a%px+px)%px)*127.1+((b%py+py)%py)*311.7)*43758.5453;return n-Math.floor(n);};
  return T.MathUtils.lerp(T.MathUtils.lerp(hash(ix,iy),hash(ix+1,iy),s),T.MathUtils.lerp(hash(ix,iy+1),hash(ix+1,iy+1),s),t);
 };
 const cellHash=(x:number,y:number,seed:number)=>{const n=Math.sin(((x%20+20)%20)*127.1+((y%9+9)%9)*311.7+seed*91.7)*43758.5453;return n-Math.floor(n);};
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const u=x/w,v=y/h;
  // Warped, unequal bark plates form a branching crack network. There is no
  // periodic stripe function: fissures terminate, fork and change direction.
  const px=u*20+(noise(u*7,v*11,7,11)-.5)*.8+(noise(u*23,v*31,23,31)-.5)*.22;
  const py=v*9+(noise(u*13,v*7,13,7)-.5)*.8+(noise(u*29,v*19,29,19)-.5)*.19;
  const ix=Math.floor(px),iy=Math.floor(py);let first=Infinity,second=Infinity,plate=0;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   const cx=ix+dx,cy=iy+dy,a=cx+.12+cellHash(cx,cy,1)*.76-px,b=cy+.12+cellHash(cx,cy,2)*.76-py,d=a*a+b*b;
   if(d<first){second=first;first=d;plate=cellHash(cx,cy,3);}else if(d<second)second=d;
  }
  const edge=Math.sqrt(second)-Math.sqrt(first),fissure=Math.exp(-Math.pow(edge/.045,2)),rim=T.MathUtils.smoothstep(edge,.025,.17);
  const small=noise(u*51,v*67,51,67),flake=noise(u*29,v*37,29,37),hairline=Math.exp(-Math.pow((noise(u*43,v*31,43,31)-.49)/.026,2))*(1-fissure)*.22;
  const speck=Math.sin(x*127.1+y*311.7)*43758.5453,pore=Math.max(0,.12-(speck-Math.floor(speck)))*70;
  const shade=206+(plate-.5)*28+(small-.5)*21+(flake-.5)*15-67*fissure-25*hairline-pore+rim*7;
  const lichen=T.MathUtils.smoothstep(noise(u*9,v*13,9,13),.72,.88)*.15,i=(y*w+x)*4;
  data[i]=T.MathUtils.clamp(shade+3-lichen*20,0,255);data[i+1]=T.MathUtils.clamp(shade+lichen*8,0,255);data[i+2]=T.MathUtils.clamp(shade-7-lichen*12,0,255);data[i+3]=255;
  const height=T.MathUtils.clamp(145+rim*42+(plate-.5)*18+(flake-.5)*16-fissure*76-hairline*26-pore,0,255);relief[i]=relief[i+1]=relief[i+2]=height;relief[i+3]=255;
 }
 const map=new T.DataTexture(data,w,h),bump=new T.DataTexture(relief,w,h);map.name='Irregular oak bark plates and branching fissures';bump.name='Uneven oak bark relief';map.colorSpace=T.SRGBColorSpace;
 for(const t of [map,bump]){t.wrapS=t.wrapT=T.RepeatWrapping;t.generateMipmaps=true;t.minFilter=T.LinearMipmapLinearFilter;t.magFilter=T.LinearFilter;t.anisotropy=4;t.needsUpdate=true;}
 bark=new T.MeshStandardMaterial({map,bumpMap:bump,bumpScale:.045,roughness:.98,vertexColors:true});return bark;
}
