import {chromium} from '../../../node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const out = fileURLToPath(new URL('.', import.meta.url));
const base = 'http://127.0.0.1:5184/meta-knight-preview.html';
const browser = await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
  const page = await browser.newPage({viewport:{width:1600,height:1040},deviceScaleFactor:1});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const glbResponsePromise = page.waitForResponse(response => /models\/meta-knight-animated\.glb/.test(response.url()));
  await page.goto(base + '?revision=3&clip=Idle&time=0', {waitUntil:'networkidle', timeout:60000});
  const glbResponse = await glbResponsePromise;
  const asset = {url:glbResponse.url(),status:glbResponse.status(),bytes:(await glbResponse.body()).byteLength};
  await page.waitForFunction(() => window.__metaKnightPreview, {timeout:60000});
  await page.evaluate(() => {
    const t = window.__metaKnightPreview;
    t.renderer.setAnimationLoop(null);
    t.controls.enableDamping = false;
    t.sample('Idle',0);
  });
  const canvas = page.locator('#stage canvas');
  const capture = async (name, clip = 'Idle', time = 0, view = 'three') => {
    await page.evaluate(({clip,time,view}) => {
      const t = window.__metaKnightPreview;
      t.sample(clip,time);
      t.selectView(view);
      t.renderer.render(t.scene,t.camera);
    },{clip,time,view});
    await canvas.screenshot({path:out + name + '.png'});
  };
  for (const [name,clip,time,view] of [
    ['three','Idle',.4,'three'],['front','Idle',.4,'front'],['side','Idle',.4,'side'],
    ['walk','Walk',.26,'three'],['sitting','Sitting',.6,'three'],
    ['sitting-front','Sitting',.6,'front'],['sitting-side','Sitting',.6,'side'],
  ]) await capture(name,clip,time,view);
  const custom = async (name, targetName, offset, distance, clip='Idle',time=.4) => {
    await page.evaluate(({targetName,offset,distance,clip,time}) => {
      const t = window.__metaKnightPreview;
      t.sample(clip,time);
      const target=t.controls.target.clone();
      if(targetName==='mask') {
        t.model.getObjectByName('Body_motion').getWorldPosition(target);
        target.y+=.12;target.z+=.6;
      } else if(targetName) t.model.getObjectByName(targetName).getWorldPosition(target);
      else t.bounds.getCenter(target);
      const direction=target.clone().set(...offset).normalize();
      t.controls.minDistance=.1;t.controls.maxDistance=100;
      t.controls.target.copy(target);
      t.camera.position.copy(target).addScaledVector(direction,distance);
      t.camera.lookAt(target);t.controls.update();
      t.renderer.render(t.scene,t.camera);
    },{targetName,offset,distance,clip,time});
    await canvas.screenshot({path:out + name + '.png'});
  };
  await custom('back',undefined,[.12,.16,-1],8.6);
  await custom('cape-back',undefined,[-.65,.1,-1],6.9);
  await custom('mask','mask',[.05,.04,1],3.2);
  await custom('grip-front','Right_gauntlet',[.18,.1,1],2.5);
  await custom('grip-side','Right_gauntlet',[1,.15,.4],2.5);
  await custom('free-fist','Left_gauntlet',[-.35,.1,1],2.3);
  await page.evaluate(() => document.querySelectorAll('#stage > :not(canvas)').forEach(e => e.style.visibility='hidden'));
  await capture('cleanportrait','Idle',.4,'three');
  const audit = await page.evaluate(() => {
    const t=window.__metaKnightPreview;
    const durations=t.model.animations.map(c=>({name:c.name,duration:c.duration}));
    const meshes=[];t.model.traverse(o=>{if(o.isMesh)meshes.push({name:o.name,parent:o.parent.name,vertices:o.geometry.attributes.position.count});});
    return {clips:durations,meshes,bounds:{min:t.bounds.min.toArray(),max:t.bounds.max.toArray()}};
  });
  await writeFile(out+'browser-audit.json',JSON.stringify({...audit,asset,errors},null,2));
  if(errors.length) throw new Error(errors.join('\n'));
  console.log(JSON.stringify({output:out,screenshots:14,clips:audit.clips,asset,errors}));
} finally {await browser.close();}
