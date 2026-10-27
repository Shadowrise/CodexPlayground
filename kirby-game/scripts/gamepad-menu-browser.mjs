import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {extname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

// Exercise the production startup menu while model downloads are still pending.
// Fulfill local build files directly, so no running server or external network is needed.
const dist=fileURLToPath(new URL('../dist/',import.meta.url));
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json',
  '.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'};
let releaseModels;const modelsReady=new Promise(resolve=>releaseModels=resolve);
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
  const context=await browser.newContext({viewport:{width:1280,height:800}}),errors=[];
  await context.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.origin!=='http://127.0.0.1:5194')return route.fulfill({json:{ok:true,players:0,occupiedVariants:[],capacity:14}});
    if(url.pathname.startsWith('/models/'))await modelsReady;
    if(url.pathname.endsWith('.mp4'))return route.fulfill({status:204});
    const path=resolve(dist,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
    if(!path.startsWith(dist.endsWith(sep)?dist:dist+sep))return route.abort();
    try{await route.fulfill({contentType:types[extname(path)]??'application/octet-stream',body:await readFile(path)});}
    catch(error){if(error.code==='ENOENT')await route.fulfill({status:404});else throw error;}
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
    if(!sessionStorage.getItem('qa-menu-initialized')){
      localStorage.clear();localStorage.setItem('kirby-language-v1','ru');sessionStorage.setItem('qa-menu-initialized','1');
    }
    window.qaPad={id:'Unknown Gamepad (Vendor: 045e Product: 0b13)',index:0,connected:true,mapping:'',
      axes:[.055,-.045,-.039,-1,-1,-.002,0,0,0,1227133568],
      buttons:Array.from({length:15},()=>({pressed:false,touched:false,value:0}))};
    window.qaPads=[];Object.defineProperty(navigator,'getGamepads',{value:()=>qaPads});
  });
  await page.goto('http://127.0.0.1:5194/',{waitUntil:'commit'});
  await page.locator('#new-game').waitFor({state:'visible',timeout:60000});
  assert.equal(await page.evaluate(()=>performance.getEntriesByName('kirby-game-ready').length),0);
  await page.evaluate(()=>{qaPads=[qaPad];qaPad.buttons[0]={pressed:true,touched:true,value:1};});
  await page.locator('#startup-menu').waitFor({state:'hidden'});
  const selector=page.locator('.selection-input-row select');
  const key=await page.evaluate(()=>JSON.stringify([qaPad.id,qaPad.index]));
  assert.equal(await selector.inputValue(),key,'the discovery press selects the controller and opens New Game');
  await page.keyboard.press('k');assert.equal(await selector.inputValue(),'keyboard');
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  assert.equal(await selector.inputValue(),'keyboard','the held A button does not take control back');
  await page.evaluate(()=>qaPad.buttons[0]={pressed:false,touched:false,value:0});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.evaluate(()=>qaPad.buttons[1]={pressed:true,touched:true,value:1});
  await page.locator('#startup-menu').waitFor({state:'visible'});
  assert.equal(await selector.inputValue(),key,'B switches to the controller and returns to the initial menu');
  await page.keyboard.press('Enter');
  await page.locator('#startup-menu').waitFor({state:'hidden'});
  assert.equal(await selector.inputValue(),'keyboard','the first keyboard Enter also opens New Game');
  const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const neutral=async()=>{
    await page.evaluate(()=>{qaPad.buttons=qaPad.buttons.map(()=>({pressed:false,touched:false,value:0}));qaPad.axes[0]=.055;qaPad.axes[1]=-.045;qaPad.axes[9]=1227133568;});
    await settle();
  };
  const button=async index=>{await neutral();await page.evaluate(index=>qaPad.buttons[index]={pressed:true,touched:true,value:1},index);};
  const hat=async value=>{await neutral();await page.evaluate(value=>qaPad.axes[9]=value,value);};
  const focused=id=>page.waitForFunction(id=>document.activeElement?.id===id,id);
  await button(1);await page.locator('#startup-menu').waitFor({state:'visible'});
  await neutral();await page.keyboard.press('Escape');
  assert.equal(await selector.inputValue(),'keyboard');
  assert(await page.locator('#load-game').isDisabled());
  await hat(1/7);await focused('network-join');
  assert.equal(await selector.inputValue(),key,'the D-pad takes over without an A/B activation press');
  assert(await page.locator('#startup-menu').isVisible(),'moving down only highlights the action');
  assert.equal(await page.locator('#network-join').evaluate(button=>getComputedStyle(button).outlineWidth),'3px');
  await page.screenshot({path:fileURLToPath(new URL('../.cache/gamepad-menu-focus.png',import.meta.url))});
  await hat(-1);await focused('new-game');
  await hat(-1);await page.waitForFunction(()=>document.activeElement?.dataset.language==='ru');
  assert.equal(await page.locator('#startup-menu .language-switcher [data-language="ru"]').evaluate(button=>getComputedStyle(button).outlineWidth),'3px');
  await hat(-3/7);await page.waitForFunction(()=>document.documentElement.lang==='en');
  assert.equal(await page.evaluate(()=>localStorage.getItem('kirby-language-v1')),'en');
  assert.equal(await selector.inputValue(),key,'changing the language keeps controller input active');
  await hat(-3/7);await page.waitForFunction(()=>document.documentElement.lang==='bg');
  await hat(5/7);await page.waitForFunction(()=>document.documentElement.lang==='en');
  await hat(5/7);await page.waitForFunction(()=>document.documentElement.lang==='ru');
  await button(0);assert(await page.locator('#startup-menu').isVisible(),'A on a flag confirms the language without starting a game');
  await page.screenshot({path:fileURLToPath(new URL('../.cache/gamepad-language-focus.png',import.meta.url))});
  await hat(1/7);await focused('new-game');
  await hat(-1);await page.waitForFunction(()=>document.activeElement?.dataset.language==='ru');
  await hat(-1);await focused('network-join'); // Wrap upward from language past the disabled load action.
  await button(0);await page.locator('#startup-menu').waitFor({state:'hidden'});
  assert(await page.locator('#player-name-input').isVisible(),'A confirms the highlighted online entry');
  await button(1);await page.locator('#startup-menu').waitFor({state:'visible'});

  // Exercise all three actions without needing a real save or entering the world.
  await page.evaluate(()=>{
    const load=document.querySelector('#load-game');load.disabled=false;
    window.qaLoadClicks=0;load.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();qaLoadClicks++;},{capture:true,once:true});
  });
  await hat(1/7);await focused('load-game');
  await button(0);await page.waitForFunction(()=>qaLoadClicks===1);
  assert(await page.locator('#startup-menu').isVisible(),'A activates the focused load action rather than New Game');
  await hat(1/7);await focused('network-join');
  await hat(1/7);await page.waitForFunction(()=>document.activeElement?.dataset.language==='ru');
  await hat(1/7);await focused('new-game'); // Down from language returns to the first action.

  await page.evaluate(()=>{
    window.qaFocusMoves=[];document.querySelector('#startup-menu').addEventListener('focusin',event=>qaFocusMoves.push({id:event.target.closest('.language-switcher')?'language':event.target.id,time:performance.now()}));
  });
  await hat(1/7);await focused('load-game');
  await page.waitForFunction(()=>qaFocusMoves.length>=3);
  const moves=await page.evaluate(()=>qaFocusMoves.slice(0,3));
  assert.deepEqual(moves.map(move=>move.id),['load-game','network-join','language']);
  assert(moves[1].time-moves[0].time>=250,'holding a direction waits before repeating');
  await neutral();const count=await page.evaluate(()=>qaFocusMoves.length);await settle();
  assert.equal(await page.evaluate(()=>qaFocusMoves.length),count,'releasing the direction stops repeat');

  await page.evaluate(()=>{document.querySelector('#load-game').disabled=true;document.querySelector('#new-game').focus();});
  await page.keyboard.press('Escape');assert.equal(await selector.inputValue(),'keyboard');
  await page.evaluate(()=>qaPad.axes[1]=1);await focused('network-join');
  assert.equal(await selector.inputValue(),key,'a deliberate left-stick tilt can start navigation directly');
  await neutral();await page.evaluate(()=>qaPad.axes[1]=-1);await focused('new-game');
  await button(0);await page.locator('#startup-menu').waitFor({state:'hidden'});
  await button(1);await page.locator('#startup-menu').waitFor({state:'visible'});
  await hat(-1);await page.waitForFunction(()=>document.activeElement?.dataset.language==='ru');
  await hat(-3/7);await page.waitForFunction(()=>document.documentElement.lang==='en');
  await page.reload({waitUntil:'commit'});await page.locator('#new-game').waitFor({state:'visible',timeout:60000});
  assert.equal(await page.locator('html').getAttribute('lang'),'en');
  assert.equal(await page.locator('#startup-menu .language-switcher [aria-checked="true"]').getAttribute('data-language'),'en');
  assert.equal(await page.evaluate(()=>performance.getEntriesByName('kirby-game-ready').length),0);
  assert.deepEqual(errors,[]);
  console.log('PASS: initial-menu D-pad/stick navigation, language focus/change/persistence, disabled actions, wrap, repeat, A confirmation and B back work before world loading finishes.');
}finally{
  releaseModels();await browser.close();
}
