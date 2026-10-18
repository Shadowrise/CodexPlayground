import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const game=fileURLToPath(new URL('../',import.meta.url)),base=process.env.GAME_URL??'http://127.0.0.1:5201';
let vite,browser;
try{
 if(!process.env.GAME_URL)vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5201','--strictPort'],{cwd:game,stdio:'ignore',windowsHide:true});
 for(let attempt=0;;attempt++){try{if((await fetch(base)).ok)break;}catch{}if(attempt>300)throw Error('Vite did not start');await new Promise(resolve=>setTimeout(resolve,200));}
 browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 for(const mobile of [false,true]){
  const context=await browser.newContext(mobile?{viewport:{width:844,height:390},isMobile:true,hasTouch:true}:{viewport:{width:1280,height:850}});
  const page=await context.newPage(),errors=[],arenaRequests=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
  page.on('request',request=>{if(/\/src\/meta-knight-arena\.ts(?:\?|$)/.test(request.url()))arenaRequests.push(request.url());});
  await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
  for(const endpoint of ['room','history/solo'])await page.route('**/'+endpoint,route=>route.fulfill({json:{ok:true,players:0,occupiedVariants:[],capacity:16}}));
  await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+`
window.arenaSaveQA={chat,travel:cosmicArena,portal:meadowPortal,get c(){return character},get playing(){return playing}};
`});});
  await page.goto(base);await page.waitForFunction(()=>window.arenaSaveQA&&!document.querySelector('#start-game').disabled,undefined,{timeout:120000});
  const press=async selector=>{if(mobile)await page.locator(selector).tap();else await page.locator(selector).click();};
  const start=async(load=false)=>{await press(load?'#load-game':'#new-game');if(!load){await page.locator('#player-name-input').fill('Хранитель');await press('#start-game');}await page.waitForFunction(()=>arenaSaveQA.playing&&arenaSaveQA.c);};
  const command=async text=>{await page.evaluate(()=>arenaSaveQA.chat.show());await page.locator('#chat-input').fill(text);if(mobile)await page.locator('#chat-composer button[type=submit]').click();else await page.keyboard.press('Enter');assert(await page.locator('#chat-command-error').isHidden());await page.evaluate(()=>arenaSaveQA.chat.close());};
  const save=async()=>{await press('#settings-toggle');await press('#save-game');return page.evaluate(()=>JSON.parse(localStorage.getItem('kirby-save-v1')));};
  const exit=async()=>{await press('#exit-to-menu');await page.locator('#startup-menu').waitFor({state:'visible'});};
  await start();
  for(const open of [true,false]){
   await command('/portal '+Number(open));const saved=await save();assert.deepEqual(saved.portal,{open,override:open});await exit();await start(true);
   assert.equal(await page.evaluate(()=>arenaSaveQA.portal.working),open);assert(await page.locator('#character-select').isHidden());
  }
  assert.equal(arenaRequests.length,0,'saving and loading on the meadow must keep the arena lazy');
  await command('/portal 1');
  await page.evaluate(()=>{const q=arenaSaveQA,p=q.portal.group.position;q.c.setActivity('Idle');q.c.actor.position.set(p.x,0,p.z);});
  await page.waitForFunction(()=>arenaSaveQA.travel.active,undefined,{timeout:90000});
  assert.equal(arenaRequests.length,1);
  await page.evaluate(()=>{
   const q=arenaSaveQA,c=q.c;c.resizeTo(3,true);c.eatFruit();c.eatFruit();c.actor.position.set(2008,0,-12);c.yaw=.6;c.actor.rotation.y=.6;q.travel.startBattle();
  });
  await page.waitForFunction(()=>arenaSaveQA.travel.engaged);
  await command('/portal 0');const arenaSave=await save();
  assert.deepEqual(arenaSave.portal,{open:false,override:false});assert.equal(arenaSave.player.location,'meta-knight-arena');
  assert.equal(arenaSave.player.x,2008);assert.equal(arenaSave.player.z,-12);assert.equal(arenaSave.player.yaw,.6);assert.equal(arenaSave.player.size,3);
  await exit();
  for(const reload of [false,true]){
   if(reload){await page.reload();await page.waitForFunction(()=>window.arenaSaveQA&&!document.querySelector('#load-game').disabled,undefined,{timeout:120000});}
   await start(true);await page.waitForFunction(()=>arenaSaveQA.travel.active,undefined,{timeout:90000});
   const loaded=await page.evaluate(()=>{const q=arenaSaveQA,c=q.c;return {location:c.actor.userData.location,arenaParent:c.actor.parent===q.travel.scene,x:c.actor.position.x,z:c.actor.position.z,yaw:c.yaw,size:c.savedSize,fruits:c.fruitsEaten,open:q.portal.working};});
   assert.deepEqual(loaded,{location:'meta-knight-arena',arenaParent:true,x:2008,z:-12,yaw:.6,size:3,fruits:2,open:false});
   assert(await page.locator('#character-select').isHidden());
   await page.evaluate(()=>arenaSaveQA.travel.leave());assert.equal(await page.evaluate(()=>arenaSaveQA.c.actor.userData.location),undefined);
   assert.equal(await page.evaluate(()=>arenaSaveQA.portal.working),false);
   await press('#settings-toggle');await exit();
  }
  await start();assert.equal(await page.evaluate(()=>arenaSaveQA.portal.working),false);assert(!await page.evaluate(()=>arenaSaveQA.travel.active));
  assert.deepEqual(errors,[]);console.log(JSON.stringify({mobile,portalBothStates:true,arenaInPageAndReload:true,positionAndProgress:true,duelSizeRestored:true,errors}));await context.close();
 }
}finally{await browser?.close();vite?.kill();}
