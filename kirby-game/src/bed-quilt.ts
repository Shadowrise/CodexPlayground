import * as T from 'three';

/** One small deformable surface. Stitches are painted, so there are no coplanar strips. */
export class BedQuilt extends T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>{
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
    // The blanket rests above the mattress and drapes over its sides, never on
    // the same planes. The raised envelope clears fitted Kirby's feet as well.
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
      const dome=(1-T.MathUtils.smoothstep(Math.abs(x),.65,1.62))*(1-T.MathUtils.smoothstep(z,.32,1.35));
      const wrinkles=.018*Math.sin(u*Math.PI*12)*Math.sin(v*Math.PI)*lift;
      positions.setXYZ(i,x,1.16-.37*sides+1.7*lift*dome+wrinkles,z);
    }
    positions.needsUpdate=true;this.geometry.computeVertexNormals();
  }
}
