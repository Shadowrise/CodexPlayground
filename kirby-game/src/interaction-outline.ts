import * as T from 'three';

export type OutlineTarget={key:unknown;root:T.Object3D;box?:T.Box3};
export function outlineRegion(key:unknown,root:T.Object3D,center:T.Vector3,size:T.Vector3):OutlineTarget {
  return {key,root,box:new T.Box3().setFromCenterAndSize(center,size)};
}

/** Only the selected object's hulls are rendered; no full-screen render pass. */
export class InteractionOutline {
  readonly group=new T.Group();
  private key:unknown;
  private parts:{source:T.Mesh;instances?:number[];mesh:T.Mesh}[]=[];
  private matrix=new T.Matrix4();
  private material=new T.MeshBasicMaterial({color:0xa8fff1,transparent:true,opacity:.48,side:T.BackSide,depthWrite:false});
  constructor(){
    this.group.name='Available interaction outline';
    this.material.onBeforeCompile=shader=>{
      // Expand in view space so differently scaled planks have equal-width borders.
      shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
        vec3 hullNormal=normal;
        #ifdef USE_INSTANCING
          mat3 instanceNormal=mat3(instanceMatrix);
          hullNormal/=vec3(dot(instanceNormal[0],instanceNormal[0]),dot(instanceNormal[1],instanceNormal[1]),dot(instanceNormal[2],instanceNormal[2]));
          hullNormal=instanceNormal*hullNormal;
        #endif
        vec3 outlineNormal=normalize(normalMatrix * hullNormal);
        mvPosition.xyz+=outlineNormal*.075;
        gl_Position=projectionMatrix*mvPosition;`);
    };
  }
  update(target?:OutlineTarget){
    if(this.key!==target?.key){
      for(const part of this.parts)if(part.mesh instanceof T.InstancedMesh)part.mesh.dispose();
      this.group.clear();this.parts=[];this.key=target?.key;
      if(target){
        target.root.updateWorldMatrix(true,true);
        const center=new T.Vector3();
        target.root.traverseVisible(object=>{
          if(!(object instanceof T.Mesh) || object.parent===this.group)return;
          const materials=Array.isArray(object.material)?object.material:[object.material];
          if(materials.every(m=>m.transparent || !m.visible))return;
          const count=object instanceof T.InstancedMesh?object.count:1;
          const selected:number[]=[];
          for(let i=0;i<count;i++){
            this.matrix.copy(object.matrixWorld);
            if(object instanceof T.InstancedMesh){const local=new T.Matrix4();object.getMatrixAt(i,local);this.matrix.multiply(local);}
            center.setFromMatrixPosition(this.matrix);
            if(!target.box || target.box.containsPoint(center))selected.push(i);
          }
          if(!selected.length)return;
          const mesh=object instanceof T.InstancedMesh
            ? new T.InstancedMesh(object.geometry,this.material,selected.length)
            : new T.Mesh(object.geometry,this.material);
          mesh.matrixAutoUpdate=false;mesh.frustumCulled=false;
          mesh.morphTargetInfluences=object.morphTargetInfluences;
          this.group.add(mesh);this.parts.push({source:object,instances:object instanceof T.InstancedMesh?selected:undefined,mesh});
        });
      }
    }
    this.group.visible=!!target;
    for(const part of this.parts){
      part.source.updateWorldMatrix(true,false);part.mesh.matrix.copy(part.source.matrixWorld);
      if(part.instances && part.mesh instanceof T.InstancedMesh){
        const mesh=part.mesh;
        part.instances.forEach((index,i)=>{(part.source as T.InstancedMesh).getMatrixAt(index,this.matrix);mesh.setMatrixAt(i,this.matrix);});
        mesh.instanceMatrix.needsUpdate=true;
      }
    }
  }
}
