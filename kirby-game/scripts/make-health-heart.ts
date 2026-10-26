import { writeFile } from 'node:fs/promises';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { createHealthHeartModel, getHealthHeartStats } from '../src/health-heart-model';

Object.assign(globalThis, { FileReader: class {
  result: unknown; onloadend?: () => void;
  readAsArrayBuffer(blob: Blob) { void blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.(); }); }
  readAsDataURL(blob: Blob) { void blob.arrayBuffer().then(result => {
    this.result = `data:${blob.type};base64,${Buffer.from(result).toString('base64')}`; this.onloadend?.();
  }); }
} });
const root = createHealthHeartModel();
const data = await new GLTFExporter().parseAsync(root, { binary: true }) as ArrayBuffer;
const output = new URL('../public/models/health-heart.glb', import.meta.url);
await writeFile(output, Buffer.from(data));
console.log(JSON.stringify({ output: output.pathname, bytes: data.byteLength, ...getHealthHeartStats() }, null, 2));
