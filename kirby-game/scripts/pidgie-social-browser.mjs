import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';

const game=fileURLToPath(new URL('../',import.meta.url));
const output=fileURLToPath(new URL('../node_modules/.cache/pidgie-social/',import.meta.url));
const base=process.env.GAME_URL??'http://127.0.0.1:5197';
let vite,browser;
const errors=[];
try{
 await mkdir(output,{recursive:true});
 if(!process.env.GAME_URL)vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5197','--strictPort'],{cwd:game,stdio:'ignore',windowsHide:true});
 for(let n=0;;n++){
  try{if((await fetch(base)).ok)break;}catch{}
  if(n>600)throw Error('Vite did not start');await new Promise(resolve=>setTimeout(resolve,200));
 }
 browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const enter=async(touch=false)=>{
  const context=await browser.newContext({viewport:{width:1280,height:800},hasTouch:touch,isMobile:touch});
  const page=await context.newPage();page.setDefaultTimeout(20000);
  page.on('pageerror',error=>errors.push(error.message));
  await page.routeWebSocket('**',()=>{});
  await page.route('https://kirby-game-server.kirby-game-server.workers.dev/**',route=>route.fulfill({json:{ok:true,players:0,occupiedVariants:[],capacity:14}}));
  await page.addInitScript(()=>{
   localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');localStorage.setItem('kirby-pidgie-unlocked-v1','1');
  });
  await page.route('**/src/main.ts*',async route=>{
   const response=await route.fetch();await route.fulfill({response,body:(await response.text())+`
window.socialTest={get c(){return character},get bird(){return pidgieNpc},emoteWheel,touch,renderer,scene,camera,cameraTarget,followCamera,pidgieSafeGround,localLog,bread,returnToMenu};`});
  });
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#start-game')?.disabled===false,undefined,{timeout:120000});
  await page.locator('#new-game').click();await page.locator('#variant-grid .pigeon-character').click();await page.locator('#player-name-input').fill('Пиджи');await page.locator('#start-game').click();
  await page.waitForFunction(()=>window.socialTest?.c?.isPigeon&&window.socialTest?.bird);
  return {page,context};
 };
 const {page,context}=await enter();
 const site=await page.evaluate(()=>{
  const w=window.socialTest;
  for(let z=-210;z<=210;z+=15)for(let x=-210;x<=210;x+=15){
   if([-6,-3,0,3,6,9,12].every(dz=>w.pidgieSafeGround(x,z+dz)))return [x,0,z];
  }
  throw Error('No clear greeting site');
 });
 await page.evaluate(p=>{
  const w=window.socialTest,c=w.c,b=w.bird;
  c.setActivity('Idle');c.actor.position.set(p[0],0,p[2]+9);c.surfaceY=0;c.yaw=Math.PI;c.actor.rotation.set(0,Math.PI,0);
  b.applyNetworkState({...b.networkState(),phase:'wander',p,yaw:0,elapsed:0,refuge:[p[0],p[2]],target:[p[0],p[2]],clip:'Idle',clipTime:0,pause:1,cooldown:0,followId:undefined,followSpeed:undefined,friend:undefined},true);
 },site);
 await page.waitForFunction(()=>window.socialTest.bird.phase==='greet'&&window.socialTest.bird.state==='Hello');
 const fearCount=await page.evaluate(()=>window.socialTest.bird.fearCount);
 await page.keyboard.press('6');await page.waitForFunction(()=>window.socialTest.c.state==='Peck');
 const peckPosition=await page.evaluate(()=>window.socialTest.c.actor.position.toArray());
 await page.waitForFunction(()=>window.socialTest.c.actions.get('Peck').time>.5);
 assert.deepEqual(await page.evaluate(()=>window.socialTest.c.actor.position.toArray()),peckPosition);
 await page.screenshot({path:output+'/ground-peck.png'});
 await page.keyboard.down('w');await page.waitForFunction(()=>window.socialTest.c.state==='Run');
 assert.equal(await page.evaluate(()=>window.socialTest.c.actions.get('Peck').isRunning()),false);
 await page.keyboard.press('6');assert.equal(await page.evaluate(()=>window.socialTest.c.state),'Run');
 await page.keyboard.up('w');await page.waitForFunction(()=>window.socialTest.c.state==='Idle');
 await page.keyboard.press('6');await page.waitForFunction(()=>window.socialTest.c.state==='Peck');
 await page.waitForFunction(()=>window.socialTest.c.state==='Idle');
 const wheel=await page.evaluate(()=>{
  const w=window.socialTest.emoteWheel,a=5*Math.PI*2/6;w.update(true,Math.sin(a),-Math.cos(a));
  const count=w.element.querySelectorAll('.emote-choice').length,selected=w.element.querySelector('.selected')?.textContent;
  return {count,selected,picked:w.update(false,0,0)};
 });
 assert.equal(wheel.count,6);assert.match(wheel.selected,/Клевать с земли/);assert.equal(wheel.picked,'Peck');
 await page.evaluate(()=>{const w=window.socialTest;w.c.actor.position.copy(w.bird.actor.position);w.c.actor.position.z+=2;});
 await page.waitForFunction(()=>window.socialTest.bird.state==='Run');
 await page.waitForFunction(()=>{
  const w=window.socialTest;return w.bird.state==='Idle'&&Math.abs(w.bird.actor.position.distanceTo(w.c.actor.position)-8)<.85;
 });
 assert.equal(await page.evaluate(()=>window.socialTest.bird.fearCount),fearCount);
 assert.equal(await page.evaluate(()=>window.socialTest.bird.actor.position.y),0);
 await page.evaluate(()=>window.socialTest.returnToMenu());await page.locator('#new-game').click();await page.locator('.variant-button').first().click();await page.locator('#start-game').click();
 await page.waitForFunction(()=>window.socialTest.c&&!window.socialTest.c.isPigeon);
 assert.equal(await page.evaluate(()=>window.socialTest.emoteWheel.element.querySelectorAll('.emote-choice').length),5);
 await page.keyboard.press('6');assert.equal(await page.evaluate(()=>window.socialTest.c.state),'Idle');
 await context.close();
 console.log('Desktop keyboard, emote wheel, greeting and retreat passed.');

 const mobile=await enter(true);
 await mobile.page.locator('#touch-emotes').tap();
 const choice=mobile.page.locator('#touch-emote-menu button').filter({hasText:'Клевать с земли'});
 assert.equal(await choice.count(),1);await choice.tap();await mobile.page.waitForFunction(()=>window.socialTest.c.state==='Peck');
 assert.equal(await mobile.page.locator('#touch-emote-menu').isVisible(),false);
 await mobile.context.close();
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,keyboard:true,gamepadWheel:wheel,touch:true,greetingAndRetreat:true,errors,output}));
}finally{await browser?.close();vite?.kill();}
