import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Bone,BoxGeometry,Float32BufferAttribute,Group,Mesh,MeshStandardMaterial,Skeleton,SkinnedMesh} from 'three';
import {clonePigeon} from '../src/pigeon-appearance';

test('pigeon parts that select different shader programs never share a material',()=>{
 const paint=new MeshStandardMaterial({name:'Soft painted plumage'}),template=new Group();
 const skinned=(name:string,morph:boolean)=>{
  const geometry=new BoxGeometry(),count=geometry.attributes.position.count;
  geometry.setAttribute('skinIndex',new Float32BufferAttribute(new Float32Array(count*4),4));geometry.setAttribute('skinWeight',new Float32BufferAttribute(new Float32Array(count*4).fill(.25),4));
  if(morph)geometry.morphAttributes.position=[new Float32BufferAttribute(new Float32Array(count*3),3)];
  const mesh=new SkinnedMesh(geometry,paint),bone=new Bone();mesh.name=name;mesh.add(bone);mesh.bind(new Skeleton([bone]));return mesh;
 };
 const tuft=new Mesh(new BoxGeometry(),paint);tuft.name='tuft';
 template.add(skinned('body',true),skinned('wing',true),skinned('hip',false),skinned('leg',false),tuft);
 const model=clonePigeon(template),material=(name:string)=>(model.getObjectByName(name) as Mesh).material;
 assert.equal(material('body'),material('wing'),'parts of one kind share their copy');
 assert.equal(material('hip'),material('leg'));
 assert.notEqual(material('body'),material('hip'),'morphing and plain skinned parts are separate');
 assert.notEqual(material('hip'),material('tuft'),'skinned and rigid parts are separate');
 assert.notEqual(material('body'),paint,'clones never reuse the template material');
});
