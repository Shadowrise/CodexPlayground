import * as T from 'three';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';

export type MetaKnightSealStats = {
  triangles:number;drawCalls:number;diameter:number;
  bounds:{min:[number,number,number];max:[number,number,number]};
};
let template:T.Group|undefined;
let statistics:MetaKnightSealStats|undefined;

/** Static, editable collectible. Instances own transforms and share all buffers
 * and materials; the owning asset cache keeps those shared resources alive. */
export function createMetaKnightSealModel():T.Group {
  template??=buildSeal();
  return template.clone(true);
}

export function getMetaKnightSealStats():MetaKnightSealStats {
  template??=buildSeal();
  return {...statistics!,bounds:{min:[...statistics!.bounds.min],max:[...statistics!.bounds.max]}};
}

function buildSeal(){
  const root=new T.Group();root.name='MetaKnight_seal';
  const batches:T.BufferGeometry[][]=[[],[],[]];
  const silver=new T.MeshStandardMaterial({name:'Seal · moon silver',color:'#ffffff',vertexColors:true,metalness:.78,roughness:.29});
  const enamel=new T.MeshStandardMaterial({name:'Seal · indigo enamel',color:'#ffffff',vertexColors:true,metalness:.12,roughness:.61});
  const gold=new T.MeshStandardMaterial({name:'Seal · warm gold',color:'#ffffff',vertexColors:true,metalness:.72,roughness:.27,emissive:'#ffb51b',emissiveIntensity:.10});
  const materials=[silver,enamel,gold];
  function add(batch:number,source:T.BufferGeometry,color:string,position=[0,0,0],scale=[1,1,1]){
    let geometry=source.index?source.toNonIndexed():source.clone();geometry.deleteAttribute('uv');
    geometry.scale(...scale as [number,number,number]);geometry.translate(...position as [number,number,number]);
    if(scale[0]*scale[1]*scale[2]<0)for(const attribute of Object.values(geometry.attributes)){
      for(let i=0;i<attribute.count;i+=3)for(let c=0;c<attribute.itemSize;c++){
        const value=attribute.getComponent(i+1,c);attribute.setComponent(i+1,c,attribute.getComponent(i+2,c));attribute.setComponent(i+2,c,value);
      }
    }
    const positionAttribute=geometry.getAttribute('position'),indices:number[]=[],a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();
    for(let i=0;i<positionAttribute.count;i+=3){
      a.fromBufferAttribute(positionAttribute,i);b.fromBufferAttribute(positionAttribute,i+1);c.fromBufferAttribute(positionAttribute,i+2);
      if(b.sub(a).cross(c.sub(a)).lengthSq()>1e-14)indices.push(i,i+1,i+2);
    }
    if(indices.length!==positionAttribute.count){geometry.setIndex(indices);const cleaned=geometry.toNonIndexed();geometry.dispose();geometry=cleaned;}
    const tint=new T.Color(color),values=new Float32Array(geometry.getAttribute('position').count*3);
    for(let i=0;i<values.length;i+=3)values.set([tint.r,tint.g,tint.b],i);
    geometry.setAttribute('color',new T.BufferAttribute(values,3));batches[batch].push(geometry);source.dispose();
  }
  function shape(points:number[][]){const s=new T.Shape();s.moveTo(...points[0] as [number,number]);for(const p of points.slice(1))s.lineTo(...p as [number,number]);s.closePath();return s;}
  function extrude(outline:T.Shape,depth:number,bevel=.004,curveSegments=4){return new T.ExtrudeGeometry(outline,{depth,bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel,bevelSegments:1,steps:1,curveSegments});}
  const backingZ=.055;
  /** Preserve the curved front cap while carrying its back and side walls all
   * the way into the enamel. A curved shell on both sides would float above it. */
  function anchorRelief(geometry:T.BufferGeometry,depth:number,bevel:number,height:(x:number,y:number)=>number){
    const p=geometry.getAttribute('position'),n=geometry.getAttribute('normal'),wallBase=backingZ+(bevel>0?.002:0);
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),y=p.getY(i),z=p.getZ(i),eps=.0001;
      const front=height(x,y),dx=(height(x+eps,y)-height(x-eps,y))/(eps*2),dy=(height(x,y+eps)-height(x,y-eps))/(eps*2);
      let target:number,weight:number,stretch:number;
      if(z<=0){target=bevel>0?backingZ+.002*(z+bevel)/bevel:backingZ;weight=0;stretch=bevel>0?.002/bevel:1;}
      else if(z>=depth){target=front+z-depth-bevel;weight=1;stretch=1;}
      else{weight=z/depth;target=T.MathUtils.lerp(wallBase,front-bevel,weight);stretch=(front-bevel-wallBase)/depth;}
      const normal=new T.Vector3(n.getX(i)-weight*dx*n.getZ(i)/stretch,n.getY(i)-weight*dy*n.getZ(i)/stretch,n.getZ(i)/stretch).normalize();
      p.setZ(i,target);n.setXYZ(i,normal.x,normal.y,normal.z);
    }
    return geometry;
  }

  // A closed lathed profile gives the medallion a true back, thick edge and
  // broad bevel. Its silver front ring surrounds a separate recessed enamel.
  const profile=[[0,-.068],[.665,-.068],[.7,-.035],[.7,.035],[.671,.073],[.595,.073],[.581,.055],[0,.055]];
  const plate=new T.LatheGeometry(profile.map(([r,z])=>new T.Vector2(r,z)),64);
  plate.rotateX(Math.PI/2);add(0,plate,'#cdd5e5');
  const inset=new T.CircleGeometry(.588,64);inset.translate(0,0,.057);
  const insetPosition=inset.getAttribute('position'),insetColors=new Float32Array(insetPosition.count*3);
  const inner=new T.Color('#60438d'),outer=new T.Color('#2e2457');
  for(let i=0;i<insetPosition.count;i++){
    const radius=Math.hypot(insetPosition.getX(i),insetPosition.getY(i));
    const color=inner.clone().lerp(outer,T.MathUtils.clamp(radius/.588,0,1));insetColors.set(color.toArray(),i*3);
  }
  inset.setAttribute('color',new T.BufferAttribute(insetColors,3));inset.deleteAttribute('uv');batches[1].push(inset.toNonIndexed());inset.dispose();

  // Small bat wings are relief, not copies of the playable character's wings.
  const wing=new T.Shape();wing.moveTo(0,-.16);
  wing.bezierCurveTo(-.01,0,.02,.14,-.035,.23);
  wing.bezierCurveTo(.04,.255,.18,.20,.29,.03);
  wing.bezierCurveTo(.20,.08,.18,.04,.18,-.075);
  wing.bezierCurveTo(.13,-.025,.085,-.05,.08,-.17);
  wing.bezierCurveTo(.035,-.095,.01,-.12,0,-.16);wing.closePath();
  for(const side of [-1,1]){
    const border=anchorRelief(extrude(wing,.010,.006,3),.010,.006,()=>.089);add(0,border,'#d6dcea',[side*.285,.095,0],[side,1,1]);
    const fill=anchorRelief(extrude(wing,.040,0,3),.040,0,()=>.095);add(1,fill,'#65418e',[side*.285,.095,0],[side*.88,.88,1]);
  }

  const mask=new T.Shape();mask.moveTo(0,.365);
  mask.bezierCurveTo(.07,.27,.18,.28,.275,.21);mask.lineTo(.335,.265);
  mask.bezierCurveTo(.315,.145,.375,.015,.31,-.14);
  mask.bezierCurveTo(.27,-.27,.13,-.35,0,-.38);
  mask.bezierCurveTo(-.13,-.35,-.27,-.27,-.31,-.14);
  mask.bezierCurveTo(-.375,.015,-.315,.145,-.335,.265);mask.lineTo(-.275,.21);
  mask.bezierCurveTo(-.18,.28,-.07,.27,0,.365);mask.closePath();
  const visor=new T.Shape();visor.moveTo(-.255,.05);visor.lineTo(0,-.085);visor.lineTo(.255,.05);
  visor.bezierCurveTo(.265,-.06,.248,-.13,.20,-.16);visor.lineTo(0,-.27);visor.lineTo(-.20,-.16);
  visor.bezierCurveTo(-.248,-.13,-.265,-.06,-.255,.05);visor.closePath();
  const hole=new T.Path();hole.setFromPoints(visor.getPoints(4));mask.holes.push(hole);
  const frontZ=(x:number,y:number)=>.101+.083*Math.sqrt(Math.max(.035,1-(x/.38)**2-((y+.015)/.415)**2))+.020*Math.max(0,1-Math.abs(x)/.075);
  const relief=anchorRelief(extrude(mask,.016,.004,4),.016,.004,(x,y)=>frontZ(x,y)-.002);
  add(0,relief,'#e0e5ef');
  const shadow=anchorRelief(extrude(visor,.008,0,4),.008,0,(x,y)=>frontZ(x,y)-.021);add(1,shadow,'#0b1028');
  for(const side of [-1,1]){
    const socket=new T.CylinderGeometry(1,1,1,8,1);socket.rotateX(Math.PI/2);
    add(2,socket,'#ffe17a',[side*.135,-.105,frontZ(side*.135,-.105)-.015],[.022,.046,.020]);
    add(2,new T.SphereGeometry(1,10,5),'#ffe17a',[side*.135,-.105,frontZ(side*.135,-.105)-.005],[.032,.066,.013]);
  }

  function star(cx:number,cy:number,rx:number,ry:number,z:number,batch:number,color:string){
    const points=shape([[0,ry],[-rx*.25,ry*.24],[-rx,0],[-rx*.25,-ry*.24],[0,-ry],[rx*.25,-ry*.24],[rx,0],[rx*.25,ry*.24]]);
    const outline=points.getPoints(1),vertices:number[]=[],normals:number[]=[];
    function triangle(a:T.Vector3,b:T.Vector3,c:T.Vector3){
      const normal=new T.Triangle(a,b,c).getNormal(new T.Vector3());
      for(const v of [a,b,c]){vertices.push(...v.toArray());normals.push(...normal.toArray());}
    }
    for(let i=0;i<outline.length-1;i++){
      const a=outline[i],b=outline[i+1],frontA=new T.Vector3(cx+a.x,cy+a.y,z),frontB=new T.Vector3(cx+b.x,cy+b.y,z);
      const backA=new T.Vector3(cx+a.x,cy+a.y,backingZ),backB=new T.Vector3(cx+b.x,cy+b.y,backingZ);
      triangle(new T.Vector3(cx,cy,z+.012),frontA,frontB);
      triangle(new T.Vector3(cx,cy,backingZ),backB,backA);
      triangle(frontA,backA,frontB);triangle(frontB,backA,backB);
    }
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));add(batch,geometry,color);
  }
  for(const side of [-1,1]){
    star(0,side*.525,.077,.116,.094,0,'#dce3ed');star(0,side*.525,.050,.081,.110,2,'#f3c14e');
    for(const x of [-.22,.22])star(x,side*.435,.027,.042,.082,2,'#f3c65b');
  }
  const studAngles=[0,Math.PI/4,Math.PI*3/4,Math.PI,Math.PI*5/4,Math.PI*7/4];
  for(const angle of studAngles){
    const x=.638*Math.cos(angle),y=.638*Math.sin(angle);
    const rim=new T.RingGeometry(.033,.043,10);add(2,rim,'#edbc55',[x,y,.079]);
    add(0,new T.SphereGeometry(1,10,4),'#edf0f7',[x,y,.086],[.033,.033,.021]);
  }

  const names=['Seal_silver_relief','Seal_indigo_enamel','Seal_golden_accents'];
  for(let i=0;i<batches.length;i++){
    const merged=mergeGeometries(batches[i],false);if(!merged)throw Error('Unable to merge Meta Knight seal');
    const geometry=mergeVertices(merged,1e-5);merged.dispose();batches[i].forEach(g=>g.dispose());
    const mesh=new T.Mesh(geometry,materials[i]);mesh.name=names[i];mesh.castShadow=mesh.receiveShadow=false;root.add(mesh);
  }
  root.updateMatrixWorld(true);
  const bounds=new T.Box3().setFromObject(root,true),center=bounds.getCenter(new T.Vector3());
  for(const mesh of root.children as T.Mesh[]){mesh.geometry.translate(-center.x,-center.y,-center.z);mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();}
  root.updateMatrixWorld(true);bounds.setFromObject(root,true);
  const triangles=(root.children as T.Mesh[]).reduce((sum,mesh)=>sum+(mesh.geometry.index?.count??mesh.geometry.getAttribute('position').count)/3,0);
  statistics={triangles,drawCalls:3,diameter:1.4,bounds:{min:bounds.min.toArray() as [number,number,number],max:bounds.max.toArray() as [number,number,number]}};
  root.userData={asset:'meta-knight-seal',forward:'+Z',units:'metres',static:true,sharedResources:true,performance:{triangles,drawCalls:3},diameter:1.4};
  return root;
}
