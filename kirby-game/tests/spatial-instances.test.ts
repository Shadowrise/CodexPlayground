import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BoxGeometry, Color, InstancedMesh, Matrix4, MeshStandardMaterial, Vector3 } from 'three';
import { spatialInstances } from '../src/spatial-instances';

test('spatial batches preserve transforms, colors and shadow flags with local bounds', () => {
  const source = new InstancedMesh(new BoxGeometry(), new MeshStandardMaterial(), 3);
  source.castShadow = source.receiveShadow = true;
  for (let i = 0; i < 3; i++) {
    source.setMatrixAt(i, new Matrix4().makeTranslation(i * 200, 0, 0));
    source.setColorAt(i, new Color(i === 0 ? 'red' : 'green'));
  }
  const group = spatialInstances(source);
  assert.equal(group.children.length, 3);
  group.children.forEach((child, i) => {
    const mesh = child as InstancedMesh, matrix = new Matrix4(), color = new Color();
    assert(mesh.castShadow && mesh.receiveShadow);
    mesh.getMatrixAt(0, matrix); mesh.getColorAt(0, color);
    assert.equal(matrix.elements[12], i * 200);
    assert.equal(color.getHex(), new Color(i === 0 ? 'red' : 'green').getHex());
    assert(mesh.boundingSphere!.radius < 1);
    assert(mesh.boundingSphere!.center.equals(new Vector3(i * 200, 0, 0)));
  });
});
