import fs from 'node:fs';
import http from 'node:http';
import { chromium } from 'playwright';

const sourceDir = new URL('./tiny-treats/', import.meta.url);
const outDir = new URL('./textured/', import.meta.url);
const original = JSON.parse(fs.readFileSync(new URL('bread_slice.gltf', sourceDir)));
const originalBin = fs.readFileSync(new URL('bread_slice.bin', sourceDir));
const sourceTextures = ['bread-crumb-basecolor.png', 'bread-crust-basecolor.png'];

// Decode, resize and bake tangent-space normal data with the browser image codec.
const server = http.createServer((req, res) => {
  if (req.url === '/') { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><body></body>'); return; }
  const name = req.url.slice(1);
  if (!sourceTextures.includes(name)) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', 'image/png');
  res.end(fs.readFileSync(new URL(name, outDir)));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
let baked;
try {
  browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:' + server.address().port + '/');
  baked = await page.evaluate(async names => {
    const result = [];
    for (const [material, name] of names.entries()) {
      const image = new Image(); image.src = '/' + name; await image.decode();
      const base = document.createElement('canvas'); base.width = base.height = 1024;
      const ctx = base.getContext('2d'); ctx.drawImage(image, 0, 0, 1024, 1024);
      const pixels = ctx.getImageData(0, 0, 1024, 1024).data;
      const w = 512, height = new Float32Array(w * w);
      for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
        let value = 0;
        for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
          const i = ((y * 2 + dy) * 1024 + x * 2 + dx) * 4;
          value += (pixels[i] * .2126 + pixels[i + 1] * .7152 + pixels[i + 2] * .0722) / 255;
        }
        height[y * w + x] = value / 4;
      }
      const normal = document.createElement('canvas'); normal.width = normal.height = w;
      const nctx = normal.getContext('2d'), n = nctx.createImageData(w, w);
      const at = (x, y) => height[((y + w) % w) * w + (x + w) % w];
      const strength = material === 0 ? 4.5 : 2.0;
      for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
        // glTF V follows image rows; cavities descend toward darker source pixels.
        const nx = (at(x - 1, y) - at(x + 1, y)) * strength;
        const ny = (at(x, y - 1) - at(x, y + 1)) * strength;
        const len = Math.hypot(nx, ny, 1), i = (y * w + x) * 4;
        n.data[i] = Math.round((nx / len * .5 + .5) * 255);
        n.data[i + 1] = Math.round((ny / len * .5 + .5) * 255);
        n.data[i + 2] = Math.round((1 / len * .5 + .5) * 255); n.data[i + 3] = 255;
      }
      nctx.putImageData(n, 0, 0);
      result.push({ sourceWidth: image.width, sourceHeight: image.height, base: base.toDataURL('image/jpeg', .9), normal: normal.toDataURL('image/png') });
    }
    return result;
  }, sourceTextures);
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}

const read = (accessor, vertex, component) => {
  const a = original.accessors[accessor], view = original.bufferViews[a.bufferView];
  const bytes = a.componentType === 5126 ? 4 : 2;
  const size = { VEC3: 3, VEC2: 2, SCALAR: 1 }[a.type];
  const offset = (view.byteOffset ?? 0) + (a.byteOffset ?? 0) + vertex * (view.byteStride ?? size * bytes) + component * bytes;
  return bytes === 4 ? originalBin.readFloatLE(offset) : originalBin.readUInt16LE(offset);
};
const groups = [0, 1].map(() => ({ positions: [], normals: [], uvs: [] }));
const bounds = original.accessors[0], width = bounds.max[0] - bounds.min[0], height = bounds.max[1] - bounds.min[1];
const centreY = (bounds.min[1] + bounds.max[1]) / 2;
for (let triangle = 0; triangle < original.accessors[3].count; triangle += 3) {
  const ids = [0, 1, 2].map(k => read(3, triangle + k, 0));
  // Original atlas puts all crumb faces above V=.4 and crust below it.
  const isCrumb = ids.reduce((sum, i) => sum + read(1, i, 1), 0) / 3 > .4;
  const group = groups[isCrumb ? 0 : 1];
  const vertices = ids.map(i => [0, 1, 2].map(k => read(0, i, k)));
  const normals = ids.map(i => [0, 1, 2].map(k => read(2, i, k)));
  const faceNormalZ = Math.abs(normals.reduce((sum, n) => sum + n[2], 0) / 3);
  const frontRim = faceNormalZ > .65;
  const angles = vertices.map(p => (Math.atan2(p[0], p[1] - centreY) / (2 * Math.PI) + .5) * 4);
  if (Math.max(...angles) - Math.min(...angles) > 2) for (let k = 0; k < 3; k++) if (angles[k] < 2) angles[k] += 4;
  for (let k = 0; k < 3; k++) {
    const p = vertices[k]; group.positions.push(...p); group.normals.push(...normals[k]);
    if (isCrumb || frontRim) group.uvs.push(.03 + (p[0] - bounds.min[0]) / width * .94, .03 + (bounds.max[1] - p[1]) / height * .94);
    else group.uvs.push(angles[k], .5 - p[2] / height);
  }
}

const doc = {
  asset: { version: '2.0', generator: 'Tiny Treats bread with image_gen textures, local PBR baking', extras: { geometryAuthor: 'Isa Lousberg / Tiny Treats', geometryLicense: 'CC0', texturePrompts: 'texture-prompts.json' } },
  scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name: 'White bread with porous crumb' }],
  meshes: [{ name: 'bread_slice_textured', primitives: [] }],
  materials: [], textures: [], images: [], samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }],
  accessors: [], bufferViews: [], buffers: [],
};
const chunks = []; let byteLength = 0;
const append = (buffer, target) => {
  const view = { buffer: 0, byteOffset: byteLength, byteLength: buffer.length };
  if (target) view.target = target;
  const index = doc.bufferViews.push(view) - 1; chunks.push(buffer); byteLength += buffer.length;
  const padding = (4 - byteLength % 4) % 4; if (padding) { chunks.push(Buffer.alloc(padding)); byteLength += padding; }
  return index;
};
const attribute = (values, type) => {
  const data = new Float32Array(values), size = type === 'VEC3' ? 3 : 2;
  const accessor = { bufferView: append(Buffer.from(data.buffer), 34962), componentType: 5126, count: values.length / size, type };
  if (type === 'VEC3') {
    accessor.min = [Infinity, Infinity, Infinity]; accessor.max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < data.length; i++) { const k = i % 3; accessor.min[k] = Math.min(accessor.min[k], data[i]); accessor.max[k] = Math.max(accessor.max[k], data[i]); }
  }
  return doc.accessors.push(accessor) - 1;
};
for (const [index, g] of groups.entries()) {
  doc.meshes[0].primitives.push({ attributes: { POSITION: attribute(g.positions, 'VEC3'), NORMAL: attribute(g.normals, 'VEC3'), TEXCOORD_0: attribute(g.uvs, 'VEC2') }, material: index, mode: 4 });
  const prefix = index === 0 ? 'bread-crumb' : 'bread-crust';
  for (const [kind, mime, extension] of [['base', 'image/jpeg', 'jpg'], ['normal', 'image/png', 'png']]) {
    const data = Buffer.from(baked[index][kind].split(',')[1], 'base64');
    fs.writeFileSync(new URL(prefix + (kind === 'base' ? '-color.' : '-normal.') + extension, outDir), data);
    doc.images.push({ mimeType: mime, bufferView: append(data), name: prefix + '-' + kind });
    doc.textures.push({ sampler: 0, source: doc.images.length - 1 });
  }
  doc.materials.push({ name: index === 0 ? 'Soft porous white crumb' : 'Golden baked crust', pbrMetallicRoughness: { baseColorTexture: { index: index * 2 }, metallicFactor: 0, roughnessFactor: index === 0 ? .97 : .87 }, normalTexture: { index: index * 2 + 1, scale: index === 0 ? .6 : .3 } });
}
doc.buffers.push({ byteLength });
const rawJson = Buffer.from(JSON.stringify(doc)), json = Buffer.alloc(Math.ceil(rawJson.length / 4) * 4, 32); rawJson.copy(json);
const bin = Buffer.concat(chunks), glb = Buffer.alloc(28 + json.length + bin.length);
glb.writeUInt32LE(0x46546c67, 0); glb.writeUInt32LE(2, 4); glb.writeUInt32LE(glb.length, 8);
glb.writeUInt32LE(json.length, 12); glb.writeUInt32LE(0x4e4f534a, 16); json.copy(glb, 20);
glb.writeUInt32LE(bin.length, 20 + json.length); glb.writeUInt32LE(0x004e4942, 24 + json.length); bin.copy(glb, 28 + json.length);
fs.writeFileSync(new URL('bread_slice.glb', outDir), glb);
console.log(JSON.stringify({ bytes: glb.length, triangles: groups.map(g => g.positions.length / 9), vertices: groups.map(g => g.positions.length / 3), textures: baked.map(b => ({ sourceWidth: b.sourceWidth, sourceHeight: b.sourceHeight, baseWidth: 1024, normalWidth: 512 })) }));
