import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

function leafGeometry(){
  const shape=new T.Shape();
  const points=[[0,-1],[.19,-.64],[.43,-.57],[.32,-.24],[.65,-.13],[.43,.1],[.58,.37],[.25,.31],[.18,.69],[0,1],[-.18,.69],[-.25,.31],[-.58,.37],[-.43,.1],[-.65,-.13],[-.32,-.24],[-.43,-.57],[-.19,-.64]];
  points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
  const blade=new T.ShapeGeometry(shape).toNonIndexed();blade.rotateX(-Math.PI/2);
  const pos=blade.getAttribute('position'),colors=[];
  for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i);pos.setY(i,.1*x*x+.045*Math.sin(z*3));const light=x<0?.86:1;colors.push(light,light,light);}
  blade.setAttribute('color',new T.Float32BufferAttribute(colors,3));blade.deleteAttribute('uv');blade.computeVertexNormals();
  const vertices:number[]=[],tints:number[]=[];
  const vein=(ax:number,az:number,bx:number,bz:number,width:number)=>{
    const length=Math.hypot(bx-ax,bz-az),dx=-(bz-az)/length*width,dz=(bx-ax)/length*width;
    for(const [x,z] of [[ax-dx,az-dz],[bx-dx,bz-dz],[ax+dx,az+dz],[bx-dx,bz-dz],[bx+dx,bz+dz],[ax+dx,az+dz]]){vertices.push(x,.1*x*x+.045*Math.sin(z*3)+.009,z);tints.push(1.22,1.13,.91);}
  };
  vein(0,-1.18,0,.9,.017);
  for(const z of [-.5,-.12,.25])for(const sign of [-1,1])vein(0,z,sign*.37,z-.2,.009);
  const veins=new T.BufferGeometry();veins.setAttribute('position',new T.Float32BufferAttribute(vertices,3));veins.setAttribute('color',new T.Float32BufferAttribute(tints,3));veins.computeVertexNormals();
  const result=mergeGeometries([blade,veins]);blade.dispose();veins.dispose();return result;
}

/** Two instanced draws: layered leaves and a short, gravity-driven landing burst. */
export class LeafPile {
  readonly group=new T.Group();
  private flying:T.InstancedMesh;
  private time=10;
  private dummy=new T.Object3D();
  constructor(rx=4.4,rz=3.9){
    this.group.name='Layered autumn leaves';
    const geometry=leafGeometry(),material=new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.86});
    const bed=new T.InstancedMesh(geometry,material,1100),color=new T.Color();
    const palette=['#d99730','#efbd48','#bd6130','#ae782f','#dbaa46','#9e5229','#c2a54a'];
    for(let i=0;i<1100;i++){
      const a=i*2.399963,r=Math.sqrt((i+.5)/1100),jitter=Math.sin(i*17.13)*.07;
      this.dummy.position.set(Math.cos(a)*rx*r,.06+.6*(1-r*r)+jitter,Math.sin(a)*rz*r);
      const scale=.28+(Math.sin(i*7.1)+1)*.12;
      this.dummy.scale.setScalar(scale);this.dummy.rotation.set(Math.sin(i)*.32,i*1.7,Math.cos(i*2)*.25);this.dummy.updateMatrix();bed.setMatrixAt(i,this.dummy.matrix);bed.setColorAt(i,color.set(palette[i%palette.length]));
    }
    bed.computeBoundingSphere();bed.receiveShadow=true;this.group.add(bed);
    this.flying=new T.InstancedMesh(geometry,material,120);this.flying.visible=false;this.flying.frustumCulled=false;
    for(let i=0;i<120;i++)this.flying.setColorAt(i,color.set(palette[i%palette.length]));
    this.group.add(this.flying);
  }
  burst(){this.time=0;this.update(0);}
  update(dt:number){
    this.time+=dt;this.flying.visible=this.time<3.2;if(!this.flying.visible)return;
    const t=this.time;
    for(let i=0;i<120;i++){
      const a=i*2.399963,speed=1.5+(i%9)*.29,lift=2.5+(i%7)*.42;
      const landing=(lift+Math.sqrt(lift*lift+2*5*.6))/5,flight=Math.min(t,landing);
      const radius=.45+speed*flight;
      this.dummy.position.set(Math.cos(a)*radius+Math.sin(flight*7+i)*.16,.06+Math.max(0,.6+lift*flight-2.5*flight*flight),Math.sin(a)*radius+Math.cos(flight*6+i)*.16);
      this.dummy.rotation.set(Math.sin(i+flight*4)*.8, a+flight*(i%2?2:-2),Math.cos(i+flight*3)*.7);
      if(t>=landing)this.dummy.rotation.x=this.dummy.rotation.z=0;
      this.dummy.scale.setScalar((.27+i%4*.045)*Math.min(1,(3.2-t)*2));this.dummy.updateMatrix();this.flying.setMatrixAt(i,this.dummy.matrix);
    }
    this.flying.instanceMatrix.needsUpdate=true;
  }
}
