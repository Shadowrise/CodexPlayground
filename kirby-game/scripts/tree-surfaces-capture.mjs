import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import assert from 'node:assert/strict';
const url=process.env.GAME_URL??'http://127.0.0.1:5187/',out=fileURLToPath(new URL('../node_modules/.cache/tree-surfaces/',import.meta.url));await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1400,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL|shader/i.test(m.text()))errors.push(m.text());});
 await page.routeWebSocket(/.*/,ws=>ws.onMessage(()=>{}));await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
 for(const endpoint of ['room','players','history/solo'])await page.route('**/'+endpoint,r=>r.fulfill({json:{ok:true,players:0,occupiedVariants:[],capacity:14}}));
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.forestView={THREE,scene,camera,renderer,shadows,preparedShadows,celestialLighting,updateTreeShadows,updateSky,setupShadowMaterials,get c(){return character}};'});});
 await page.goto(url);await page.locator('#startup-loader').waitFor({state:'hidden',timeout:180000});await page.click('#new-game');await page.fill('#player-name-input','Лес');await page.click('#start-game');await page.waitForFunction(()=>window.forestView?.c);
 await page.evaluate(async()=>{
  const q=forestView;q.renderer.setAnimationLoop(null);const {daylight}=await import('/src/day-cycle.ts');q.day=daylight(.28);q.celestialLighting.update(q.day);q.updateTreeShadows(q.day);q.renderer.toneMappingExposure=1+q.day.day*.2;
 });
 await page.addStyleTag({content:'body > :not(#game){visibility:hidden!important}'});
 const prepare=async(eye,target)=>page.evaluate(({eye,target})=>{const q=forestView;q.camera.position.fromArray(eye);q.camera.lookAt(...target);q.camera.updateMatrixWorld();q.c.actor.position.set(eye[0],0,eye[2]);q.shadows.update();q.updateSky(0,q.camera,q.day);q.preparedShadows.update(q.day,q.camera.position);},{eye,target});
 const render=async()=>page.evaluate(()=>{const q=forestView;for(let i=0;i<3;i++)q.renderer.render(q.scene,q.camera);});
 await prepare([-112,4.8,-124],[-112,3,-168]);await render();await page.screenshot({path:out+'spruce-live-in-game.png'});
 await prepare([-92,6.2,-100],[-100,3.8,-111]);await render();await page.screenshot({path:out+'spruce-live-close.png'});
 console.log(JSON.stringify({errors}));
}finally{await browser.close();}
