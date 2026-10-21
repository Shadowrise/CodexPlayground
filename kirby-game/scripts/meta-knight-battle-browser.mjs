import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const mobile=process.argv.includes('--mobile');
const output=process.env.META_KNIGHT_BATTLE_OUTPUT??fileURLToPath(new URL('../design/meta-knight-battle/game-v2/'+(mobile?'mobile/':''),import.meta.url));await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--renderer-process-limit=1']});
try{
 const page=await browser.newPage(mobile?{viewport:{width:844,height:390},isMobile:true,hasTouch:true}:{viewport:{width:1440,height:900}}),errors=[];
 page.on('pageerror',e=>{errors.push(e.stack);console.error(e.stack);});page.on('console',m=>{if(m.type()==='error'&&/WebGL|THREE|shader/i.test(m.text()))errors.push(m.text());});
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');localStorage.removeItem('kirby-meta-knight-unlocked-v1');});
 for(const endpoint of ['room','players','history/solo'])await page.route('**/'+endpoint,r=>r.fulfill({json:{ok:true,players:0,occupiedVariants:[],capacity:14}}));
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.knightQA={THREE,music,travel:cosmicArena,renderer,unlocks:characterUnlocks,get c(){return character},get log(){return localLog},stop(){renderer.setAnimationLoop(null);touch?.setInteraction(undefined);rideHint.textContent=""},menu:returnToMenu};'});});
 await page.goto(process.env.GAME_URL??'http://127.0.0.1:5193/');await page.waitForFunction(()=>!!window.knightQA,null,{timeout:180000});await page.locator('#startup-loader').waitFor({state:'hidden',timeout:180000});
 assert(await page.evaluate(()=>knightQA.unlocks.isLocked('Meta Knight')));
 await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Звёздочка');await page.locator('#start-game').click();await page.waitForFunction(()=>!!knightQA.c);
 await page.evaluate(async()=>{const q=knightQA;q.c.resizeTo(3,true);q.c.restoreMovementSpeed(2);await q.travel.enter(q.c);q.c.actor.position.set(2000,0,-2);q.c.yaw=Math.PI;q.c.actor.rotation.y=Math.PI;});
 await page.waitForFunction(()=>knightQA.travel.active);if(mobile)await page.locator('#touch-interact').tap();else await page.keyboard.press('KeyE');await page.waitForFunction(()=>!!knightQA.travel.battle);
 await page.waitForFunction(()=>knightQA.music.eventAudio?.readyState>=2);
 const soundtrack=await page.evaluate(()=>({active:knightQA.music.eventActive,src:knightQA.music.eventAudio.src,loop:knightQA.music.eventAudio.loop,playing:!knightQA.music.eventAudio.paused,backgroundPaused:knightQA.music.audio.paused}));assert.equal(soundtrack.active,'knight');assert(soundtrack.src.endsWith('/audio/meta-knight-duel.wav'));assert(soundtrack.loop&&soundtrack.playing&&soundtrack.backgroundPaused);
 assert.equal(await page.locator('#knight-battle-hud button').count(),0);
 if(mobile)await page.locator('#touch-interact').tap();else await page.keyboard.press('KeyE');assert(await page.evaluate(()=>knightQA.travel.engaged),'a short action press cannot end a duel');
 const beforeCancel=await page.evaluate(()=>knightQA.c.actor.position.toArray());let touchSession;
 if(mobile){const box=await page.locator('#touch-interact').boundingBox();touchSession=await page.context().newCDPSession(page);await touchSession.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2}]});}else await page.keyboard.down('KeyE');
 await page.waitForFunction(()=>knightQA.travel.cancelProgress>.35);assert(await page.evaluate(()=>knightQA.travel.engaged));if(mobile){assert.equal(await page.locator('#touch-interact').textContent(),'Прервать дуэль');assert(await page.locator('#touch-interact').evaluate(b=>parseFloat(b.style.getPropertyValue('--interaction-progress'))>35),'the held touch button fills too');}else assert((await page.locator('#action-hint').textContent()).includes('E — Прервать дуэль'));await page.screenshot({path:output+'hold-to-cancel.png'});
 await page.waitForFunction(()=>knightQA.travel.battle.stage==='cancelled');if(mobile)await touchSession.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await page.keyboard.up('KeyE');
 const cancelled=await page.evaluate(()=>({arena:knightQA.travel.active,position:knightQA.c.actor.position.toArray(),engaged:knightQA.travel.engaged,music:knightQA.music.eventActive,paused:knightQA.music.eventAudio.paused}));assert(cancelled.arena&&!cancelled.engaged&&!cancelled.music&&cancelled.paused);assert.deepEqual(cancelled.position,beforeCancel);
 if(mobile)await page.locator('#touch-interact').tap();else await page.keyboard.press('KeyE');await page.waitForFunction(()=>knightQA.travel.battle.stage==='intro');
 assert.equal(await page.evaluate(()=>knightQA.c.actor.scale.x),1);assert.equal(await page.evaluate(()=>knightQA.c.savedSize),3);
 await page.evaluate(()=>knightQA.stop());
 const first=await page.evaluate(async()=>{
  const {starDanger}=await import('/src/meta-knight-star-assault.ts');
  const q=knightQA,c=q.c,empty={forward:false,left:false,right:false,sprint:false};q.empty=empty;
  q.step=(attack=false)=>{q.travel.update(.025,performance.now()/1000,c,{...empty,attack},0,0,false,false);q.music.updateKnightPhase(q.travel.battle?.phase??1,.025);};
  let lastWarning='';q.avoid=()=>{const s=q.travel.battle,key=s.stage+':'+s.since;if((!s.stage.endsWith('-warn')&&s.stage!=='shot')||key===lastWarning)return;lastWarning=key;
   if(s.pattern==='star'){
    const future={...s,stage:s.stage==='cross-warn'?'cross':s.stage==='ricochet-warn'?'ricochet':'open',since:0,until:1000};
    for(let i=0;i<32;i++){const a=i*Math.PI/16,p=[Math.sin(a)*36,0,Math.cos(a)*36];if(!starDanger(future,p,future.stage==='open'?0:1000,future.stage==='open'?-1:0,.65)){c.actor.position.set(2000+p[0],0,p[2]);return;}}throw Error('No safe position for '+s.stage);
   }
   if(s.stage==='jump-warn'||s.stage==='dive-warn'||s.stage==='shot'){const d=Math.hypot(s.to[0],s.to[2]);c.actor.position.set(2000+(d?-s.to[0]/d*35:35),0,d?-s.to[2]/d*35:0);}else c.actor.position.set(2000+s.from[0]+Math.cos(s.yaw)*28,0,s.from[2]-Math.sin(s.yaw)*28);};
  q.seek=(stage)=>{for(let i=0;i<10000&&q.travel.battle.stage!==stage;i++){q.avoid();q.step();}if(q.travel.battle.stage!==stage)throw Error('Stage not reached '+stage);};
  q.seek('slash-warn');q.travel.render();return {stage:q.travel.battle.stage,hp:q.travel.battle.hp,life:q.travel.battle.players.solo.hp,bossScale:q.travel.knight.actor.scale.x};
 });assert.equal(first.hp,12);await page.screenshot({path:output+'phase-1-sword.png'});
 assert.equal(first.bossScale,3.3);
 const portal=await page.evaluate(async()=>{const {META_KNIGHT_ARENA:s}=await import('/src/meta-knight-arena-site.ts'),q=knightQA,p=q.c.actor.position.clone();q.c.actor.position.set(s.x+s.exitX,0,s.exitZ);q.step();const result={arena:q.travel.active,exit:q.travel.nearExit(q.c),working:q.travel.current.portal.working,gate:q.travel.current.annex.gate.visible};q.c.actor.position.copy(p);return result;});assert.deepEqual(portal,{arena:true,exit:false,working:true,gate:true},'the closed bridge blocks the fighter while the portal remains working');
 await page.evaluate(()=>{knightQA.seek('jump-warn');knightQA.travel.render();});await page.screenshot({path:output+'jump-warning.png'});
 const crescent=await page.evaluate(()=>{const q=knightQA;q.seek('shot');for(let i=0;i<16;i++)q.step();q.travel.render();const mesh=q.travel.scene.getObjectByName('Galaxia solid crescent and magical wake'),box=new q.THREE.Box3().setFromObject(mesh);return {floor:box.min.y,depth:box.max.z-box.min.z};});assert(crescent.floor>.15);await page.screenshot({path:output+'crescent-gold.png'});
 // Real Q input goes through the game's controller and the shared reflection rule.
 const reflected=await page.evaluate(async()=>{
  const {KNIGHT,knightShotOrigin}=await import('/src/meta-knight-battle.ts');
  const q=knightQA,c=q.c;const s=q.travel.battle;
  const p=s.to,origin=knightShotOrigin(s),dx=p[0]-origin[0],dz=p[2]-origin[2],d=Math.hypot(dx,dz)||1;c.actor.position.set(2000+p[0]+dx/d*1.1,0,p[2]+dz/d*1.1);c.yaw=Math.atan2(-dx,-dz);c.actor.rotation.y=c.yaw;
  const parry=KNIGHT.shotReleaseMs+(d+1.1-KNIGHT.projectileRadius)/KNIGHT.projectileSpeed-80;
  while(q.travel.soloNow-s.since<parry)q.step();q.step(true);for(let i=0;i<18&&s.stage==='shot';i++)q.step(false);q.travel.render();return {stage:s.stage,reflects:s.players.solo.reflects,life:s.players.solo.hp};
 });assert.equal(reflected.stage,'return');assert.equal(reflected.reflects,1);assert.equal(reflected.life,5,'a reflected crescent never takes a heart');await page.screenshot({path:output+'reflection.png'});
 const returned=await page.evaluate(()=>{
  const q=knightQA,s=q.travel.battle,before=s.hp;while(s.stage==='return')q.step(false);q.travel.render();
  return {before,hp:s.hp,stage:s.stage,life:s.players.solo.hp,duration:s.until-s.since,stars:q.travel.scene.getObjectByName('Meta Knight golden dizziness stars').visible,eyes:q.travel.knight.actor.getObjectByName('Duel dazed eyes').visible};
 });assert.equal(returned.before-returned.hp,1);assert.equal(returned.life,5);assert.equal(returned.stage,'stunned');assert.equal(returned.duration,1000);assert(returned.stars&&returned.eyes,'a returned crescent causes the one-second starred reaction and dazed eyes');await page.screenshot({path:output+'reflection-hit.png'});
 const phases=await page.evaluate(()=>{
  const q=knightQA,c=q.c,phases=new Set();let lastAttack=-1e9;
  q.playUntil=(stop)=>{for(let i=0;i<40000&&!stop();i++){
   const s=q.travel.battle,now=q.travel.soloNow;
   if(s.stage==='shield'){
    if(now-s.since<180){q.step(false);continue;}
    const angle=s.activeCrystal*Math.PI/4;c.actor.position.set(2000+Math.sin(angle)*42,0,Math.cos(angle)*42);c.yaw=angle;c.actor.rotation.y=angle;
    const press=now-lastAttack>750;if(press)lastAttack=now;q.step(press);
   }else if(s.stage==='open'){
    const p=s.from;c.actor.position.set(2000+p[0],0,p[2]+4.2);c.yaw=Math.PI;c.actor.rotation.y=Math.PI;
    const press=now-lastAttack>750;if(press)lastAttack=now;q.step(press);
   }else{q.avoid();q.step(false);}
   phases.add(s.phase);
   if(s.stage==='lost')throw Error('Bot lost unexpectedly at phase '+s.phase+', cycle '+s.cycle);
  }};
  q.playUntil(()=>q.travel.battle.phase===2&&q.travel.battle.stage==='dash-warn');q.travel.render();return [...phases];
 });assert(phases.includes(2));await page.screenshot({path:output+'phase-2-flight.png'});
 await page.evaluate(()=>{const q=knightQA;q.playUntil(()=>q.travel.battle.stage==='dash');for(let i=0;i<12;i++)q.step();q.travel.render();});await page.screenshot({path:output+'active-red-lane.png'});
 await page.evaluate(()=>{const q=knightQA;q.playUntil(()=>q.travel.battle.phase===3&&q.travel.battle.stage==='cross-warn');q.travel.render();});await page.screenshot({path:output+'phase-3-assault.png'});
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(100);await page.evaluate(()=>{const q=knightQA;q.step();q.travel.render();});await page.screenshot({path:output+'phase-3-portrait.png'});
 const layout=await page.locator('#knight-battle-hud').boundingBox();assert(layout.x>=0&&layout.x+layout.width<=390);
 const title=await page.locator('#knight-battle-hud strong').boundingBox(),settings=await page.locator('#settings-toggle').boundingBox();assert(title.x>=settings.x+settings.width||title.y>=settings.y+settings.height,'boss title clears the settings button');
 await page.setViewportSize(mobile?{width:844,height:390}:{width:1440,height:900});
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const aimedCamera=await page.evaluate(async()=>{const q=knightQA,T=q.THREE;q.playUntil(()=>q.travel.battle.stage==='ricochet-warn');for(let i=0;i<25;i++)q.step();q.travel.render();const {ricochetCurve,ricochetIndex}=await import('/src/meta-knight-star-assault.ts'),s=q.travel.battle,points=[q.c.actor.position.clone().add(new T.Vector3(0,1,0)),q.travel.knight.actor.position.clone().add(new T.Vector3(0,7,0)),...[0,.25,.5,.75,1].map(t=>new T.Vector3().fromArray(ricochetCurve(s,ricochetIndex(s),t)).add(new T.Vector3(2000,0,0)))];return {visible:points.map(p=>p.project(q.travel.camera).toArray()),distance:q.travel.starDistance};});assert(aimedCamera.visible.every(p=>Math.abs(p[0])<1&&Math.abs(p[1])<1&&p[2]<1),'closer camera keeps the player, boss and locked lane visible');await page.screenshot({path:output+'phase-3-curves.png'});
 await page.evaluate(()=>{const q=knightQA;q.playUntil(()=>q.travel.battle.stage==='star-warn');for(let i=0;i<25;i++)q.step();q.travel.render();});await page.screenshot({path:output+'phase-3-starfall.png'});
 assert(await page.evaluate(()=>knightQA.music.eventAudio.playbackRate>1.09));
 const won=await page.evaluate(()=>{const q=knightQA;q.playUntil(()=>q.travel.battle.stage==='won');q.step();q.travel.render();return {hp:q.travel.battle.hp,hits:q.travel.battle.players.solo.hits,unlocked:!q.unlocks.isLocked('Meta Knight'),stored:localStorage.getItem('kirby-meta-knight-unlocked-v1'),log:q.log.map(e=>e.text),bodyY:q.travel.knight.actor.getObjectByName('Body_motion').position.y,dazedEyes:q.travel.knight.actor.getObjectByName('Duel dazed eyes').visible,stars:q.travel.scene.getObjectByName('Meta Knight golden dizziness stars').visible};});
 assert.equal(won.hp,0);assert.equal(won.hits,11,'one returned crescent plus eleven melee hits win the duel');assert(won.unlocked);assert.equal(won.stored,'1');assert(won.log.includes('Метакнайт с уважением смотрит на Звёздочка.'));assert(won.bodyY<1&&won.dazedEyes&&won.stars,'the defeated boss really sits with spiral eyes and stars');await page.screenshot({path:output+'victory.png'});
 assert(await page.locator('#knight-party-hud').isVisible());assert(await page.locator('.knight-health').isHidden());assert(!(await page.locator('.knight-hint').textContent()).includes('прервана'));assert.equal(await page.evaluate(()=>knightQA.travel.controlsHint('E','Q')),'E — Завершить дуэль, Q — Ещё раз');
 assert.equal(await page.evaluate(()=>knightQA.music.eventActive),false);
 const walking=await page.evaluate(()=>{const q=knightQA,before=q.c.actor.position.clone();q.c.yaw=Math.atan2(2000-before.x,-before.z);q.c.actor.rotation.y=q.c.yaw;q.travel.update(.05,0,q.c,{forward:true,left:false,right:false,sprint:false},0,0,false,false);return q.c.actor.position.distanceTo(before);});assert(walking>.01,'winner can walk to the portal');
 await page.evaluate(()=>{knightQA.travel.interact();knightQA.step();knightQA.travel.render();});assert.equal(await page.evaluate(()=>knightQA.travel.battle.stage),'won','finishing a victory cannot turn it into cancellation');assert(await page.locator('#knight-battle-hud').isHidden());await page.screenshot({path:output+'victory-finished.png'});
 await page.evaluate(()=>{knightQA.travel.interact();knightQA.step();});assert.equal(await page.evaluate(()=>knightQA.travel.battle.hp),12);assert(await page.locator('.knight-party-hearts').isVisible());assert(await page.locator('.knight-health').isVisible());
 const lost=await page.evaluate(()=>{const q=knightQA,c=q.c;for(let i=0;i<20000&&q.travel.battle.stage!=='lost';i++){
  const s=q.travel.battle,p=s.from;
  if(s.stage==='slash')c.actor.position.set(2000+p[0]+Math.sin(s.yaw)*2,0,p[2]+Math.cos(s.yaw)*2);
  else if(s.stage==='wave')c.actor.position.set(2000+p[0],0,p[2]+Math.max(.2,(q.travel.soloNow-s.since)*.014));
  else c.actor.position.set(2026,0,22);
  q.step(false);
 }q.step(false);q.travel.render();return {stage:q.travel.battle.stage,hearts:q.travel.battle.players.solo.hp,hp:q.travel.battle.hp,pose:c.state,stars:q.travel.scene.getObjectByName('Player golden dizziness stars').visible,bodyY:c.actor.getObjectByName('Body_motion').position.y,footZ:c.actor.getObjectByName('Left_foot_pivot').position.z,dazedEyes:c.actor.getObjectByName('Duel dazed eyes').visible};});assert.equal(lost.stage,'lost');assert.equal(lost.hearts,0);assert.equal(lost.hp,12);assert.equal(lost.pose,'Sitting');assert(lost.stars&&lost.dazedEyes&&lost.bodyY<1.01&&lost.footZ>.5,'a sitting state label must also have a real seated pose and spiral eyes');await page.screenshot({path:output+'defeat.png'});
 await page.evaluate(()=>{const q=knightQA;q.travel.update(.025,0,q.c,{...q.empty,attackPressed:true},0,0,false,false);});assert.equal(await page.evaluate(()=>knightQA.travel.battle.players.solo.hp),5);
 await page.evaluate(()=>knightQA.travel.cancelBattle()); // The render loop is stopped; release through the arena API for cleanup.
 const restored=await page.evaluate(async()=>{const {META_KNIGHT_ARENA:s}=await import('/src/meta-knight-arena-site.ts'),q=knightQA;q.c.setActivity('Idle');q.c.actor.position.set(s.x+s.exitX,0,s.exitZ);q.step();return {active:q.travel.active,size:q.c.actor.scale.x,speed:q.c.savedSpeedSize,hud:!!document.querySelector('#knight-battle-hud')};});assert.deepEqual(restored,{active:false,size:3,speed:2,hud:false});
 assert.deepEqual(errors,[]);await writeFile(output+'browser-report.json',JSON.stringify({soundtrack,cancelled,crescent,first,reflected,returned,phases,won,lost,restored,errors},null,2));console.log(JSON.stringify({soundtrack,cancelled,crescent,first,reflected,returned,won,lost,restored,errors}));
}finally{await browser.close();}
