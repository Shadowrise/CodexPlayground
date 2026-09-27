import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const server='http://127.0.0.1:8787',game='http://127.0.0.1:5173';
const password=(await readFile(new URL('../../game-server/.dev.vars',import.meta.url),'utf8')).match(/^ADMIN_PASSWORD=(.+)$/m)[1].trim();
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const admin=await browser.newPage({viewport:{width:1500,height:950}}),errors=[];admin.on('pageerror',e=>errors.push(e.message));
 await admin.goto(server+'/admin');await admin.locator('#password').fill(password);await admin.getByRole('button',{name:'Войти',exact:true}).click();await admin.locator('#dashboard').waitFor({state:'visible'});
 assert(await admin.getByRole('link',{name:'История',exact:true}).isVisible());await admin.locator('#rows tr').first().waitFor();
 assert((await admin.locator('#rows').textContent()).includes('из 13'));
 await admin.locator('#mode').selectOption('solo');await admin.getByRole('button',{name:'Показать',exact:true}).click();await admin.waitForFunction(()=>!document.querySelector('#message').textContent);
 assert((await admin.locator('#rows tr').allTextContents()).every(t=>t.includes('Одиночная')));
 await admin.screenshot({path:process.env.TEMP+'/kirby-admin-history.png'});
 await admin.reload();await admin.locator('#dashboard').waitFor({state:'visible'});await admin.locator('#logout').click();await admin.locator('#login').waitFor({state:'visible'});
 assert.equal((await admin.request.get(server+'/admin/api/history')).status(),401);assert.deepEqual(errors,[]);
 // The real game keeps moving when every telemetry request fails.
 const page=await browser.newPage({viewport:{width:1280,height:860}}),gameErrors=[];let reports=0;
 page.on('pageerror',e=>gameErrors.push(e.message));await page.route('**/history/solo',async route=>{reports++;await route.abort('failed');});
 await page.goto(game);await page.locator('#startup-loader').waitFor({state:'hidden',timeout:180000});
 await page.evaluate(async()=>{
  const url=performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='/src/controller.ts').name;
  const {CharacterController}=await import(url),update=CharacterController.prototype.update;
  CharacterController.prototype.update=function(...args){window.__actor=this;return update.apply(this,args);};
  const historyUrl=performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='/src/solo-history.ts').name;
  const {SoloHistory}=await import(historyUrl),report=SoloHistory.prototype.report;
  SoloHistory.prototype.report=function(...args){window.__history=this;return report.apply(this,args);};
 });
 await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Без статистики');await page.locator('#start-game').click();
 await page.waitForFunction(()=>window.__actor&&window.__history);await page.evaluate(()=>window.__actor.actor.position.set(0,0,0));
 const initial=await page.evaluate(()=>window.__actor.actor.position.toArray());await page.keyboard.down('w');
 await page.waitForFunction(([x,,z])=>Math.hypot(window.__actor.actor.position.x-x,window.__actor.actor.position.z-z)>.5,initial);await page.keyboard.up('w');
 await page.evaluate(()=>{window.__history.report(false);const original=window.fetch;window.fetch=()=>{throw Error('Synchronous fetch failure');};window.__history.report(false);window.fetch=original;});
 await page.keyboard.press('Space');await page.waitForFunction(()=>window.__actor.flight.active);assert(reports>=1);assert.deepEqual(gameErrors,[]);
 // Successful reports render scores and tasks from the actual client.
 await page.unroute('**/history/solo');await page.evaluate(()=>{window.__actor.achievements.add('mill');window.__history.report(false);});
 await admin.locator('#password').fill(password);await admin.getByRole('button',{name:'Войти',exact:true}).click();await admin.locator('#dashboard').waitFor({state:'visible'});
 await admin.locator('#name').fill('Без статистики');await admin.getByRole('button',{name:'Показать',exact:true}).click();await admin.waitForFunction(()=>document.querySelector('#rows').textContent.includes('1 из 13'));
 await page.locator('#settings-toggle').click();await page.locator('#exit-to-menu').click();
 await admin.locator('#refresh').click();await admin.waitForFunction(()=>document.querySelector('#rows').textContent.includes('Вышел'));
 console.log('PASS admin table/login/logout/filters, task counts, persistent cookie, solo movement with failed requests and final report');
}finally{await browser.close();}
