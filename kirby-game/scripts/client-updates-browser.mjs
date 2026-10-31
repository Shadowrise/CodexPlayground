import {chromium} from 'playwright';
import {preview} from 'vite';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';

const root=fileURLToPath(new URL('../',import.meta.url));
const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
const original=JSON.parse(await readFile(new URL('../dist/client-version.json',import.meta.url),'utf8')).version;
const entry=html.match(/<script type="module"[^>]*src="([^"]+)"/)[1];
const code=await readFile(new URL('../dist'+entry,import.meta.url),'utf8');
assert(code.includes(original),'the built code and version manifest must carry the same release ID');
let published=original,manifestStatus=200;
const manifestRequests=[],assetRequests=[];
const cache='public, max-age=31536000, immutable';
const server=await preview({configFile:false,root,preview:{host:'127.0.0.1',port:5192,strictPort:true,headers:{'Cache-Control':cache}},plugins:[{
 name:'client-updates-browser-fixture',
 configurePreviewServer(server){server.middlewares.use((request,response,next)=>{
  const url=new URL(request.url,'http://localhost');
  if(url.pathname.startsWith('/assets/'))assetRequests.push(url.pathname);
  if(url.pathname==='/client-version.json'){
   manifestRequests.push({url:url.href,cacheControl:request.headers['cache-control']});
   response.setHeader('Content-Type','application/json');response.setHeader('Cache-Control','no-store');response.statusCode=manifestStatus;
   response.end(JSON.stringify({version:published}));return;
  }
  // Simulate an atomic deployment with a fresh entry URL and embedded release ID.
  // The deliberately long HTML cache exercises tabs that reopen the old client.
  const nextEntry=`/assets/game-client-updates-${published}.js`;
  if(url.pathname==='/'){
   response.setHeader('Content-Type','text/html');response.setHeader('Cache-Control',cache);
   response.end(published===original?html:html.replace(entry,nextEntry));return;
  }
  if(url.pathname===nextEntry){
   response.setHeader('Content-Type','text/javascript');response.setHeader('Cache-Control',cache);
   response.end(code.replaceAll(original,published));return;
  }
  next();
 });},
}]});
const base='http://127.0.0.1:5192/';
let browser;
const observed=promise=>{void promise.catch(()=>{});return promise;};
try{
 browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const output=new URL('../.cache/client-updates/',import.meta.url);await mkdir(output,{recursive:true});
 const reports=[];
 for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
  console.log(`Checking ${viewport.width}px client`);
  published=original;manifestStatus=200;
  const context=await browser.newContext({viewport,hasTouch:viewport.width<500}),errors=[];
  await context.addInitScript(()=>{
   localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');
   // Local QA never posts gameplay history to the production Worker.
   const request=window.fetch.bind(window);
   window.fetch=(input,options)=>{
    const url=new URL(input instanceof Request?input.url:String(input),location.href);
    if(url.hostname.endsWith('.workers.dev'))return Promise.resolve(Response.json(url.pathname==='/players'?{players:0}:{ok:true}));
    return request(input,options);
   };
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  const initialCheck=observed(page.waitForResponse(response=>new URL(response.url()).pathname==='/client-version.json'));
  await page.goto(base,{waitUntil:'domcontentloaded'});await initialCheck;
  await page.waitForFunction(()=>performance.getEntriesByName('kirby-game-ready').length>0,{},{timeout:180000});
  console.log('Initial client loaded; waiting for a release check');
  const banner=page.locator('#client-update');assert.equal(await banner.isVisible(),false);
  const initialTime=await page.evaluate(()=>performance.timeOrigin);
  const entryRequests=assetRequests.filter(path=>path===entry).length;
  published=randomUUID();
  const periodic=observed(page.waitForResponse(response=>new URL(response.url()).pathname==='/client-version.json',{timeout:75000}));
  if(viewport.width<500||process.env.KIRBY_UPDATE_FAST_QA)await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await periodic;await banner.waitFor({state:'visible'});
  assert((await banner.textContent()).includes('несохранённый прогресс будет потерян'));
  assert.equal(await page.evaluate(()=>document.activeElement.id),'new-game','showing the banner must not steal focus');
  await page.screenshot({path:fileURLToPath(new URL(`menu-${viewport.width}.png`,output))});
  await page.locator('#client-update-close').click();await banner.waitFor({state:'hidden'});
  assert.equal(await page.evaluate(()=>performance.timeOrigin),initialTime,'closing must never reload the page');
  async function check(event){
   const done=observed(page.waitForResponse(response=>new URL(response.url()).pathname==='/client-version.json'));
   await page.evaluate(event=>{
    if(event==='visibilitychange')document.dispatchEvent(new Event(event));
    else if(event==='pageshow')window.dispatchEvent(new PageTransitionEvent(event,{persisted:true}));
    else window.dispatchEvent(new Event(event));
   },event);
   await done;await page.waitForTimeout(50);
  }
  for(const event of ['visibilitychange','focus','pageshow','online']){await check(event);assert.equal(await banner.isVisible(),false,'a dismissed release must stay dismissed');}
  // A new tab reuses the cached old entry but still checks the current manifest immediately.
  const reopened=await context.newPage();reopened.on('pageerror',error=>errors.push(error.message));
  const reopenedCheck=observed(reopened.waitForResponse(response=>new URL(response.url()).pathname==='/client-version.json'));
  await reopened.goto(base,{waitUntil:'domcontentloaded'});await reopenedCheck;
  await reopened.waitForFunction(()=>performance.getEntriesByName('kirby-game-ready').length>0,{},{timeout:180000});
  assert(await reopened.locator('#client-update').isVisible(),'a newly opened cached client must immediately notice the release');
  assert.equal(assetRequests.filter(path=>path===entry).length,entryRequests,'the new tab must actually reuse the cached old entry');
  console.log('Cached new tab and dismissal checked');
  await reopened.close();await page.bringToFront();
  await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Проверка обновлений');await page.locator('#start-game').click();
  await page.waitForFunction(()=>performance.getEntriesByName('kirby-first-frame').length>0,{},{timeout:180000});
  assert(await page.locator('#game canvas').isVisible());
  await page.locator('#settings-toggle').click();await page.locator('#save-game').click();
  const saved=await page.evaluate(()=>localStorage.getItem('kirby-save-v1'));assert(saved);
  await page.locator('#settings-toggle').click();
  published=randomUUID();await check('focus');await banner.waitFor({state:'visible'});
  const rect=await banner.boundingBox();assert(rect.x>=0&&rect.x+rect.width<=viewport.width&&rect.y>=0);
  await page.screenshot({path:fileURLToPath(new URL(`game-${viewport.width}.png`,output))});
  console.log('Checking offline recovery and keyboard dismissal');
  manifestStatus=503;await check('online');assert(await banner.isVisible());manifestStatus=200;
  const previousFocus=await page.evaluate(()=>document.activeElement.id);
  await page.locator('#client-update-close').focus();await page.keyboard.press('Escape');await banner.waitFor({state:'hidden'});
  assert.equal(await page.evaluate(()=>document.activeElement.id),previousFocus,'closing with the keyboard must restore the previous focus');
  assert.equal(await page.evaluate(()=>performance.timeOrigin),initialTime);
  console.log('Checking reload');
  published=randomUUID();await check('pageshow');await banner.waitFor({state:'visible'});
  const navigation=observed(page.waitForEvent('domcontentloaded'));await page.locator('#client-update-reload').click();await navigation;
  await page.waitForFunction(()=>performance.getEntriesByName('kirby-game-ready').length>0,{},{timeout:180000});
  assert.notEqual(await page.evaluate(()=>performance.timeOrigin),initialTime);
  assert.equal(await banner.isVisible(),false,'refresh must load the new entry even when the old HTML was cached');
  assert.equal(await page.evaluate(()=>localStorage.getItem('kirby-save-v1')),saved,'refresh must preserve an existing save');
  assert(assetRequests.some(path=>path===`/assets/game-client-updates-${published}.js`));
  console.log('Game entry, save, dismissal and fresh-file reload checked');
  for(const [language,title] of [['en','A new game version is available'],['bg','Налична е нова версия на играта']]){
   await page.locator(`#startup-menu button[data-language="${language}"]`).click();
   published=randomUUID();await check('visibilitychange');await banner.waitFor({state:'visible'});
   assert.equal(await page.locator('#client-update-title').textContent(),title);
   await page.locator('#client-update-close').click();
  }
  assert.deepEqual(errors,[]);reports.push({viewport,cachedNewTab:true,dismissWithoutReload:true,newReleaseReappears:true,freshFilesAfterReload:true,savedProgressPreserved:true,errors});
  await context.close();
 }
 console.log(JSON.stringify({reports,manifestChecks:manifestRequests.length},null,2));
 console.log('PASS client updates: polling, activation, cached new tab, dismiss, recovery, reload, saves and translations');
}catch(error){console.error(error);throw error;}
finally{await browser?.close();server.httpServer.closeAllConnections();await new Promise(resolve=>server.httpServer.close(resolve));}
