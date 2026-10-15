import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Box3,Mesh,MeshStandardMaterial,Raycaster,SkinnedMesh,Vector3,type Object3D} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createMetaKnightSealModel,getMetaKnightSealStats} from '../src/meta-knight-seal-model';

function meshes(root:Object3D){const result:Mesh[]=[];root.traverse(object=>{if(object instanceof Mesh)result.push(object);});return result;}
function triangles(root:Object3D){return meshes(root).reduce((sum,mesh)=>sum+(mesh.geometry.index?.count??mesh.geometry.getAttribute('position').count)/3,0);}
function front(root:Object3D,x:number,y:number){root.updateMatrixWorld(true);return new Raycaster(new Vector3(x,y,2),new Vector3(0,0,-1)).intersectObject(root,true)[0];}

test('seal is a centered, genuinely thick medallion within the shared geometry and draw-call budget',()=>{
  const root=createMetaKnightSealModel(),stats=getMetaKnightSealStats();
  const bounds=new Box3().setFromObject(root,true),size=bounds.getSize(new Vector3());
  assert(bounds.getCenter(new Vector3()).length()<1e-6);
  assert(Math.abs(size.x-1.4)<1e-6&&Math.abs(size.y-1.4)<1e-6,'round 1.4 metre diameter');
  assert(size.z>.18&&size.z<.35,'a solid edge and raised relief must have real depth');
  assert.equal(meshes(root).length,3);assert.equal(stats.drawCalls,3);
  assert.equal(triangles(root),stats.triangles);assert(stats.triangles<=3000,'all three visible seals should remain inexpensive');
  assert.equal(root.userData.forward,'+Z');assert.equal(root.userData.static,true);
  for(const mesh of meshes(root)){
    assert(!mesh.castShadow&&!mesh.receiveShadow);assert(!Array.isArray(mesh.material));
    const material=mesh.material as MeshStandardMaterial;
    assert(material instanceof MeshStandardMaterial&&material.vertexColors&&!material.transparent);
    assert(!material.map&&!material.normalMap&&!material.roughnessMap&&!material.metalnessMap&&!material.envMap,'portable colors require no texture or environment assets');
    const p=mesh.geometry.getAttribute('position'),n=mesh.geometry.getAttribute('normal'),color=mesh.geometry.getAttribute('color'),index=mesh.geometry.index!;
    assert.equal(p.count,n.count);assert.equal(p.count,color.count);
    for(const attribute of [p,n,color])for(const value of attribute.array)assert(Number.isFinite(value));
    const a=new Vector3(),b=new Vector3(),c=new Vector3();
    for(let i=0;i<index.count;i+=3){
      a.fromBufferAttribute(p,index.getX(i));b.fromBufferAttribute(p,index.getX(i+1));c.fromBufferAttribute(p,index.getX(i+2));
      assert(b.sub(a).cross(c.sub(a)).lengthSq()>1e-14,'the budget must contain visible triangles rather than collapsed lathe poles');
    }
    for(let i=0;i<n.count;i++)assert(Math.abs(new Vector3().fromBufferAttribute(n,i).length()-1)<1e-4,'unit lighting normals');
  }
});

test('front exposes raised silver mask, recessed dark visor, golden eyes and star accents while the back stays solid',()=>{
  const root=createMetaKnightSealModel();
  const mask=front(root,0,.20),visor=front(root,0,-.14);
  assert.equal(mask.object.name,'Seal_silver_relief');assert(mask.point.z>.07,'mask is raised above the inset');
  assert.equal(visor.object.name,'Seal_indigo_enamel');assert(visor.point.z<mask.point.z,'the visor is recessed within the curved silver mask');
  for(const side of [-1,1]){
    const eye=front(root,side*.135,-.105);assert.equal(eye.object.name,'Seal_golden_accents');assert(eye.point.z>visor.point.z);
    assert.equal(front(root,0,side*.525).object.name,'Seal_golden_accents','both large four-point stars remain visible');
  }
  const back=new Raycaster(new Vector3(0,0,-2),new Vector3(0,0,1)).intersectObject(root,true)[0];
  assert(back&&back.object.name==='Seal_silver_relief'&&back.point.z<-.12,'back is a closed silver plate, not a front-facing sprite');
});

test('curved mask and both stars have solid relief walls reaching the enamel instead of floating shells',()=>{
  const root=createMetaKnightSealModel();root.updateMatrixWorld(true);
  // This slice lies in front of the plate but below the original curved shell.
  // A sideways ray must hit its filled underside, not pass through an air gap.
  const mask=new Raycaster(new Vector3(2,-.30,.01),new Vector3(-1,0,0)).intersectObject(root,true)[0];
  assert(mask&&mask.object.name==='Seal_silver_relief'&&mask.point.x>.15&&mask.point.x<.24,'mask walls connect its raised front to the backing');
  for(const side of [-1,1]){
    const star=new Raycaster(new Vector3(2,side*.525,.01),new Vector3(-1,0,0)).intersectObject(root,true)[0];
    assert(star&&star.object.name==='Seal_silver_relief'&&star.point.x>.06&&star.point.x<.08,'star relief has a supported base under its visible front cap');
  }
});

test('three independently transformed instances share each geometry buffer and material',()=>{
  const roots=Array.from({length:3},()=>createMetaKnightSealModel());
  const first=meshes(roots[0]);
  roots[1].position.set(3,2,-1);roots[1].rotation.y=.8;roots[2].scale.setScalar(.5);
  for(const root of roots.slice(1))for(const [i,mesh] of meshes(root).entries()){
    assert.notEqual(mesh,first[i]);assert.equal(mesh.geometry,first[i].geometry);assert.equal(mesh.material,first[i].material);
    assert.equal(mesh.geometry.getAttribute('position').array,first[i].geometry.getAttribute('position').array);
  }
  assert(roots[0].position.length()===0&&roots[0].scale.equals(new Vector3(1,1,1)));
  const stats=getMetaKnightSealStats();stats.bounds.min[0]=99;
  assert(getMetaKnightSealStats().bounds.min[0]<0,'statistics cannot mutate the cached asset');
});

test('exported GLB is a compact standalone static asset matching native geometry and materials',async()=>{
  const bytes=await readFile(new URL('../public/models/meta-knight-seal.glb',import.meta.url));
  assert(bytes.byteLength<150_000,'three seals load one compact shared asset');
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  assert.equal(gltf.animations.length,0);assert.equal(meshes(gltf.scene).length,3);
  assert.equal(triangles(gltf.scene),getMetaKnightSealStats().triangles);
  gltf.scene.traverse(object=>assert(!(object instanceof SkinnedMesh),'the medallion contains no character rig'));
  assert(new Box3().setFromObject(gltf.scene,true).getCenter(new Vector3()).length()<1e-6);
  for(const mesh of meshes(gltf.scene))assert(!(mesh.material as MeshStandardMaterial).map,'no external textures');
  assert.equal(front(gltf.scene,.135,-.105).object.name,'Seal_golden_accents');
});
