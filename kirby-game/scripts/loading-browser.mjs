import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {KIRBY_VARIANTS} from '../src/variant-palette.ts';

const base=process.env.KIRBY_URL??'http://127.0.0.1:5174/';
const actor=variant=>({variant,x:12,z:33,yaw:.8,size:1.4,fruitsEaten:5,achievements:['bench']});
const save={version:1,savedAt:new Date().toISOString(),player:actor(KIRBY_VARIANTS[0][0]),npcs:KIRBY_VARIANTS.slice(1,15).map(v=>actor(v[0])),fruits:Array(70).fill(false),dayPhase:.25};
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(save=>{
  localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');localStorage.setItem('kirby-save-v1',JSON.stringify(save));
  localStorage.setItem('kirby-input-device-v1',JSON.stringify(['Startup test pad',0]));window.startupPadButtons=[];
  Object.defineProperty(navigator,'getGamepads',{value:()=>[{id:'Startup test pad',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:18},(_,i)=>({pressed:window.startupPadButtons.includes(i),value:Number(window.startupPadButtons.includes(i))}))}]});
 },save);
 await page.route('**/history/solo',route=>route.fulfill({json:{ok:true}}));
 const waitMenu=async()=>{
  await page.locator('#startup-loader').waitFor({state:'hidden',timeout:120000});
  assert(await page.locator('#new-game').isEnabled());assert(await page.locator('#start-game').isEnabled());assert(await page.locator('#load-game').isEnabled());
  assert(!(await page.locator('#character-select').evaluate(el=>el.inert)));
  assert((await page.locator('#character-select').evaluate(el=>getComputedStyle(el).backgroundImage)).includes('loading-meadow.webp'));
 };
 const waitPlaying=async()=>{
  await page.locator('#startup-loader').waitFor({state:'hidden',timeout:120000});
  await page.waitForFunction(()=>!document.body.classList.contains('choosing'),null,{timeout:120000});
  assert(await page.locator('#game canvas').isVisible());assert.equal(await page.locator('body').getAttribute('aria-busy'),'false');
 };
 const exit=async()=>{await page.locator('#settings-toggle').click();await page.locator('#exit-to-menu').click();await waitMenu();assert(await page.locator('#game canvas').isHidden());};
 const waitForEntry=async()=>{
  await page.locator('#startup-loader').waitFor({state:'visible'});assert(await page.locator('.loading-orbit').isVisible());
  assert.equal(await page.locator('body').getAttribute('aria-busy'),'true');assert(await page.locator('#character-select').evaluate(el=>el.inert));
  assert(await page.locator('#game canvas').isHidden());
  assert.equal(await page.evaluate(()=>performance.getEntriesByName('kirby-game-ready').length),0);
 };

 // Entry must already work while the environment holds the module at a top-level await.
 let release;const environmentGate=new Promise(resolve=>release=resolve);
 await page.route('**/world/environment.bin.gz*',async route=>{await environmentGate;await route.continue();});
 await page.goto(base,{waitUntil:'domcontentloaded'});await waitMenu();
 await page.locator('#startup-menu .gamepad-hint').waitFor({state:'visible'});
 await page.evaluate(()=>window.startupPadButtons=[0]);await page.locator('.selection-card:not(#startup-menu)').waitFor({state:'visible'});
 await page.evaluate(()=>window.startupPadButtons=[]);
 const initial=await page.locator('.variant-button[aria-pressed="true"]').getAttribute('aria-label');
 await page.evaluate(()=>window.startupPadButtons=[15]);await page.waitForFunction(label=>document.querySelector('.variant-button[aria-pressed="true"]').getAttribute('aria-label')!==label,initial);
 await page.evaluate(()=>window.startupPadButtons=[1]);await page.locator('#startup-menu').waitFor({state:'visible'});await page.evaluate(()=>window.startupPadButtons=[]);
 await page.locator('#new-game').click();await page.locator('#start-game').click();assert(await page.locator('#startup-loader').isHidden());
 assert.equal(await page.locator('#player-name-input').getAttribute('aria-invalid'),'true');
 await page.locator('#player-name-input').fill('Проверка');await page.locator('#character-back').click();await page.locator('#new-game').click();
 assert.equal(await page.locator('#player-name-input').inputValue(),'Проверка');
 await page.locator('#start-game').click();await waitForEntry();
 await page.evaluate(()=>{document.querySelector('#start-game').click();document.querySelector('#load-game').click();});
 release();await waitPlaying();await page.unroute('**/world/environment.bin.gz*');
 assert.equal(await page.locator('#player-name').textContent(),'Проверка');
 console.log('PASS early menu/gamepad, name validation, one pending entry and new game during environment download');
 await exit();

 // A warm world stays behind the static menu and enters without showing a loader.
 await page.evaluate(()=>{window.loaderShows=0;new MutationObserver(()=>{if(document.body.classList.contains('loading'))window.loaderShows++;}).observe(document.body,{attributes:true,attributeFilter:['class']});});
 await page.locator('#load-game').click();await waitPlaying();
 assert.equal(await page.evaluate(()=>window.loaderShows),0);await page.waitForFunction(()=>document.querySelector('#player-size').textContent==='140%');
 await exit();
 console.log('PASS static menu after exit and immediate saved-game entry when the world is ready');

 // Saved games also accept a request while models are still downloading.
 let releaseModel;const modelGate=new Promise(resolve=>releaseModel=resolve);
 await page.route('**/models/kirby-animated.glb',async route=>{await modelGate;await route.continue();});
 await page.reload({waitUntil:'domcontentloaded'});await waitMenu();
 await page.locator('#load-game').click();await waitForEntry();releaseModel();await waitPlaying();
 await page.waitForFunction(()=>document.querySelector('#player-size').textContent==='140%');
 await page.unroute('**/models/kirby-animated.glb');assert.deepEqual(errors,[]);
 console.log('PASS saved-game request waits for models and restores progress automatically');

 await page.route('**/models/kirby-animated.glb',route=>route.abort());
 await page.reload({waitUntil:'domcontentloaded'});await page.locator('#loading-retry').waitFor({state:'visible',timeout:120000});
 assert(await page.locator('#startup-loader').isVisible());assert(await page.locator('.loading-orbit').isHidden());
 assert.deepEqual(errors,[]);
 console.log('PASS recoverable background load failure on the illustrated backdrop');
}finally{await browser.close();}
