import * as T from 'three';
import {clusteredGeometry} from './geometry-detail';

/** Seated snapshots in cart-local coordinates. Original rigs, wheels and
 * physics remain on their original cart; the rider always uses full detail. */
export class CoasterDetail{
 readonly far:T.Mesh;
 private parts:{object:T.Object3D;visible:boolean;passenger:boolean}[]=[];
 private distant=false;
 private position=new T.Vector3();
 constructor(private readonly cart:T.Group){
  for(const object of cart.children)this.parts.push({object,visible:object.visible,passenger:object.name==='Luigi · permanent passenger'});
  this.far=new T.Mesh(new T.BufferGeometry(),new T.MeshLambertMaterial({vertexColors:true}));
  this.far.name='Distant coaster cart and passengers';this.far.userData.renderOnlyDetail=true;this.far.receiveShadow=true;this.far.visible=false;cart.add(this.far);this.rebuild();
 }
 addPassenger(object:T.Object3D){this.parts.push({object,visible:true,passenger:true});this.rebuild();}
 private rebuild(){
  this.cart.updateWorldMatrix(true,true);
  const inverse=this.cart.matrixWorld.clone().invert(),matrix=new T.Matrix4(),point=new T.Vector3(),normal=new T.Vector3(),colour=new T.Color(),tint=new T.Color();
  const positions:number[]=[],normals:number[]=[],colours:number[]=[];
  for(const part of this.parts){
   const visible=part.object.visible;part.object.visible=part.visible;
   part.object.traverseVisible(object=>{
    if(!(object instanceof T.Mesh)||object instanceof T.InstancedMesh)return;
    const materials=Array.isArray(object.material)?object.material:[object.material];
    if(materials.every(m=>!m.visible||m.transparent||!m.colorWrite))return;
    const geometry=clusteredGeometry(object.geometry,part.passenger?12:10),view=object.clone(false);view.geometry=geometry;view.morphTargetInfluences=object.morphTargetInfluences;
    if(view instanceof T.SkinnedMesh)view.skeleton.update();
    const count=geometry.attributes.position.count,posed=new Float32Array(count*3);
    matrix.multiplyMatrices(inverse,object.matrixWorld);
    for(let i=0;i<count;i++){view.getVertexPosition(i,point).applyMatrix4(matrix);point.toArray(posed,i*3);}
    const shape=new T.BufferGeometry();shape.setAttribute('position',new T.BufferAttribute(posed,3));if(geometry.index)shape.setIndex(geometry.index);shape.computeVertexNormals();
    const length=geometry.index?.count??count,groups=geometry.groups.length?geometry.groups:[{start:0,count:length,materialIndex:0}];
    for(const group of groups){
     const material=materials[group.materialIndex??0];if(!material||!material.visible||material.transparent||!material.colorWrite)continue;
     const start=Math.max(group.start,geometry.drawRange.start),end=Math.min(length,group.start+group.count,geometry.drawRange.start+geometry.drawRange.count);
     for(let at=start;at<end;at++){
      const index=geometry.index?.getX(at)??at;
      point.fromBufferAttribute(shape.attributes.position,index);normal.fromBufferAttribute(shape.attributes.normal,index);
      positions.push(point.x,point.y,point.z);normals.push(normal.x,normal.y,normal.z);
      colour.set(0xffffff);if('color' in material)colour.copy((material as T.MeshLambertMaterial).color);
      if(material.vertexColors&&geometry.attributes.color){tint.fromBufferAttribute(geometry.attributes.color,index);colour.multiply(tint);}colours.push(colour.r,colour.g,colour.b);
     }
    }
    shape.dispose();
   });part.object.visible=visible;
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colours,3));geometry.computeBoundingSphere();geometry.computeBoundingBox();
  this.far.geometry.dispose();this.far.geometry=geometry;
 }
 update(camera?:T.Vector3,forceNear=false){
  const distance=camera?this.cart.getWorldPosition(this.position).distanceTo(camera):0;
  this.distant=!forceNear&&(this.distant?distance>95:distance>110);this.far.visible=this.distant;
  for(const part of this.parts){part.object.visible=part.visible&&!this.distant;if(part.passenger)part.object.userData.coasterDistant=this.distant;}
 }
}
