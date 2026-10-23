import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const url=process.env.KIRBY_URL??'http://127.0.0.1:5192/';
const mobileOnly=process.env.KIRBY_DASH_MOBILE_ONLY==='1';
const output=resolve('node_modules/.cache/meta-knight-player-dash');await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const report={desktop:{},mobile:[],errors:[]};
async function prepare(page){
 // Keep an input sequence stable when another dev session edits arena scenery.
 await page.routeWebSocket(`ws://${new URL(url).host}/**`,ws=>{const server=ws.connectToServer();server.onMessage(message=>{if(typeof message==='string'){try{if(['full-reload','update'].includes(JSON.parse(message).type))return;}catch{}}ws.send(message);});});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');localStorage.setItem('kirby-meta-knight-unlocked-v1','1');});
 await page.route('http://127.0.0.1:8787/**',r=>r.fulfill({json:{count:0,players:0,occupiedVariants:[],capacity:19,ok:true}}));
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+`
 window.dashQA={get c(){return character},get playing(){return playing},get keys(){return [...keys]},get settings(){return !audioPanel.hidden||chat.open},travel:cosmicArena,chat,followCamera,renderer,scene,sounds,T:THREE,history:[],cues:[]};
 const dashPlayKnight=sounds.playKnight.bind(sounds);sounds.playKnight=kind=>{window.dashQA.cues.push(kind);dashPlayKnight(kind);};
 `});});
 await page.goto(url);await page.locator('#startup-loader').waitFor({state:'hidden',timeout:120000});
 await page.waitForFunction(()=>window.dashQA&&!document.querySelector('#start-game').disabled,null,{timeout:120000});
 await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Рывок');await page.locator('.variant-button.meta-knight-character').click();await page.locator('#start-game').click();
 await page.waitForFunction(()=>window.dashQA?.playing&&dashQA.c?.isMetaKnight,null,{timeout:120000});
 await page.locator('#game canvas').focus();
 await page.evaluate(()=>{const q=dashQA,c=q.c,update=c.update.bind(c);c.update=(dt,input)=>{update(dt,input);q.history.push({dt,held:input.dashHeld,jump:input.jump,state:c.state,swimming:c.swimming,flight:c.flight.active,dash:{...c.knightDash},charge:c.knightDash.charge,cooldown:c.knightDash.cooldown,x:c.actor.position.x,z:c.actor.position.z,yaw:c.yaw});if(q.history.length>3000)q.history.shift();};});
 await reset(page);
}
async function reset(page){await page.evaluate(()=>{const c=dashQA.c;c.setActivity('Idle');c.actor.position.set(135,0,146);c.surfaceY=0;c.yaw=Math.PI/2;c.actor.rotation.y=c.yaw;dashQA.history=[];});await page.waitForTimeout(200);}
async function command(page,text){await page.evaluate(()=>dashQA.chat.show());await page.locator('#chat-input').fill(text);await page.keyboard.press('Enter');assert(await page.locator('#chat-composer').isHidden());}
async function hudBox(page,viewport){const box=await page.locator('#knight-dash-hud').boundingBox();assert(box&&box.x>=0&&box.y>=0&&box.x+box.width<=viewport.width+1&&box.y+box.height<=viewport.height+1,JSON.stringify(box));return box;}
try{
 if(!mobileOnly){
 const viewport={width:1280,height:800},page=await browser.newPage({viewport});await prepare(page);
 const hud=page.locator('#knight-dash-hud'),counter=hud.locator('.knight-dash-countdown');
 assert(await hud.isVisible());assert.doesNotMatch(await hud.textContent(),/Пробел/);assert.match(await hud.getAttribute('aria-description'),/Пробел.*0,3/);
 assert.equal(await hud.getAttribute('data-state'),'ready');assert(await counter.isHidden());
 assert.equal(await hud.evaluate(el=>parseFloat(getComputedStyle(el).width)),76);await page.screenshot({path:resolve(output,'desktop-ready.png')});
 await page.keyboard.down('Space');await page.waitForFunction(()=>dashQA.c.knightDash.charge>.25);
 const charging=await hud.evaluate(el=>({state:el.dataset.state,charge:Number(el.style.getPropertyValue('--dash-charge')),clip:getComputedStyle(el.querySelector('.knight-dash-charge')).clipPath}));
 assert.equal(charging.state,'charging');assert(charging.charge>.25&&charging.charge<1);assert.match(charging.clip,/inset/);
 await page.keyboard.up('Space');await page.waitForTimeout(160);assert.equal(await hud.getAttribute('data-state'),'ready');assert.equal(await hud.evaluate(el=>Number(el.style.getPropertyValue('--dash-charge'))),0);
 assert.equal(await page.evaluate(()=>dashQA.c.knightDash.cooldown),0);assert.equal(await page.evaluate(()=>dashQA.history.some(f=>f.state==='Dash')),false);
 await reset(page);await page.addStyleTag({content:'body.dash-effects-photo .right-hud,body.dash-effects-photo .status-cluster{visibility:hidden}'});
 await page.evaluate(()=>{const q=dashQA;q.cues=[];const render=q.renderer.render;q.restorePhoto=()=>{q.renderer.render=render;document.body.classList.remove('dash-effects-photo');};document.body.classList.add('dash-effects-photo');q.renderer.render=function(scene,camera){if(scene!==q.scene)return render.call(this,scene,camera);const photo=camera.clone(),p=q.c.actor.position;photo.position.set(p.x+6,p.y+3,p.z+7);photo.lookAt(p.x+1,p.y+1,p.z);photo.updateMatrixWorld();return render.call(this,scene,photo);};});await page.keyboard.down('Space');await page.waitForFunction(()=>dashQA.c.state==='Dash');
 const thrust=await page.evaluate(()=>{const c=dashQA.c,T=dashQA.T,b=c.actor.getObjectByName('Galaxia');c.actor.updateMatrixWorld(true);const dir=b.localToWorld(new T.Vector3(-.315,2.05,0)).sub(b.getWorldPosition(new T.Vector3())).normalize();return {heading:c.yaw,direction:dir.toArray(),cooldown:c.knightDash.cooldown,charged:dashQA.history.filter(f=>f.held).reduce((sum,f)=>sum+f.dt,0),sparks:c.actor.getObjectByName('Meta Knight flying sword sparks').visible};});
 assert(thrust.direction[0]>.995);assert(thrust.sparks);assert(thrust.charged>=.3&&thrust.charged<.45,JSON.stringify(thrust));assert(thrust.cooldown>5.7&&thrust.cooldown<=6);
 await page.keyboard.down('a');await page.keyboard.down('w');await page.waitForTimeout(120);await page.keyboard.up('a');await page.keyboard.up('w');
 await page.waitForFunction(()=>dashQA.c.actor.getObjectByName('Meta Knight flying sword sparks')?.visible&&dashQA.cues.includes('thrust'));
 const playerEffects=await page.evaluate(()=>{const q=dashQA,effect=q.c.actor.getObjectByName('Meta Knight flying sword sparks'),mist=effect.getObjectByName('Galaxia soft flying mist');return {mistPuffs:mist.children.length,mistOpacity:mist.children[1].material.opacity,mistWidth:mist.children[1].scale.x,sparkCount:effect.children[0].count,noWake:!q.c.actor.getObjectByName('Meta Knight golden violet dash wake'),sounds:q.cues.filter(k=>k==='thrust').length,soundSeconds:q.sounds.buffers.get('knight-v2-thrust')?.duration,audio:q.sounds.context.state};});assert.equal(playerEffects.mistPuffs,8);assert(playerEffects.mistOpacity>=.3&&playerEffects.mistWidth>.38&&playerEffects.noWake);assert.equal(playerEffects.sparkCount,40);assert.equal(playerEffects.sounds,1);assert(Math.abs(playerEffects.soundSeconds-1.35)<2/44100);assert.equal(playerEffects.audio,'running');
 await page.screenshot({path:resolve(output,'desktop-thrust.png')});await page.evaluate(()=>dashQA.restorePhoto());await page.waitForFunction(()=>!dashQA.c.knightDash.active);
 assert(Math.abs(await page.evaluate(()=>dashQA.c.yaw)-thrust.heading)<1e-6);
 const before=await page.evaluate(()=>dashQA.c.actor.position.x);await page.waitForFunction(()=>dashQA.c.knightDash.cooldown===0,null,{timeout:15000});await page.waitForTimeout(150);
 assert(Math.abs(await page.evaluate(()=>dashQA.c.actor.position.x)-before)<.05,'continued hold cannot repeat');
 await page.keyboard.up('Space');await page.waitForTimeout(80);await page.keyboard.down('Space');await page.waitForFunction(()=>dashQA.c.state==='Dash');await page.keyboard.up('Space');
 assert(await hud.isVisible());await page.waitForFunction(()=>!dashQA.c.knightDash.active);
 assert.equal(await hud.getAttribute('data-state'),'cooldown');assert(await counter.isVisible());assert.match(await counter.textContent(),/^[1-6]$/);
 await page.screenshot({path:resolve(output,'desktop-cooldown.png')});
 // The last fractional second still shows 1; readiness removes the overlay entirely.
 await page.waitForFunction(()=>dashQA.c.knightDash.cooldown>0&&dashQA.c.knightDash.cooldown<.9);
 assert.equal(await counter.textContent(),'1');
 // A menu must break a partial hold; closing it cannot finish that old charge.
 await page.waitForFunction(()=>dashQA.c.knightDash.cooldown===0,null,{timeout:15000});await counter.waitFor({state:'hidden'});assert.equal(await hud.getAttribute('data-state'),'ready');await reset(page);
 await page.keyboard.down('Space');await page.waitForFunction(()=>dashQA.c.knightDash.charge>.2);await page.keyboard.press('Escape');assert(await page.locator('#knight-dash-hud').isHidden());await page.keyboard.up('Space');await page.keyboard.press('Escape');await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>dashQA.c.knightDash.cooldown),0);
 await command(page,'/portal 1');await command(page,'/tele mk');
 await page.evaluate(()=>{dashQA.c.actor.position.z-=5;});await page.waitForFunction(()=>document.querySelector('#action-hint').textContent.includes('Войти на арену'));
 await page.keyboard.press('e');await page.waitForFunction(()=>dashQA.travel.active,null,{timeout:120000});
 await page.keyboard.down('Space');await page.waitForFunction(()=>dashQA.c.state==='Dash');await page.keyboard.up('Space');assert(await page.locator('#knight-dash-hud').isVisible());
 report.desktop={thrust,playerEffects,charging,hud:await hudBox(page,viewport),arena:true,shortTap:true,cooldown:true,integerCountdown:true,releaseRequired:true,menuReset:true};console.log('PASS keyboard hold, compact hex HUD, integer countdown, menu reset, player effects and arena');
 const bossEffects=await page.evaluate(async()=>{
  const q=dashQA,{startKnightBattle}=await import('/src/meta-knight-battle.ts');q.renderer.setAnimationLoop(null);q.c.setActivity('Idle');q.c.actor.position.set(2000,0,28);
  const s=startKnightBattle([{id:'solo',p:[0,0,-2],yaw:0,available:true}],'solo',1000);Object.assign(s,{phase:2,hp:8,pattern:'flight',stage:'dash',step:1,since:1000,until:1700,from:[-18,1.2,0],to:[18,1.2,0],height:1.2,yaw:Math.PI/2});q.bossThrust=s;q.cues=[];
  const view=q.travel.battleView;for(let i=0;i<32;i++)view.update(s,'solo',1000+i*1000/60,1/60,false,'Q',true,false);
  q.travel.camera.position.set(2019,18,25);q.travel.camera.lookAt(2003,4,0);q.travel.camera.updateMatrixWorld();q.travel.render();
  const actor=q.travel.knight.actor,sparks=actor.getObjectByName('Meta Knight flying sword sparks'),mist=sparks.getObjectByName('Galaxia soft flying mist');
  return {sparks:sparks.visible,mistPuffs:mist.children.length,noWake:!actor.getObjectByName('Meta Knight golden violet dash wake'),sounds:q.cues.filter(k=>k==='thrust').length};
 });assert(bossEffects.sparks&&bossEffects.noWake&&bossEffects.mistPuffs===8);assert.equal(bossEffects.sounds,1);await page.screenshot({path:resolve(output,'boss-thrust.png')});
 assert(await page.evaluate(()=>{const q=dashQA,s=q.bossThrust;Object.assign(s,{stage:'open',since:1700,until:3500,from:[18,0,0],to:[18,0,0],height:0});for(let i=0;i<40;i++)q.travel.battleView.update(s,'solo',1700+i*1000/60,1/60,false,'Q',true,false);return !q.travel.knight.actor.getObjectByName('Meta Knight flying sword sparks').visible;}));report.bossEffects=bossEffects;console.log('PASS NPC soft blade mist, no body wake and one epic sound');await page.close();
 }
 for(const viewport of [{width:390,height:844},{width:844,height:390}]){
  const context=await browser.newContext({viewport,isMobile:true,hasTouch:true}),phone=await context.newPage();await prepare(phone);
  assert.equal(await phone.locator('#knight-dash-hud').getAttribute('data-embedded'),'true');
  assert.match(await phone.locator('#touch-jump').getAttribute('aria-label'),/Прыжок.*ускорение/);
  // Real touch pointer events, held across multiple game frames.
  const session=await context.newCDPSession(phone),box=await phone.locator('#touch-jump').boundingBox(),point={x:box.x+box.width/2,y:box.y+box.height/2};
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await phone.waitForFunction(()=>dashQA.c.state==='Dash');
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert(await phone.evaluate(()=>dashQA.c.knightDash.cooldown>0));
  const hud=await hudBox(phone,viewport);
  const jump=await phone.locator('#touch-jump').boundingBox();assert(Math.abs(hud.x-jump.x)<1&&Math.abs(hud.y-jump.y)<1&&Math.abs(hud.width-jump.width)<1&&Math.abs(hud.height-jump.height)<1);
  for(const selector of ['.touch-tools','#touch-stick','#touch-interaction','.combat-message','.right-hud']){
   const other=phone.locator(selector);if(!await other.isVisible())continue;const box=await other.boundingBox();
   assert(!box||hud.x+hud.width<=box.x||box.x+box.width<=hud.x||hud.y+hud.height<=box.y||box.y+box.height<=hud.y,`Dash HUD overlaps ${selector} at ${viewport.width}x${viewport.height}`);
  }
  await phone.screenshot({path:resolve(output,`phone-${viewport.width}.png`)});report.mobile.push({viewport,hud,hold:true,noOverlap:true});console.log(`PASS touch hold and HUD at ${viewport.width}x${viewport.height}`);await context.close();
 }
 assert.deepEqual(report.errors,[]);await writeFile(resolve(output,mobileOnly?'checks-mobile.json':'checks.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(error){console.error(JSON.stringify(report.errors));for(const context of browser.contexts())for(const page of context.pages()){console.error(JSON.stringify(await page.evaluate(()=>({playing:window.dashQA?.playing,settings:window.dashQA?.settings,keys:window.dashQA?.keys,focus:document.activeElement?.outerHTML.slice(0,180),hidden:document.hidden,state:window.dashQA?.c?.state,history:window.dashQA?.history.slice(-3)})).catch(()=>({closed:true}))));await page.screenshot({path:resolve(output,'failure.png')}).catch(()=>{});}throw error;}finally{await browser.close();}
