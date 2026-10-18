import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const output=fileURLToPath(new URL('../node_modules/.cache/duel-dazed/',import.meta.url));await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error'&&/WebGL|THREE|shader/i.test(m.text()))errors.push(m.text());});
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
 for(const endpoint of ['room','players','history/solo'])await page.route('**/'+endpoint,r=>r.fulfill({json:{ok:true,players:0,occupiedVariants:[],capacity:14}}));
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.dazeQA={THREE,CharacterController,applyActor,actorState,travel:cosmicArena,renderer,get c(){return character},get model(){return loadedModel}};'});});
 await page.goto(process.env.GAME_URL??'http://127.0.0.1:5194/');await page.waitForFunction(()=>!!window.dazeQA,null,{timeout:180000});await page.locator('#startup-loader').waitFor({state:'hidden',timeout:180000});
 await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Звёздочки');await page.locator('#start-game').click();await page.waitForFunction(()=>!!dazeQA.c);
 const defeated=await page.evaluate(async()=>{
  const q=dazeQA;await q.travel.enter(q.c);q.renderer.setAnimationLoop(null);q.c.actor.position.set(2000,0,-2);q.travel.startBattle();q.fixture=q.travel.battle;
  Object.assign(q.fixture,{stage:'lost',since:q.travel.soloNow,until:q.travel.soloNow+1e12});q.fixture.players.solo.hp=0;q.c.actor.position.set(2010,0,8);q.c.yaw=0;q.c.actor.rotation.y=0;q.empty={forward:false,left:false,right:false,sprint:false};
  q.stats=c=>({state:c.state,bodyY:c.actor.getObjectByName('Body_motion').position.y,feet:['Left','Right'].map(side=>c.actor.getObjectByName(side+'_foot_pivot').position.toArray()),eyes:c.actor.getObjectByName('Duel dazed eyes')?.visible,nativeEyes:c.actor.getObjectByName('Left_eyelid_pivot')?.visible});
  q.photo=(c,boss=false)=>{const p=c.actor.position,cam=q.travel.camera,scale=boss?3.3:1;cam.position.set(p.x+2.3*scale,p.y+1.7*scale,p.z+5.6*scale);cam.lookAt(p.x,p.y+1.4*scale,p.z);cam.updateMatrixWorld();q.travel.render();};
  q.travel.update(1/60,1,q.c,q.empty,0,0,false,false);const atRest=q.c.actor.position.clone();for(let i=0;i<90;i++)q.travel.update(1/60,1,q.c,{...q.empty,forward:true,jump:true,attack:true},0,0,false,false);q.photo(q.c);return {...q.stats(q.c),moved:q.c.actor.position.distanceTo(atRest),stars:q.travel.scene.getObjectByName('Player golden dizziness stars').visible};
 });assert(defeated.state==='Sitting'&&defeated.bodyY<1.01&&defeated.feet.every(p=>p[2]>.5)&&defeated.eyes&&!defeated.nativeEyes&&defeated.stars);assert.equal(defeated.moved,0);await page.screenshot({path:output+'player-defeat.png'});
 const boss=await page.evaluate(()=>{
  const q=dazeQA,s=q.fixture;s.players.solo.hp=5;Object.assign(s,{stage:'won',phase:3,hp:0,pattern:'star',since:q.travel.soloNow,until:q.travel.soloNow+1e12,from:[0,0,0],to:[0,0,0]});q.travel.update(.025,1,q.c,q.empty,0,0,false,false);q.photo(q.travel.knight,true);
  return {bodyY:q.travel.knight.actor.getObjectByName('Body_motion').position.y,eyes:q.travel.knight.actor.getObjectByName('Duel dazed eyes').visible,nativeEyes:q.travel.knight.actor.getObjectByName('Eyes_glow').visible,stars:q.travel.scene.getObjectByName('Meta Knight golden dizziness stars').visible};
 });assert(boss.bodyY<1&&boss.eyes&&!boss.nativeEyes&&boss.stars);await page.screenshot({path:output+'boss-defeat.png'});
 const remote=await page.evaluate(async()=>{
  const q=dazeQA,{cloneVariant,KIRBY_VARIANTS}=await import('/src/variants.ts');
  q.remote=new q.CharacterController(cloneVariant(q.model.scene,KIRBY_VARIANTS[2],false),q.model.animations);q.remote.actor.position.set(2014,0,8);q.remote.actor.userData.location='meta-knight-arena';q.fixture.players.remote={hp:0,invulnerable:0,attackAt:0,handled:0,hits:0,reflects:0};
  const old=q.actorState(q.remote,'Друг',2);old.location='meta-knight-arena';old.state='Idle';for(let i=0;i<30;i++){q.applyActor(q.remote,old,1/60,true);q.travel.routeRemotes([['remote',q.remote]]);}q.photo(q.remote);
  return {...q.stats(q.remote),stars:q.travel.scene.getObjectByName('Remote player golden dizziness stars').visible};
 });assert(remote.state==='Sitting'&&remote.bodyY<1.01&&remote.eyes&&!remote.nativeEyes&&remote.stars);await page.screenshot({path:output+'remote-defeat.png'});
 const open=await page.evaluate(()=>{const q=dazeQA,s=q.fixture;Object.assign(s,{stage:'open',phase:1,hp:11,pattern:'sword',since:q.travel.soloNow,until:q.travel.soloNow+4000});q.travel.update(.1,1,q.c,q.empty,0,0,false,false);q.photo(q.travel.knight,true);return {eyes:q.travel.knight.actor.getObjectByName('Duel dazed eyes').visible,nativeEyes:q.travel.knight.actor.getObjectByName('Eyes_glow').visible,stars:q.travel.scene.getObjectByName('Meta Knight golden dizziness stars').visible};});assert(!open.eyes&&open.nativeEyes&&!open.stars);await page.screenshot({path:output+'open-without-dizziness.png'});
 const retry=await page.evaluate(()=>{const q=dazeQA;q.fixture.stage='lost';q.fixture.players.solo.hp=0;q.travel.update(.025,1,q.c,q.empty,0,0,false,false);q.travel.startBattle();for(let i=0;i<12;i++)q.travel.update(.025,1,q.c,q.empty,0,0,false,false);q.travel.routeRemotes([['remote',q.remote]]);return {...q.stats(q.c),hp:q.travel.battle.players.solo.hp,stars:q.travel.scene.getObjectByName('Player golden dizziness stars').visible,remoteEyes:q.remote.actor.getObjectByName('Duel dazed eyes').visible};});assert(retry.hp===5&&!retry.eyes&&retry.nativeEyes&&!retry.stars&&!retry.remoteEyes);assert(retry.feet.every(p=>p[2]<.3));
 assert.deepEqual(errors,[]);const report={defeated,boss,remote,open,retry,errors};await writeFile(output+'report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({output,...report}));
}finally{await browser.close();}
