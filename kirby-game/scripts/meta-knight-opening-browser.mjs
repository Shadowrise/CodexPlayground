import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const output=fileURLToPath(new URL('../node_modules/.cache/meta-knight-opening/',import.meta.url));await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error'&&/WebGL|THREE|shader/i.test(m.text()))errors.push(m.text());});
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
 for(const endpoint of ['room','players','history/solo'])await page.route('**/'+endpoint,r=>r.fulfill({json:{ok:true,players:0,occupiedVariants:[],capacity:14}}));
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.openingQA={THREE,travel:cosmicArena,renderer,pillowView:centipedeView,get c(){return character}};'});});
 await page.goto(process.env.GAME_URL??'http://127.0.0.1:5194/');await page.waitForFunction(()=>!!window.openingQA,null,{timeout:180000});await page.locator('#startup-loader').waitFor({state:'hidden',timeout:180000});
 await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Момент удара');await page.locator('#start-game').click();await page.waitForFunction(()=>!!openingQA.c);
 await page.evaluate(async()=>{
  const q=openingQA;await q.travel.enter(q.c);q.renderer.setAnimationLoop(null);q.rules=await import('/src/meta-knight-battle.ts');q.shield=await import('/src/meta-knight-shield.ts');q.a={id:'solo',p:[0,0,6],yaw:Math.PI,available:true};
  q.s=q.rules.startKnightBattle([{...q.a,p:[0,0,-2]}],'solo',1000);Object.assign(q.s,{pattern:'leap',stage:'jump',step:1,since:10000,until:10850,checked:10000,from:[-4,0,-6],to:[0,0,0],height:0});q.travel.soloBattle=q.s;q.c.actor.position.set(2000,0,6);
  q.pose=(now,crystal=false)=>{const s=q.s,cam=q.travel.camera;if(crystal){const p=q.shield.crystalPoint(s.activeCrystal);cam.position.set(2000+p[0]+12,12,p[2]+17);cam.lookAt(2000+p[0],3.2,p[2]);}else{cam.position.set(2018,13,25);cam.lookAt(2000,3,0);}cam.updateMatrixWorld();q.travel.battleView.update(s,'solo',now,.025,false,'Q',true,false,undefined,cam);q.travel.render();
   const target=q.travel.scene.getObjectByName(crystal?'Violet crystal available hit target':'Meta Knight available hit target');return {stage:s.stage,bodyY:q.travel.knight.actor.getObjectByName('Body_motion').position.y,footZ:q.travel.knight.actor.getObjectByName('Left_foot_pivot').position.z,visible:target.visible,position:target.position.toArray(),scale:target.scale.x,progress:target.getObjectByName('Available target window countdown').material.uniforms.progress.value,stars:q.travel.scene.getObjectByName('Meta Knight golden dizziness stars').visible};};
 });
 await page.evaluate(()=>openingQA.pose(10830));await page.screenshot({path:output+'just-before-landing.png'});
 const landing=await page.evaluate(()=>{const q=openingQA;q.rules.advanceKnightBattle(q.s,[q.a],10850);return q.pose(10850);});assert.equal(landing.stage,'open');assert(landing.bodyY<.95&&landing.footZ<.4&&landing.visible&&!landing.stars);assert.equal(landing.progress,0);await page.screenshot({path:output+'landing-first-frame.png'});
 const timers=[];for(const [elapsed,expected] of [[1000,.25],[2000,.5],[3000,.75],[3999,.99975]]){const state=await page.evaluate(elapsed=>openingQA.pose(10850+elapsed),elapsed);assert(Math.abs(state.progress-expected)<1e-8);timers.push(state);if(elapsed===1000||elapsed===3000)await page.screenshot({path:output+'opening-'+elapsed+'.png'});}
 const hit=await page.evaluate(()=>{const q=openingQA;q.a.p=[0,0,3];q.rules.knightAttack(q.s,q.a,10850);q.rules.advanceKnightBattle(q.s,[q.a],10990);const state=q.pose(10990);return {...state,hp:q.s.hp};});assert.equal(hit.hp,11);assert.equal(hit.stage,'stunned');assert(!hit.visible&&hit.stars);
 const crystal=await page.evaluate(()=>{const q=openingQA;Object.assign(q.s,{phase:3,hp:4,pattern:'star',stage:'shield',step:13,since:20000,until:1e12,checked:20000,from:[0,0,0],to:[0,0,0],activeCrystal:6,brokenCrystals:0});const state=q.pose(21500,true),gem=q.travel.scene.getObjectByName('Star assault crystal 6');return {...state,gem:gem.position.toArray(),gemScale:gem.scale.y};});assert(crystal.visible&&crystal.scale>2.5&&Math.abs(crystal.position[1]-crystal.gem[1])<1);assert.equal(crystal.progress,-1,'the crystal remains available until struck');await page.screenshot({path:output+'crystal-surrounding-ring.png'});
 const pillow=await page.evaluate(async()=>{
  const q=openingQA,T=q.THREE,{CENTIPEDE_TIMES}=await import('/src/centipede-event.ts'),trail=Array.from({length:12},(_,i)=>[140,-45-i*1.6875]),s={startedAt:1000,stage:'back',stageAt:30000,cycle:1,hits:3,phase:2,trail,from:[140,-45],control:[140,-45],to:[140,-45],players:{}};
  const values=[];for(const stage of ['exhausted','back','dizzy'])for(const f of [.25,.5,.75]){s.stage=stage;q.pillowView.update(s,'solo',30000+CENTIPEDE_TIMES[stage]*f,new T.Vector3(140,0,-45),true,'Q',q.travel.camera,0,new T.Vector3(140,2,-45));values.push(q.pillowView.group.getObjectByName('Available target window countdown').material.uniforms.progress.value);}
  q.pillowView.update(undefined,'solo',30000,new T.Vector3(140,0,-45),false,'Q');return values;
 });assert.deepEqual(pillow,[.25,.5,.75,.25,.5,.75,.25,.5,.75]);
 assert.deepEqual(errors,[]);const report={landing,timers,hit,crystal,pillow,errors};await writeFile(output+'report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({output,...report}));
}finally{await browser.close();}
