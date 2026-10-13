import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';

const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
 page.on('pageerror',e=>{errors.push(e.message);console.error(e.stack);});
 await mkdir('node_modules/.cache/push-size',{recursive:true});
 await page.addInitScript(()=>{
  localStorage.setItem('kirby-language-v1','ru');
  localStorage.setItem('kirby-tutorial-completed-v1','1');
 });
 await page.route('**/src/main.ts*',async route=>{
  const response=await route.fetch();
  await route.fulfill({response,body:(await response.text())+'\nwindow.pushSizeTest={get c(){return character},get npcs(){return npcs},get q(){return currentCentipede()},get model(){return arenaCentipede},followCamera,boatTime};'});
 });
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:5174/');
 console.log('Game page loaded');
 await page.locator('#startup-loader').waitFor({state:'hidden',timeout:120000});
 await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Толчок 700%');await page.locator('#start-game').click();
 await page.waitForFunction(()=>window.pushSizeTest.c);
 console.log('Player ready');
 for(const size of [1,.3]){
  await page.evaluate(size=>{
   const t=window.pushSizeTest,c=t.c,n=t.npcs[0];
   c.setActivity('Idle');c.resizeTo(7,true);c.actor.position.set(0,0,0);c.yaw=0;c.actor.rotation.y=0;t.followCamera.reset(0);
   for(const npc of t.npcs){npc.actor.position.set(-20,0,-20);npc.update=()=>{};}
   n.roll.reset();n.networkAnimate('Idle',0);n.actor.scale.setScalar(size);n.actor.position.set(0,0,8);
  },size);
  await page.waitForTimeout(700);await page.keyboard.press('q');
  await page.waitForFunction(()=>window.pushSizeTest.npcs[0].state==='Roll');
  console.log('NPC pushed',size);
  assert.equal(await page.evaluate(()=>window.pushSizeTest.npcs[0].health),3);
  await page.screenshot({path:`node_modules/.cache/push-size/npc-${size}.png`});
 }
 // Start through the real interaction, then expose the vulnerable drum stage.
 await page.evaluate(()=>{
  const t=window.pushSizeTest,head=t.model.startTrail(t.boatTime()).at(-1);
  t.c.setActivity('Idle');t.c.resizeTo(1,true);t.c.actor.position.set(head[0]+3,0,head[1]);
 });
 await page.waitForFunction(()=>document.querySelector('#action-hint').textContent.includes('Поиграть с Топотушкой'));
 await page.keyboard.press('e');await page.waitForFunction(()=>window.pushSizeTest.q?.stage==='invite');
 console.log('Centipede started');
 const reports=[];
 for(const {size,y,hit} of [{size:1,y:0,hit:false},{size:7,y:0,hit:true},{size:7,y:3.5,hit:true},{size:1,y:3.5,hit:true}]){
  await page.evaluate(async({size,y})=>{
   const t=window.pushSizeTest,{centipedeTarget}=await import('/src/centipede-event.ts');
   t.q.phase=2;t.q.hits=3;t.q.stage='back';t.q.stageAt=Date.now();delete t.q.chasers;
   const target=centipedeTarget(t.q),c=t.c;c.setActivity('Idle');c.resizeTo(size,true);
   c.actor.position.set(target[0],y,target[2]+(size===7&&y===0?8:1));c.yaw=Math.PI;c.actor.rotation.y=Math.PI;t.followCamera.reset(Math.PI);
  },{size,y});
  await page.waitForTimeout(750);
  const before=await page.evaluate(async()=>{
   const t=window.pushSizeTest,{centipedeTarget}=await import('/src/centipede-event.ts'),target=centipedeTarget(t.q);
   t.c.yaw=Math.atan2(target[0]-t.c.actor.position.x,target[2]-t.c.actor.position.z);t.c.actor.rotation.y=t.c.yaw;t.followCamera.reset(t.c.yaw);
   return {p:t.c.actor.position.toArray(),scale:t.c.actor.scale.x,distance:Math.hypot(t.c.actor.position.x-target[0],t.c.actor.position.z-target[2]),surface:t.c.surfaceY,state:t.c.state,yaw:t.c.yaw};
  });
  console.log('Before drum push',JSON.stringify({size,y,...before}));
  if(y>0)assert(before.surface>2.5,'the character is supported by the actual back');
  await page.screenshot({path:`node_modules/.cache/push-size/drum-${size}-${y}-before.png`});
  await page.keyboard.press('q');
  if(hit)await page.waitForFunction(()=>window.pushSizeTest.q.stage==='bell',{},{timeout:3000});
  else {await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>window.pushSizeTest.q.stage),'back');}
  reports.push({size,y,hit,...before});
  console.log('Drum checked',JSON.stringify(reports.at(-1)));
 }
 assert.deepEqual(errors,[]);
 console.log('PASS real Q pushes at 700% against 100%/30% NPCs, grounded/back drum and normal-size height guard',JSON.stringify(reports));
}finally{await browser.close();}
