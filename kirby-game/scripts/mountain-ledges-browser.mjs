import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const game = fileURLToPath(new URL('../', import.meta.url));
const output = fileURLToPath(new URL('../design/mountain-ledges/', import.meta.url)); fs.mkdirSync(output, { recursive: true });
const base = process.env.GAME_URL ?? 'http://127.0.0.1:5185';
let vite, browser;
try {
  if (!process.env.GAME_URL) vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5185', '--strictPort'], { cwd: game, stdio: 'ignore', windowsHide: true });
  for (let attempt = 0; ; attempt++) {
    try { const response = await fetch(base); if (response.ok) break; } catch {}
    if (attempt > 100) throw Error('Vite did not start');
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } }), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/__mountain-ledges-preview', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><body style="margin:0"></body>' }));
  if(!process.env.SKIP_GAME_SMOKE){
    await page.addInitScript(()=>{localStorage.setItem('kirby-tutorial-completed-v1','1');});
    await page.goto(base);
    try{
      await page.waitForFunction(()=>!document.body.classList.contains('loading'),undefined,{timeout:120000});
      await page.waitForFunction(()=>document.querySelector('#start-game')?.disabled===false,undefined,{timeout:120000});
      await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Проверка');await page.locator('#start-game').click({timeout:120000});
      await page.waitForFunction(()=>!document.body.classList.contains('choosing'),undefined,{timeout:30000});
    }catch(e){await page.screenshot({path:output+'/startup-error.png'});console.log(JSON.stringify({errors,body:await page.locator('body').innerText()}));throw e;}
    assert.deepEqual(errors,[],'actual game starts with the new collision integration');
  }
  await page.goto(base + '/__mountain-ledges-preview');
  const report = await page.evaluate(async () => {
    const T = await import('/node_modules/.vite/deps/three.js');
    const { MountainLedges } = await import('/src/mountain-ledges.ts');
    const { MOUNTAIN_STEPS: steps, MOUNTAIN_SUMMIT: summit, MOUNTAIN_LEDGE_SITE: site, mountainWorld } = await import('/src/mountain-ledges-layout.ts');
    const {mountainSurfaceHeight}=await import('/src/mountain-surface.ts');
    const { addEnvironment } = await import('/src/environment.ts');
    const { Coaster } = await import('/src/coaster.ts');
    const { CharacterController } = await import('/src/controller.ts');
    const { GLTFLoader } = await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const scene = new T.Scene(); scene.background = new T.Color('#a3bfd5');
    addEnvironment(scene); const coaster = new Coaster(); scene.add(coaster.group);
    const material = scene.getObjectByName('Continuous square mountain range').material;
    const world = new MountainLedges(material); scene.add(world.group);
    const model = await new GLTFLoader().loadAsync('/models/kirby-animated.glb');
    const c = new CharacterController(model.scene, model.animations); scene.add(c.actor);
    const on = p => { const xy = mountainWorld(p.tangent, p.radial); c.positionConstraint=world.constrainTravel;c.actor.position.set(xy.x, p.y, xy.z); c.surfaceY = p.y; world.restorePosition(c); c.yaw = -Math.PI * .65; c.actor.rotation.y = c.yaw; c.update(0, { forward: false, left: false, right: false }); };
    on(steps[6]);
    const renderer = new T.WebGLRenderer({ antialias: true }); renderer.setSize(1440, 960); renderer.toneMapping = T.ACESFilmicToneMapping; renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap; document.body.append(renderer.domElement);
    scene.add(new T.HemisphereLight('#e6f3ff', '#69934d', 2.2));
    const light = new T.DirectionalLight('#fff2dc', 3.2); light.position.set(site.x - 30, 65, site.z - 25); light.target.position.set(site.x, 7, site.z); light.castShadow = true;
    light.shadow.mapSize.set(2048, 2048); light.shadow.camera.left = light.shadow.camera.bottom = -45; light.shadow.camera.right = light.shadow.camera.top = 45; light.shadow.camera.far = 180; light.shadow.normalBias = .025; scene.add(light, light.target);
    const camera = new T.PerspectiveCamera(48, 1.5, .3, 1200);
    const top = mountainWorld(summit.tangent, summit.radial);
    window.preview = { scene, renderer, camera, c, world, steps, top, coaster };
    camera.position.set(site.x - 23, 41, site.z - 27); camera.lookAt(site.x+8,16,site.z+10); renderer.render(scene, camera);
    const left=mountainWorld(summit.tangent-summit.width/2,summit.radial+summit.depth/2);
    return {steps:steps.length,topHeight:summit.y,topArea:Math.PI*(summit.width/2)**2/2,leftRockHeight:mountainSurfaceHeight(left.x,left.z),gaps:steps.slice(1).map((p,i)=>Math.hypot(p.tangent-steps[i].tangent,p.radial-steps[i].radial)),calls:renderer.info.render.calls,mountainTextureShared:world.summit.material.map===material.map,extraCliff:!!world.group.getObjectByName('Mountain corner rock buttress')};
  });
  await page.screenshot({ path: output + '/overview.png' });
  await page.evaluate(() => {
    const { renderer, scene, camera, top, coaster } = window.preview;
    let rail, distance = Infinity;
    for (let i = 0; i < 6000; i++) { const p = coaster.curve.getPointAt(i / 6000), d = (p.x - 201) ** 2 + (p.z - 232) ** 2; if (d < distance) { rail = p; distance = d; } }
    camera.position.copy(rail).add(new camera.position.constructor(0, 2.3, 0)); camera.lookAt(top.x, 26, top.z); renderer.render(scene, camera);
  });
  await page.screenshot({ path: output + '/cart-view.png' });
  await page.evaluate(()=>{const {renderer,scene,camera,top,c,world}=window.preview;const summit=world.summit;c.actor.position.set(top.x,30.72,top.z);c.surfaceY=30.72;world.restorePosition(c);camera.position.set(top.x-15,53,top.z-21);camera.lookAt(top.x,30.72,top.z);renderer.render(scene,camera);});
  await page.screenshot({path:output+'/summit.png'});
  await page.evaluate(()=>{const {c,world,steps}=window.preview;const p=steps[6],angle=Math.PI/4;c.actor.position.set(world.group.position.x+(p.tangent+p.radial)/Math.SQRT2,p.y,world.group.position.z+(p.radial-p.tangent)/Math.SQRT2);c.surfaceY=p.y;world.restorePosition(c);});
  const trap = await page.evaluate(() => {
    const { renderer, scene, camera, world, c, steps } = window.preview;
    for (let frame = 0; frame < 235; frame++) { const old = c.actor.position.clone(); world.update(1 / 60, [c]); c.update(1 / 60, { forward: false, left: false, right: false }); world.apply(c, old, 1 / 60); }
    camera.position.set(223.55,41,219.55);camera.lookAt(254.55,16,256.55);renderer.render(scene,camera);
    return { phase: world.steps[6].phase, visible: world.steps[6].mesh.visible, height: c.actor.position.y, originalHeight: steps[6].y };
  });
  await page.screenshot({ path: output + '/trap-retracted.png' });
  assert(report.mountainTextureShared);assert(!report.extraCliff);assert.equal(report.topHeight,30.72);assert(Math.abs(report.topArea-110.88)<1e-8);assert(report.leftRockHeight>=report.topHeight-.001);assert(report.gaps.every(g=>g>0&&g<12));assert.equal(trap.phase,'hidden');assert(!trap.visible);assert(trap.height<trap.originalHeight);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({ report, trap, errors, output }));
} finally { if (browser) await browser.close(); if (vite) vite.kill(); }
