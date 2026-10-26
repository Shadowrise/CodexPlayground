import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.GAME_URL ?? 'http://127.0.0.1:5174';
const output = new URL('../node_modules/.cache/health-heart/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const errors = [], report = {};
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(base + '/health-heart-preview.html');
  await page.locator('#loading').waitFor({ state: 'hidden' });
  await page.locator('#pause').click();
  await page.screenshot({ path: new URL('preview.png', output).pathname.replace(/^\/(\w:)/, '$1') });
  report.initial = await page.evaluate(() => {
    const { heart, renderer } = window.healthHeartPreview;
    if (!heart.aura.visible || !heart.glints.visible) throw Error('Pickup effects missing');
    return { draws: renderer.info.render.calls, triangles: renderer.info.render.triangles };
  });
  if (report.initial.draws !== 3) throw Error('Expected three draws for the complete pickup: ' + JSON.stringify(report.initial));
  for (const view of ['front', 'side', 'back', 'three']) {
    await page.locator(`[data-view="${view}"]`).click();
    await page.screenshot({ path: new URL(view + '.png', output).pathname.replace(/^\/(\w:)/, '$1') });
  }
  await page.locator('[data-mode="carried"]').click();
  await page.locator('#mist').uncheck(); await page.locator('#glints').uncheck();
  await page.waitForFunction(() => {
    const { heart, renderer } = window.healthHeartPreview;
    return !heart.floating && heart.visual.position.y === 0 && renderer.info.render.calls === 1;
  });
  await page.screenshot({ path: new URL('solid.png', output).pathname.replace(/^\/(\w:)/, '$1') });
  report.glb = await page.evaluate(async () => {
    const { GLTFLoader } = await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const { scene, heart, renderer, camera } = window.healthHeartPreview;
    const gltf = await new GLTFLoader().loadAsync('/models/health-heart.glb');
    heart.group.visible = false; scene.add(gltf.scene); renderer.render(scene, camera);
    let meshes = 0; gltf.scene.traverse(object => { if (object.isMesh) meshes++; });
    const result = { meshes, draws: renderer.info.render.calls, triangles: renderer.info.render.triangles };
    await new Promise(resolve => requestAnimationFrame(resolve));
    return result;
  });
  await page.screenshot({ path: new URL('imported-glb.png', output).pathname.replace(/^\/(\w:)/, '$1') });
  if (report.glb.meshes !== 1 || report.glb.triangles !== 5952) throw Error('GLB is incomplete');
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce', isMobile: true, hasTouch: true });
  mobile.on('pageerror', error => errors.push(error.message));
  await mobile.goto(base + '/health-heart-preview.html');
  await mobile.locator('#loading').waitFor({ state: 'hidden' });
  if (await mobile.locator('#pause').getAttribute('aria-pressed') !== 'true') throw Error('Reduced motion ignored');
  report.mobile = await mobile.evaluate(() => ({ width: innerWidth, contentWidth: document.documentElement.scrollWidth }));
  if (report.mobile.width !== report.mobile.contentWidth) throw Error('Mobile horizontal overflow');
  await mobile.screenshot({ path: new URL('mobile.png', output).pathname.replace(/^\/(\w:)/, '$1'), fullPage: true });
  const download = await page.locator('.download').getAttribute('href');
  const response = await page.request.get(base + download);
  if (!response.ok()) throw Error('Model download failed');
  report.bytes = (await response.body()).byteLength;
  report.errors = errors;
  await writeFile(new URL('report.json', output), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (errors.length) throw Error(errors.join('\n'));
} finally { await browser.close(); }
