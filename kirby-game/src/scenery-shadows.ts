import {BufferGeometry,InstancedMesh,Matrix4,MeshBasicMaterial} from 'three';
import {spatialInstances} from './spatial-instances';

// Shadow shapes share one material regardless of the decoration's visible colour.
const shadowMaterial=new MeshBasicMaterial({colorWrite:false,depthWrite:false});
export function sceneryShadowBatch(name:string,geometry:BufferGeometry,matrices:readonly Matrix4[]){
 const mesh=new InstancedMesh(geometry,shadowMaterial,matrices.length);
 mesh.name=name;mesh.castShadow=true;
 matrices.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));
 return spatialInstances(mesh);
}
