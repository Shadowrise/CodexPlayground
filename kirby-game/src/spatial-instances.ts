import { Group, InstancedMesh, Matrix4, Color } from 'three';

/** Let camera and shadow frustums cull small regions instead of an entire forest. */
export function spatialInstances(source: InstancedMesh, cellSize = 64) {
  const group = new Group();
  group.name = source.name;
  const cells = new Map<string, number[]>(), matrix = new Matrix4(), color = new Color();
  for (let i = 0; i < source.count; i++) {
    source.getMatrixAt(i, matrix);
    if (matrix.elements[0] === 0 && matrix.elements[1] === 0 && matrix.elements[2] === 0) continue;
    const key = `${Math.floor(matrix.elements[12] / cellSize)},${Math.floor(matrix.elements[14] / cellSize)}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key)!.push(i);
  }
  for (const indices of cells.values()) {
    const mesh = new InstancedMesh(source.geometry, source.material, indices.length);
    mesh.castShadow = source.castShadow; mesh.receiveShadow = source.receiveShadow;
    indices.forEach((index, i) => {
      source.getMatrixAt(index, matrix); mesh.setMatrixAt(i, matrix);
      if (source.instanceColor) { source.getColorAt(index, color); mesh.setColorAt(i, color); }
    });
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
  source.dispose();
  return group;
}
