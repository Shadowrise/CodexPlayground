import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const output=fileURLToPath(new URL('../node_modules/.cache/meta-knight-sword/',import.meta.url));
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[],frames=[];
 page.on('pageerror',e=>errors.push(e.stack));
 page.on('console',m=>{if(m.type()==='error'&&/WebGL|THREE|shader/i.test(m.text()))errors.push(m.text());});
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
 for(const endpoint of ['room','players','history/solo'])await page.route('**/'+endpoint,r=>r.fulfill({json:{ok:true,players:0,occupiedVariants:[],capacity:14}}));
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.swordQA={THREE,travel:cosmicArena,renderer,get c(){return character}};'});});
 await page.goto(process.env.GAME_URL??'http://127.0.0.1:5193/');
 await page.waitForFunction(()=>!!window.swordQA,null,{timeout:180000});await page.locator('#startup-loader').waitFor({state:'hidden',timeout:180000});
 await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Дуэлянт');await page.locator('#start-game').click();
 await page.waitForFunction(()=>!!swordQA.c);
 await page.evaluate(async()=>{const q=swordQA;await q.travel.enter(q.c);q.renderer.setAnimationLoop(null);q.c.actor.position.set(1987,0,7);q.c.yaw=Math.PI;q.c.actor.rotation.y=Math.PI;q.travel.camera.position.set(2019,20,20);q.travel.camera.lookAt(2000,2,-7);q.travel.camera.updateMatrixWorld();});
 for(const [stage,step,f,label] of [
  ['slash-warn',0,0,'Guard'],['slash-warn',0,.5,'Raised wind-up'],['slash-warn',0,1,'Ready at sector edge'],
  ['slash',1,0,'Forehand start'],['slash',1,.5,'Forehand centre'],['slash',1,1,'Forehand finish'],
  ['slash-warn',2,.5,'Backhand wind-up'],['slash',3,.5,'Backhand centre'],['slash',3,1,'Backhand finish'],
 ]){
  const metrics=await page.evaluate(({stage,step,f})=>{
   const q=swordQA,s={id:123,revision:step+1,stage,step,since:1000,until:stage==='slash'?1250:2600,checked:1000,phase:1,hp:12,players:{solo:{hp:5,hits:0,reflects:0}},target:'solo',from:[0,0,-9],to:[0,0,-9],yaw:0,height:0,cycle:1,pattern:'sword',openHit:false};
   const now=s.since+(s.until-s.since)*f;q.travel.battleView.update(s,'solo',now,0,false,'Q',true);q.travel.render();
   const blade=q.travel.knight.actor.getObjectByName('Galaxia'),tip=blade.localToWorld(new q.THREE.Vector3(-.315,2.05,0)),bounds=new q.THREE.Box3().setFromObject(blade);
   return {tip:tip.toArray(),floor:bounds.min.y};
  },{stage,step,f});
  assert(metrics.floor>.15,'sword stays above the arena floor');
  const path=output+`${frames.length}-${stage}.png`;await page.screenshot({path});frames.push({stage,step,f,label,path,...metrics});
 }
 const sheet=await browser.newPage({viewport:{width:1536,height:1200}});
 const images=await Promise.all(frames.map(async frame=>({...frame,src:`data:image/png;base64,${(await readFile(frame.path)).toString('base64')}`})));
 await sheet.setContent(`<html><style>*{box-sizing:border-box}body{margin:0;padding:16px;background:#101628;color:white;font:16px system-ui}h1{margin:0 0 12px;font-size:24px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}figure{margin:0;background:#1f2844;border-radius:10px;overflow:hidden}img{display:block;width:100%}figcaption{padding:8px 12px}</style><h1>Meta Knight · sector sword choreography</h1><div class="grid">${images.map(frame=>`<figure><img src="${frame.src}"><figcaption>${frame.label}</figcaption></figure>`).join('')}</div></html>`);
 await sheet.screenshot({path:output+'contact-sheet.png',fullPage:true});
 assert.deepEqual(errors,[]);await writeFile(output+'report.json',JSON.stringify({frames,errors},null,2));console.log(JSON.stringify({output,frames,errors}));
}finally{await browser.close();}
