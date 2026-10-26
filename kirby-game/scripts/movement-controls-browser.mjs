import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium,devices} from 'playwright';

const output=fileURLToPath(new URL('../node_modules/.cache/movement-controls/',import.meta.url));
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const report={errors:[],keyboard:{},gamepad:{},touch:{}};
async function prepare(options={}){
 const page=await browser.newPage(options);
 page.on('pageerror',error=>report.errors.push(error.message));
 await page.routeWebSocket(`ws://${new URL(process.env.GAME_URL??'http://127.0.0.1:5173/').host}/**`,ws=>{
  const server=ws.connectToServer();server.onMessage(message=>{try{if(['full-reload','update'].includes(JSON.parse(message).type))return;}catch{}ws.send(message);});
 });
 await page.addInitScript(()=>{
  localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');
  window.virtualPad=null;Object.defineProperty(navigator,'getGamepads',{value:()=>[window.virtualPad]});
 });
 await page.route('**/src/main.ts*',async route=>{
  const response=await route.fetch();await route.fulfill({response,body:(await response.text())+`
window.controlsQA={get c(){return character},camera:followCamera,gamepad,touch,renderer,frames:0,elapsed:0};
const originalMovementUpdate=CharacterController.prototype.update;
CharacterController.prototype.update=function(dt,input){
 const before=this.actor.position.clone(),result=originalMovementUpdate.call(this,dt,input);
 if(this===character){const q=window.controlsQA;q.frames++;q.elapsed+=dt;q.input={...input};if(input.dashPressed)q.startedOnPress=this.state==='Dash';q.speed=dt>0?Math.hypot(this.actor.position.x-before.x,this.actor.position.z-before.z)/dt:0;}
 return result;
};`});
 });
 await page.goto(process.env.GAME_URL??'http://127.0.0.1:5173/');
 await page.locator('#startup-loader').waitFor({state:'hidden',timeout:180000});
 await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Управление');await page.locator('#start-game').click();
 await page.waitForFunction(()=>window.controlsQA?.c,null,{timeout:180000});
 await reset(page);
 console.log(options.isMobile?'Mobile game ready':'Desktop game ready');
 return page;
}
async function reset(page){
 await page.evaluate(()=>{
  const q=controlsQA,c=q.c;c.setActivity('Idle');c.playerDash.tick(7);c.surfaceY=0;c.actor.position.set(135,0,140);c.yaw=0;c.actor.rotation.y=0;q.camera.reset(0);
 });
}
async function frames(page,count=4){
 const target=await page.evaluate(n=>controlsQA.frames+n,count);await page.waitForFunction(n=>controlsQA.frames>=n,target);
}
async function checkHelp(page){
 for(const locale of ['ru','en','bg']){
  await page.evaluate(async locale=>{const i18n=await import('/src/i18n.ts');i18n.setLocale(locale);},locale);
  assert.doesNotMatch(await page.locator('.hotkey-list').allTextContents().then(a=>a.join(' ')),/sprint|спринт/i);
 }
 await page.evaluate(async()=>{const i18n=await import('/src/i18n.ts');i18n.setLocale('ru');});
}
try{
 const page=await prepare({viewport:{width:1280,height:800}});
 await checkHelp(page);
 await page.locator('#game canvas').focus();
 await page.keyboard.down('w');await page.waitForFunction(()=>controlsQA.c.state==='Run'&&Math.abs(controlsQA.speed-6.8)<1e-6);
 assert.equal(await page.evaluate(()=>controlsQA.c.actions.get('Run').getEffectiveTimeScale()),2);
 await page.keyboard.up('w');await page.waitForFunction(()=>controlsQA.c.state==='Idle');
 report.keyboard.defaultSpeed=6.8;
 assert.deepEqual(await page.locator('#player-actions-dock .player-action-key').allTextContents(),['Q','Shift','Пробел']);
 const actionBounds=await Promise.all(['#player-push-hud','#knight-dash-hud','#player-jump-hud'].map(selector=>page.locator(selector).boundingBox()));
 assert(actionBounds[0].x+actionBounds[0].width<actionBounds[1].x&&actionBounds[1].x+actionBounds[1].width<actionBounds[2].x);
 await page.keyboard.press('q');await page.waitForFunction(()=>document.querySelector('#player-push-hud').dataset.state==='cooldown');
 assert(await page.locator('#player-push-hud .player-action-countdown').isHidden());
 assert.equal(await page.locator('#player-push-hud').innerText(),'Q');
 await page.waitForFunction(()=>controlsQA.c.pushAvailable);await frames(page);
 assert.equal(await page.locator('#player-push-hud').getAttribute('data-state'),'ready');
 await reset(page);await page.keyboard.press('Space');await page.waitForFunction(()=>controlsQA.c.flight.active);
 await page.waitForFunction(()=>document.querySelector('#player-jump-hud').dataset.icon==='fly');
 assert(await page.locator('#player-jump-hud .player-action-countdown').isHidden());
 await page.keyboard.press('Space');await page.waitForFunction(()=>controlsQA.c.flight.levitating);
 await page.waitForFunction(()=>document.querySelector('#player-jump-hud .player-action-countdown').textContent==='2');
 await page.screenshot({path:output+'desktop-flight-2.png'});
 await page.waitForFunction(()=>document.querySelector('#player-jump-hud .player-action-countdown').textContent==='1');
 await page.screenshot({path:output+'desktop-flight-1.png'});
 await page.waitForFunction(()=>!controlsQA.c.flight.active);await frames(page);
 assert.equal(await page.locator('#player-jump-hud').getAttribute('data-icon'),'jump');
 report.actions={order:['push','dash','jump'],hotkeysOnly:true,pushDarkensWithoutDigits:true,jumpChangesToWings:true,flightCountdown:[2,1]};
 for(const key of ['ShiftLeft','ShiftRight']){
  await reset(page);await page.keyboard.down(key);
  await page.waitForFunction(()=>controlsQA.c.state==='Dash');
  assert.equal(await page.evaluate(()=>controlsQA.startedOnPress),true);
  await page.waitForFunction(()=>!controlsQA.c.playerDash.active);
  await page.evaluate(()=>controlsQA.c.playerDash.tick(7));await frames(page);
  assert.equal(await page.evaluate(()=>controlsQA.c.playerDash.active),false,'held key cannot repeat after cooldown');
  await page.keyboard.up(key);await frames(page);assert.equal(await page.evaluate(()=>controlsQA.c.playerDash.cooldown),0);
 }
 await reset(page);await page.keyboard.down('Space');
 const until=await page.evaluate(()=>controlsQA.elapsed+1.1);await page.waitForFunction(t=>controlsQA.elapsed>=t,until);
 assert.equal(await page.evaluate(()=>controlsQA.c.playerDash.cooldown),0,'holding jump cannot dash');await page.keyboard.up('Space');
 await reset(page);await page.keyboard.press('ShiftLeft');await page.waitForFunction(()=>controlsQA.c.state==='Dash');
 await page.waitForFunction(()=>!controlsQA.c.playerDash.active);await page.keyboard.press('ShiftLeft');await frames(page);
 await page.evaluate(()=>controlsQA.c.playerDash.tick(7));await frames(page);
 assert.equal(await page.evaluate(()=>controlsQA.c.playerDash.active),false,'cooldown press cannot queue a dash');
 for(const interrupt of ['settings','chat']){
  await reset(page);
  if(interrupt==='settings')await page.locator('#settings-toggle').click();
  else if(interrupt==='chat')await page.keyboard.press('Enter');
  await page.keyboard.press('ShiftLeft');
  if(interrupt==='settings')await page.locator('#settings-toggle').click();
  else if(interrupt==='chat')await page.keyboard.press('Escape');
  await frames(page);assert.equal(await page.evaluate(()=>controlsQA.c.playerDash.cooldown),0);
 }
 await page.evaluate(()=>{window.dispatchEvent(new KeyboardEvent('keydown',{code:'ShiftLeft'}));window.dispatchEvent(new Event('blur'));});
 await frames(page);assert.equal(await page.evaluate(()=>controlsQA.c.playerDash.cooldown),0);
 report.keyboard={...report.keyboard,bothShiftKeys:true,pressStartsImmediately:true,noRepeatOrQueue:true,jumpIndependent:true};
 await reset(page);await page.screenshot({path:output+'desktop.png'});
 await page.evaluate(()=>{
  window.virtualPad={id:'Movement QA',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
  controlsQA.gamepad.input.select(JSON.stringify([virtualPad.id,virtualPad.index]));
 });
 await frames(page);await page.evaluate(()=>virtualPad.axes[1]=-.5);
 await page.waitForFunction(()=>controlsQA.c.state==='Run'&&Math.abs(controlsQA.speed-6.8)<1e-6);
 await page.evaluate(()=>virtualPad.axes[1]=0);await frames(page);await reset(page);
 await page.evaluate(()=>{virtualPad.buttons[1]={pressed:true,value:1};});await page.waitForFunction(()=>controlsQA.c.state==='Dash');
 assert.equal(await page.locator('.knight-dash-key').innerText(),'B');
 assert.deepEqual(await page.locator('#player-actions-dock .player-action-key').allTextContents(),['X','B','A']);
 await page.waitForFunction(()=>!controlsQA.c.playerDash.active);await page.evaluate(()=>controlsQA.c.playerDash.tick(7));await frames(page);
 assert.equal(await page.evaluate(()=>controlsQA.c.playerDash.active),false);
 await page.evaluate(()=>{virtualPad.buttons[1]={pressed:false,value:0};});await frames(page);await reset(page);
 await page.evaluate(()=>{virtualPad.buttons[0]={pressed:true,value:1};});await frames(page,35);
 assert.equal(await page.evaluate(()=>controlsQA.c.playerDash.cooldown),0);
 await page.evaluate(()=>{virtualPad.buttons[0]={pressed:false,value:0};});
 report.gamepad={defaultSpeed:6.8,buttonB:true,buttonAStillJumps:true,noHeldRepeat:true};await page.close();

 const mobile=await prepare({...devices['Pixel 7'],viewport:{width:390,height:844}});
 await checkHelp(mobile);
 const cdp=await mobile.context().newCDPSession(mobile);
 const box=await mobile.locator('#touch-stick').boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;
 for(const distance of [.5,1]){
  await reset(mobile);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x,y:y-box.width*.34*distance}]});
  await mobile.waitForFunction(()=>controlsQA.c.state==='Run'&&Math.abs(controlsQA.speed-6.8)<1e-6);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await frames(mobile);
 }
 await reset(mobile);await mobile.locator('#touch-dash').tap();await mobile.waitForFunction(()=>controlsQA.c.state==='Dash');
 assert.equal(await mobile.locator('#touch-jump #knight-dash-hud').count(),0);
 assert.equal(await mobile.locator('#touch-dash #knight-dash-hud').count(),1);
 assert.equal(await mobile.locator('.touch-actions .player-action-key:visible').count(),0);
 assert.doesNotMatch(await mobile.locator('.touch-actions').innerText(),/Q|Shift|Пробел/);
 assert.doesNotMatch(await mobile.locator('.touch-actions').innerText(),/Толчок|Рывок|Полёт|Прыжок/);
 await mobile.waitForFunction(()=>!controlsQA.c.playerDash.active);await reset(mobile);
 await mobile.locator('#touch-jump').tap();await mobile.waitForFunction(()=>controlsQA.c.flight.active);
 assert.equal(await mobile.evaluate(()=>controlsQA.c.playerDash.cooldown),0);
 await mobile.waitForFunction(()=>!controlsQA.c.flight.active);
 await mobile.evaluate(()=>{controlsQA.renderer.setAnimationLoop(null);controlsQA.touch.setInteraction('Действие');});
 for(const viewport of [{width:390,height:844},{width:320,height:568},{width:844,height:390},{width:568,height:320}]){
  await mobile.setViewportSize(viewport);
  const buttons=[];
  for(const selector of ['#touch-stick','#touch-jump','#touch-dash','#touch-attack','#touch-interact']){
   const b=await mobile.locator(selector).boundingBox();assert(b&&b.x>=0&&b.y>=0&&b.x+b.width<=viewport.width+1&&b.y+b.height<=viewport.height+1,selector);buttons.push({selector,...b});
  }
  for(let i=0;i<buttons.length;i++)for(let j=i+1;j<buttons.length;j++){
   const a=buttons[i],b=buttons[j];assert(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y,`${a.selector} overlaps ${b.selector}`);
  }
  const hud=await mobile.locator('.right-hud').boundingBox();
  for(const b of buttons)assert(b.x+b.width<=hud.x||hud.x+hud.width<=b.x||b.y+b.height<=hud.y||hud.y+hud.height<=b.y,`${b.selector} overlaps the HUD`);
  await mobile.screenshot({path:output+`mobile-${viewport.width}.png`});
 }
 report.touch={defaultSpeed:6.8,partialAndFullStick:true,separateTapDash:true,jumpIndependent:true,widths:[320,390,568,844]};
 assert.deepEqual(report.errors,[]);await writeFile(output+'report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(error){
 console.error(JSON.stringify(report));
 for(const context of browser.contexts())for(const page of context.pages()){
  console.error(await page.evaluate(()=>({qa:!!window.controlsQA,state:window.controlsQA?.c?.state,loader:document.querySelector('#startup-loader')?.textContent,message:document.querySelector('#startup-message')?.textContent,body:document.body.className})).catch(()=>({closed:true})));
  await page.screenshot({path:output+'failure.png'}).catch(()=>{});
 }
 throw error;
}finally{await browser.close();}
