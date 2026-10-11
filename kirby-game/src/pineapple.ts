import {BufferGeometry,CatmullRomCurve3,Color,DoubleSide,Float32BufferAttribute,Group,LatheGeometry,Mesh,MeshLambertMaterial,Vector2,Vector3} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/** Raised rind eyes and folded crown leaves share two surfaces, without tiny
 * separate meshes, texture lookups, lights or per-frame deformation. */
export function makePineapple(){
 const group=new Group();group.name='Detailed golden pineapple';
 const profile=new CatmullRomCurve3([
  new Vector3(0,.015,0),new Vector3(.19,.025,0),new Vector3(.27,.08,0),
  new Vector3(.325,.25,0),new Vector3(.34,.49,0),new Vector3(.315,.72,0),
  new Vector3(.25,.86,0),new Vector3(.13,.92,0),new Vector3(0,.925,0),
 ]).getPoints(48);
 const radiusAt=(y:number)=>{
  for(let i=1;i<profile.length;i++)if(y<=profile[i].y){const a=profile[i-1],b=profile[i];return Math.max(0,a.x+(b.x-a.x)*(y-a.y)/Math.max(.00001,b.y-a.y));}
  return 0;
 };
 const color=(hex:string)=>new Color(hex),gold=color('#d1a33f'),seam=color('#78663b'),green=color('#7d863f');
 const skin=new LatheGeometry(profile.map(p=>new Vector2(Math.max(0,p.x),p.y)),48),skinColors:number[]=[];
 const skinPoints=skin.attributes.position;
 for(let i=0;i<skinPoints.count;i++){
  const y=skinPoints.getY(i),c=seam.clone().lerp(green,Math.max(0,(y-.67)/.26)*.55);
  skinColors.push(c.r,c.g,c.b);
 }
 skin.setAttribute('color',new Float32BufferAttribute(skinColors,3));
 skin.deleteAttribute('uv');
 const positions:number[]=[],colors:number[]=[],indices:number[]=[];
 const vertex=(a:number,y:number,raise:number,c:Color)=>{
  y=Math.max(.025,Math.min(.918,y));const r=radiusAt(y)+raise;
  const index=positions.length/3;positions.push(Math.sin(a)*r,y,Math.cos(a)*r);colors.push(c.r,c.g,c.b);return index;
 };
 // A staggered diamond lattice wraps the oval continuously. Inset ridges rise
 // out of the darker seams, with a small brown eye on each golden scale.
 for(let row=0;row<11;row++)for(let col=0;col<12;col++){
  const a=(col+(row%2)*.5)*Math.PI*2/12,y=.064+row*.078,da=Math.PI/12,dy=.078;
  const shade=.94+.055*Math.sin(row*7.17+col*2.39),ripe=gold.clone().multiplyScalar(shade).lerp(green,Math.max(0,(y-.66)/.25)*.32);
  const corners=[[a,y-dy],[a+da,y],[a,y+dy],[a-da,y]],base:number[]=[],ridge:number[]=[];
  for(let j=0;j<4;j++){
   const [ca,cy]=corners[j];base.push(vertex(ca,cy,.001,seam));
   ridge.push(vertex(a+(ca-a)*.79,y+(cy-y)*.79,.012,ripe.clone().multiplyScalar(j===2?1.08:.96)));
  }
  const centre=vertex(a,y,.022,ripe.clone().lerp(color('#efce7e'),.23));
  for(let j=0;j<4;j++){
   const k=(j+1)%4;indices.push(base[j],base[k],ridge[j],base[k],ridge[k],ridge[j],ridge[j],ridge[k],centre);
  }
  const brown=color('#87643a'),tip=vertex(a,y+.012,.029,brown);
  const e1=vertex(a-.023,y+.026,.019,brown),e2=vertex(a+.023,y+.026,.019,brown),e3=vertex(a,y-.013,.022,brown);
  indices.push(e1,tip,e2,e2,tip,e3,e3,tip,e1);
 }
 const eyes=new BufferGeometry();eyes.setAttribute('position',new Float32BufferAttribute(positions,3));eyes.setAttribute('color',new Float32BufferAttribute(colors,3));eyes.setIndex(indices);eyes.computeVertexNormals();
 const rind=mergeGeometries([skin,eyes])!;skin.dispose();eyes.dispose();
 const body=new Mesh(rind,new MeshLambertMaterial({vertexColors:true}));body.name='Pineapple raised diamond rind';group.add(body);
 const leafPositions:number[]=[],leafColors:number[]=[],leafIndices:number[]=[];
 const olive=color('#365b35'),edge=color('#628348'),vein=color('#8a9b58');
 for(const [tier,count] of [[0,9],[1,8],[2,5]])for(let i=0;i<count;i++){
  const a=i/count*Math.PI*2+tier*1.37,spread=[.37,.26,.12][tier],height=[.37,.59,.77][tier]*(.93+.07*Math.sin(i*2.3+tier)),base=leafPositions.length/3;
  for(let j=0;j<=12;j++){
   const t=j/12,r=.035+spread*(.3*t+.7*t*t),y=.878+tier*.013+height*Math.sin(t*Math.PI/2)-.075*t*t;
   const width=[.062,.053,.041][tier]*Math.sin(Math.PI*t)**.7*(1-.18*t)*(j%2?.97:1.03);
   for(let side=-1;side<=1;side++){
    leafPositions.push(Math.sin(a)*r+Math.cos(a)*width*side,y+(side===0?.018:-.003)*Math.sin(Math.PI*t),Math.cos(a)*r-Math.sin(a)*width*side);
    const c=olive.clone().lerp(side===0?vein:edge,side===0?.46:.24).multiplyScalar(.92+.08*Math.sin(i*2.4+tier+t*5));leafColors.push(c.r,c.g,c.b);
   }
   if(j<12){const k=base+j*3;leafIndices.push(k,k+3,k+1,k+1,k+3,k+4,k+1,k+4,k+2,k+2,k+4,k+5);}
  }
 }
 const crown=new BufferGeometry();crown.setAttribute('position',new Float32BufferAttribute(leafPositions,3));crown.setAttribute('color',new Float32BufferAttribute(leafColors,3));crown.setIndex(leafIndices);crown.computeVertexNormals();
 const leaves=new Mesh(crown,new MeshLambertMaterial({vertexColors:true,side:DoubleSide}));leaves.name='Pineapple curved folded leaf crown';group.add(leaves);
 return group;
}
