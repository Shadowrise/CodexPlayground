import type {BufferGeometry} from 'three';

type Triangle={ax:number;az:number;ay:number;bx:number;bz:number;by:number;cx:number;cz:number;cy:number;inverse:number};
/** Static, local triangle lookup: walking uses the rendered bank surface,
 * including concave joins. One tiny cell query replaces per-frame raycasts. */
export class BankSupport {
 private cells=new Map<string,Triangle[]>();
 constructor(geometry:BufferGeometry){
  const p=geometry.attributes.position,index=geometry.index!;
  for(let i=0;i<index.count;i+=3){
   const a=index.getX(i),b=index.getX(i+1),c=index.getX(i+2);
   const t={ax:p.getX(a),az:p.getZ(a),ay:p.getY(a),bx:p.getX(b),bz:p.getZ(b),by:p.getY(b),cx:p.getX(c),cz:p.getZ(c),cy:p.getY(c),inverse:0};
   const area=(t.bz-t.cz)*(t.ax-t.cx)+(t.cx-t.bx)*(t.az-t.cz);if(Math.abs(area)<1e-9)continue;t.inverse=1/area;
   for(let x=Math.floor(Math.min(t.ax,t.bx,t.cx)/4);x<=Math.floor(Math.max(t.ax,t.bx,t.cx)/4);x++)for(let z=Math.floor(Math.min(t.az,t.bz,t.cz)/4);z<=Math.floor(Math.max(t.az,t.bz,t.cz)/4);z++){
    const key=`${x},${z}`;if(!this.cells.has(key))this.cells.set(key,[]);this.cells.get(key)!.push(t);
   }
  }
 }
 height(x:number,z:number){
  for(const t of this.cells.get(`${Math.floor(x/4)},${Math.floor(z/4)}`)??[]){
   const u=((t.bz-t.cz)*(x-t.cx)+(t.cx-t.bx)*(z-t.cz))*t.inverse;
   const v=((t.cz-t.az)*(x-t.cx)+(t.ax-t.cx)*(z-t.cz))*t.inverse,w=1-u-v;
   if(u>=-1e-6&&v>=-1e-6&&w>=-1e-6)return u*t.ay+v*t.by+w*t.cy;
  }
  return 0;
 }
}
