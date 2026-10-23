import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {GAME_MODEL_FILES} from '../src/game-assets.ts';

const base=process.env.KIRBY_URL??'http://127.0.0.1:5174/';
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const reports=[];
 for(const viewport of [{width:1280,height:850},{width:390,height:844}]){
  const context=await browser.newContext({viewport,hasTouch:viewport.width<500}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
   localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');
   new PerformanceObserver(list=>{(window.startupLongTasks??=[]).push(...list.getEntries().map(entry=>({start:entry.startTime,ms:entry.duration})));}).observe({type:'longtask',buffered:true});
  });
  await page.route('**/history/solo',route=>route.fulfill({json:{ok:true}}));
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.locator('#startup-loader').waitFor({state:'hidden'});
  assert(await page.locator('#new-game').isVisible());
  await page.waitForFunction(()=>performance.getEntriesByName('kirby-game-ready').length>0,{},{timeout:120000});
  assert(await page.locator('#game canvas').isHidden());
  assert(await page.locator('#start-game').isEnabled());
  assert.equal(await page.evaluate(()=>performance.getEntriesByName('kirby-first-frame').length),0);
  assert((await page.locator('#character-select').evaluate(el=>getComputedStyle(el).backgroundImage)).includes('loading-meadow.webp'));
  await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Загрузка');await page.locator('#start-game').click();
  await page.waitForFunction(()=>!document.body.classList.contains('choosing')&&performance.getEntriesByName('kirby-first-frame').length>0);
  const report=await page.evaluate(()=>{
   const marks=Object.fromEntries(performance.getEntriesByType('mark').map(entry=>[entry.name,Math.round(entry.startTime)]));
   const models=performance.getEntriesByType('resource').filter(entry=>entry.name.includes('/models/')&&entry.name.includes('.glb')).map(entry=>({file:entry.name.split('/').at(-1),startMs:Math.round(entry.startTime),downloadMs:Math.round(entry.duration)}));
   return {marks,models,firstFrameMs:Math.round(performance.getEntriesByName('kirby-first-frame')[0].duration),longTasks:window.startupLongTasks.map(entry=>({startMs:Math.round(entry.start),ms:Math.round(entry.ms)}))};
  });
  assert(report.marks['kirby-menu-ready']<report.marks['kirby-environment-ready']);
  assert.equal(report.models.length,GAME_MODEL_FILES.length);assert(report.models.every(model=>model.startMs<report.marks['kirby-menu-ready']));
  await page.waitForTimeout(500);assert.deepEqual(errors,[]);
  const cache=new URL('../node_modules/.cache/',import.meta.url);await mkdir(cache,{recursive:true});
  await page.screenshot({path:new URL(`startup-game-${viewport.width}.png`,cache).pathname.replace(/^\/(\w:)/,'$1')});
  reports.push({viewport,...report});await context.close();
 }
 console.log(JSON.stringify(reports,null,2));
 console.log('PASS: early menu, immediate transfers, static backdrop until requested and desktop/touch game entry');
}finally{await browser.close();}
