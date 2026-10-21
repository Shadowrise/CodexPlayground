import * as T from 'three';
import {mountainFace,type MountainLedge} from './mountain-ledges-layout';

/** A faint contact stain hugs the wall below the rock, independent of the sky. */
export function createMountainLedgeShade(ledge:MountainLedge,thickness:number){
 const positions:number[]=[],colors:number[]=[],indices:number[]=[];
 const columns=20,rows=10,halfWidth=ledge.width*.56,reach=Math.min(2.7,1.5+ledge.width*.08);
 for(let row=0;row<=rows;row++)for(let column=0;column<=columns;column++){
  const u=column/columns*2-1,v=row/rows,x=u*halfWidth,y=Math.max(.035,ledge.y-thickness*.5-v*reach);
  let radial=ledge.radial,alpha=(1-u*u)**2*(1-v)**2*Math.min(1,v*6);
  try{radial=mountainFace(y,ledge.tangent+x)-.055;}catch{alpha=0;}
  positions.push(x,y-ledge.y,radial-ledge.radial);colors.push(1,1,1,alpha);
  if(row<rows&&column<columns){const a=row*(columns+1)+column,b=a+columns+1;indices.push(a,b,a+1,a+1,b,b+1);}
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,4));geometry.setIndex(indices);
 const material=new T.MeshBasicMaterial({color:'#18211f',vertexColors:true,transparent:true,opacity:.18,depthWrite:false,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 const shade=new T.Mesh(geometry,material);shade.name='Soft mountain ledge contact shade';
 shade.castShadow=shade.receiveShadow=false;shade.raycast=()=>{};
 return shade;
}
