import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const mobile=process.argv.includes('--mobile');
const output=fileURLToPath(new URL('../design/meta-knight-battle/game/'+(mobile?'mobile/':''),import.meta.url));await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--renderer-process-limit=1']});
try{
 const page=await browser.newPage(mobile?{viewport:{width:844,height:390},isMobile:true,hasTouch:true}:{viewport:{width:1440,height:900}}),errors=[];
 page.on('pageerror',e=>{errors.push(e.stack);console.error(e.stack);});page.on('console',m=>{if(m.type()==='error'&&/WebGL|THREE|shader/i.test(m.text()))errors.push(m.text());});
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');localStorage.removeItem('kirby-meta-knight-unlocked-v1');});
 for(const endpoint of ['room','players','history/solo'])await page.route('**/'+endpoint,r=>r.fulfill({json:{ok:true,players:0,occupiedVariants:[],capacity:14}}));
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.knightQA={THREE,travel:cosmicArena,renderer,unlocks:characterUnlocks,get c(){return character},get log(){return localLog},stop(){renderer.setAnimationLoop(null)},menu:returnToMenu};'});});
 await page.goto(process.env.GAME_URL??'http://127.0.0.1:5192/');await page.waitForFunction(()=>!!window.knightQA,null,{timeout:180000});await page.locator('#startup-loader').waitFor({state:'hidden',timeout:180000});
 assert(await page.evaluate(()=>knightQA.unlocks.isLocked('Meta Knight')));
 await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Звёздочка');await page.locator('#start-game').click();await page.waitForFunction(()=>!!knightQA.c);
 await page.evaluate(async()=>{const q=knightQA;q.c.resizeTo(3,true);q.c.restoreMovementSpeed(2);await q.travel.enter(q.c);q.c.actor.position.set(2000,0,-2);q.c.yaw=Math.PI;q.c.actor.rotation.y=Math.PI;});
 await page.waitForFunction(()=>knightQA.travel.active);if(mobile)await page.locator('.knight-battle-actions button').first().tap();else await page.keyboard.press('KeyE');await page.waitForFunction(()=>!!knightQA.travel.battle);
 assert.equal(await page.evaluate(()=>knightQA.c.actor.scale.x),1);assert.equal(await page.evaluate(()=>knightQA.c.savedSize),3);
 await page.evaluate(()=>knightQA.stop());
 const first=await page.evaluate(()=>{
  const q=knightQA,c=q.c,empty={forward:false,left:false,right:false,sprint:false};q.empty=empty;
  q.step=(attack=false)=>q.travel.update(.025,performance.now()/1000,c,{...empty,attack},0,0,false,false);
  q.seek=(stage)=>{for(let i=0;i<8000&&q.travel.battle.stage!==stage;i++){const s=q.travel.battle;c.actor.position.set(2026,0,22);q.step();}if(q.travel.battle.stage!==stage)throw Error('Stage not reached '+stage);};
  q.seek('slash-warn');q.travel.render();return {stage:q.travel.battle.stage,hp:q.travel.battle.hp,life:q.travel.battle.players.solo.hp};
 });assert.equal(first.hp,12);await page.screenshot({path:output+'phase-1-sword.png'});
 await page.evaluate(()=>{knightQA.seek('jump-warn');knightQA.travel.render();});await page.screenshot({path:output+'jump-warning.png'});
 // Real Q input goes through the game's controller and the shared reflection rule.
 const reflected=await page.evaluate(()=>{
  const q=knightQA,c=q.c;q.seek('shot');const s=q.travel.battle;
  const p=s.to,dx=p[0]-s.from[0],dz=p[2]-s.from[2],d=Math.hypot(dx,dz)||1;c.actor.position.set(2000+p[0]+dx/d*1.1,0,p[2]+dz/d*1.1);c.yaw=Math.atan2(-dx,-dz);c.actor.rotation.y=c.yaw;
  for(let i=0;i<32;i++)q.step();q.step(true);for(let i=0;i<16&&s.stage==='shot';i++)q.step(false);q.travel.render();return {stage:s.stage,reflects:s.players.solo.reflects,life:s.players.solo.hp};
 });assert.equal(reflected.stage,'return');assert.equal(reflected.reflects,1);await page.screenshot({path:output+'reflection.png'});
 const phases=await page.evaluate(()=>{
  const q=knightQA,c=q.c,phases=new Set();let lastAttack=-1e9,lastWarning='';
  q.playUntil=(stop)=>{for(let i=0;i<40000&&!stop();i++){
   const s=q.travel.battle,now=q.travel.soloNow;
   if(s.stage==='open'){
    const p=s.from;c.actor.position.set(2000+p[0],0,p[2]+2.5);c.yaw=Math.PI;c.actor.rotation.y=Math.PI;
    const press=now-lastAttack>750;if(press)lastAttack=now;q.step(press);
   }else{const warning=s.stage+':'+s.since;if(s.stage.endsWith('-warn')&&warning!==lastWarning){lastWarning=warning;c.actor.position.set(2000+s.from[0]+Math.cos(s.yaw)*14,0,s.from[2]-Math.sin(s.yaw)*14);}q.step(false);}
   phases.add(s.phase);
   if(s.stage==='lost')throw Error('Bot lost unexpectedly');
  }};
  q.playUntil(()=>q.travel.battle.phase===2&&q.travel.battle.stage==='dash-warn');q.travel.render();return [...phases];
 });assert(phases.includes(2));await page.screenshot({path:output+'phase-2-flight.png'});
 await page.evaluate(()=>{const q=knightQA;q.playUntil(()=>q.travel.battle.stage==='dash');for(let i=0;i<12;i++)q.step();q.travel.render();});await page.screenshot({path:output+'active-red-lane.png'});
 await page.evaluate(()=>{const q=knightQA;q.playUntil(()=>q.travel.battle.phase===3&&q.travel.battle.stage==='dash-warn');q.travel.render();});await page.screenshot({path:output+'phase-3-assault.png'});
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(100);await page.evaluate(()=>{const q=knightQA;q.step();q.travel.render();});await page.screenshot({path:output+'phase-3-portrait.png'});
 const layout=await page.locator('#knight-battle-hud').boundingBox();assert(layout.x>=0&&layout.x+layout.width<=390);
 const title=await page.locator('#knight-battle-hud strong').boundingBox(),settings=await page.locator('#settings-toggle').boundingBox();assert(title.x>=settings.x+settings.width||title.y>=settings.y+settings.height,'boss title clears the settings button');
 await page.setViewportSize(mobile?{width:844,height:390}:{width:1440,height:900});
 const won=await page.evaluate(()=>{const q=knightQA;q.playUntil(()=>q.travel.battle.stage==='won');q.step();q.travel.render();return {hp:q.travel.battle.hp,hits:q.travel.battle.players.solo.hits,unlocked:!q.unlocks.isLocked('Meta Knight'),stored:localStorage.getItem('kirby-meta-knight-unlocked-v1'),log:q.log.map(e=>e.text)};});
 assert.equal(won.hp,0);assert.equal(won.hits,12);assert(won.unlocked);assert.equal(won.stored,'1');assert(won.log.includes('Метакнайт с уважением смотрит на Звёздочка.'));await page.screenshot({path:output+'victory.png'});
 await page.locator('.knight-battle-actions button').first().click();assert.equal(await page.evaluate(()=>knightQA.travel.battle.hp),12);
 const lost=await page.evaluate(()=>{const q=knightQA,c=q.c;for(let i=0;i<20000&&q.travel.battle.stage!=='lost';i++){
  const s=q.travel.battle,p=s.from;
  if(s.stage==='slash')c.actor.position.set(2000+p[0]+Math.sin(s.yaw)*2,0,p[2]+Math.cos(s.yaw)*2);
  else if(s.stage==='wave')c.actor.position.set(2000+p[0],0,p[2]+Math.max(.2,(q.travel.soloNow-s.since)*.007));
  else c.actor.position.set(2026,0,22);
  q.step(false);
 }q.travel.render();return {stage:q.travel.battle.stage,hearts:q.travel.battle.players.solo.hp,hp:q.travel.battle.hp};});assert.equal(lost.stage,'lost');assert.equal(lost.hearts,0);assert.equal(lost.hp,12);await page.screenshot({path:output+'defeat.png'});
 await page.locator('.knight-battle-actions button').first().click();assert.equal(await page.evaluate(()=>knightQA.travel.battle.players.solo.hp),5);
 const restored=await page.evaluate(()=>{const q=knightQA;q.travel.leave();return {size:q.c.actor.scale.x,speed:q.c.savedSpeedSize,hud:!!document.querySelector('#knight-battle-hud')};});assert.deepEqual(restored,{size:3,speed:2,hud:false});
 assert.deepEqual(errors,[]);await writeFile(output+'browser-report.json',JSON.stringify({first,reflected,phases,won,lost,restored,errors},null,2));console.log(JSON.stringify({first,reflected,won,lost,restored,errors}));
}finally{await browser.close();}
