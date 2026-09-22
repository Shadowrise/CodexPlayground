import { DataTexture, LinearFilter, Sprite, SpriteMaterial } from 'three';

const colors=['#ed343a','#ed2943','#69ed63','#b4ce42','#ffa028','#f4d04c','#934bd0','#e9b142','#ffab88','#d92b4c'];
let texture: DataTexture | undefined;
const materials: SpriteMaterial[]=[];

export function makeFruitMist(kind: number) {
  if(!texture) {
    const size=96,data=new Uint8Array(size*size*4);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
      const u=(x/(size-1)-.5)*2,v=(y/(size-1)-.5)*2;
      const r=Math.hypot(u,v),edge=Math.max(0,1-r*r);
      const clouds=.72+.16*Math.sin(u*9+v*5)+.12*Math.cos(v*12-u*4);
      const i=(y*size+x)*4;
      data[i]=data[i+1]=data[i+2]=255;
      data[i+3]=Math.round(255*Math.pow(edge,1.5)*clouds);
    }
    texture=new DataTexture(data,size,size);
    texture.magFilter=texture.minFilter=LinearFilter;texture.needsUpdate=true;
  }
  materials[kind] ??= new SpriteMaterial({map:texture,color:colors[kind],opacity:kind===2?.72:.6,
    transparent:true,depthWrite:false,depthTest:true,toneMapped:false});
  const mist=new Sprite(materials[kind]);mist.name='Fruit colored mist';
  mist.position.y=.48;mist.scale.set(2.5,1.7,1);
  return mist;
}
