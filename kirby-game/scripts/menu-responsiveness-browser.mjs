import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';

const base=process.env.KIRBY_URL??'http://127.0.0.1:5183/';
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const reports=[],cache=new URL('../node_modules/.cache/menu-responsiveness/',import.meta.url);
await mkdir(cache,{recursive:true});
try{
 for(const viewport of [{width:1280,height:850},{width:390,height:844}]){
  const context=await browser.newContext({viewport,hasTouch:viewport.width<500}),page=await context.newPage(),errors=[];
  const tap=(x,y)=>viewport.width<500?page.touchscreen.tap(x,y):page.mouse.click(x,y);
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');
   window.menuChecks={clicks:[],frames:[],tasks:[],audio:[]};
   new PerformanceObserver(list=>window.menuChecks.tasks.push(...list.getEntries().map(e=>({start:e.startTime,ms:e.duration})))).observe({type:'longtask',buffered:true});
   document.addEventListener('click',e=>{
    if(!e.target.closest('.variant-button,#start-game'))return;
    const record={target:e.target.closest('button').id||'variant',input:performance.now()-e.timeStamp};window.menuChecks.clicks.push(record);
    requestAnimationFrame(()=>requestAnimationFrame(()=>{record.paint=performance.now()-e.timeStamp;record.loader=!document.querySelector('#startup-loader').hidden;}));
   },true);
   const create=AudioContext.prototype.createBuffer;
   AudioContext.prototype.createBuffer=function(...args){window.menuChecks.audio.push({time:performance.now(),loader:!document.querySelector('#startup-loader').hidden});return create.apply(this,args);};
  });
  await page.route('**/history/solo',route=>route.fulfill({json:{ok:true}}));
  let release;const gate=new Promise(r=>release=r);
  await page.route('**/world/environment.bin.gz*',async route=>{await gate;await route.continue();});
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('#new-game').click();
  await page.locator('#player-name-input').fill('Отзывчивость');
  const buttons=page.locator('.variant-button:not(.variant-locked)'),boxes=[await buttons.nth(0).boundingBox(),await buttons.nth(1).boundingBox()];
  await page.evaluate(()=>{
   const tick=time=>{if(window.lastMenuFrame)window.menuChecks.frames.push(time-window.lastMenuFrame);window.lastMenuFrame=time;if(!performance.getEntriesByName('kirby-game-ready').length)requestAnimationFrame(tick);};requestAnimationFrame(tick);
  });
  release();
  let clicks=0;
  while(!await page.evaluate(()=>performance.getEntriesByName('kirby-game-ready').length)){
   const box=boxes[clicks++%2];await tap(box.x+box.width/2,box.y+box.height/2);await new Promise(r=>setTimeout(r,40));
  }
  assert(clicks>10);assert(await page.locator('#startup-loader').isHidden());
  const report=await page.evaluate(()=>window.menuChecks);
  report.viewport=viewport;report.maxFrame=Math.max(...report.frames);report.maxInput=Math.max(...report.clicks.map(c=>c.input));report.maxPaint=Math.max(...report.clicks.filter(c=>c.paint).map(c=>c.paint));
  assert(report.maxInput<500&&report.maxPaint<500,'background scene work must not stall menu feedback for half a second');
  console.log(JSON.stringify({viewport,maxFrame:report.maxFrame,maxInput:report.maxInput,maxPaint:report.maxPaint}));
  // Enter while the scene is being built and a model is still downloading.
  // The overlay must paint before synthesis, then entry continues automatically.
  let releaseEntry;const entryGate=new Promise(r=>releaseEntry=r);
  await page.unroute('**/world/environment.bin.gz*');await page.route('**/models/kirby-animated.glb',async route=>{await entryGate;await route.continue();});
  await page.reload({waitUntil:'domcontentloaded'});await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Быстрый вход');
  await page.waitForFunction(()=>performance.getEntriesByName('kirby-environment-ready').length);
  await page.locator('#start-game').scrollIntoViewIfNeeded();
  const start=await page.locator('#start-game').boundingBox();await tap(start.x+start.width/2,start.y+start.height/2);
  await page.locator('#startup-loader').waitFor({state:'visible'});await page.waitForFunction(()=>window.menuChecks.clicks.some(c=>c.target==='start-game'&&c.paint));
  report.entry=await page.evaluate(()=>window.menuChecks.clicks.find(c=>c.target==='start-game'));
  assert(report.entry.loader);assert(report.entry.paint<200,`entry feedback took ${report.entry.paint} ms`);
  await page.waitForFunction(()=>window.menuChecks.audio.length>0);assert(await page.evaluate(()=>window.menuChecks.audio.every(a=>a.loader)));
  await page.screenshot({path:new URL(`loading-${viewport.width}.png`,cache).pathname.replace(/^\/(\w:)/,'$1')});
  releaseEntry();await page.waitForFunction(()=>!document.body.classList.contains('choosing'),null,{timeout:120000});
  assert(await page.locator('#startup-loader').isHidden());assert.deepEqual(errors,[]);
  await page.waitForFunction(()=>performance.getEntriesByName('kirby-first-frame').length);
  await page.screenshot({path:new URL(`game-${viewport.width}.png`,cache).pathname.replace(/^\/(\w:)/,'$1')});
  reports.push(report);console.log(JSON.stringify({viewport,maxFrame:report.maxFrame,maxInput:report.maxInput,maxPaint:report.maxPaint,entry:report.entry}));await context.close();
 }
 await writeFile(new URL('checks.json',cache),JSON.stringify(reports,null,2));
 console.log('PASS: real clicks during scene preparation, loading paint before synthesis, automatic desktop/touch entry');
}finally{await browser.close();}
