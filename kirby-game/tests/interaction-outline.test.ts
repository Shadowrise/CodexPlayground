import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {InteractionOutline,outlineRegion} from '../src/interaction-outline';

test('selects only nearby instances and clears hulls without disposing shared geometry',()=>{
  const scene=new T.Scene(),outline=new InteractionOutline();scene.add(outline.group);
  const geometry=new T.BoxGeometry(),source=new T.InstancedMesh(geometry,new T.MeshBasicMaterial(),3);
  for(let i=0;i<3;i++)source.setMatrixAt(i,new T.Matrix4().makeTranslation(i*10,0,0));
  scene.add(source);
  const target=outlineRegion('bench',scene,new T.Vector3(10,0,0),new T.Vector3(3,3,3));
  outline.update(target);
  assert.equal(outline.group.children.length,1);
  const instance=new T.Matrix4();(outline.group.children[0] as T.InstancedMesh).getMatrixAt(0,instance);assert.equal(instance.elements[12],10);
  let disposed=false;geometry.addEventListener('dispose',()=>disposed=true);
  outline.update(undefined);
  assert.equal(outline.group.children.length,0);assert.equal(outline.group.visible,false);assert.equal(disposed,false);
});
test('follows moving targets and reuses the selected hulls',()=>{
  const root=new T.Group(),source=new T.Mesh(new T.BoxGeometry(),new T.MeshBasicMaterial());root.add(source);
  const outline=new InteractionOutline(),target={key:root,root};outline.update(target);
  const hull=outline.group.children[0];root.position.set(4,2,1);outline.update(target);
  assert.equal(outline.group.children[0],hull);assert.equal(hull.matrix.elements[12],4);
  assert.equal(hull.matrix.elements[13],2);
});
