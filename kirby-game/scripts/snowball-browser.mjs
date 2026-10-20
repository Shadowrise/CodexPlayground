import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';

const game=fileURLToPath(new URL('../',import.meta.url)),output=fileURLToPath(new URL('../node_modules/.cache/snowball/',import.meta.url));
const base=process.env.GAME_URL??'http://127.0.0.1:5199';let vite,browser;
try{
 await mkdir(output,{recursive:true});
 if(!process.env.GAME_URL){
  vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5199','--strictPort'],{cwd:game,stdio:'inherit',windowsHide:true});
  vite.on('error',error=>console.error(error.message));
 }
 for(let n=0;;n++){try{if((await fetch(base,{signal:AbortSignal.timeout(1000)})).ok)break;}catch{}if(n>120)throw Error('Vite did not start');await new Promise(r=>setTimeout(r,200));}
 console.log('Local server ready');
 browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:850}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL|shader/i.test(m.text()))errors.push(m.text());});
 page.on('dialog',dialog=>dialog.accept());
 await page.routeWebSocket('**',()=>{});
 await page.route('**/room',route=>route.fulfill({json:{players:0,occupiedVariants:[],capacity:14}}));
 await page.route('**/history/solo',route=>route.fulfill({json:{ok:true}}));
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
 await page.route('**/src/main.ts*',async route=>{
  const response=await route.fetch();await route.fulfill({response,body:(await response.text())+`
let snowUnlockSounds=0;const snowUnlockSound=sounds.playCharacterUnlock.bind(sounds);sounds.playCharacterUnlock=()=>{snowUnlockSounds++;snowUnlockSound();};
window.snowQA={get c(){return character},get playing(){return playing},get selected(){return selected},get birds(){return wildBirds},get unlockSounds(){return snowUnlockSounds},get log(){return localLog},set online(value){networkIntent=value},bread,resolveInteraction,sendBread,returnToMenu,captureWorld,pidgieSafeGround,pidgieSafeWalk,renderer,scene,camera,followCamera,cameraTarget,mountainLedges,progress:characterUnlocks,get model(){return loadedModel},get pigeon(){return loadedPigeon},createPlayerModel,KIRBY_VARIANTS};`});
 });
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('#start-game')?.disabled===false,undefined,{timeout:120000});
 console.log('Game loaded');
 await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Пекарь');
 const snow=page.locator('#variant-grid .snowball-character');
 assert.equal(await snow.getAttribute('aria-disabled'),'true');await snow.click({force:true});
 assert.match(await page.locator('#locked-character-tooltip').innerText(),/Снежка хлебушком/);
 assert.equal(await page.evaluate(()=>snowQA.selected[0]),'Классический');
 await page.screenshot({path:output+'/snowball-locked.png'});
 await page.locator('#variant-grid .variant-button').first().click();await page.locator('#start-game').click();
 await page.waitForFunction(()=>snowQA.playing&&snowQA.birds.size===2);
 if(process.argv.includes('--unlock-command-only')){
  const achievements=await page.evaluate(()=>[...snowQA.c.achievements]);
  await page.evaluate(()=>{snowQA.online=true;});await page.keyboard.press('Enter');await page.locator('#chat-input').fill('/unlock snowball');
  assert(await page.locator('#chat-command-list').isHidden());await page.keyboard.press('Enter');assert(await page.locator('#chat-command-error').isVisible());
  assert.equal(await page.evaluate(()=>localStorage.getItem('kirby-snowball-unlocked-v1')),null);
  await page.evaluate(()=>{snowQA.online=false;});await page.locator('#chat-input').fill('/unlock sno');
  assert.deepEqual(await page.locator('#chat-command-list code').allTextContents(),['snowball']);
  await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
  await page.waitForFunction(()=>localStorage.getItem('kirby-snowball-unlocked-v1')==='1');
  await page.locator('#character-unlock').waitFor({state:'visible'});assert.match(await page.locator('#character-unlock').innerText(),/Снежок/);
  assert.equal(await page.evaluate(()=>snowQA.unlockSounds),1);assert.equal(await page.evaluate(()=>localStorage.getItem('kirby-pidgie-unlocked-v1')),null);
  assert.equal(await page.evaluate(()=>localStorage.getItem('kirby-bandana-unlocked-v1')),null);
  assert.deepEqual(await page.evaluate(()=>[...snowQA.c.achievements]),achievements);
  await page.keyboard.press('Enter');await page.locator('#chat-input').fill('/unlock snowball');await page.keyboard.press('Enter');await page.waitForTimeout(150);
  assert.equal(await page.evaluate(()=>snowQA.unlockSounds),1);assert(!(await page.evaluate(()=>snowQA.log)).some(m=>m.text.startsWith('/unlock')));
  await page.evaluate(()=>snowQA.returnToMenu());await page.reload();await page.waitForFunction(()=>document.querySelector('#start-game')?.disabled===false,undefined,{timeout:120000});
  await page.locator('#new-game').click();assert.equal(await snow.getAttribute('aria-disabled'),'false');await snow.click();assert.equal(await page.evaluate(()=>snowQA.selected[0]),'Снежок');
  assert.deepEqual(errors,[]);console.log('PASS: /unlock snowball suggestions, online gating, one announcement, independent persisted unlock and selectable character after reload');
 }else{
 const world=await page.evaluate(async()=>{const {validWorld}=await import('/src/network-protocol.ts'),w=snowQA.captureWorld();return {valid:validWorld(w),bytes:JSON.stringify(w).length,keys:Object.keys(w)};});
 assert(world.valid,JSON.stringify(world));assert(world.keys.includes('snowball'));
 const site=await page.evaluate(()=>{
  for(let z=-210;z<=210;z+=15)for(let x=-210;x<=210;x+=15)if(Array.from({length:13},(_,i)=>snowQA.pidgieSafeGround(x,z+i*.5)).every(Boolean))return [x,0,z];
  throw Error('No clear test site');
 });
 const stage=async(id,hasBread)=>page.evaluate(async({site,id,hasBread})=>{
  const w=snowQA,c=w.c;c.setActivity('Idle');c.actor.position.fromArray(site);c.surfaceY=0;c.yaw=0;c.actor.rotation.set(0,0,0);w.mountainLedges.resetPlayer();
  for(const [kind,{npc}] of w.birds){
   const p=[site[0]+(kind===id?0:30),0,site[2]+4];
   npc.applyNetworkState({...npc.networkState(),phase:'wander',p,yaw:Math.PI,elapsed:0,refuge:[p[0],p[2]],target:[p[0],p[2]],clip:'Idle',clipTime:0,pause:1,cooldown:0,followId:undefined,followSpeed:undefined,friend:undefined},true);
  }
  if(hasBread){const {grantBread}=await import('/src/bread-state.ts');w.bread.state=grantBread(w.bread.state,{id:'solo',p:site,yaw:0,size:1,available:true},Date.now());}
 },{site,id,hasBread});
 await stage('snowball',true);
 await page.waitForFunction(()=>snowQA.resolveInteraction(snowQA.c)?.text==='E — Угостить дикого Снежка');
 await page.keyboard.press('e');await page.waitForFunction(()=>localStorage.getItem('kirby-snowball-unlocked-v1')==='1');
 assert.equal(await page.evaluate(()=>localStorage.getItem('kirby-pidgie-unlocked-v1')),null);
 await page.waitForFunction(()=>snowQA.birds.get('snowball').npc.phase==='feast');
 assert.equal(await page.evaluate(()=>snowQA.bread.state.offering.target),'snowball');
 await page.screenshot({path:output+'/snowball-unlocked.png'});
 await page.locator('#settings-toggle').click();await page.locator('#save-game').click();
 const save=await page.evaluate(()=>JSON.parse(localStorage.getItem('kirby-save-v1')));
 assert.equal(save.snowball.phase,'feast');assert(save.pidgie);assert(save.player.achievements.includes('snowballFriend'));
 await page.evaluate(()=>snowQA.returnToMenu());await page.locator('#load-game').click();
 await page.waitForFunction(()=>snowQA.playing&&snowQA.birds.get('snowball').npc.phase==='feast');
 await page.evaluate(()=>snowQA.returnToMenu());await page.locator('#new-game').click();
 assert.equal(await snow.getAttribute('aria-disabled'),'false');await snow.click();await page.locator('#start-game').click();
 await page.waitForFunction(()=>snowQA.playing&&snowQA.c.isPigeon&&snowQA.selected[0]==='Снежок');
 await stage('pidgie',false);
 await page.waitForFunction(()=>snowQA.birds.get('pidgie').npc.phase==='greet');
 assert.equal(await page.evaluate(()=>snowQA.birds.get('pidgie').npc.fearCount),0);
 await stage('pidgie',true);await page.waitForFunction(()=>snowQA.resolveInteraction(snowQA.c)?.text==='E — Угостить дикого Пиджи');
 await page.keyboard.press('e');await page.waitForFunction(()=>localStorage.getItem('kirby-pidgie-unlocked-v1')==='1');
 await page.evaluate(()=>snowQA.returnToMenu());await page.locator('#new-game').click();await page.locator('#variant-grid .pigeon-character:not(.snowball-character)').click();await page.locator('#start-game').click();
 await page.waitForFunction(()=>snowQA.playing&&snowQA.selected[0]==='Пиджи');await stage('snowball',false);
 await page.waitForFunction(()=>snowQA.birds.get('snowball').npc.phase==='greet');
 assert.equal(await page.evaluate(()=>snowQA.birds.get('snowball').npc.fearCount),0);
 // Render both authored rigs under identical lighting for visual inspection.
 await page.evaluate(async()=>{
  const w=snowQA,T=await import('/node_modules/.vite/deps/three.js');w.renderer.setAnimationLoop(null);
  document.body.replaceChildren(w.renderer.domElement);w.renderer.setSize(1280,850);w.renderer.setPixelRatio(1);
  const scene=new T.Scene();scene.background=new T.Color('#cee2ef');scene.add(new T.HemisphereLight('#ffffff','#8b9fa9',2.3));
  const light=new T.DirectionalLight('#fff2dd',3.3);light.position.set(4,8,6);scene.add(light);
  const ground=new T.Mesh(new T.PlaneGeometry(80,80),new T.MeshStandardMaterial({color:'#b4c6c7',roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.01;scene.add(ground);
  for(const [name,x] of [['Пиджи',-1.8],['Снежок',1.8]]){
   const rig=w.createPlayerModel(w.model,w.KIRBY_VARIANTS.find(v=>v[0]===name),w.pigeon);rig.model.position.x=x;rig.model.rotation.y=.4;scene.add(rig.model);
  }
  const camera=new T.PerspectiveCamera(34,1280/850,.1,100);camera.position.set(8,4.5,12);camera.lookAt(0,1.25,0);w.renderer.render(scene,camera);
 });
 await page.screenshot({path:output+'/pigeons.png'});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({result:'PASS: locked menu, targeted feeding, independent durable unlocks, save/load, both social directions, native player models and GPU shaders',world,output}));
 }
}finally{await browser?.close();vite?.kill();}
