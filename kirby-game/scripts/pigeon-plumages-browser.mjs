import {chromium} from 'playwright';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';

const game=fileURLToPath(new URL('../',import.meta.url)),output=fileURLToPath(new URL('../node_modules/.cache/pigeon-plumages/',import.meta.url));
const base=process.env.GAME_URL??'http://127.0.0.1:5198';let vite,browser;
try{
 await mkdir(output,{recursive:true});
 if(!process.env.GAME_URL){vite=await createServer({root:game,server:{host:'127.0.0.1',port:5198,strictPort:true,hmr:false}});await vite.listen();}
 browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL|shader/i.test(m.text()))errors.push(m.text());});
 page.on('dialog',dialog=>dialog.accept());await page.routeWebSocket('**',()=>{});
 await page.route('**/room',route=>route.fulfill({json:{players:0,occupiedVariants:[],capacity:14}}));
 await page.route('**/history/session',route=>route.fulfill({json:{ok:true}}));
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
 await page.route('**/src/main.ts*',async route=>{
  const response=await route.fetch();await route.fulfill({response,body:(await response.text())+`
window.plumageQA={get c(){return character},get playing(){return playing},get selected(){return selected},get birds(){return wildBirds},set online(value){networkIntent=value},chat,bread,resolveInteraction,returnToMenu,captureWorld,pidgieSafeGround,renderer,scene,mountainLedges,get models(){return loadedPlumages},get model(){return loadedModel},createPlayerModel,KIRBY_VARIANTS};`});
 });
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.plumageQA?.models&&document.querySelector('#start-game')?.disabled===false,undefined,{timeout:120000});
 console.log('Game loaded');
 for(const [locale,cinder,ginger,king] of [['en','Cinder','Ginger','Coo King'],['bg','Въгленчо','Рижко','Гуругурко'],['ru','Уголёк','Рыжик','Курлык']]){
  await page.locator(`#startup-menu [data-language="${locale}"]`).click();await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Пекарь');
  for(const [id,name] of [['ugolyok',cinder],['ryzhik',ginger],['kurlyk',king]]){
   const button=page.locator(`#variant-grid .${id}-character`);assert.equal(await button.getAttribute('aria-disabled'),'true');assert.equal(await button.getAttribute('aria-label'),name);assert((await button.innerText()).includes(name));await button.click({force:true});
   assert((await page.locator('#locked-character-tooltip').innerText()).includes(name));assert.equal(await page.evaluate(()=>plumageQA.selected[0]),'Классический');
  }
  await page.screenshot({path:output+`/locked-menu-${locale}.png`});await page.locator('#character-back').click();
 }
 await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Пекарь');
 await page.screenshot({path:output+'/locked-menu.png'});await page.locator('#variant-grid .variant-button').first().click();await page.locator('#start-game').click();
 await page.waitForFunction(()=>plumageQA.playing&&plumageQA.birds.size===5);
 const world=await page.evaluate(async()=>{const {validWorld}=await import('/src/network-protocol.ts'),w=plumageQA.captureWorld();return {valid:validWorld(w),bytes:JSON.stringify(w).length,keys:Object.keys(w)};});assert(world.valid,JSON.stringify(world));
 if(process.argv.includes('--commands-only')){
  const achievements=await page.evaluate(()=>[...plumageQA.c.achievements]);
  for(const [id,alias,name] of [['ugolyok','cinder','Уголёк'],['ryzhik','ginger','Рыжик'],['kurlyk','coo-king','Курлык']]){
   await page.evaluate(()=>{plumageQA.online=true;plumageQA.chat.show();});await page.locator('#chat-input').fill(`/unlock ${alias}`);await page.keyboard.press('Enter');
   assert(await page.locator('#chat-command-error').isVisible());assert.equal(await page.evaluate(id=>localStorage.getItem(`kirby-${id}-unlocked-v1`),id),null);
   await page.evaluate(()=>{plumageQA.online=false;});await page.locator('#chat-input').fill(`/unlock ${alias.slice(0,3)}`);
   assert.deepEqual(await page.locator('#chat-command-list code').allTextContents(),[alias]);await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
   await page.waitForFunction(id=>localStorage.getItem(`kirby-${id}-unlocked-v1`)==='1',id);
   await page.locator('#character-unlock').waitFor({state:'visible'});assert((await page.locator('#character-unlock').innerText()).includes(name));await page.locator('#character-unlock').click();await page.locator('#character-unlock').waitFor({state:'hidden'});
   await page.evaluate(()=>plumageQA.chat.show());await page.locator('#chat-input').fill(`/unlock ${alias}`);await page.keyboard.press('Enter');assert(await page.locator('#character-unlock').isHidden());
   assert.deepEqual(await page.evaluate(()=>[...plumageQA.c.achievements]),achievements);
  }
  await page.evaluate(()=>plumageQA.returnToMenu());await page.reload();await page.waitForFunction(()=>window.plumageQA?.models,undefined,{timeout:120000});await page.locator('#new-game').click();
  for(const id of ['ugolyok','ryzhik','kurlyk'])assert.equal(await page.locator(`#variant-grid .${id}-character`).getAttribute('aria-disabled'),'false');
  assert.deepEqual(errors,[]);console.log('PASS: all three slash commands, autocomplete, online restrictions, repeated commands, no achievement changes and persisted selectable characters');
 }else{
 if(!process.argv.includes('--textures-only')){
 const site=await page.evaluate(()=>{
  for(let z=-210;z<=210;z+=15)for(let x=-210;x<=210;x+=15)if(Array.from({length:13},(_,i)=>plumageQA.pidgieSafeGround(x,z+i*.5)).every(Boolean))return [x,0,z];
  throw Error('No clear test site');
 });
 for(const [id,obj] of [['ugolyok','Уголька'],['ryzhik','Рыжика'],['kurlyk','Курлыка']]){
  await page.evaluate(async({id,site})=>{
   const {grantBread}=await import('/src/bread-state.ts');
   const w=plumageQA,c=w.c;
   if([...w.birds.values()].some(({npc})=>npc.networkState().friend)){
    search:for(let z=-210;z<=210;z+=15)for(let x=-210;x<=210;x+=15){
     if(!Array.from({length:13},(_,i)=>w.pidgieSafeGround(x,z+i*.5)).every(Boolean))continue;
     if([...w.birds.values()].some(({npc})=>npc.networkState().friend&&Math.hypot(npc.actor.position.x-x,npc.actor.position.z-z)<30))continue;
     site=[x,0,z];break search;
    }
   }
   c.setActivity('Idle');c.actor.position.fromArray(site);c.surfaceY=0;c.yaw=0;c.actor.rotation.set(0,0,0);w.mountainLedges.resetPlayer();
   for(const [kind,{npc}] of w.birds){
    if(npc.networkState().friend)continue;
    const p=[site[0]+(kind===id?0:35),0,site[2]+4];
    npc.applyNetworkState({...npc.networkState(),phase:'wander',p,yaw:Math.PI,elapsed:0,refuge:[p[0],p[2]],target:[p[0],p[2]],clip:'Idle',clipTime:0,pause:1,cooldown:0,followId:undefined,followSpeed:undefined,friend:undefined},true);
   }
   w.bread.state=grantBread(w.bread.state,{id:'solo',p:site,yaw:0,size:1,available:true},Date.now());
  },{id,site});
  console.log('Staged',id,await page.evaluate(()=>({prompt:plumageQA.resolveInteraction(plumageQA.c)?.text,state:plumageQA.c.state,player:plumageQA.c.actor.position.toArray(),bread:plumageQA.bread.state.owner,birds:[...plumageQA.birds].map(([id,{npc}])=>({id,phase:npc.phase,p:npc.actor.position.toArray()}))})));
  await page.waitForFunction(text=>plumageQA.resolveInteraction(plumageQA.c)?.text===text,`E — Угостить дикого ${obj}`);
  await page.keyboard.press('e');await page.waitForFunction(id=>localStorage.getItem(`kirby-${id}-unlocked-v1`)==='1',id);
  await page.waitForFunction(id=>plumageQA.birds.get(id).npc.phase==='feast',id);
  await page.locator('#character-unlock').waitFor({state:'visible'});await page.screenshot({path:output+`/${id}-unlocked.png`});
  await page.locator('#character-unlock').click();await page.locator('#character-unlock').waitFor({state:'hidden'});
  assert.equal(await page.evaluate(()=>localStorage.getItem('kirby-pidgie-unlocked-v1')),null);assert.equal(await page.evaluate(()=>localStorage.getItem('kirby-snowball-unlocked-v1')),null);
 }
 await page.locator('#settings-toggle').click();await page.locator('#save-game').click();
 const save=await page.evaluate(()=>JSON.parse(localStorage.getItem('kirby-save-v1')));
 for(const id of ['ugolyok','ryzhik','kurlyk']){assert.equal(save[id].phase,'feast');assert(save.player.achievements.includes(id+'Friend'));}
 await page.evaluate(()=>plumageQA.returnToMenu());await page.locator('#load-game').click();
 await page.waitForFunction(()=>plumageQA.playing&&['ugolyok','ryzhik','kurlyk'].every(id=>plumageQA.birds.get(id).npc.phase==='feast'));
 for(const [id,name] of [['ugolyok','Уголёк'],['ryzhik','Рыжик'],['kurlyk','Курлык']]){
  await page.evaluate(()=>plumageQA.returnToMenu());await page.locator('#new-game').click();const button=page.locator(`#variant-grid .${id}-character`);
  assert.equal(await button.getAttribute('aria-disabled'),'false');await button.click();await page.locator('#start-game').click();
  await page.waitForFunction(name=>plumageQA.playing&&plumageQA.c.isPigeon&&plumageQA.selected[0]===name,name);
 }
 console.log('PASS: five world NPCs, locked menu, targeted feeding, independent unlocks, save/load and all three native players',world);
 }
 await page.evaluate(async()=>{
  const w=plumageQA,T=await import('/node_modules/.vite/deps/three.js');w.renderer.setAnimationLoop(null);
  document.body.replaceChildren(w.renderer.domElement);w.renderer.setSize(1440,900);w.renderer.setPixelRatio(1);
  const scene=new T.Scene();scene.background=new T.Color('#d9e5ec');scene.add(new T.HemisphereLight('#ffffff','#8b9fa9',2.3));
  const light=new T.DirectionalLight('#fff2dd',3.3);light.position.set(4,8,6);scene.add(light);
  const ground=new T.Mesh(new T.PlaneGeometry(80,80),new T.MeshStandardMaterial({color:'#bacbcc',roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.01;scene.add(ground);
  const models=new Map();
  for(const [id,x] of [['pidgie',-6.8],['snowball',-3.4],['ugolyok',0],['ryzhik',3.4],['kurlyk',6.8]]){
   const variant=w.KIRBY_VARIANTS.find(v=>v[0]===({pidgie:'Пиджи',snowball:'Снежок',ugolyok:'Уголёк',ryzhik:'Рыжик',kurlyk:'Курлык'})[id]);
   const rig=w.createPlayerModel(w.model,variant,w.models.pidgie,false,undefined,w.models.snowball,w.models);rig.model.position.x=x;rig.model.rotation.y=.4;scene.add(rig.model);models.set(id,rig.model);
  }
  const camera=new T.PerspectiveCamera(30,1440/900,.1,100);camera.position.set(9,5,27);camera.lookAt(0,1.25,0);await w.renderer.compileAsync(scene,camera);w.renderer.render(scene,camera);
  w.photo={scene,camera,models};
 });
 await page.screenshot({path:output+'/all-pigeons.png'});assert.deepEqual(errors,[]);console.log(JSON.stringify({result:'PASS: native feather textures and GPU shaders',output}));
 await page.evaluate(()=>{
  const w=plumageQA,{scene,camera,models}=w.photo;models.get('pidgie').visible=models.get('snowball').visible=false;
  models.get('ugolyok').position.x=-3.4;models.get('ryzhik').position.x=0;models.get('kurlyk').position.x=3.4;
  camera.position.set(6,3.4,16);camera.lookAt(0,1.3,0);w.renderer.render(scene,camera);
 });
 await page.screenshot({path:output+'/new-pigeons.png'});
 await page.evaluate(()=>{
  const w=plumageQA,{scene,camera,models}=w.photo;
  for(const [id,model] of models)model.visible=id==='kurlyk';
  models.get('kurlyk').position.x=0;models.get('kurlyk').rotation.y=-.25;
  camera.position.set(4.3,2.8,8);camera.lookAt(0,1.5,0);w.renderer.render(scene,camera);
 });
 await page.screenshot({path:output+'/kurlyk.png'});
 await page.evaluate(async()=>{
  const w=plumageQA,T=await import('/node_modules/.vite/deps/three.js'),{PigeonCrowd}=await import('/src/pigeon-crowd.ts');
  const {scene,camera,models}=w.photo;
  for(const model of models.values())model.visible=false;
  const crowd=new PigeonCrowd(w.models.kurlyk);scene.add(crowd.group);crowd.begin(3);
  for(let i=0;i<3;i++){
   const actor=new T.Group();actor.position.x=(i-1)*3.6;actor.rotation.y=(i-1)*.7;
   crowd.add({actor,state:i===1?'Hello':'Fly',clipTime:.6+i*.2});
  }
  crowd.end();camera.position.set(5,3.4,18);camera.lookAt(0,1.5,0);
  await w.renderer.compileAsync(scene,camera);w.renderer.render(scene,camera);
 });
 await page.screenshot({path:output+'/kurlyk-admin-flock.png'});
 assert.deepEqual(errors,[]);console.log('PASS: crowned iridescent Kurlyk in native and instanced GPU rendering');
 }
}finally{await browser?.close();await vite?.close();}
