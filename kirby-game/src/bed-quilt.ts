import * as T from 'three';

export const BED_REST={y:1.58,z:.4,pitch:-Math.PI*.38};
// Beyond the bottom lip, so even the breathing pose keeps the mouth uncovered.
export const BED_COVER_FOLD=(1.15+.065)/2.05;
const PROFILE_ROWS=64,PROFILE_STEP=2.65/PROFILE_ROWS;

/** Upper surface of a reclining ellipsoid in bed coordinates. */
function bodyHeight(x:number,z:number,cx:number,cy:number,cz:number,rx:number,ry:number,rz:number){
  const cos=Math.cos(BED_REST.pitch),sin=Math.sin(BED_REST.pitch);
  const dz=z-(BED_REST.z+sin*cy+cos*cz),dx=x-cx;
  const a=cos*cos/(ry*ry)+sin*sin/(rz*rz);
  const b=2*cos*sin*(1/(ry*ry)-1/(rz*rz))*dz;
  const c=(sin*sin/(ry*ry)+cos*cos/(rz*rz))*dz*dz+dx*dx/(rx*rx)-1;
  const discriminant=b*b-4*a*c;
  return discriminant<0?0:BED_REST.y+cos*cy-sin*cz+(-b+Math.sqrt(discriminant))/(2*a);
}

/** One small deformable surface. Stitches are painted, so there are no coplanar strips. */
export class BedQuilt extends T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>{
  private readonly resting=new Float32Array(25*(PROFILE_ROWS+1));
  private lift=-1;
  private fold=-1;
  constructor(){
    const geometry=new T.PlaneGeometry(1,1,24,24);
    geometry.rotateX(-Math.PI/2);
    let map:T.CanvasTexture|undefined;
    if(typeof document!=='undefined'){
      const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
      const ctx=canvas.getContext('2d');
      if(ctx){
        ctx.fillStyle='#829ecb';ctx.fillRect(0,0,256,256);
        for(let y=0;y<8;y++)for(let x=0;x<8;x++){
          ctx.fillStyle=(x+y)%2?'#8ca8d1':'#809bc6';ctx.fillRect(x*32,y*32,32,32);
        }
        ctx.strokeStyle='#bdd0e8';ctx.lineWidth=1;ctx.setLineDash([3,3]);
        for(let i=1;i<8;i++){ctx.beginPath();ctx.moveTo(i*32,0);ctx.lineTo(i*32,256);ctx.moveTo(0,i*32);ctx.lineTo(256,i*32);ctx.stroke();}
        ctx.setLineDash([]);ctx.strokeStyle='#d8e4f1';ctx.lineWidth=6;ctx.strokeRect(4,4,248,248);
        map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;
      }
    }
    super(geometry,new T.MeshStandardMaterial({color:map?'#ffffff':'#869dc4',map:map??null,roughness:1,side:T.DoubleSide}));
    this.name='Soft blue bed quilt';this.receiveShadow=true;
    // Bake the fitted model's torso/boot envelope once. A small allowance covers
    // the Idle breathing motion; outside the body the cloth falls onto the bed.
    for(let row=0;row<=PROFILE_ROWS;row++)for(let col=0;col<25;col++){
      const x=(col/24-.5)*3.9,z=-1.15+row*PROFILE_STEP;
      this.resting[row*25+col]=Math.max(1.16,
        bodyHeight(x,z,0,1.17,0,1.035,.99,.87)+.035,
        bodyHeight(x,z,-.49,.245,.18,.56,.33,.71)+.035,
        bodyHeight(x,z,.49,.245,.18,.56,.33,.71)+.035);
    }
    // Steep, continuous skirts bridge the silhouette to the mattress instead of
    // leaving a tent-shaped air gap. This is initialization work, not cloth physics.
    const dx=3.9/24,slope=2.8,diagonal=Math.hypot(dx,PROFILE_STEP)*slope;
    for(const reverse of [false,true])for(let j=0;j<this.resting.length;j++){
      const index=reverse?this.resting.length-1-j:j,row=Math.floor(index/25),col=index%25,sign=reverse?1:-1;
      let height=this.resting[index];
      if(col+sign>=0&&col+sign<25)height=Math.max(height,this.resting[index+sign]-dx*slope);
      if(row+sign>=0&&row+sign<=PROFILE_ROWS){
        height=Math.max(height,this.resting[index+sign*25]-PROFILE_STEP*slope);
        for(const side of [-1,1])if(col+side>=0&&col+side<25)height=Math.max(height,this.resting[index+sign*25+side]-diagonal);
      }
      this.resting[index]=height;
    }
    this.setPose(0,0);
    geometry.boundingSphere=new T.Sphere(new T.Vector3(0,1.9,0),4);
  }
  setPose(lift:number,fold:number){
    if(this.lift===lift&&this.fold===fold)return;
    this.lift=lift;this.fold=fold;
    const positions=this.geometry.getAttribute('position'),uv=this.geometry.getAttribute('uv');
    const top=T.MathUtils.lerp(-1.15,.9,fold);
    for(let i=0;i<positions.count;i++){
      const u=uv.getX(i),v=1-uv.getY(i),x=(u-.5)*3.9,z=T.MathUtils.lerp(top,1.5,v);
      const sides=T.MathUtils.smoothstep(Math.abs(x),1.76,1.95);
      const row=T.MathUtils.clamp((z+1.15)/PROFILE_STEP,0,PROFILE_ROWS),lo=Math.min(PROFILE_ROWS-1,Math.floor(row)),col=i%25;
      const resting=T.MathUtils.lerp(this.resting[lo*25+col],this.resting[(lo+1)*25+col],row-lo);
      const wrinkles=.008*Math.sin(u*Math.PI*12)*Math.sin(v*Math.PI)*lift;
      positions.setXYZ(i,x,1.16-.37*sides+lift*(resting-1.16)+wrinkles,z);
    }
    positions.needsUpdate=true;this.geometry.computeVertexNormals();
  }
}
