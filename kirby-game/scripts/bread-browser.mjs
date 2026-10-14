import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const game=fileURLToPath(new URL('../',import.meta.url)),output=fileURLToPath(new URL('../design/bread/game/',import.meta.url));fs.mkdirSync(output,{recursive:true});
const base=process.env.GAME_URL??'http://127.0.0.1:5185';let vite,browser;
try{
 if(!process.env.GAME_URL)vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5185','--strictPort'],{cwd:game,stdio:'ignore',windowsHide:true});
 for(let n=0;;n++){try{if((await fetch(base)).ok)break;}catch{}if(n>600)throw Error('Vite did not start');await new Promise(r=>setTimeout(r,200));}
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL|shader/i.test(m.text()))errors.push(m.text());});
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.breadTest={bread,mountainLedges,watermill,coaster,followCamera,camera,cameraTarget,renderer,scene,resolveInteraction,get character(){return character;}};'});});
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('#start-game')?.disabled===false,undefined,{timeout:120000});
 await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Пекарь');await page.locator('#start-game').click();
 await page.waitForFunction(()=>window.breadTest?.character,undefined,{timeout:30000});
 assert(await page.evaluate(()=>{const aura=window.breadTest.bread.aura;return !!aura.getObjectByName('Golden bread volume mist')&&aura.children.length===2;}),'bread uses a volume of mist and sparkles');
 const move=async(p,yaw=0)=>{
  await page.evaluate(({p,yaw})=>{const w=window.breadTest,c=w.character;c.setActivity('Idle');c.actor.position.fromArray(p);c.surfaceY=p[1];c.yaw=yaw;c.actor.rotation.set(0,yaw,0);w.mountainLedges.resetPlayer();w.mountainLedges.restorePosition(c);w.cameraTarget.copy(c.actor.position).y+=.9;w.followCamera.reset(yaw);},{p,yaw});
 };
 const breadSpawn=await page.evaluate(()=>window.breadTest.bread.state.p);
 await move(breadSpawn);await page.waitForFunction(()=>window.breadTest.bread.state.owner==='solo');
 assert.match(await page.locator('#action-hint').innerText(),/Бросить хлебушек/);
 assert.equal(await page.evaluate(()=>window.breadTest.bread.loaf.children[0].children[0].children.length>0),true);
 await page.locator('#settings-toggle').click();await page.locator('#save-game').click();
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('kirby-save-v1')).bread.owner),'solo');await page.locator('#settings-toggle').click();
 await move([49,0,42]);assert.equal(await page.evaluate(()=>window.breadTest.resolveInteraction(window.breadTest.character).text),'E — Бросить хлебушек');
 await page.keyboard.press('e');await page.waitForFunction(()=>window.breadTest.bread.state.owner==='');
 assert.equal(await page.evaluate(()=>window.breadTest.watermill.quest.stage),'idle');
 const drop=await page.evaluate(()=>window.breadTest.bread.state);await move([drop.p[0]-7,0,drop.p[2]-7]);
 await page.waitForFunction(()=>Date.now()>window.breadTest.bread.state.pickupAt);
 const resting=await page.evaluate(()=>window.breadTest.bread.loaf.position.toArray());await page.waitForTimeout(250);
 const later=await page.evaluate(()=>window.breadTest.bread.loaf.position.toArray());assert.deepEqual(resting,later);
 await page.evaluate(p=>{const w=window.breadTest,c=w.character;c.setActivity('Idle');c.actor.position.fromArray(p);c.surfaceY=p[1];w.mountainLedges.resetPlayer();c.flight.press();},drop.p);
 await page.waitForFunction(()=>window.breadTest.bread.state.owner==='solo');
 assert(await page.evaluate(()=>window.breadTest.character.flight.active),'a character can recover bread from a slope by flying up to it');
 assert.match(await page.locator('#action-hint').innerText(),/Бросить хлебушек/);
 console.log('PASS actual game: automatic pickup, hand carry, action lock, falling drop, ground rest, re-pickup and carrying save');
 // Freeze the real scene only after interaction checks; render exportable views.
 await page.evaluate(()=>{
  const w=window.breadTest;w.renderer.setAnimationLoop(null);
  document.body.replaceChildren(w.renderer.domElement);w.renderer.domElement.style.display='block';
 });
 await page.evaluate(async()=>{
  const w=window.breadTest,T=await import('/node_modules/.vite/deps/three.js');
  w.bread.reset();w.character.actor.position.set(0,0,0);w.bread.update(Date.now(),new Map());
  w.scene.add(new T.HemisphereLight('#e6f3ff','#69934d',1.7));
  const light=new T.DirectionalLight('#fff2dc',2);light.position.set(220,90,220);w.scene.add(light);
  const p=w.bread.state.p;w.camera.position.set(p[0]-13,p[1]+16,p[2]-18);w.camera.lookAt(p[0],p[1]+.8,p[2]);w.renderer.render(w.scene,w.camera);
 });
 await page.screenshot({path:output+'/summit.png'});
 await page.evaluate(()=>{
  const w=window.breadTest,p=w.bread.state.p;let rail,distance=Infinity;
  for(let i=0;i<6000;i++){const r=w.coaster.curve.getPointAt(i/6000),d=(r.x-201)**2+(r.z-232)**2;if(d<distance){rail=r;distance=d;}}
  w.camera.position.copy(rail);w.camera.position.y+=2.3;w.camera.lookAt(p[0],p[1]+1,p[2]);w.renderer.render(w.scene,w.camera);
 });
 await page.screenshot({path:output+'/cart-view.png'});
 await page.evaluate(()=>{
  const w=window.breadTest,c=w.character,p=w.bread.state.p;c.setActivity('Idle');c.actor.position.fromArray(p);c.surfaceY=p[1];c.yaw=-2.1;c.actor.rotation.set(0,c.yaw,0);c.update(0,{forward:false,left:false,right:false});w.bread.state.owner='solo';w.bread.update(Date.now(),new Map([['solo',c.actor]]));
  w.camera.position.set(p[0]-5,p[1]+3.5,p[2]-7);w.camera.lookAt(p[0],p[1]+1,p[2]);w.renderer.render(w.scene,w.camera);
 });
 await page.screenshot({path:output+'/carried.png'});
 await page.evaluate(async()=>{
  const w=window.breadTest,{GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js'),{CharacterController}=await import('/src/controller.ts');
  const gltf=await new GLTFLoader().loadAsync('/models/pigeon-animated.glb?v=15'),bird=new CharacterController(gltf.scene,gltf.animations),p=w.bread.state.p;
  w.character.actor.visible=false;bird.positionConstraint=w.mountainLedges.constrainTravel;bird.actor.position.fromArray(p);bird.actor.rotation.y=bird.yaw=-2.1;bird.update(0,{forward:false,left:false,right:false});w.scene.add(bird.actor);w.bread.update(Date.now(),new Map([['solo',bird.actor]]));
  if(w.bread.loaf.position.distanceTo(bird.actor.position)>5)throw Error('Pigeon bread attachment is too far from its wing');
  w.camera.position.set(p[0]-5,p[1]+3.5,p[2]-7);w.camera.lookAt(p[0],p[1]+1,p[2]);w.renderer.render(w.scene,w.camera);
 });
 await page.screenshot({path:output+'/pigeon-carried.png'});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({errors,output,resting,drop}));
}finally{await browser?.close();vite?.kill();}
