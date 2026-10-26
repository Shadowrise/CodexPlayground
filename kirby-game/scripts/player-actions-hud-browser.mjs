import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const output=fileURLToPath(new URL('../node_modules/.cache/player-actions-hud/',import.meta.url));
await mkdir(output,{recursive:true});
const base=process.env.GAME_URL??'http://127.0.0.1:5173/';
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const report={errors:[],states:[],layouts:[]};
try{
 const page=await browser.newPage({viewport:{width:1000,height:600},deviceScaleFactor:2});
 page.on('pageerror',error=>report.errors.push(error.message));
 await page.route('**/__player-actions-qa',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:`<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/src/touch-controls.css"><style>body{margin:0;background:#182334;color:#fff;font-family:system-ui}#game{position:fixed;inset:0}canvas{width:100%;height:100%}</style></head><body><div id="game"><canvas></canvas></div><script type="module">
import {GLTFLoader} from '/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import {CharacterController} from '/src/controller.ts';
import {PlayerActionHud} from '/src/player-action-hud.ts';
import {TouchControls} from '/src/touch-controls.ts';
const asset=await new GLTFLoader().loadAsync('/models/kirby-animated.glb');
const c=new CharacterController(asset.scene,asset.animations),hud=new PlayerActionHud(),idle={forward:false,left:false,right:false};
const touch=new TouchControls(document.querySelector('canvas'),{jump(){},dash(){},attack(){},interact(){},chat(){},emote(){},orbit(){},zoom(){}});
window.hudQA={c,hud,touch,render(mode='ready',scheme='keyboard'){
 c.setActivity('Idle');c.playerDash.tick(7);c.flight.reset();c.swimming=false;c.update(.2,idle);
 document.body.classList.toggle('touch-ui',scheme==='touch');touch.setEnabled(scheme==='touch');
 if(mode==='push')c.update(.01,{...idle,attackPressed:true});
 if(mode==='jump')c.update(.01,{...idle,jumpPressed:true});
 if(mode==='flight-2'||mode==='flight-1'){c.flight.press();c.flight.update(.1);c.flight.press();c.flight.update(.5);if(mode==='flight-1')c.flight.update(1);c.state='Fly';}
 if(mode==='dash')c.update(.01,{...idle,dashPressed:true});
 if(mode==='plane'){c.flight.holdPlane();c.state='Fly';}
 hud.update(c,true,scheme,scheme==='touch'?touch:undefined);touch.setInteraction('Действие');
}};
hudQA.render();
</script></body></html>`}));
 await page.goto(new URL('__player-actions-qa',base).href);await page.waitForFunction(()=>window.hudQA);
 for(const mode of ['ready','push','jump','flight-2','flight-1','dash','plane']){
  await page.evaluate(mode=>hudQA.render(mode),mode);
  const values=await page.locator('.player-action-badge').evaluateAll(elements=>elements.map(el=>({id:el.id,key:el.querySelector('kbd').textContent,icon:el.dataset.icon,state:el.dataset.state,count:el.querySelector('strong').textContent,counterHidden:el.querySelector('strong').hidden})));
  assert.deepEqual(values.map(v=>v.key),['Q','Shift','Пробел']);
  assert.equal(values[0].count,'');assert(values[0].counterHidden);
  if(mode==='push')assert.equal(values[0].state,'cooldown');
  if(mode==='jump'){assert.equal(values[2].icon,'fly');assert(values[2].counterHidden);}
  if(mode==='flight-2')assert.equal(values[2].count,'2');
  if(mode==='flight-1')assert.equal(values[2].count,'1');
  if(mode==='plane')assert(values[2].counterHidden,'unlimited flight never displays a false countdown');
  const box=await page.locator('#player-actions-dock').boundingBox();
  await page.screenshot({path:output+`desktop-${mode}.png`,clip:{x:box.x-16,y:box.y-16,width:box.width+32,height:box.height+32}});
  report.states.push({mode,values});
 }
 await page.evaluate(()=>hudQA.render('ready','gamepad'));
 assert.deepEqual(await page.locator('#player-actions-dock kbd').allTextContents(),['X','B','A']);
 for(const viewport of [{width:320,height:568},{width:390,height:844},{width:568,height:320},{width:844,height:390}]){
  await page.setViewportSize(viewport);await page.evaluate(()=>hudQA.render('ready','touch'));
  const boxes=await Promise.all(['#touch-attack','#touch-dash','#touch-jump','#touch-stick','#touch-interact'].map(async selector=>({selector,...await page.locator(selector).boundingBox()})));
  for(const box of boxes)assert(box.width&&box.x>=0&&box.y>=0&&box.x+box.width<=viewport.width+1&&box.y+box.height<=viewport.height+1,JSON.stringify(box));
  assert(boxes[0].x+boxes[0].width<boxes[1].x&&boxes[1].x+boxes[1].width<boxes[2].x);
  assert(Math.abs(boxes[0].width-boxes[1].width)<1&&Math.abs(boxes[1].width-boxes[2].width)<1);
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];assert(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y,`${a.selector} overlaps ${b.selector}`);}
  assert.doesNotMatch(await page.locator('.touch-actions').innerText(),/Толчок|Рывок|Полёт|Прыжок/);
  assert.equal(await page.locator('.touch-actions .player-action-key:visible').count(),0);
  assert.doesNotMatch(await page.locator('.touch-actions').innerText(),/Q|Shift|Пробел/);
  await page.screenshot({path:output+`mobile-${viewport.width}.png`});report.layouts.push({viewport,boxes});
 }
 assert.deepEqual(report.errors,[]);await writeFile(output+'report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({states:report.states.length,layouts:report.layouts.length,errors:report.errors}));
}finally{await browser.close();}
