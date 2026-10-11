import * as T from 'three';
import {BIOME_STYLE,BIOME_TERRAIN} from './biome-style';
import {meadowPathHalfWidth,type MeadowLayout} from './meadow-layout';
import {shoreDistance} from './pond-layout';

/** Low-frequency biome colour; fine grass is tiled independently below. */
export function createGroundTexture(half:number,resolution=512,layout?:MeadowLayout){
  const data=new Uint8Array(resolution*resolution*4);
  let seed=91357;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const weights=(x:number,z:number)=>({east:.5+.5*Math.tanh((x+12*Math.sin(z*.025))/18),south:.5+.5*Math.tanh((z+10*Math.sin(x*.032))/18)});
  // Broad tonal variation is baked once; it adds no fragment work or texture samples.
  const low=128,palette=new Float32Array(low*low*3);
  const nw=new T.Color(BIOME_STYLE.spruce.ground),ne=new T.Color(BIOME_STYLE.birch.ground),sw=new T.Color(BIOME_STYLE.autumn.ground),se=new T.Color(BIOME_STYLE.orchard.ground);
  const c=new T.Color(),other=new T.Color();
  for(let y=0;y<low;y++)for(let x=0;x<low;x++){
    const wx=(x/(low-1)-.5)*2*half,wz=(.5-y/(low-1))*2*half;
    const {east,south}=weights(wx,wz);
    c.copy(nw).lerp(ne,east).lerp(other.copy(sw).lerp(se,east),south);
    const soft=Math.sin(wx*.057+Math.sin(wz*.043))*Math.cos(wz*.064+Math.sin(wx*.038));
    const small=Math.sin(wx*.27+Math.sin(wz*.18))*Math.cos(wz*.23+Math.sin(wx*.16));
    c.multiplyScalar(.56+.025*soft+.012*small).convertLinearToSRGB();
    palette.set([c.r*255,c.g*255,c.b*255],(y*low+x)*3);
  }
  for(let y=0;y<resolution;y++)for(let x=0;x<resolution;x++){
    const u=x/(resolution-1)*(low-1),v=y/(resolution-1)*(low-1);
    const ix=Math.min(low-2,Math.floor(u)),iy=Math.min(low-2,Math.floor(v)),fx=u-ix,fy=v-iy;
    const a=(iy*low+ix)*3,b=a+low*3,i=(y*resolution+x)*4;
    const grain=(random()-.5)*2;
    for(let ch=0;ch<3;ch++)data[i+ch]=Math.round(T.MathUtils.lerp(T.MathUtils.lerp(palette[a+ch],palette[a+3+ch],fx),T.MathUtils.lerp(palette[b+ch],palette[b+3+ch],fx),fy)+grain);
    data[i+3]=255;
  }
  if(layout)paintMeadowGround(data,resolution,half,layout);
  const map=new T.DataTexture(data,resolution,resolution);map.name='Biome turf, soft trails and dry banks';
  map.colorSpace=T.SRGBColorSpace;map.magFilter=T.LinearFilter;map.minFilter=T.LinearMipmapLinearFilter;map.generateMipmaps=true;
  map.repeat.set(1/(2*half),1/(2*half));map.offset.set(.5,.5);map.needsUpdate=true;
  return map;
}

/** Alpha stores signed distance to the union of path edges, in metres [-4,4].
 * Filter distance first, then form the rim in the shader: a sub-texel border
 * remains continuous instead of baking isolated dark pixels into the map. */
function paintMeadowGround(data:Uint8Array,size:number,half:number,layout:MeadowLayout){
 const distance=new Float32Array(size*size);distance.fill(4);
 const metres=2*half/size;
 const pixel=(x:number,z:number)=>({x:(x/(2*half)+.5)*size-.5,y:(.5-z/(2*half))*size-.5});
 const brush=(minX:number,maxX:number,minZ:number,maxZ:number,sample:(x:number,z:number)=>number)=>{
  const a=pixel(minX,maxZ),b=pixel(maxX,minZ);
  for(let py=Math.max(0,Math.floor(a.y));py<=Math.min(size-1,Math.ceil(b.y));py++)for(let px=Math.max(0,Math.floor(a.x));px<=Math.min(size-1,Math.ceil(b.x));px++){
   const x=(px+.5)*metres-half,z=half-(py+.5)*metres,index=py*size+px;
   distance[index]=Math.min(distance[index],sample(x,z));
  }
 };
 for(const path of layout.paths)for(let i=1;i<path.points.length;i++){
  const a=path.points[i-1],b=path.points[i],halfA=meadowPathHalfWidth(path,a),halfB=meadowPathHalfWidth(path,b),r=Math.max(halfA,halfB)+4,dx=b.x-a.x,dz=b.z-a.z,len=dx*dx+dz*dz;
  brush(Math.min(a.x,b.x)-r,Math.max(a.x,b.x)+r,Math.min(a.z,b.z)-r,Math.max(a.z,b.z)+r,(x,z)=>{
   const t=len?T.MathUtils.clamp(((x-a.x)*dx+(z-a.z)*dz)/len,0,1):0;
   return Math.hypot(x-a.x-t*dx,z-a.z-t*dz)-T.MathUtils.lerp(halfA,halfB,t)+.1*Math.sin(x*.18+.6*Math.sin(z*.15))+.04*Math.cos(z*.24-x*.13);
  });
 }
 for(const p of layout.patches)brush(p.x-p.rx-4,p.x+p.rx+4,p.z-p.rz-4,p.z+p.rz+4,(x,z)=>{
  const dx=x-p.x,dz=z-p.z,q=Math.hypot(dx/p.rx,dz/p.rz),gradient=Math.hypot(dx/(p.rx*p.rx),dz/(p.rz*p.rz));
  return gradient>1e-6?q*(q-1)/gradient:-Math.min(p.rx,p.rz);
 });
 const order=['spruce','birch','autumn','orchard'] as const;
 const earth=order.map(b=>new T.Color(BIOME_TERRAIN[b].path)),bank=order.map(b=>new T.Color(BIOME_TERRAIN[b].bank));
 const soil=new T.Color(),wet=new T.Color(),south=new T.Color();
 const blend=(out:T.Color,palette:T.Color[],east:number,s:number)=>out.copy(palette[0]).lerp(palette[1],east).lerp(south.copy(palette[2]).lerp(palette[3],east),s);
 for(let py=0;py<size;py++)for(let px=0;px<size;px++){
  const x=(px+.5)*metres-half,z=half-(py+.5)*metres,index=py*size+px,i=index*4;
  const edge=shoreDistance(x,z,5.5),moist=(1-T.MathUtils.smoothstep(edge,.1,3.8))*.72;
  const d=distance[index],amount=1-T.MathUtils.smoothstep(d,-.6,1.25);
  data[i+3]=Math.round(T.MathUtils.clamp(.5+d/8,0,1)*255);
  if(amount<.001&&moist<.001)continue;
  const east=.5+.5*Math.tanh((x+12*Math.sin(z*.025))/18),s=.5+.5*Math.tanh((z+10*Math.sin(x*.032))/18);
  blend(soil,earth,east,s).multiplyScalar(.53).convertLinearToSRGB();
  blend(wet,bank,east,s).multiplyScalar(.49).convertLinearToSRGB();
  const grain=Math.sin(x*.27+z*.21)*1.2;
  for(const [ch,value,bankValue] of [[0,soil.r,wet.r],[1,soil.g,wet.g],[2,soil.b,wet.b]]){
   data[i+ch]=Math.round(T.MathUtils.lerp(T.MathUtils.lerp(data[i+ch],bankValue*255,moist),value*255+grain,amount*.9));
  }
 }
}

/** One packed tile: R is grass, G is earth relief, B is pebbles/grass fragments.
 * Fine path detail reuses the turf's existing texture sample and mipmaps. */
export function createGrassDetail(){
  const size=512,data=new Uint8Array(size*size*4);
  let seed=8712;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  let earthSeed=2271;
  const earthRandom=()=>{earthSeed=(Math.imul(earthSeed,1664525)+1013904223)>>>0;return earthSeed/4294967296;};
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=x/size*Math.PI*2,v=y/size*Math.PI*2;
    const mound=Math.sin(u*3+.7*Math.sin(v*2))*Math.cos(v*4+.4*Math.sin(u));
    const value=Math.round(128+14*mound+(random()-.5)*3);
    const earth=128+12*Math.sin(u*5+.6*Math.sin(v*3))*Math.cos(v*6+.5*Math.sin(u*2))+(earthRandom()-.5)*24;
    data.set([value,Math.round(earth),128,255],(y*size+x)*4);
  }
  const dab=(x:number,y:number,r:number,value:number,opacity=.72,soft=false)=>{
    for(let py=Math.floor(y-r);py<=Math.ceil(y+r);py++)for(let px=Math.floor(x-r);px<=Math.ceil(x+r);px++){
      const dx=px-x,dy=py-y,distance=Math.sqrt(dx*dx+dy*dy);
      const alpha=(soft?Math.max(0,1-distance/r)**2:T.MathUtils.clamp(r+.4-distance,0,1))*opacity;
      if(!alpha)continue;
      // The tile is a power of two; a mask wraps negative brush coordinates too.
      const index=((py&(size-1))*size+(px&(size-1)))*4;
      const v=Math.round(data[index]*(1-alpha)+value*alpha);
      data[index]=v;
    }
  };
  const blade=(x:number,y:number,angle:number,length:number,width:number,value:number)=>{
    const bend=(random()-.5)*length*.65,co=Math.cos(angle),si=Math.sin(angle);
    for(let step=0;step<=length;step+=1.25){
      const t=step/length,curve=Math.sin(t*Math.PI*.8)*bend,px=x+co*step-si*curve,py=y+si*step+co*curve,r=width*(1-t*.82);
      dab(px+1.2,py+1.2,r+.4,72,.38);
      dab(px,py,r,value+15*t,.76);
    }
  };
  // Broad, curved fans replace unrelated scratches. All brushes wrap at tile edges.
  for(let i=0;i<340;i++){
    const x=random()*size,y=random()*size,angle=random()*Math.PI*2;
    dab(x,y,9+random()*8,72,.48,true);
    const count=7+Math.floor(random()*5);
    for(let j=0;j<count;j++){
      const fan=(j/(count-1)-.5)*2.3;
      blade(x+(random()-.5)*4,y+(random()-.5)*4,angle+fan,10+random()*18,1.1+random()*1.25,128+random()*64);
    }
  }
  for(let i=0;i<1700;i++)blade(random()*size,random()*size,random()*Math.PI*2,7+random()*12,.8+random()*.65,96+random()*72);
  const earthDab=(x:number,y:number,rx:number,ry:number,angle:number,relief:number,kind:number,opacity=1)=>{
    const r=Math.max(rx,ry),co=Math.cos(angle),si=Math.sin(angle);
    for(let py=Math.floor(y-r-1);py<=Math.ceil(y+r+1);py++)for(let px=Math.floor(x-r-1);px<=Math.ceil(x+r+1);px++){
      const dx=px-x,dy=py-y,u=(dx*co+dy*si)/rx,v=(-dx*si+dy*co)/ry,d=Math.hypot(u,v);
      const a=(1-T.MathUtils.smoothstep(d,.64,1.16))*opacity;if(!a)continue;
      const index=((py&(size-1))*size+(px&(size-1)))*4;
      data[index+1]=Math.round(T.MathUtils.lerp(data[index+1],relief-22*v,a));
      data[index+2]=Math.round(T.MathUtils.lerp(data[index+2],kind,a));
    }
  };
  // Sparse rounded stones, a shallow rim shadow and finer compacted grit.
  for(let i=0;i<540;i++){
    const x=earthRandom()*size,y=earthRandom()*size,r=2+earthRandom()*5.5,angle=earthRandom()*Math.PI*2;
    earthDab(x+1.1,y+1.5,r*1.1,r*.77,angle,70,128,.6);
    earthDab(x,y,r,r*(.55+earthRandom()*.35),angle,145+earthRandom()*42,178+earthRandom()*62);
  }
  for(let i=0;i<2800;i++)earthDab(earthRandom()*size,earthRandom()*size,.5+earthRandom()*1.25,.5+earthRandom(),earthRandom()*Math.PI,85+earthRandom()*70,128,.75);
  // A few short blades/torn stems remain in the worn earth, especially its edges.
  for(let i=0;i<260;i++){
    const x=earthRandom()*size,y=earthRandom()*size,angle=earthRandom()*Math.PI*2,length=3+earthRandom()*8;
    for(let step=0;step<length;step+=1.2)earthDab(x+Math.cos(angle)*step,y+Math.sin(angle)*step,.7,.7,0,108,50,.72);
  }
  const texture=new T.DataTexture(data,size,size);texture.name='Packed seamless turf, worn earth and small pebbles';
  texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.magFilter=T.LinearFilter;
  texture.minFilter=T.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.anisotropy=4;texture.needsUpdate=true;
  return texture;
}

export function createGroundMaterial(half:number,layout?:MeadowLayout){
  // Dry turf and worn earth scatter light without a view-dependent specular sheen.
  const material=new T.MeshLambertMaterial({map:createGroundTexture(half,512,layout)});
  const detail=createGrassDetail();
  material.onBeforeCompile=shader=>{
    shader.uniforms.groundDetail={value:detail};
    shader.vertexShader='varying vec2 vGroundDetail;\nvarying float vGroundShore;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvGroundDetail=uv/6.0;\nvGroundShore=clamp(-position.y*2.5,0.0,1.0);');
    shader.fragmentShader='uniform sampler2D groundDetail;\nvarying vec2 vGroundDetail;\nvarying float vGroundShore;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
vec3 groundSurface=texture2D(groundDetail,vGroundDetail).rgb;
float trailEdge=(sampledDiffuseColor.a-.5)*8.0;
float trailWear=1.0-smoothstep(-.6,1.25,trailEdge);
float trailRim=smoothstep(-.9,-.25,trailEdge)*(1.0-smoothstep(.05,.95,trailEdge));
float grassWeight=clamp((1.0-trailWear*.9)*(1.0-vGroundShore*.45)+(groundSurface.g-.5)*.28,0.0,1.0);
vec3 soilTint=mix(vec3(1.0),vec3(.72,.99,.63),max(0.0,1.0-groundSurface.b*2.0)*.5);
vec3 soilDetail=soilTint*(.66+groundSurface.g*.7+max(0.0,groundSurface.b*2.0-1.0)*.16);
diffuseColor.rgb *= mix(soilDetail,vec3(.58+groundSurface.r*.8),grassWeight);
diffuseColor.rgb *= 1.0-trailRim*.28;
diffuseColor.a=1.0;`);
  };
  material.customProgramCacheKey=()=> 'biome-ground-matte-v6';
  material.addEventListener('dispose',()=>{detail.dispose();material.map?.dispose();});
  return material;
}
