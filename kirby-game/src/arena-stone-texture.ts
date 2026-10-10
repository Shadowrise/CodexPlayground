import * as T from 'three';

/** Seamless irregular flagstones, baked once. No extra material maps or draws. */
export function createArenaStoneTexture(){
 const size=512,cells=4,step=size/cells,canvas=document.createElement('canvas');canvas.width=canvas.height=size;
 const ctx=canvas.getContext('2d')!;let seed=9271;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 type P={x:number;y:number};
 const seeds=Array.from({length:cells*cells},(_,i)=>({x:(i%cells+.5+(random()-.5)*.65)*step,y:(Math.floor(i/cells)+.5+(random()-.5)*.65)*step}));
 const palette=[[91,97,91],[92,100,99],[109,108,93],[94,102,105]],rgb=(c:number[],shade=0)=>`rgb(${c.map(v=>v+shade).join(',')})`;
 ctx.fillStyle='#404945';ctx.fillRect(0,0,size,size);
 for(let i=0;i<seeds.length;i++){
  const p=seeds[i],column=i%cells,row=Math.floor(i/cells);
  let polygon:P[]=[{x:p.x-size,y:p.y-size},{x:p.x+size,y:p.y-size},{x:p.x+size,y:p.y+size},{x:p.x-size,y:p.y+size}];
  // Periodic neighbours ensure that stones continue across the texture seam.
  for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
   if(!dx&&!dy)continue;
   const x=column+dx,y=row+dy,source=seeds[T.MathUtils.euclideanModulo(y,cells)*cells+T.MathUtils.euclideanModulo(x,cells)];
   const q={x:source.x+Math.floor(x/cells)*size,y:source.y+Math.floor(y/cells)*size};
   const nx=q.x-p.x,ny=q.y-p.y,limit=(q.x*q.x+q.y*q.y-p.x*p.x-p.y*p.y)/2;
   const clipped:P[]=[];
   for(let j=0;j<polygon.length;j++){
    const a=polygon[j],b=polygon[(j+1)%polygon.length],da=a.x*nx+a.y*ny-limit,db=b.x*nx+b.y*ny-limit;
    if(da<=0)clipped.push(a);
    if((da<=0)!==(db<=0)){const t=da/(da-db);clipped.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});}
   }
   polygon=clipped;
  }
  const outline=polygon.map(a=>({x:p.x+(a.x-p.x)*.974,y:p.y+(a.y-p.y)*.974}));
  const colour=palette[Math.floor(random()*palette.length)],spots=Array.from({length:6},()=>({x:p.x+(random()-.5)*step,y:p.y+(random()-.5)*step,r:12+random()*35}));
  const cracks=Array.from({length:2},()=>({x:p.x+(random()-.5)*step*.65,y:p.y+(random()-.5)*step*.65,a:random()*Math.PI*2,length:10+random()*24}));
  for(const ox of [-size,0,size])for(const oy of [-size,0,size]){
   if(outline.every(a=>a.x+ox<0)||outline.every(a=>a.x+ox>size)||outline.every(a=>a.y+oy<0)||outline.every(a=>a.y+oy>size))continue;
   ctx.save();ctx.translate(ox,oy);ctx.beginPath();outline.forEach((a,j)=>j?ctx.lineTo(a.x,a.y):ctx.moveTo(a.x,a.y));ctx.closePath();ctx.clip();
   const shade=ctx.createLinearGradient(p.x-step/2,p.y-step/2,p.x+step/2,p.y+step/2);shade.addColorStop(0,rgb(colour,12));shade.addColorStop(1,rgb(colour,-10));ctx.fillStyle=shade;ctx.fillRect(p.x-step*2,p.y-step*2,step*4,step*4);
   for(const spot of spots){const cloud=ctx.createRadialGradient(spot.x,spot.y,0,spot.x,spot.y,spot.r);cloud.addColorStop(0,'rgba(190,183,160,.10)');cloud.addColorStop(1,'rgba(190,183,160,0)');ctx.fillStyle=cloud;ctx.fillRect(spot.x-spot.r,spot.y-spot.r,spot.r*2,spot.r*2);}
   ctx.strokeStyle='rgba(233,226,201,.16)';ctx.lineWidth=2;ctx.stroke();
   for(const crack of cracks){const dx=Math.cos(crack.a)*crack.length,dy=Math.sin(crack.a)*crack.length;ctx.beginPath();ctx.moveTo(crack.x,crack.y);ctx.lineTo(crack.x+dx*.45-dy*.08,crack.y+dy*.45+dx*.08);ctx.lineTo(crack.x+dx,crack.y+dy);ctx.strokeStyle='rgba(30,39,36,.22)';ctx.lineWidth=.7;ctx.stroke();}
   ctx.restore();
  }
 }
 // Fine mineral grain stays subtle once mipmapped, avoiding distant shimmer.
 const pixels=ctx.getImageData(0,0,size,size);
 for(let i=0;i<pixels.data.length;i+=4){const grain=Math.round((random()-.5)*10);for(let c=0;c<3;c++)pixels.data[i+c]+=grain;}
 ctx.putImageData(pixels,0,0);
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(24,24);texture.anisotropy=2;
 return texture;
}
