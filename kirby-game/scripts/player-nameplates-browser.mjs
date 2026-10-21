import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const out=fileURLToPath(new URL('../node_modules/.cache/player-nameplates/',import.meta.url));
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:850}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL|shader/i.test(m.text()))errors.push(m.text());});
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
 for(const endpoint of ['room','players','history/solo'])await page.route('**/'+endpoint,r=>r.fulfill({json:{ok:true,players:0,occupiedVariants:[],capacity:20}}));
 await page.route('**/src/main.ts*',async route=>{
  const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.nameplateQA={scene,camera,renderer,followCamera,npcs,get c(){return character},get remotes(){return remotePlayers},get session(){return network}};'});
 });
 const actor=(name,variant,p=[0,0,0],s=1)=>({p,q:[0,0,0,1],s,state:'Idle',pose:[],fruits:0,achievements:[],name,variant,star:0});
 let socket;
 await page.routeWebSocket('**/ws?**',ws=>{
  socket=ws;ws.onMessage(data=>{if(data==='ping')ws.send('pong');});
  const now=Date.now();ws.send(JSON.stringify({type:'welcome',protocolVersion:2,playerId:'self',room:{id:'nameplate-qa',host:'self',epoch:now,dayPhase:.25,fruits:Array(70).fill(null),starAt:0,mill:false,locks:{}},players:[{id:'self',actor:actor('Моё имя',0)},{id:'lemon',actor:actor('Лимончик',5)},{id:'sapphire',actor:actor('Сапфир',14)}]}));
 });
 await page.goto(process.env.GAME_URL??'http://127.0.0.1:5174/');
 await page.locator('#startup-loader').waitFor({state:'hidden',timeout:180000});
 await page.locator('#network-join').click();await page.locator('#player-name-input').fill('Моё имя');await page.locator('#start-game').click();
 await page.waitForFunction(()=>nameplateQA.remotes?.players.size===2);
 await page.evaluate(()=>{const q=nameplateQA;q.c.actor.position.set(0,0,0);q.c.yaw=Math.PI;q.c.actor.rotation.y=Math.PI;q.followCamera.reset(Math.PI);q.followCamera.zoom(400);q.followCamera.orbit(0,45);});
 const send=(id,state)=>socket.send(JSON.stringify({type:'frame',id,actor:state}));
 send('lemon',actor('Лимончик',5,[-2.4,0,0]));send('sapphire',actor('Сапфир',14,[2.4,0,0]));
 await page.waitForFunction(()=>nameplateQA.camera.position.distanceTo(nameplateQA.c.actor.position)<25);
 await page.waitForTimeout(1000);await page.evaluate(()=>document.fonts.ready);
 const inspect=()=>page.evaluate(()=>{
  const q=nameplateQA;
  const labels=[...q.remotes.players].map(([id,c])=>{
   const s=c.actor.getObjectByName('Remote player nickname'),canvas=s.material.map.image,ctx=canvas.getContext('2d');
   const pos=s.getWorldPosition(c.actor.position.clone()),ndc=pos.clone().project(q.camera);
   return {id,color:ctx.fillStyle,font:ctx.font,screenX:(ndc.x+1)*innerWidth/2,screenY:(1-ndc.y)*innerHeight/2,worldY:pos.y,actorY:c.actor.position.y,cameraDistance:q.camera.position.distanceTo(c.actor.position),screenHeight:s.scale.y*c.actor.scale.y*q.camera.projectionMatrix.elements[5]*innerHeight/2,depthTest:s.material.depthTest,depthWrite:s.material.depthWrite,toneMapped:s.material.toneMapped};
  });
  return {labels,selfHasLabel:!!q.c.actor.getObjectByName('Remote player nickname'),selfInPeers:q.remotes.players.has('self'),npcLabels:q.npcs.filter(c=>c.actor.getObjectByName('Remote player nickname')).length};
 });
 const initial=await inspect();assert(!initial.selfHasLabel&&!initial.selfInPeers);assert.equal(initial.npcLabels,0);
 assert.deepEqual(initial.labels.map(l=>l.color),['#ffe329','#2368ff']);
 for(const label of initial.labels){assert.match(label.font,/800 64px Manrope/);assert(Math.abs(label.screenHeight-44)<.01);assert(label.worldY>label.actorY+1);assert(label.depthTest&&!label.depthWrite&&!label.toneMapped);assert(label.screenX>0&&label.screenX<1280);}
 // Isolate the world for visual QA, so existing HUD panels do not cover names.
 await page.addStyleTag({content:'.player-stats,.tasks-panel,.route-panel,#meta-knight-seal-hud,#wayfinder-compass {visibility:hidden!important}'});
 await page.screenshot({path:out+'/desktop.png'});
 await page.evaluate(()=>{const q=nameplateQA;q.c.yaw=0;q.c.actor.rotation.y=0;q.followCamera.reset(0);q.followCamera.zoom(400);});
 await page.waitForTimeout(800);
 const distances=[];
 for(const z of [24,64]){
  send('lemon',actor('Лимончик',5,[-4.8,0,z]));send('sapphire',actor('Сапфир',14,[4.8,0,z]));await page.waitForTimeout(500);
  const samples=(await inspect()).labels;
  for(const l of samples){assert(Math.abs(l.screenHeight-44)<.01);assert(l.cameraDistance>Math.abs(z));}
  distances.push(samples);await page.screenshot({path:out+'/distance-'+Math.abs(z)+'.png'});
 }
 await page.evaluate(()=>{const q=nameplateQA;q.c.yaw=Math.PI;q.c.actor.rotation.y=Math.PI;q.followCamera.reset(Math.PI);q.followCamera.zoom(400);q.followCamera.orbit(0,45);});
 send('lemon',actor('Лимончик',5,[-2.4,0,0]));send('sapphire',actor('Сапфир',14,[2.4,0,0]));await page.waitForTimeout(400);
 // Growth and rider fitting must move the anchor without enlarging the font.
 send('lemon',{...actor('Лимончик',5,[-2.4,0,0],7),fit:.1});await page.waitForTimeout(500);
 const fitted=(await inspect()).labels.find(l=>l.id==='lemon');assert(Math.abs(fitted.screenHeight-44)<.01);assert(fitted.worldY<3);
 send('lemon',{...actor('Лимончик',5,[-2.4,3,0],.5),state:'Fly'});await page.waitForTimeout(400);
 const flying=(await inspect()).labels.find(l=>l.id==='lemon');assert(flying.worldY>3.5);assert(Math.abs(flying.screenHeight-44)<.01);
 // Names update through actual WebSocket frames, including markup-like text.
 await page.evaluate(()=>{const s=nameplateQA.remotes.players.get('lemon').actor.getObjectByName('Remote player nickname');window.oldNameTexture=s.material.map;window.nameTextureDisposals=0;s.material.map.addEventListener('dispose',()=>window.nameTextureDisposals++);});
 send('lemon',actor('<Кирби & друг>',5,[-2.4,0,0]));await page.waitForTimeout(400);
 assert(await page.evaluate(()=>nameplateQA.remotes.players.get('lemon').actor.getObjectByName('Remote player nickname').material.map===oldNameTexture));
 const variantSamples=[];
 for(const [variant,name,color] of [[17,'Пиджи','#8c98a6'],[18,'Meta Knight','#a8b0f7'],[19,'Снежок','#f5f5f1']]){
  send('lemon',actor(name,variant,[-2.4,0,0]));
  await page.waitForFunction(v=>nameplateQA.remotes.players.get('lemon')?.actor.userData.variant===v,variant);
  await page.waitForTimeout(200);const sample=(await inspect()).labels.find(l=>l.id==='lemon');assert.equal(sample.color,color);assert(sample.worldY>1);variantSamples.push(sample);
  await page.screenshot({path:out+'/variant-'+variant+'.png'});
 }
 assert.equal(await page.evaluate(()=>nameTextureDisposals),1,'replacing a character releases its name texture');
 send('lemon',actor('Лимончик',5,[-2.4,0,0]));await page.waitForTimeout(400);
 await page.evaluate(()=>nameplateQA.followCamera.zoom(1000));
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(1200);
 for(const l of (await inspect()).labels){assert(Math.abs(l.screenHeight-44)<.01);assert(l.screenX>0&&l.screenX<390);}
 await page.screenshot({path:out+'/mobile.png'});
 await page.setViewportSize({width:1280,height:850});
 await page.evaluate(()=>{const s=nameplateQA.remotes.players.get('sapphire').actor.getObjectByName('Remote player nickname');window.departedLabel=s;window.departedTextureDisposals=0;s.material.map.addEventListener('dispose',()=>window.departedTextureDisposals++);});
 socket.send(JSON.stringify({type:'left',id:'sapphire'}));await page.waitForFunction(()=>nameplateQA.remotes.players.size===1);
 assert(await page.evaluate(()=>!departedLabel.parent&&departedTextureDisposals===1));
 await page.locator('#settings-toggle').click();await page.locator('#exit-to-menu').click();await page.waitForFunction(()=>!nameplateQA.remotes);
 assert.equal(await page.evaluate(()=>{let count=0;nameplateQA.scene.traverse(o=>{if(o.name==='Remote player nickname')count++;});return count;}),0);
 await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Одиночная игра');await page.locator('#start-game').click();await page.waitForFunction(()=>!!nameplateQA.c);
 assert(!await page.evaluate(()=>!!nameplateQA.c.actor.getObjectByName('Remote player nickname')));
 assert.deepEqual(errors,[]);
 const report={initial,distances,fitted,flying,variantSamples,cleanup:true,solo:true,errors};await writeFile(out+'/checks.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
