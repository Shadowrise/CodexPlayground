import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');
  localStorage.setItem('kirby-input-device-v1',JSON.stringify(['Startup test pad',0]));window.startupPadButtons=[];
  Object.defineProperty(navigator,'getGamepads',{value:()=>[{id:'Startup test pad',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:18},(_,i)=>({pressed:window.startupPadButtons.includes(i),value:Number(window.startupPadButtons.includes(i))}))}]});
 });
 let release;const gate=new Promise(r=>release=r);await page.route('**/models/kirby-animated.glb',async route=>{await gate;await route.continue();});
 await page.goto(process.env.KIRBY_URL??'http://127.0.0.1:5174/',{waitUntil:'domcontentloaded'});
 await page.locator('#startup-loader').waitFor({state:'hidden',timeout:60000});assert(await page.locator('#new-game').isEnabled());
 assert(await page.locator('#start-game').isDisabled());assert(!(await page.locator('#character-select').evaluate(el=>el.inert)));
 await page.locator('#startup-menu .gamepad-hint').waitFor({state:'visible'});
 await page.evaluate(()=>window.startupPadButtons=[0]);await page.locator('.selection-card:not(#startup-menu)').waitFor({state:'visible'});
 await page.evaluate(()=>window.startupPadButtons=[]);
 const initial=await page.locator('.variant-button[aria-pressed="true"]').getAttribute('aria-label');
 await page.evaluate(()=>window.startupPadButtons=[15]);await page.waitForFunction(label=>document.querySelector('.variant-button[aria-pressed="true"]').getAttribute('aria-label')!==label,initial);
 await page.evaluate(()=>window.startupPadButtons=[]);
 await page.evaluate(()=>window.startupPadButtons=[1]);await page.locator('#startup-menu').waitFor({state:'visible'});
 await page.evaluate(()=>window.startupPadButtons=[]);
 await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Проверка');
 await page.locator('#character-back').click();assert(await page.locator('#startup-menu').isVisible());
 await page.locator('#new-game').click();assert.equal(await page.locator('#player-name-input').inputValue(),'Проверка');
 release();await page.waitForFunction(()=>!document.querySelector('#start-game').disabled,{},{timeout:60000});
 await page.locator('#start-game').click();await page.locator('#settings-toggle').click();assert(await page.locator('#exit-to-menu').isVisible());
 await page.locator('#exit-to-menu').click();await page.locator('#startup-loader').waitFor({state:'hidden',timeout:60000});assert(await page.locator('#startup-menu').isVisible());assert.deepEqual(errors,[]);
 await page.route('**/models/kirby-animated.glb',route=>route.abort());await page.reload({waitUntil:'domcontentloaded'});await page.locator('#loading-retry').waitFor({state:'visible',timeout:60000});assert(await page.locator('#startup-loader').isVisible());
 console.log('PASS early interactive menu with gamepad, delayed-model start gate, solo exit and recoverable load failure');
}finally{await browser.close();}
