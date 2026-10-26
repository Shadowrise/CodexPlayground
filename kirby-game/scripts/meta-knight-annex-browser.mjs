import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const output=fileURLToPath(new URL('../node_modules/.cache/meta-knight-annex/',import.meta.url));await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error'&&/WebGL|THREE|shader/i.test(m.text()))errors.push(m.text());});
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
 for(const endpoint of ['room','players','history/solo'])await page.route('**/'+endpoint,r=>r.fulfill({json:{ok:true,players:0,occupiedVariants:[],capacity:14}}));
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.annexQA={THREE,travel:cosmicArena,renderer,get c(){return character}};'});});
 await page.goto(process.env.GAME_URL??'http://127.0.0.1:5194/');await page.waitForFunction(()=>!!window.annexQA,null,{timeout:180000});await page.locator('#startup-loader').waitFor({state:'hidden',timeout:180000});
 await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Звёздный мост');await page.locator('#start-game').click();await page.waitForFunction(()=>!!annexQA.c);
 const arrival=await page.evaluate(async()=>{
  const q=annexQA;await q.travel.enter(q.c);q.renderer.setAnimationLoop(null);q.site=await import('/src/meta-knight-arena-site.ts');q.rules=await import('/src/meta-knight-battle.ts');q.empty={forward:false,left:false,right:false};q.step=()=>q.travel.update(.025,1,q.c,q.empty,0,0,false,false);
  q.photo=(close=false)=>{const c=q.travel.camera;c.fov=52;c.aspect=1440/1000;c.updateProjectionMatrix();if(close){c.position.set(2036,15,64);c.lookAt(2017,4,42);}else{c.position.set(2067,72,104);c.lookAt(2006,-1,12);}c.updateMatrixWorld();q.travel.render();};
  const a=q.site.knightAnnexCoordinates(q.c.actor.position.x-2000,q.c.actor.position.z);q.photo();return {along:a.along,portal:q.travel.current.portal.working,closed:q.travel.current.annex.gate.visible};
 });assert(arrival.along>50&&arrival.portal&&!arrival.closed);await page.screenshot({path:output+'annex-open.png'});
 const crossing=await page.evaluate(()=>{const q=annexQA,a=q.site.META_KNIGHT_ANNEX;q.c.yaw=a.angle+Math.PI;q.c.actor.rotation.y=q.c.yaw;for(let i=0;i<160;i++)q.travel.update(.05,1,q.c,{...q.empty,forward:true},0,0,false,false);return q.site.knightAnnexCoordinates(q.c.actor.position.x-2000,q.c.actor.position.z);});assert(crossing.along<38,'walk from the arrival pad across the open bridge');
 const closed=await page.evaluate(()=>{
  const q=annexQA;q.c.actor.position.set(2000,0,-2);q.travel.startBattle();q.step();q.fixture=q.travel.battle;
  const a=q.site.META_KNIGHT_ARENA;for(const height of [0,8,30]){q.c.actor.position.set(a.x+a.exitX,height,a.exitZ);q.step();if(Math.hypot(q.c.actor.position.x-a.x,q.c.actor.position.z)>41.001)throw Error('Fighter bypassed closed bridge');}
  q.photo();return {portal:q.travel.current.portal.working,closed:q.travel.current.annex.gate.visible,exit:q.travel.nearExit(q.c),arena:q.travel.active};
 });assert.deepEqual(closed,{portal:true,closed:true,exit:false,arena:true});await page.screenshot({path:output+'annex-closed.png'});await page.evaluate(()=>annexQA.photo(true));await page.screenshot({path:output+'gate-close.png'});
 const dash=await page.evaluate(()=>{
  const q=annexQA,s=q.fixture,a={id:'solo',p:[39,0,13],yaw:0,available:true};Object.assign(s,{phase:2,pattern:'flight',stage:'approach',since:1000,until:1900,checked:1000,step:-1,from:[-28,0,-10],to:[-28,0,-10]});q.rules.advanceKnightBattle(s,[a],1900);q.travel.soloNow=s.since+900;q.c.actor.position.set(2039,0,13);q.travel.battleView.update(s,'solo',q.travel.soloNow,.025,false,'Q',true,false,undefined,q.travel.camera);q.photo();return {from:s.from,to:s.to,target:a.p,danger:q.rules.knightDashHalfWidth(s)};
 });assert(Math.hypot(...[dash.to[0],dash.to[2]])>42);await page.screenshot({path:output+'edge-dash-warning.png'});
 const closeShot=await page.evaluate(()=>{
  const q=annexQA,s=q.fixture,a={id:'solo',p:[0,0,1],yaw:0,available:true};Object.assign(s,{phase:1,pattern:'crescent',stage:'shot',since:10000,until:15000,checked:10000,step:1,from:[0,1.2,0],to:[0,0,1],height:1.2,yaw:0});delete s.shotContacts;s.players.solo.hp=5;s.players.solo.invulnerable=0;
  const now=10000+q.rules.KNIGHT.shotReleaseMs+20;q.rules.advanceKnightBattle(s,[a],now);q.travel.soloNow=now;q.c.actor.position.set(2000,0,1);q.travel.camera.position.set(2018,17,26);q.travel.camera.lookAt(2000,2,7);q.travel.camera.updateMatrixWorld();q.travel.battleView.update(s,'solo',now,.025,false,'Q',true,false,undefined,q.travel.camera);q.travel.render();return {contact:s.shotContacts.solo,flash:q.travel.scene.getObjectByName('Crescent launch connecting sword flash').visible};
 });assert(closeShot.contact&&closeShot.flash);await page.screenshot({path:output+'close-crescent-release.png'});
 const damage=await page.evaluate(()=>{const q=annexQA,s=q.fixture;q.rules.advanceKnightBattle(s,[{id:'solo',p:[0,0,1],yaw:0,available:true}],10420);return s.players.solo.hp;});assert.equal(damage,4);
 const spectator=await page.evaluate(()=>{
  const q=annexQA,s=q.fixture,options=q.travel.battleOptions;q.originalOptions={...options};options.online=()=>true;options.state=()=>s;options.id=()=> 'waiting';options.now=()=>10500;options.send=()=>{};
  q.c.actor.position.set(2000,0,0);q.step();const p=q.site.knightAnnexCoordinates(q.c.actor.position.x-2000,q.c.actor.position.z);q.photo(true);return {along:p.along,size:q.c.actor.scale.x,closed:q.travel.current.annex.gate.visible,portal:q.travel.current.portal.working,participant:!!s.players.waiting};
 });assert(spectator.along>=42+spectator.size-1e-6&&spectator.closed&&spectator.portal&&!spectator.participant,JSON.stringify(spectator));await page.screenshot({path:output+'spectator-outside-gate.png'});
 const exited=await page.evaluate(()=>{const q=annexQA,a=q.site.META_KNIGHT_ARENA;q.c.actor.position.set(a.x+a.exitX,0,a.exitZ);q.step();return {arena:q.travel.active,location:q.c.actor.userData.location,duel:q.fixture.stage};});assert(!exited.arena&&!exited.location);assert.equal(exited.duel,'shot','spectator portal exit must not cancel the fight');
 const late=await page.evaluate(async()=>{const q=annexQA;await q.travel.enter(q.c);q.step();const p=q.site.knightAnnexCoordinates(q.c.actor.position.x-2000,q.c.actor.position.z);return {along:p.along,closed:q.travel.current.annex.gate.visible,portal:q.travel.current.portal.working};});assert(late.along>50&&late.closed&&late.portal);
 const reopened=await page.evaluate(()=>{const q=annexQA;q.fixture.stage='cancelled';q.step();const a=q.site.knightAnnexPoint(0,40);q.c.actor.position.set(2000+a.x,0,a.z);q.step();return {along:q.site.knightAnnexCoordinates(q.c.actor.position.x-2000,q.c.actor.position.z).along,closed:q.travel.current.annex.gate.visible,portal:q.travel.current.portal.working};});assert(reopened.along<42&&!reopened.closed&&reopened.portal);
 assert.deepEqual(errors,[]);const report={arrival,crossing,closed,dash,closeShot,damage,spectator,exited,late,reopened,errors};await writeFile(output+'report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({output,...report}));
}finally{await browser.close();}
