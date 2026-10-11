import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';

const base = process.env.GAME_URL ?? 'http://127.0.0.1:5174';
const berries = process.env.FRUIT_PREVIEW_SET === 'berries';
const names = berries ? ['cherry', 'grapes'] : ['peach', 'orange', 'watermelon', 'pear'];
const output = process.env.TEMP + (berries ? '/kirby-detailed-berries' : '/kirby-detailed-fruits');
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 700 } }), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && /THREE|WebGL|shader/i.test(m.text())) errors.push(m.text()); });
  await page.route('**/fruit-model-preview', route => route.fulfill({ contentType: 'text/html', body: '<body style="margin:0;background:#283e32"></body>' }));
  for (const file of ['fruits', 'watermelon']) {
    const source = execFileSync('git', ['show', `HEAD:kirby-game/src/${file}.ts`], { encoding: 'utf8', cwd: '..' });
    const body = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
      .replace(/from\s+(['"])([^'"]+)\1/g, (_, quote, spec) => {
        if (spec === 'three') return "from '/node_modules/.vite/deps/three.js'";
        if (spec === './watermelon') return "from '/src/watermelon-fruit-before.ts'";
        if (spec.startsWith('./')) return `from '/src/${spec.slice(2)}.ts'`;
        throw Error('Unexpected baseline import: ' + spec);
      });
    await page.route(`**/src/${file}-fruit-before.ts`, route => route.fulfill({ contentType: 'application/javascript', body }));
  }
  await page.goto(base + '/fruit-model-preview');
  const budget = await page.evaluate(async berries => {
    const T = await import('/node_modules/.vite/deps/three.js');
    const { makePeach } = await import('/src/peach.ts'), { makeOrange } = await import('/src/orange.ts');
    const { makePear } = await import('/src/pear.ts'), { makeWatermelon } = await import('/src/watermelon.ts');
    const { makeCherry } = await import('/src/cherry.ts'), { makeGrapes } = await import('/src/grapes.ts');
    const { FruitWorld } = await import('/src/fruits.ts'), { FruitWorld: BeforeWorld } = await import('/src/fruits-fruit-before.ts');
    const { prepareSurfaceTextures } = await import('/src/texture-filtering.ts');
    const count = root => {
      let calls = 0, triangles = 0;
      root.traverse(o => { if (o.isMesh) { calls++; triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1); } });
      return { calls, triangles };
    };
    const before = new BeforeWorld(), after = new FruitWorld();
    const result = { before: count(before.group), after: count(after.group), models: [] };
    const scene = new T.Scene(); scene.background = new T.Color('#cbdad0');
    const ground = new T.Mesh(new T.PlaneGeometry(100, 100), new T.MeshLambertMaterial({ color: '#829274' }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -.01; ground.receiveShadow = true; scene.add(ground);
    const key = new T.DirectionalLight('#fff1df', 3); key.position.set(-4, 8, 6); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = -8; key.shadow.camera.right = 8;
    key.shadow.camera.top = 6; key.shadow.camera.bottom = -6; key.shadow.normalBias = .03;
    scene.add(key, new T.HemisphereLight('#d7e5ee', '#798064', 1.2));
    const fruits = [];
    const makers = berries ? [makeCherry, makeGrapes] : [makePeach, makeOrange, makeWatermelon, makePear];
    for (const [i, make] of makers.entries()) {
      const fruit = make(), box = new T.Box3().setFromObject(fruit);
      fruit.position.set((i - (makers.length - 1) / 2) * 3.2, -box.min.y * 2.6, 0); fruit.scale.setScalar(2.6);
      fruit.rotation.y = !berries && i === 2 ? -.12 : -.27;
      fruit.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; prepareSurfaceTextures(o.material, 4); } });
      scene.add(fruit); fruits.push(fruit);
      result.models.push({ name: fruit.name, ...count(fruit), size: box.getSize(new T.Vector3()).toArray() });
    }
    const renderer = new T.WebGLRenderer({ antialias: true }); renderer.setSize(1440, 700); renderer.setPixelRatio(1.25);
    renderer.toneMapping = T.ACESFilmicToneMapping; renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    document.body.append(renderer.domElement);
    const camera = new T.PerspectiveCamera(35, 1440 / 700, .1, 100);
    camera.position.set(0, berries ? 3.7 : 4.4, berries ? 9 : 13); camera.lookAt(0, 1.05, 0);
    renderer.render(scene, camera);
    window.fruitPreview = { scene, renderer, camera, fruits, before, after, key, berries,
      kinds: berries ? [9, 6] : [8, 4, 2, 3] };
    return result;
  }, berries);
  await page.screenshot({ path: output + '-day.png' });
  for (let i = 0; i < names.length; i++) {
    await page.evaluate(i => {
      const { scene, renderer, camera, fruits, berries } = window.fruitPreview;
      fruits.forEach((fruit, j) => fruit.visible = i === j);
      const target = fruits[i].position.clone().add(new camera.position.constructor(0, berries ? 1.2 : i === 3 ? 1.25 : .95, 0));
      camera.position.copy(target).add(new camera.position.constructor(!berries && i === 2 ? -1.5 : .8, 1.25, 4.8));
      camera.lookAt(target); renderer.render(scene, camera);
    }, i);
    await page.screenshot({ path: output + '-' + names[i] + '.png' });
  }
  const instanceState = await page.evaluate(() => {
    const { after, renderer, camera, scene, kinds, berries } = window.fruitPreview;
    // Put one of each rebuilt species in view, with the actual production batches.
    window.fruitPreview.fruits.forEach(fruit => fruit.visible = false);
    after.fruits.forEach(fruit => fruit.object.visible = false); after.syncInstances();
    kinds.forEach((kind, i) => {
      const fruit = after.fruits[kind]; fruit.object.visible = true;
      fruit.object.position.set((i - (kinds.length - 1) / 2) * 3.2, 0, 0); fruit.object.scale.setScalar(2.6);
      fruit.object.rotation.y = !berries && i === 2 ? -.12 : -.27;
      fruit.object.getObjectByName('Fruit colored mist').visible = false;
    });
    after.syncInstances(); scene.add(after.group);
    camera.position.set(0, berries ? 3.7 : 4.4, berries ? 9 : 13); camera.lookAt(0, 1.05, 0); renderer.render(scene, camera);
    const meshes = after.group.children.filter(o => o.isInstancedMesh);
    const before = meshes.reduce((sum, mesh) => sum + mesh.instanceMatrix.version, 0);
    after.syncInstances();
    if (meshes.reduce((sum, mesh) => sum + mesh.instanceMatrix.version, 0) !== before) throw Error('Static fruit matrices are being uploaded every frame');
    window.fruitPreview.pickupState = after.fruits.map((_, i) => kinds.includes(i));
    for (const mesh of meshes) {
      for (let i = 0; i < mesh.count; i++) if (mesh.instanceMatrix.array.slice(i * 16, i * 16 + 16).some(n => !Number.isFinite(n))) throw Error('Invalid fruit instance matrix');
    }
    return { batches: meshes.length, matrixUploadsOnUnchangedFrame: 0 };
  });
  await page.screenshot({ path: output + '-instanced.png' });
  instanceState.remainingAfterPickup = await page.evaluate(() => {
    const { after, pickupState, kinds } = window.fruitPreview; after.restore(pickupState, 0);
    if (after.remaining !== 70 - kinds.length) throw Error('Collected fruit state was not restored correctly');
    return after.remaining;
  });
  console.log(JSON.stringify({ ...budget, instanceState, errors, screenshots: output + '-*.png' }, null, 2));
  if (errors.length) throw Error(errors.join('\n'));
} finally { await browser.close(); }
