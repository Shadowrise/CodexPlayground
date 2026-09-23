import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let release;const gate=new Promise(r=>release=r);await page.route('**/models/kirby-animated.glb',async route=>{await gate;await route.continue();});
 await page.goto('http://127.0.0.1:5173/',{waitUntil:'domcontentloaded'});
 await page.locator('#startup-loader').waitFor({state:'visible'});assert(await page.locator('#character-select').evaluate(el=>el.inert));release();
 await page.locator('#startup-loader').waitFor({state:'hidden',timeout:60000});assert(await page.locator('#new-game').isEnabled());assert(await page.locator('#start-game').isEnabled());
 await page.locator('#player-name-input').fill('Проверка');await page.locator('#new-game').click();await page.locator('#start-game').click();await page.locator('#settings-toggle').click();assert(await page.locator('#exit-to-menu').isVisible());
 await page.locator('#exit-to-menu').click();await page.locator('#startup-loader').waitFor({state:'hidden',timeout:60000});assert(await page.locator('#startup-menu').isVisible());assert.deepEqual(errors,[]);
 await page.route('**/models/kirby-animated.glb',route=>route.abort());await page.reload({waitUntil:'domcontentloaded'});await page.locator('#loading-retry').waitFor({state:'visible',timeout:60000});assert(await page.locator('#startup-loader').isVisible());
 console.log('PASS loading gate, ready menu, solo exit and recoverable load failure');
}finally{await browser.close();}
