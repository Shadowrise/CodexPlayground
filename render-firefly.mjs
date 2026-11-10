import { chromium } from './kirby-game/node_modules/playwright/index.mjs';
import { build } from './kirby-game/node_modules/vite/dist/node/index.js';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Render the exported asset with actual Three.js materials, including vertex
// colours, transparency, environment reflections and soft contact shadows.
const game = fileURLToPath(new URL('./kirby-game/', import.meta.url));
const cache = new URL('./kirby-game/.cache/firefly-render/', import.meta.url);
await mkdir(cache, { recursive: true });
await writeFile(new URL('index.html', cache), '<html><head><link rel="icon" href="data:,"></head><body style="margin:0"><script type="module" src="./scene.mjs"></script></body></html>');
await writeFile(new URL('scene.mjs', cache), String.raw`
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Firefly } from '../../src/firefly.ts';
const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
document.body.append(renderer.domElement);
const pmrem = new T.PMREMGenerator(renderer), room = new RoomEnvironment();
const environment = pmrem.fromScene(room, .04); room.dispose(); pmrem.dispose();
const loader = new GLTFLoader(), gltf = await loader.loadAsync('/models/firefly-animated.glb');
const views = [];
for (const mode of ['Sit', 'Fly']) {
  const scene = new T.Scene(); scene.background = new T.Color('#263b40'); scene.environment = environment.texture;
  scene.fog = new T.Fog('#263b40', 5, 16);
  scene.environmentIntensity = .4;
  scene.add(new T.HemisphereLight('#f0f5e6', '#66756a', 1.4));
  const key = new T.DirectionalLight('#fff0cd', 3.2); key.position.set(-3, 5, 4); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -3, right: 3, top: 4, bottom: -2, near: .1, far: 15 });
  key.shadow.bias = -.0003; key.shadow.normalBias = .018; key.shadow.radius = 3; scene.add(key);
  const fill = new T.DirectionalLight('#c8eeeb', 1.7); fill.position.set(4, 2, -3); scene.add(fill);
  const floor = new T.Mesh(new T.SphereGeometry(150, 48, 32), new T.MeshStandardMaterial({ color: '#263b40', roughness: .95 }));
  floor.position.y = -149.955; floor.receiveShadow = true; scene.add(floor);
  const bug = new Firefly({ ...gltf, scene: gltf.scene.clone(true) }); bug.setMode(mode); bug.update(.3); bug.mixer.setTime(mode === 'Sit' ? .5 : .18);
  // Translucent insect membranes should not cast an opaque black wing silhouette.
  bug.object.traverse(o => { if (o.isMesh && o.material.transparent) o.castShadow = false; });
  scene.add(bug.object);
  const camera = new T.PerspectiveCamera(34, 1, .01, 100); views.push({ scene, bug, camera });
}
function render(kind = 'pair') {
  renderer.setSize(innerWidth, innerHeight); renderer.setScissorTest(true);
  const selected = kind === 'pair' ? views : [views[kind === 'wings' ? 1 : 0]];
  selected.forEach((v, i) => {
    const width = innerWidth / selected.length, height = innerHeight;
    renderer.setViewport(i * width, 0, width, height); renderer.setScissor(i * width, 0, width, height);
    v.camera.aspect = width / height;
    if (kind === 'face') { v.camera.position.set(1.6, 1.75, 3.3); v.camera.lookAt(0, 1.15, .35); }
    else if (kind === 'side') { v.camera.position.set(3.5, 1.55, 1.25); v.camera.lookAt(0, .88, -.08); }
    else if (kind === 'wings') { v.camera.position.set(2.2, 4, 2.7); v.camera.lookAt(0, 1.05, -.1); }
    else { v.camera.position.set(3.3, 2.8, 5.3); v.camera.lookAt(0, kind === 'pair' && i === 1 ? 1.12 : .95, -.05); }
    v.camera.updateProjectionMatrix(); renderer.render(v.scene, v.camera);
  });
  return { triangles: renderer.info.render.triangles, calls: renderer.info.render.calls };
}
function pose(mode, time, index = 0) {
  const bug = views[index].bug; bug.mixer.stopAllAction();
  bug.mixer.clipAction(gltf.animations.find(c => c.name === mode)).reset().play();
  bug.mixer.setTime(time);
}
window.fireflyRender = { views, render, pose };
render();
`);

const compiled = await build({ root: game, configFile: false, logLevel: 'error', build: {
  write: false, minify: false, target: 'es2022', rollupOptions: { input: {
    render: fileURLToPath(new URL('index.html', cache)), preview: resolve(game, 'firefly.html'),
  } },
} });
const files = new Map(compiled.output.map(item => ['/' + item.fileName, Buffer.from(item.type === 'chunk' ? item.code : item.source)]));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary' };
const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } }), errors = [];
  await page.route('**/*', async route => {
    const url = new URL(route.request().url()), name = decodeURIComponent(url.pathname);
    let body = files.get(name);
    if (!body) {
      const publicDir = resolve(game, 'public'), path = resolve(publicDir, '.' + name);
      if (!path.startsWith(publicDir + sep)) return route.abort();
      try { body = await readFile(path); } catch (e) { if (e.code === 'ENOENT') return route.fulfill({ status: 404 }); throw e; }
    }
    await route.fulfill({ contentType: types[extname(name)] ?? 'application/octet-stream', body });
  });
  page.on('pageerror', e => errors.push(e.stack));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://127.0.0.1:5198/.cache/firefly-render/index.html');
  await page.waitForFunction(() => !!window.fireflyRender, null, { timeout: 60000 });
  const stats = await page.evaluate(() => window.fireflyRender.render());
  await page.screenshot({ path: fileURLToPath(new URL('./firefly-preview.png', import.meta.url)) });
  const detail = new URL('./kirby-game/design/firefly/', import.meta.url);
  await mkdir(detail, { recursive: true });
  await page.setViewportSize({ width: 1200, height: 1000 });
  for (const kind of ['face', 'side', 'wings']) {
    await page.evaluate(kind => window.fireflyRender.render(kind), kind);
    await page.screenshot({ path: fileURLToPath(new URL(kind + '.png', detail)) });
  }
  for (const [mode, time] of [['Sit', 3.5], ['Groom', 2.2], ['WingStretch', 3.5], ['LookAround', 2.4]]) {
    await page.evaluate(([mode, time]) => { window.fireflyRender.pose(mode, time); window.fireflyRender.render('solo'); }, [mode, time]);
    await page.screenshot({ path: fileURLToPath(new URL(mode.toLowerCase() + '.png', cache)) });
  }
  if (process.argv.includes('--animation')) {
    const frames = new URL('frames/', cache); await mkdir(frames, { recursive: true });
    await page.setViewportSize({ width: 840, height: 700 });
    await page.evaluate(() => {
      const title = document.createElement('div'); title.id = 'animation-title';
      title.style.cssText = 'position:absolute;top:25px;left:30px;font:23px system-ui;color:#e5edda;pointer-events:none';
      document.body.append(title);
    });
    let frame = 0;
    for (const [mode, start, title] of [['Sit', 2.6, 'В покое'], ['Fly', 0, 'В полёте'],
      ['LookAround', .5, 'Осматривается'], ['Groom', 4.2, 'Чистит усики'], ['WingStretch', .8, 'Расправляет крылья']]) {
      for (let n = 0; n < 48; n++) {
        await page.evaluate(([mode, t, title]) => {
          window.fireflyRender.pose(mode, t); window.fireflyRender.render('solo');
          document.querySelector('#animation-title').textContent = title;
        }, [mode, start + n / 24, title]);
        await page.screenshot({ path: fileURLToPath(new URL(String(frame++).padStart(4, '0') + '.png', frames)) });
      }
      console.log('Rendered animation: ' + mode);
    }
    await page.evaluate(() => document.querySelector('#animation-title').remove());
  }
  await page.goto('http://127.0.0.1:5198/firefly.html');
  await page.waitForFunction(() => document.querySelector('#message')?.textContent?.startsWith('Дышит'), null, { timeout: 60000 });
  for (const mode of ['fly', 'lookaround', 'groom', 'wingstretch', 'sit']) {
    await page.locator('#' + mode).click();
    if (await page.locator('.animations button[aria-pressed="true"]').getAttribute('id') !== mode) throw Error('Animation control did not select ' + mode);
  }
  await page.locator('#glow').fill('#ff77bb');
  await page.screenshot({ path: fileURLToPath(new URL('controls.png', cache)) });
  if (errors.length) throw Error(errors.join('\n'));
  console.log(JSON.stringify({ preview: 'firefly-preview.png', details: ['face', 'side', 'wings'], ...stats, errors }));
} finally {
  await browser.close();
}
