import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,readFile,stat,writeFile} from 'node:fs/promises';

const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const output='node_modules/.cache/menu-backdrop';await mkdir(output,{recursive:true});
const base=process.env.KIRBY_URL??'http://127.0.0.1:5174/';
const composition=JSON.parse(await readFile('design/menu-backdrop/composition.json','utf8'));
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],requests=[];
 page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>requests.push(request.url()));
 await page.addInitScript(()=>localStorage.setItem('kirby-language-v1','ru'));
 let releaseMain,releaseVideo;const mainGate=new Promise(resolve=>releaseMain=resolve),videoGate=new Promise(resolve=>releaseVideo=resolve),assetGate=new Promise(()=>{});
 await page.route('**/assets/main-*.js',async route=>{await mainGate;await route.continue();});
 await page.route('**/backgrounds/*.mp4*',async route=>{await videoGate;await route.continue();});
 await page.route('**/models/**',async()=>{await assetGate;});
 await page.route('**/world/environment.bin.gz*',async()=>{await assetGate;});
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.locator('#menu-backdrop[data-state="ready"] img').waitFor({state:'visible'});
 assert.equal(await page.evaluate(()=>performance.getEntriesByName('kirby-game-ready').length),0);
 const paint=await page.evaluate(()=>({readyMs:Math.round(performance.getEntriesByName('kirby-menu-backdrop-ready')[0].startTime),paintMs:Math.round(performance.getEntriesByName('kirby-menu-backdrop-paint')[0].duration)}));
 assert(!requests.some(url=>url.includes('loading-meadow.webp')));
 assert.equal(await page.locator('#menu-backdrop button, #menu-backdrop .panel, #menu-backdrop canvas').count(),0);
 assert.equal(await page.locator('#menu-backdrop video').evaluate(video=>getComputedStyle(video).opacity),'0','poster appears while the video is downloading');
 await page.evaluate(()=>document.querySelector('#startup-loader').hidden=true);
 await page.screenshot({path:`${output}/poster.png`});releaseVideo();
 await page.waitForFunction(()=>document.querySelector('#menu-backdrop video').currentTime>.3);
 const metadata=await page.locator('#menu-backdrop video').evaluate(video=>({width:video.videoWidth,height:video.videoHeight,duration:video.duration,muted:video.muted,loop:video.loop,inline:video.playsInline,controls:video.controls}));
 assert.equal(metadata.width,1280);assert.equal(metadata.height,720);assert(metadata.duration>11&&metadata.duration<13);
 assert(metadata.muted&&metadata.loop&&metadata.inline&&!metadata.controls);
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(150);
 const stillTime=await page.locator('#menu-backdrop video').evaluate(video=>video.currentTime);
 for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:844,height:390}]){
  await page.setViewportSize(viewport);await page.screenshot({path:`${output}/scene-${viewport.width}.png`});
  assert(await page.locator('#menu-backdrop video').evaluate(video=>getComputedStyle(video).filter.includes('blur')));
 }
 await page.waitForTimeout(250);
 assert.equal(await page.locator('#menu-backdrop video').evaluate(video=>video.currentTime),stillTime,'reduced motion pauses the video');
 await page.setViewportSize({width:1440,height:900});await page.emulateMedia({reducedMotion:'no-preference'});
 await page.waitForFunction(time=>document.querySelector('#menu-backdrop video').currentTime>time+.3,stillTime);
 await page.locator('#menu-backdrop video').evaluate(video=>video.currentTime=video.duration-.2);
 await page.waitForFunction(()=>document.querySelector('#menu-backdrop video').currentTime<1.5,null,{timeout:5000});
 // Browser lifecycle events pause and resume the existing decoder.
 await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
 assert(await page.locator('#menu-backdrop video').evaluate(video=>video.paused));
 await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
 await page.waitForFunction(()=>!document.querySelector('#menu-backdrop video').paused);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});
 assert(await page.locator('#menu-backdrop video').evaluate(video=>video.paused));
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{value:false,configurable:true});document.dispatchEvent(new Event('visibilitychange'));document.querySelector('#startup-loader').hidden=false;});
 releaseMain();await page.locator('#startup-loader').waitFor({state:'hidden',timeout:60000});
 const visibleKirbys=[];
 for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
  await page.setViewportSize(viewport);await page.screenshot({path:`${output}/menu-${viewport.width}.png`});
  const visibleGameButtons=await page.locator('button').evaluateAll(buttons=>buttons.filter(button=>!button.closest('#character-select')&&button.getClientRects().length>0).map(button=>button.id));
  assert.deepEqual(visibleGameButtons,[],'the backdrop has no game HUD or control buttons');
  const menu=await page.locator('#startup-menu').boundingBox(),scale=Math.max(viewport.width/composition.width,viewport.height/composition.height)*1.04;
  const visible=composition.characterCenters.filter(point=>{
   const x=viewport.width/2+(point.x-.5)*composition.width*scale,y=viewport.height/2+(point.y-.5)*composition.height*scale;
   return x>25&&x<viewport.width-25&&y>25&&y<viewport.height-25&&(x<menu.x-15||x>menu.x+menu.width+15||y<menu.y-15||y>menu.y+menu.height+15);
  }).length;
  assert(visible>=2,`at least two real Kirby models remain visible around the ${viewport.width}px menu`);visibleKirbys.push({width:viewport.width,count:visible});
 }
 const reduced=await browser.newContext({reducedMotion:'reduce'}),reducedPage=await reduced.newPage(),reducedRequests=[];
 reducedPage.on('request',request=>reducedRequests.push(request.url()));
 await reducedPage.route('**/assets/main-*.js',()=>{});
 await reducedPage.goto(base,{waitUntil:'domcontentloaded'});await reducedPage.locator('#menu-backdrop[data-state="ready"] img').waitFor({state:'visible'});
 assert(!reducedRequests.some(url=>url.includes('meadow-menu.mp4')),'reduced motion uses only the poster');await reduced.close();
 const fallback=await browser.newPage();await fallback.route('**/assets/main-*.js',()=>{});await fallback.route('**/backgrounds/*.mp4*',route=>route.abort());
 await fallback.goto(base,{waitUntil:'domcontentloaded'});await fallback.waitForFunction(()=>!!document.querySelector('#menu-backdrop video').error);
 assert.equal(await fallback.locator('#menu-backdrop video').evaluate(video=>getComputedStyle(video).opacity),'0');assert(await fallback.locator('#menu-backdrop img').isVisible());await fallback.close();
 const sizes={video:(await stat('public/backgrounds/meadow-menu.mp4')).size,poster:(await stat('public/backgrounds/meadow-menu-poster.jpg')).size};
 assert(sizes.video<2_500_000);assert(sizes.poster<200_000);assert.deepEqual(errors,[]);
 const report={result:'PASS',paint,metadata,sizes,visibleKirbys,hiddenGameUI:true,reducedMotion:true,loop:true,posterFallback:true,errors};
 await writeFile(`${output}/checks.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
