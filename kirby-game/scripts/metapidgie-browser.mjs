import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';

const base=process.env.GAME_URL??'http://127.0.0.1:5211',output='../../metapidgie-browser';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
page.on('pageerror',e=>errors.push(e.stack));
page.on('console',m=>{if(m.type()==='error'&&/WebGL|shader|THREE/i.test(m.text()))errors.push(m.text());});
try{
 // A portrait rendered from the actual imported model, including its native paint.
 await page.route('**/metapidgie-icon',r=>r.fulfill({contentType:'text/html',body:'<html><body style="margin:0;background:transparent"></body></html>'}));
 await page.goto(base+'/metapidgie-icon');
 await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
  const renderer=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});renderer.setSize(280,256);renderer.setPixelRatio(1);renderer.setClearColor(0,0);renderer.toneMapping=T.ACESFilmicToneMapping;
  document.body.append(renderer.domElement);
  const scene=new T.Scene(),gltf=await new GLTFLoader().loadAsync('/models/metapidgie-animated.glb');scene.add(gltf.scene);
  const mixer=new T.AnimationMixer(gltf.scene);mixer.clipAction(gltf.animations.find(c=>c.name==='Idle')).play();mixer.update(0);
  scene.add(new T.HemisphereLight('#f4f7ff','#596070',2.5));const light=new T.DirectionalLight('#fff3dd',3.4);light.position.set(3,5,5);scene.add(light);
  const box=new T.Box3().setFromObject(gltf.scene),center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3()),h=Math.max(size.y,size.x*256/280)*1.12;
  const camera=new T.OrthographicCamera(-h*280/256/2,h*280/256/2,h/2,-h/2,.01,100);
  camera.position.copy(center).add(new T.Vector3(3,1.2,5));camera.lookAt(center);renderer.render(scene,camera);
 });
 await page.locator('canvas').screenshot({path:'public/icons/metapidgie.png',omitBackground:true});
 if(process.argv.includes('--icon-only')){assert.deepEqual(errors,[]);console.log('Rendered actual Meta Pidgie portrait');process.exitCode=0;}
 else{
  await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
  for(const endpoint of ['room','players','history/solo'])await page.route('**/'+endpoint,r=>r.fulfill({json:{ok:true,players:0,occupiedVariants:[],capacity:14}}));
  await page.routeWebSocket(/^ws:\/\/127\.0\.0\.1:\d+\/(?!ws\?)/,ws=>ws.onMessage(()=>{}));
  await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.pgQA={get c(){return character},get selected(){return selected},get unlocked(){return !characterUnlocks.isLocked("Мета Пиджи")},returnToMenu,renderer,scene,camera,get flock(){return pigeonFlock}};'});});
  await page.goto(base+'/');await page.locator('#startup-loader').waitFor({state:'hidden',timeout:180000});
  await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Проверка PG');
  let button=page.locator('#variant-grid button').nth(23);await button.scrollIntoViewIfNeeded();
  assert.equal(await button.getAttribute('aria-disabled'),'true');await button.hover();
  await page.locator('#locked-character-tooltip').waitFor({state:'visible'});assert.match(await page.locator('#locked-character-tooltip').innerText(),/под серебряным шлемом/);
  await page.screenshot({path:output+'/locked.png'});await button.click({force:true});assert.equal(await button.getAttribute('aria-pressed'),'false');
  await page.locator('#variant-grid button').first().click();await page.locator('#start-game').click({timeout:180000});await page.waitForFunction(()=>window.pgQA?.c,null,{timeout:180000});
  await page.keyboard.press('Enter');await page.locator('#chat-input').fill('/unlock metap');assert.match(await page.locator('#chat-command-list').innerText(),/metapidgie/);
  await page.locator('#chat-input').fill('/unlock metapidgie');await page.keyboard.press('Enter');await page.waitForFunction(()=>pgQA.unlocked);console.log('Unlocked through real chat');
  assert.equal(await page.evaluate(()=>localStorage.getItem('kirby-metapidgie-unlocked-v1')),'1');
  await page.evaluate(()=>pgQA.returnToMenu());await page.locator('#new-game').click();button=page.locator('#variant-grid button').nth(23);await button.click();assert.equal(await button.getAttribute('aria-disabled'),'false');
  await page.locator('#start-game').click({timeout:180000});await page.waitForFunction(()=>pgQA.c?.isPigeon&&pgQA.selected[0]==='Мета Пиджи');
  const report={model:await page.evaluate(()=>({bird:pgQA.c.isPigeon,knight:pgQA.c.isMetaKnight,helmet:!!pgQA.c.actor.getObjectByName('Metapidgie_helmet_shell'),flockSkins:[...pgQA.flock?.crowds.keys()??[]]}))};
  console.log('Playing as Meta Pidgie',JSON.stringify(report.model));assert(report.model.helmet&&report.model.bird&&!report.model.knight);assert(!report.model.flockSkins.includes('metapidgie'));
  const before=await page.evaluate(()=>pgQA.c.actor.position.toArray());await page.keyboard.down('KeyW');await page.waitForTimeout(650);await page.keyboard.up('KeyW');
  report.movement=await page.evaluate(()=>pgQA.c.actor.position.toArray());assert(Math.hypot(...report.movement.map((n,i)=>n-before[i]))>.1);
  await page.waitForTimeout(300);await page.keyboard.press('Digit1');await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>pgQA.c.state),'Hello');
  await page.screenshot({path:output+'/playing.png'});
  await page.evaluate(()=>pgQA.returnToMenu());await page.reload();await page.locator('#startup-loader').waitFor({state:'hidden',timeout:180000});await page.locator('#new-game').click();
  assert.equal(await page.locator('#variant-grid button').nth(23).getAttribute('aria-disabled'),'false');
  await page.setViewportSize({width:390,height:844});button=page.locator('#variant-grid button').nth(23);await button.scrollIntoViewIfNeeded();await page.screenshot({path:output+'/mobile-picker.png'});
  report.errors=errors;assert.deepEqual(errors,[]);await writeFile(output+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }
}finally{await browser.close();}
