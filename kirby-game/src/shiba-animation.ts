import * as T from 'three';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';

const smooth=(a:number,b:number,v:number)=>T.MathUtils.smoothstep(v,a,b);
const JAW_Y=-.17,JAW_Z=.06,JAW_ANGLE=.24;
/** A recessed oral pocket joined to the actual upper and lower lip edges. */
function mouthGeometry(body:T.BufferGeometry,jaw:Float32Array){
  const p=body.getAttribute('position'),side=body.getAttribute('jawSide');
  const columns=new Map<number,{x:number;z:number;dy:number;dz:number}>();
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    if(side.getX(i)<.5||Math.abs(y+.185)>1e-5||Math.abs(x)>.22||z<.17)continue;
    const key=Math.round(x*100000),old=columns.get(key);
    if(!old||z>old.z)columns.set(key,{x,z,dy:jaw[i*3+1],dz:jaw[i*3+2]});
  }
  const lip=[...columns.values()].sort((a,b)=>a.x-b.x),rows=6,positions:number[]=[],delta:number[]=[],indices:number[]=[];
  if(lip.length<3)throw new Error('Shiba lip seam not found');
  for(let col=0;col<lip.length;col++)for(let row=0;row<=rows;row++){
    const v=row/rows,l=lip[col];
    positions.push(l.x,-.185,l.z-.002-.055*Math.sin(Math.PI*v));delta.push(0,l.dy*v,l.dz*v);
    if(col<lip.length-1&&row<rows){const a=col*(rows+1)+row,b=a+rows+1;indices.push(a,a+1,b,a+1,b+1,b);}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.morphAttributes.position=[new T.Float32BufferAttribute(delta,3)];g.morphTargetsRelative=true;g.computeBoundingBox();g.computeBoundingSphere();return g;
}
/** Split the front muzzle at its lip seam, retaining interpolated texture UVs. */
function openLipSeam(source:T.BufferGeometry){
  const g=source.toNonIndexed(),p=g.getAttribute('position'),n=g.getAttribute('normal'),uv=g.getAttribute('uv');
  type Vertex={p:T.Vector3;n:T.Vector3;uv:T.Vector2};
  const positions:number[]=[],normals:number[]=[],uvs:number[]=[],jawSides:number[]=[];
  const emit=(poly:Vertex[],lower?:boolean)=>{for(let k=1;k<poly.length-1;k++)for(const v of [poly[0],poly[k],poly[k+1]]){positions.push(...v.p.toArray());normals.push(...v.n.toArray());uvs.push(...v.uv.toArray());jawSides.push(Number(lower??v.p.y<-.185));}};
  const clip=(tri:Vertex[],lower:boolean)=>{
    const output:Vertex[]=[];
    for(let k=0;k<tri.length;k++){
      const a=tri[k],b=tri[(k+1)%tri.length],da=a.p.y+.185,db=b.p.y+.185;
      const inside=lower?da<=0:da>=0,next=lower?db<=0:db>=0;
      if(inside)output.push(a);
      if(inside!==next){const t=da/(da-db);output.push({p:a.p.clone().lerp(b.p,t),n:a.n.clone().lerp(b.n,t).normalize(),uv:a.uv.clone().lerp(b.uv,t)});}
    }
    return output;
  };
  const midpoint=(a:Vertex,b:Vertex):Vertex=>({p:a.p.clone().lerp(b.p,.5),n:a.n.clone().lerp(b.n,.5).normalize(),uv:a.uv.clone().lerp(b.uv,.5)});
  const split=(tri:Vertex[],depth:number)=>{
    const center=tri.reduce((v,p)=>v.add(p.p),new T.Vector3()).multiplyScalar(1/3);
    if(depth<1&&center.z>.17&&Math.abs(center.x)<.24&&center.y>-.40&&center.y<-.10){
      const [a,b,c]=tri,ab=midpoint(a,b),bc=midpoint(b,c),ca=midpoint(c,a);
      for(const sub of [[a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]])split(sub,depth+1);
      return;
    }
    const front=center.z>.17;
    if(front&&tri.some(v=>v.p.y<-.185)&&tri.some(v=>v.p.y>-.185)){emit(clip(tri,false),false);emit(clip(tri,true),true);}else emit(tri);
  };
  for(let i=0;i<p.count;i+=3){
    const tri=[0,1,2].map(k=>({p:new T.Vector3().fromBufferAttribute(p,i+k),n:new T.Vector3().fromBufferAttribute(n,i+k),uv:new T.Vector2(uv.getX(i+k),uv.getY(i+k))}));
    split(tri,0);
  }
  g.dispose();const result=new T.BufferGeometry();result.setAttribute('position',new T.Float32BufferAttribute(positions,3));result.setAttribute('normal',new T.Float32BufferAttribute(normals,3));result.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));result.setAttribute('jawSide',new T.Float32BufferAttribute(jawSides,1));
  const indexed=mergeVertices(result,1e-6);result.dispose();return indexed;
}
export function shibaPose(time:number){
  // One short, silent bark every 11 seconds; no timers or audio sources.
  const phase=((time%11)+11)%11;
  const bark=phase>=7&&phase<7.7?Math.sin(Math.PI*(phase-7)/.7)**2:0;
  const tongue=phase<6.7||phase>=8?1:phase<7?1-smooth(6.7,7,phase):phase<=7.7?0:smooth(7.7,8,phase);
  return {bark,wag:Math.sin(time*10.4)*(.72+.15*Math.sin(time*.8)),tongue};
}

/** One continuous tongue: curved outside, flattened on the jaw inside the mouth. */
function tongueGeometry(){
  const outside=new T.CatmullRomCurve3([
    new T.Vector3(0,0,0),new T.Vector3(0,-.003,.042),
    new T.Vector3(0,-.012,.083),new T.Vector3(0,-.038,.104),
    new T.Vector3(0,-.071,.108),new T.Vector3(0,-.091,.101),
  ]);
  const inside=new T.CatmullRomCurve3([
    new T.Vector3(0,0,0),new T.Vector3(0,.003,.019),
    new T.Vector3(0,.006,.037),new T.Vector3(0,.007,.052),
    new T.Vector3(0,.004,.063),new T.Vector3(0,0,.066),
  ]);
  const build=(curve:T.CatmullRomCurve3)=>{
  const rows=18,sides=12,positions:number[]=[],colors:number[]=[],indices:number[]=[];
  for(let row=0;row<=rows;row++){
    const t=row/rows,center=curve.getPoint(t),tangent=curve.getTangent(t);
    const normal=new T.Vector3(0,tangent.z,-tangent.y).normalize();
    const end=T.MathUtils.clamp((t-.78)/.22,0,1),round=Math.sqrt(Math.max(.0001,1-end*end));
    const width=(.024+.014*Math.sin(Math.PI*t*.85))*round;
    const thickness=(.0075-.0015*t)*round;
    for(let side=0;side<=sides;side++){
      const angle=side/sides*Math.PI*2,x=width*Math.cos(angle),top=Math.max(0,Math.sin(angle));
      const groove=.0018*Math.exp(-((x/.007)**2))*top*smooth(.18,.40,t)*(1-smooth(.84,1,t));
      const v=center.clone().addScaledVector(normal,thickness*Math.sin(angle)-groove);v.x=x;positions.push(...v.toArray());
      const shade=1-.13*Math.exp(-((x/.008)**2))*top*smooth(.20,.40,t);
      colors.push(shade,shade*(.96+.04*t),shade*(.96+.04*t));
      if(row<rows&&side<sides){const a=row*(sides+1)+side,b=a+sides+1;indices.push(a,a+1,b,a+1,b+1,b);}
    }
  }
  // Hidden root cap; the distal rings close smoothly into the rounded tip.
  for(let side=1;side<sides-1;side++)indices.push(0,side+1,side);
  const tip=rows*(sides+1);for(let side=1;side<sides-1;side++)indices.push(tip,tip+side,tip+side+1);
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
  };
  const geometry=build(outside),inner=build(inside);
  for(const attribute of ['position','normal'] as const){
    const base=geometry.getAttribute(attribute),target=inner.getAttribute(attribute),delta=new Float32Array(base.count*3);
    for(let i=0;i<base.count;i++){delta[i*3]=target.getX(i)-base.getX(i);delta[i*3+1]=target.getY(i)-base.getY(i);delta[i*3+2]=target.getZ(i)-base.getZ(i);}
    geometry.morphAttributes[attribute]=[new T.Float32BufferAttribute(delta,3)];
  }
  geometry.morphTargetsRelative=true;inner.dispose();geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}

/** Small GPU morph targets tailored to the supplied zixisun02 Shiba. */
export class ShibaAnimation {
  private body:T.Mesh;
  private mouth:T.Mesh;
  private tongue:T.Group;
  private tip:T.Mesh;
  private time=0;
  constructor(readonly model:T.Object3D){
    const body=model.getObjectByName('Box002_default_0');
    if(!(body instanceof T.Mesh))throw new Error('Shiba body mesh not found');
    this.body=body;
    model.updateMatrixWorld(true);
    // Bake the authored transforms once so all anatomical coordinates use Y-up.
    const inverse=new T.Matrix4().copy(model.matrixWorld).invert();
    const meshes:T.Mesh[]=[];model.traverse(o=>{if(o instanceof T.Mesh)meshes.push(o);});
    for(const mesh of meshes){
      const matrix=new T.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld);
      mesh.geometry=mesh.geometry.clone().applyMatrix4(matrix);
      mesh.removeFromParent();mesh.position.set(0,0,0);mesh.quaternion.identity();mesh.scale.setScalar(1);model.add(mesh);
    }
    const original=body.geometry;
    const geometry=openLipSeam(original);body.geometry=geometry;original.dispose();
    const position=geometry.getAttribute('position');
    // Lower the haunches into a resting sit, keeping every paw above the floor.
    for(let i=0;i<position.count;i++){
      const x=position.getX(i),y=position.getY(i),z=position.getZ(i);
      const rear=smooth(.43,.9,-z),aboveFeet=smooth(-.99,-.60,y);
      position.setXYZ(i,x,y-.16*rear*aboveFeet,z+.07*rear*(1-aboveFeet));
    }
    const left=new Float32Array(position.count*3),right=new Float32Array(left.length),jaw=new Float32Array(left.length);
    for(let i=0;i<position.count;i++){
      const x=position.getX(i),y=position.getY(i),z=position.getZ(i),offset=i*3;
      const tail=smooth(.86,1.16,-z)*smooth(-.98,-.85,y)*(1-smooth(.21,.34,Math.abs(x)));
      const pivotZ=-.94;
      for(const [target,sign] of [[left,-1],[right,1]] as const){
        const angle=sign*.28*tail,c=Math.cos(angle),s=Math.sin(angle);
        target[offset]=x*c+(z-pivotZ)*s-x;target[offset+2]=-x*s+(z-pivotZ)*c+pivotZ-z;
      }
      // The duplicated seam's upper vertices remain pinned; lower ones open.
      const lowerLip=geometry.getAttribute('jawSide').getX(i)>.5?smooth(.17,.28,z)*(1-smooth(.07,.19,Math.abs(x)))*smooth(-.42,-.30,y):0;
      // Rotate the lower muzzle around the jaw hinge rather than stretching it down.
      const dy=y-JAW_Y,dz=z-JAW_Z,c=Math.cos(JAW_ANGLE),s=Math.sin(JAW_ANGLE);
      jaw[offset+1]=(dy*c-dz*s-dy)*lowerLip;
      jaw[offset+2]=(dy*s+dz*c-dz)*lowerLip;
    }
    geometry.morphAttributes.position=[new T.Float32BufferAttribute(left,3),new T.Float32BufferAttribute(right,3),new T.Float32BufferAttribute(jaw,3)];
    const oralPocket=mouthGeometry(geometry,jaw);
    geometry.deleteAttribute('jawSide');
    geometry.morphTargetsRelative=true;body.updateMorphTargets();
    geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const dark=new T.MeshBasicMaterial({color:'#381d1d',side:T.DoubleSide}),pink=new T.MeshStandardMaterial({color:'#ed8597',roughness:.65,vertexColors:true});
    this.mouth=new T.Mesh(oralPocket,dark);this.mouth.name='Shiba mouth interior';model.add(this.mouth);
    this.tongue=new T.Group();this.tongue.name='Shiba tongue';model.add(this.tongue);
    this.tip=new T.Mesh(tongueGeometry(),pink);this.tip.name='Shiba sculpted tongue';this.tongue.add(this.tip);
    this.update(0);
  }
  update(dt:number){
    const previous=this.time;
    this.time+=Math.max(0,Math.min(dt,.1));this.setTime(this.time);
    // Fire once as the mouth opens, aligning the short bark with the jaw peak.
    return Math.floor((this.time-7.16)/11)>Math.floor((previous-7.16)/11);
  }
  /** Deterministic pose sampling also used by the visual regression check. */
  setTime(time:number){
    const {bark,wag,tongue}=shibaPose(time);
    const jawAmount=.28+.72*bark;
    const weights=this.body.morphTargetInfluences!;weights[0]=Math.max(0,-wag);weights[1]=Math.max(0,wag);weights[2]=jawAmount;
    this.mouth.morphTargetInfluences![0]=jawAmount;
    // The tongue stays full-sized and visible, curling back onto the oral floor.
    const dy=-.174-JAW_Y,dz=.245-JAW_Z,c=Math.cos(JAW_ANGLE),s=Math.sin(JAW_ANGLE);
    this.tongue.position.set(0,-.174+(dy*c-dz*s-dy)*jawAmount,.245+(dy*s+dz*c-dz)*jawAmount);
    this.tongue.rotation.x=JAW_ANGLE*jawAmount;
    this.tip.morphTargetInfluences![0]=1-tongue;
    this.tip.rotation.x=.025*Math.sin(time*3.1)*tongue;
  }
}
