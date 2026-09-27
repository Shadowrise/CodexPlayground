import {chromium,webkit,devices} from 'playwright';
import assert from 'node:assert/strict';
const base=process.env.GAME_URL??'http://127.0.0.1:5173/';
const safari=process.argv.includes('--webkit');
const iphone=safari||process.argv.includes('--iphone');
const browser=await (safari?webkit:chromium).launch(safari?{headless:true}:{executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
async function checkHud(page,mobile){
 const stats=await page.locator('.player-stats').boundingBox(),route=await page.locator('.right-hud .route-panel').boundingBox(),tasks=await page.locator('#tasks-toggle').boundingBox();
 assert(stats&&route&&tasks);assert(route.y>=stats.y+stats.height-1);assert(tasks.y>=route.y+route.height-1);
 assert(Math.abs(route.x-stats.x)<1);assert(Math.abs(route.width-stats.width)<1);
 if(mobile){
  assert(!await page.locator('#meadow-chat').isVisible());
  const fps=await page.locator('#fps-counter').boundingBox(),settings=await page.locator('#settings-toggle').boundingBox(),dial=await page.locator('#time-dial').boundingBox();
  assert(fps.x+fps.width<=settings.x);assert(dial.x>settings.x+settings.width);assert(dial.x-settings.x-settings.width<16);
  assert(dial.y+dial.height<=stats.y||dial.x+dial.width<=stats.x);
 }
 assert.equal(await page.locator('#status,.panel.status').count(),0);
}
try{
 const page=await browser.newPage({...devices[iphone?'iPhone 13':'Pixel 7'],viewport:{width:844,height:390}});
 const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
 await page.goto(base);await page.waitForSelector('#startup-loader',{state:'hidden',timeout:180000});
 assert(await page.locator('body.touch-ui').count());
 await page.evaluate(async()=>{
  const controllerUrl=performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='/src/controller.ts').name;
  const {CharacterController}=await import(controllerUrl);const update=CharacterController.prototype.update;
  CharacterController.prototype.update=function(dt,input){const result=update.call(this,dt,input);window.__mobileActor=this;window.__mobileInput=input;return result;};
  const {FollowCamera}=await import('/src/follow-camera.ts');const updateCamera=FollowCamera.prototype.update;
  FollowCamera.prototype.update=function(...args){const result=updateCamera.apply(this,args);window.__mobileCamera=this;return result;};
 });
 await page.locator('#new-game').tap();await page.fill('#player-name-input','Мобильный Кирби');await page.locator('#start-game').tap();
 await page.waitForSelector('#touch-stick');
 await page.waitForFunction(()=>window.__mobileActor&&window.__mobileCamera);
 await page.evaluate(()=>{window.__mobileActor.actor.position.set(0,0,0);window.__mobileActor.yaw=0;window.__mobileCamera.reset(0);});
 assert.equal(await page.locator('#tasks-toggle').getAttribute('aria-expanded'),'false');
 assert.equal(await page.locator('.input-device select').first().inputValue(),'keyboard');
 const bounds=async selector=>{const b=await page.locator(selector).boundingBox();assert(b,selector);return {x:b.x+b.width/2,y:b.y+b.height/2};};
 if(!safari){
  const cdp=await page.context().newCDPSession(page);
  const points=new Map();
  const touch=async(type,id,x,y)=>{const ended=points.get(id);if(type==='touchEnd'||type==='touchCancel')points.delete(id);else points.set(id,{id,x,y});await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[ended]:[...points.values()]});};
  const stick=await bounds('#touch-stick'),jump=await bounds('#touch-jump');
  const initial=await page.evaluate(()=>window.__mobileActor.actor.position.toArray());
  await touch('touchStart',1,stick.x,stick.y);await touch('touchMove',1,stick.x,stick.y-40);
  await page.waitForFunction(()=>window.__mobileInput?.forward&&window.__mobileInput?.sprint);
  await page.waitForFunction(([x,,z])=>Math.hypot(window.__mobileActor.actor.position.x-x,window.__mobileActor.actor.position.z-z)>.3,initial);
  const cameraBefore=await page.evaluate(()=>window.__mobileCamera.azimuth);
  await touch('touchStart',2,410,190);await touch('touchMove',2,470,200);
  await touch('touchStart',3,jump.x,jump.y);await touch('touchEnd',3);
  await page.waitForFunction(()=>window.__mobileActor.flight.active);
  assert(await page.evaluate(()=>window.__mobileInput.forward));
  await page.waitForFunction(v=>Math.abs(window.__mobileCamera.azimuth-v)>.05,cameraBefore);
  await touch('touchEnd',2);await touch('touchEnd',1);
  await page.waitForFunction(()=>!window.__mobileInput.forward);
  // Pinch changes camera distance without browser/page zoom.
  const zoomBefore=await page.evaluate(()=>window.__mobileCamera.distance);
  await touch('touchStart',4,340,190);await touch('touchStart',5,430,190);await touch('touchMove',5,490,190);
  await touch('touchEnd',5);await touch('touchEnd',4);
  await page.waitForFunction(v=>window.__mobileCamera.distance<v-.2,zoomBefore);
  // Interrupt a held stick with settings: movement must not resume on closing.
  await touch('touchStart',1,stick.x,stick.y-40);await page.locator('#settings-toggle').tap();
  await touch('touchEnd',1);await page.waitForSelector('#touch-controls',{state:'hidden'});
  await page.locator('#settings-toggle').tap();await page.waitForFunction(()=>!window.__mobileInput.forward);
 }
 await page.waitForFunction(()=>!window.__mobileActor.flight.active);
 await page.locator('#touch-attack').tap();await page.waitForFunction(()=>window.__mobileActor.state==='Attack');
 await page.waitForFunction(()=>window.__mobileActor.state==='Idle');
 await page.locator('#touch-emotes').tap();await page.getByRole('button',{name:'👋 Привет',exact:true}).tap();
 await page.waitForFunction(()=>window.__mobileActor.state==='Hello');
 await page.locator('#touch-chat').tap();await page.fill('#chat-input','Привет с телефона!');
 await page.getByRole('button',{name:'Отправить',exact:true}).tap();
 await page.waitForFunction(()=>document.querySelector('#meadow-chat').textContent.includes('Привет с телефона!'));
 // All attraction actions use the same interaction path as keyboard/gamepad.
 await page.evaluate(async()=>{const {MILL_LEVER}=await import('/src/watermill.ts');window.__mobileActor.setActivity('Idle');window.__mobileActor.actor.position.copy(MILL_LEVER);});
 await page.waitForFunction(()=>document.querySelector('#touch-interact').textContent.includes('шлюз'));
 await page.locator('#touch-interact').tap();await page.waitForFunction(()=>window.__mobileActor.achievements.has('mill'));
 await checkHud(page,true);
 await page.screenshot({path:process.env.TEMP+`/kirby-mobile-${safari?'webkit':'android'}-landscape.png`});
 await page.setViewportSize({width:390,height:844});
 await page.waitForTimeout(300);
 assert.equal(await page.evaluate(()=>innerWidth),390);
 await checkHud(page,true);
 for(const selector of ['#touch-stick','#touch-jump','#touch-attack','#touch-chat','#settings-toggle','.right-hud','#navigation-hud']){
  const b=await page.locator(selector).boundingBox();assert(b&&b.x>=0&&b.y>=0&&b.x+b.width<=391&&b.y+b.height<=845,`${selector}: ${JSON.stringify(b)}`);
 }
 await page.screenshot({path:process.env.TEMP+`/kirby-mobile-${safari?'webkit':'android'}-portrait.png`});
 await page.setViewportSize({width:568,height:320});await page.waitForTimeout(300);
 assert.equal(await page.evaluate(()=>innerWidth),568);
 await checkHud(page,true);
 for(const selector of ['#touch-stick','#touch-interact','#navigation-hud','#time-dial']){const b=await page.locator(selector).boundingBox();assert(b&&b.x>=0&&b.y>=0&&b.x+b.width<=569&&b.y+b.height<=321,`${selector}: ${JSON.stringify(b)}`);}
 await page.screenshot({path:process.env.TEMP+'/kirby-mobile-small-landscape.png'});
 await page.setViewportSize({width:844,height:260});await page.waitForTimeout(300);await checkHud(page,true);
 const hud=await page.locator('.right-hud').boundingBox(),route=await page.locator('.route-panel').boundingBox(),toggle=await page.locator('#tasks-toggle').boundingBox();
 assert(route.y+route.height<=hud.y+hud.height);assert(toggle.y+toggle.height<=hud.y+hud.height);
 await page.locator('#tasks-toggle').tap();assert(await page.locator('#task-list').isVisible());
 assert((await page.locator('#task-list').boundingBox()).height>100);
 await page.locator('#task-list li').last().scrollIntoViewIfNeeded();
 assert(await page.evaluate(()=>{const list=document.querySelector('#task-list'),hud=document.querySelector('.right-hud');return list.scrollTop>0||hud.scrollTop>0;}));
 assert(await page.evaluate(()=>Number(getComputedStyle(document.querySelector('.right-hud')).zIndex)>Number(getComputedStyle(document.querySelector('#touch-controls')).zIndex)));
 // The contextual action must escape the lower movement layer and cover expanded tasks.
 for(const viewport of [{width:844,height:260},{width:568,height:320},{width:390,height:844}]){
  await page.setViewportSize(viewport);await page.waitForTimeout(200);
  assert(await page.evaluate(()=>{
   const button=document.querySelector('#touch-interact'),r=button.getBoundingClientRect();
   if(!r.width||r.left<0||r.top<0||r.right>innerWidth||r.bottom>innerHeight)return false;
   return [[.1,.1],[.5,.5],[.9,.9],[.1,.9],[.9,.1]].every(([x,y])=>button.contains(document.elementFromPoint(r.left+r.width*x,r.top+r.height*y)));
  }),'Interaction is fully visible and receives touches above the task list');
  const label=await page.locator('#touch-interact').textContent();await page.locator('#touch-interact').tap();
  await page.waitForFunction(text=>document.querySelector('#touch-interact').textContent!==text,label);
 }
 await page.setViewportSize({width:844,height:260});await page.waitForTimeout(200);
 await page.screenshot({path:process.env.TEMP+'/kirby-mobile-short-tasks.png'});
 await page.locator('#tasks-toggle').tap();
 await page.locator('#settings-toggle').tap();assert(await page.locator('[data-controls="touch"]').isVisible());assert(!await page.locator('[data-controls="keyboard"]').isVisible());
 assert(!await page.locator('#touch-interact').isVisible());
 assert(await page.locator('#meadow-chat').isVisible());await page.screenshot({path:process.env.TEMP+'/kirby-mobile-settings-chat.png'});
 if(await page.locator('#fullscreen-toggle').isVisible()){
  await page.locator('#fullscreen-toggle').tap();await page.waitForFunction(()=>document.fullscreenElement===document.documentElement);
  assert.equal(await page.locator('#fullscreen-toggle').getAttribute('aria-pressed'),'true');
  await page.locator('#fullscreen-toggle').tap();await page.waitForFunction(()=>!document.fullscreenElement);
  assert.equal(await page.locator('#fullscreen-toggle').getAttribute('aria-pressed'),'false');
  await page.evaluate(()=>{document.documentElement.requestFullscreen=async()=>{throw new Error('Denied by browser');};});
  await page.locator('#fullscreen-toggle').tap();await page.waitForFunction(()=>document.querySelector('#fullscreen-hint').textContent.includes('не разрешил'));
  assert(!await page.locator('#fullscreen-toggle').isDisabled());
 }
 await page.evaluate(async()=>{
  Object.defineProperty(document,'fullscreenEnabled',{value:false,configurable:true});
  const {createFullscreenControls}=await import('/src/fullscreen.ts');
  document.querySelector('.fullscreen-controls').replaceWith(createFullscreenControls());
 });
 assert(!await page.locator('#fullscreen-toggle').isVisible());assert((await page.locator('#fullscreen-hint').textContent()).includes('На экран Домой'));
 await page.locator('#settings-toggle').tap();assert(!await page.locator('#meadow-chat').isVisible());
 assert.deepEqual(errors,[]);console.log(JSON.stringify({engine:safari?'WebKit':'Chromium',profile:iphone?'iPhone':'Android',multiTouch:!safari,interaction:true,errors}));
 await page.close();
 if(!safari){
  const desktop=await browser.newPage({viewport:{width:1280,height:860}});
  await desktop.goto(base);await desktop.waitForSelector('#startup-loader',{state:'hidden',timeout:180000});
  assert.equal(await desktop.locator('.touch-ui,#touch-controls').count(),0);
  assert.equal(await desktop.locator('#tasks-toggle').getAttribute('aria-expanded'),'true');
  await desktop.click('#new-game');await desktop.fill('#player-name-input','Компьютер');await desktop.click('#start-game');
  await desktop.keyboard.down('KeyW');await desktop.waitForTimeout(300);await desktop.keyboard.up('KeyW');
  await checkHud(desktop,false);assert(await desktop.locator('#meadow-chat').isVisible());await desktop.screenshot({path:process.env.TEMP+'/kirby-desktop-hud.png'});
  await desktop.keyboard.press('Escape');assert(await desktop.locator('[data-controls="keyboard"]').isVisible());assert(!await desktop.locator('.touch-chat-buttons').isVisible());
  await desktop.screenshot({path:process.env.TEMP+'/kirby-mobile-desktop.png'});
  console.log('Desktop: keyboard controls and UI retained');
 }
}finally{await browser.close();}
