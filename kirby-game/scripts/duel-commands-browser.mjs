import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const game=fileURLToPath(new URL('../',import.meta.url)),base=process.env.GAME_URL??'http://127.0.0.1:5202';
let vite,browser;
try{
 if(!process.env.GAME_URL)vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5202','--strictPort'],{cwd:game,stdio:'ignore',windowsHide:true});
 for(let attempt=0;;attempt++){try{if((await fetch(base)).ok)break;}catch{}if(attempt>300)throw Error('Vite did not start');await new Promise(resolve=>setTimeout(resolve,200));}
 browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 for(const mobile of [false,true]){
  const page=await browser.newPage(mobile?{viewport:{width:844,height:390},isMobile:true,hasTouch:true}:{viewport:{width:1280,height:850}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.routeWebSocket('**',()=>{});
  await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
  for(const endpoint of ['room','history/solo'])await page.route('**/'+endpoint,route=>route.fulfill({json:{ok:true,players:0,occupiedVariants:[],capacity:16}}));
  await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+`
window.duelCommandQA={chat,travel:cosmicArena,renderer,get c(){return character},set online(value){networkIntent=value}};
`});});
  await page.goto(base);await page.waitForFunction(()=>window.duelCommandQA&&!document.querySelector('#start-game').disabled,undefined,{timeout:120000});
  await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Испытатель');await page.locator('#start-game').click();await page.waitForFunction(()=>duelCommandQA.c);
  const command=async(text,error=false)=>{
   await page.evaluate(()=>duelCommandQA.chat.show());await page.locator('#chat-input').fill(text);
   if(mobile)await page.locator('#chat-composer button[type=submit]').click();else await page.keyboard.press('Enter');
   assert.equal(await page.locator('#chat-command-error').isVisible(),error,text);await page.evaluate(()=>duelCommandQA.chat.close());
  };
  await command('/phase 2',true);await command('/godmode',true);
  await page.evaluate(async()=>{const q=duelCommandQA;await q.travel.enter(q.c);q.c.actor.position.set(2000,0,-2);q.c.yaw=Math.PI;q.c.actor.rotation.y=Math.PI;q.renderer.setAnimationLoop(null);});
  await command('/phase 2',true);await command('/godmode',true);
  await page.evaluate(()=>duelCommandQA.travel.startBattle());await command('/godmode');
  assert(await page.evaluate(()=>duelCommandQA.travel.godMode));assert.match(await page.locator('#cosmic-arena-caption').textContent(),/Неуязвимость/);
  for(const [phase,hp] of [[3,4],[1,12],[2,8]]){
   await command('/phase '+phase);
   assert.deepEqual(await page.evaluate(()=>{const s=duelCommandQA.travel.battle;return {phase:s.phase,hp:s.hp,stage:s.stage,player:s.players.solo.hp};}),{phase,hp,stage:'transition',player:5});
  }
  await command('/god mode',true);await command('/phase 4',true);await command('/godmode on',true);
  const protectedHit=await page.evaluate(()=>{
   const q=duelCommandQA,s=q.travel.battle,now=q.travel.soloNow;
   Object.assign(s,{stage:'slash',pattern:'sword',since:now,until:now+2000,checked:now,from:[0,0,0],to:[0,0,0],height:0,yaw:0});s.players.solo.invulnerable=0;q.c.actor.position.set(2000,0,2);
   q.step=dt=>q.travel.update(dt,performance.now()/1000,q.c,{forward:false,left:false,right:false},0,0,false,false);
   q.step(.016);return s.players.solo.hp;
  });assert.equal(protectedHit,5);
  await command('/godmode');assert.equal(await page.evaluate(()=>{duelCommandQA.step(.016);return duelCommandQA.travel.battle.players.solo.hp;}),4);
  await command('/godmode');
  const projectile=await page.evaluate(async()=>{
   const q=duelCommandQA,{KNIGHT,knightShotOrigin}=await import('/src/meta-knight-battle.ts');
   q.shot=()=>{
    const s=q.travel.battle,now=q.travel.soloNow;Object.assign(s,{stage:'shot',pattern:'crescent',step:1,since:now,until:now+10000,checked:now,from:[0,0,0],to:[0,0,20],height:0,yaw:0});delete s.shotContacts;s.players.solo.invulnerable=0;q.c.actor.position.set(2000,0,20);
    const origin=knightShotOrigin(s),contact=now+KNIGHT.shotReleaseMs+Math.hypot(s.to[0]-origin[0],s.to[2]-origin[2])/KNIGHT.projectileSpeed;
    q.travel.soloNow=contact-16;q.step(.016);return {hp:s.players.solo.hp,contact:s.shotContacts?.solo};
   };return q.shot();
  });assert.equal(projectile.hp,4);assert(projectile.contact>=0,'godmode keeps the normal reflection grace');
  await command('/godmode');assert.equal(await page.evaluate(()=>duelCommandQA.travel.battle.shotContacts.solo),-1);
  assert.equal(await page.evaluate(()=>{duelCommandQA.step(.2);return duelCommandQA.travel.battle.players.solo.hp;}),4);
  assert.equal(await page.evaluate(()=>{const q=duelCommandQA;q.shot();q.step(.2);return q.travel.battle.players.solo.hp;}),3);
  // Both the parser and the executor reject the commands in online context.
  await page.evaluate(()=>{duelCommandQA.online=true;});await command('/phase 1',true);await command('/godmode',true);
  await page.evaluate(()=>{duelCommandQA.online=false;});
  assert.deepEqual(await page.evaluate(()=>{
   const q=duelCommandQA,options=q.travel.battleOptions,original=options.online;options.online=()=>true;
   const result={phase:q.travel.setPhase(1),god:q.travel.toggleGodMode()===undefined};options.online=original;return result;
  }),{phase:false,god:true});
  await command('/godmode');await page.evaluate(()=>duelCommandQA.travel.cancelBattle());assert(!await page.evaluate(()=>duelCommandQA.travel.godMode));
  await command('/phase 1',true);await command('/godmode',true);
  for(const stage of ['won','lost']){
   await page.evaluate(()=>duelCommandQA.travel.startBattle());assert(!await page.evaluate(()=>duelCommandQA.travel.godMode));await command('/godmode');
   await page.evaluate(stage=>{const q=duelCommandQA;q.travel.battle.stage=stage;q.step(.016);},stage);
   assert(!await page.evaluate(()=>duelCommandQA.travel.godMode));await command('/phase 1',true);await command('/godmode',true);
  }
  await page.evaluate(()=>duelCommandQA.travel.startBattle());await command('/godmode');await page.evaluate(()=>duelCommandQA.travel.leave());
  assert(!await page.evaluate(()=>duelCommandQA.travel.godMode));await command('/godmode',true);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({mobile,phaseHealth:[12,8,4],godmodeToggle:true,meleeAndCrescents:true,soloDuelOnly:true,resetsOnFinishRetryAndExit:true,errors}));await page.close();
 }
}finally{await browser?.close();vite?.kill();}
