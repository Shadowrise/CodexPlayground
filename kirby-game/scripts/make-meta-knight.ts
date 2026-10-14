import {writeFile} from 'node:fs/promises';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {Mesh} from 'three';
import {createMetaKnight} from '../src/meta-knight-model';

// GLTFExporter uses the browser FileReader API even for texture-free GLBs.
Object.assign(globalThis, {FileReader: class {
  result: unknown;
  onloadend?: () => void;
  readAsArrayBuffer(blob: Blob) {
    void blob.arrayBuffer().then(result => {this.result = result; this.onloadend?.();});
  }
  readAsDataURL(blob: Blob) {
    void blob.arrayBuffer().then(result => {
      this.result = `data:${blob.type};base64,${Buffer.from(result).toString('base64')}`;
      this.onloadend?.();
    });
  }
}});

const {root, clips} = createMetaKnight();
const data = await new GLTFExporter().parseAsync(root, {
  binary: true,
  animations: clips,
  onlyVisible: false,
}) as ArrayBuffer;
const output = new URL('../public/models/meta-knight-animated.glb', import.meta.url);
await writeFile(output, Buffer.from(data));

let meshes = 0, triangles = 0;
root.traverse(object => {
  if (!(object instanceof Mesh)) return;
  meshes++;
  triangles += (object.geometry.index?.count ?? object.geometry.getAttribute('position').count) / 3;
});
console.log(JSON.stringify({
  output: output.pathname,
  bytes: data.byteLength,
  meshes,
  triangles,
  clips: clips.map(clip => ({name: clip.name, duration: clip.duration, tracks: clip.tracks.length})),
}, null, 2));
